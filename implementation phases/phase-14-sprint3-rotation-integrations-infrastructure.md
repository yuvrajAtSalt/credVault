# VaultStack — Phase 14 (Sprint 3): Automated Rotation, Integrations & Infrastructure Layer

> Prerequisite: Phase 14 Sprint 2 complete. Security policies, CLI, Slack, and analytics working.
>
> This sprint contains the features that move VaultStack from a team tool to an infrastructure
> layer — automated rotation removes the human dependency from credential lifecycle management,
> SSO unlocks enterprise adoption, CI/CD integration eliminates the .env file from deployments,
> and the SDK libraries enable runtime secret fetching for applications.

---

## Overview of systems added in this sprint

1. **Automated secret rotation engine** — rotate AWS IAM, Postgres, MongoDB, and GitHub tokens before expiry without human intervention
2. **Credential dependency map** — document and visualise which services use which credentials
3. **CI/CD pipeline integration** — GitHub Actions, GitLab CI, and Jenkins can fetch credentials at deploy time
4. **SSO / SAML login** — Google Workspace, Azure AD, and Okta as identity providers
5. **Anomaly detection on audit log** — automated alerts for unusual access patterns
6. **Compliance readiness score** — SOC 2, ISO 27001 control mapping with live readiness percentage
7. **Local dev secrets injection** — a background agent that injects secrets into local processes without .env files
8. **SDK libraries** — `@vaultstack/node`, `@vaultstack/python`, and `@vaultstack/go` for runtime secret fetching

---

## Part 1 — Automated secret rotation engine

### 1a. What it is

A credential has an `expiresAt` date. Today, a human must remember to rotate it before that date. This feature eliminates the human dependency — for supported provider types, VaultStack rotates the credential, stores the new value, and notifies the team completely unattended.

### 1b. Supported rotation providers (v1)

| Provider | What gets rotated | API used |
|---|---|---|
| AWS IAM Access Keys | `access_key_id` + `secret_access_key` pair | AWS SDK — CreateAccessKey + DeleteAccessKey |
| PostgreSQL | User password | pg client — ALTER USER ... PASSWORD |
| MongoDB | User password | MongoDB driver — updateUser |
| GitHub Personal Access Token | Token | GitHub REST API — token rotation endpoint |
| Generic webhook | POST to a configured URL — the external service handles rotation | HTTP |

### 1c. New model: `models/RotationConfig.ts`

```ts
{
  credentialId: ObjectId (ref: Credential, required),  // the primary credential being rotated
  projectId: ObjectId (ref: Project, required),
  organisationId: ObjectId (ref: Organisation, required),

  provider: String (enum: ['aws_iam','postgres','mongodb','github_token','webhook'], required),
  isEnabled: Boolean (default: false),

  // Provider-specific config — stored encrypted
  providerConfig: {
    // AWS IAM:
    awsRegion: String,
    awsAccessKeyIdCredentialId: ObjectId,   // points to the Access Key ID credential
    awsSecretKeyCredentialId: ObjectId,      // points to the Secret Key credential
    iamUsername: String,

    // PostgreSQL / MongoDB:
    hostCredentialId: ObjectId,             // which credential holds the host URL
    adminUserCredentialId: ObjectId,        // which credential holds admin credentials
    targetUsername: String,

    // GitHub token:
    githubTokenCredentialId: ObjectId,

    // Webhook:
    webhookUrl: String,
    webhookSecret: String (encrypted),
    webhookPayloadTemplate: String,         // JSON template with {{currentValue}} placeholder
  },

  rotationSchedule: {
    type: String (enum: ['before_expiry','cron']),
    daysBeforeExpiry: Number (default: 7),  // rotate N days before expiresAt
    cronExpression: String (nullable),       // for custom schedule
  },

  // Rotation results
  lastRotatedAt: Date (nullable),
  lastRotationStatus: String (enum: ['success','failed','pending'], nullable),
  lastRotationError: String (nullable),
  nextRotationAt: Date (nullable),          // computed: expiresAt - daysBeforeExpiry

  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: credentialId, organisationId, nextRotationAt, isEnabled
```

### 1d. Rotation engine (`lib/rotation/`)

```
lib/rotation/
  index.ts           — orchestrator: finds due rotations, runs them
  providers/
    aws-iam.ts       — AWS IAM key rotation
    postgres.ts      — PostgreSQL password rotation
    mongodb.ts       — MongoDB password rotation
    github-token.ts  — GitHub PAT rotation
    webhook.ts       — Generic webhook rotation
  utils.ts           — password generation, retry logic
```

**Password generation utility:**
```ts
export function generateSecurePassword(length = 32): string {
  // Uses crypto.randomBytes — guaranteed cryptographically random
  // Character set: uppercase + lowercase + digits + safe special chars
  // Avoids ambiguous characters (0/O, 1/l/I) for human-readable passwords
}
```

**Provider interface:**
```ts
interface RotationProvider {
  rotate(config: RotationConfig, currentValues: Record<string, string>): Promise<{
    newValues: Record<string, string>;   // credentialId → new plaintext value
    metadata?: Record<string, unknown>;  // provider-specific info to log
  }>;
}
```

**AWS IAM rotation (`providers/aws-iam.ts`):**
```ts
import { IAMClient, CreateAccessKeyCommand, DeleteAccessKeyCommand } from '@aws-sdk/client-iam';

export const awsIamProvider: RotationProvider = {
  async rotate(config, currentValues) {
    const iam = new IAMClient({ region: config.providerConfig.awsRegion,
      credentials: {
        accessKeyId: currentValues[config.providerConfig.awsAccessKeyIdCredentialId],
        secretAccessKey: currentValues[config.providerConfig.awsSecretKeyCredentialId],
      }
    });
    // 1. Create new key pair
    const { AccessKey } = await iam.send(new CreateAccessKeyCommand({
      UserName: config.providerConfig.iamUsername
    }));
    // 2. Return new values
    return {
      newValues: {
        [config.providerConfig.awsAccessKeyIdCredentialId]: AccessKey.AccessKeyId,
        [config.providerConfig.awsSecretKeyCredentialId]: AccessKey.SecretAccessKey,
      }
    };
    // Note: Delete old key in a separate step AFTER new values are confirmed saved
    // This prevents a window where both old and new are gone
  }
};
```

Install AWS SDK: `npm install @aws-sdk/client-iam`

**Orchestrator (`lib/rotation/index.ts`):**
```ts
export async function runDueRotations(orgId?: string): Promise<RotationResult[]> {
  const dueConfigs = await RotationConfig.find({
    isEnabled: true,
    nextRotationAt: { $lte: new Date() },
    lastRotationStatus: { $ne: 'pending' },
    ...(orgId ? { organisationId: orgId } : {})
  });

  return Promise.allSettled(dueConfigs.map(async (config) => {
    // 1. Mark as pending (prevents concurrent runs)
    await RotationConfig.findByIdAndUpdate(config._id, { lastRotationStatus: 'pending' });
    try {
      // 2. Fetch current values of all involved credentials (decrypt)
      // 3. Call the provider.rotate()
      // 4. Save new values to VaultStack (triggers versioning — old values preserved)
      // 5. Update nextRotationAt
      // 6. Send success notifications + email
      // 7. Write AuditLog 'credential.auto_rotated'
    } catch (err) {
      // 8. Save error, set lastRotationStatus = 'failed'
      // 9. Send failure alert to sysadmin + project manager
      // 10. Write AuditLog 'rotation.failed'
    }
  }));
}
```

### 1e. Rotation cron: `GET /api/cron/run-rotations`

Schedule: `"0 3 * * *"` — 3am UTC daily.

Also add: `GET /api/cron/compute-next-rotation-dates` — runs daily to update `nextRotationAt` for all configs based on the credential's `expiresAt`.

### 1f. API routes

#### `GET /api/projects/:id/credentials/:credId/rotation-config`
Returns the rotation config for a credential if one exists.

#### `POST /api/projects/:id/credentials/:credId/rotation-config`
Create a rotation config. Manager or sysadmin only.

#### `PATCH /api/projects/:id/credentials/:credId/rotation-config`
Update config. Enable/disable rotation.

#### `POST /api/projects/:id/credentials/:credId/rotate-now`
Trigger an immediate manual rotation. Manager or sysadmin.
Useful for: testing the config, responding to a security event.

### 1g. UI

**Credential row** — a `[⟳ auto-rotate]` badge appears when rotation is configured and enabled. A `[⟳ failed]` red badge when `lastRotationStatus = 'failed'`.

**Rotation config panel** — accessible from the credential's settings/edit view:

```
Automatic rotation

[Toggle: Enabled ●]
Provider:     [AWS IAM Access Key ▾]
IAM Username: [_______________]
Linked credentials:
  Access Key ID  →  [Select credential ▾]
  Secret Key     →  [Select credential ▾]

Schedule:
  [Rotate N days before expiry ●]  N: [7]
  [Custom cron ○]

Last rotation: 28 Mar 2025 — Success
Next rotation: 10 Apr 2025 (in 0 days)

[Test configuration]  [Rotate now]
```

"Test configuration" → validates that the provider config is correct by attempting a dry run (read-only check, no actual rotation).

---

## Part 2 — Credential dependency map

### 2a. What it is

Before rotating the production database password, a team needs to know every service, job, and CI pipeline that uses it. This knowledge lives scattered across config files and people's heads. The dependency map is a manually curated graph — teams document "this credential is used by these services" so rotation impact is always visible.

### 2b. Model update: `models/Credential.ts`

```ts
dependents: [{
  label: String (required),        // e.g. "Web application", "Background worker", "GitHub Actions CI"
  type: String (enum: ['service','job','pipeline','script','external'], default: 'service'),
  description: String (nullable),  // one-line context
  repoUrl: String (nullable),      // link to the repo or config file
  addedBy: ObjectId (ref: User),
  addedAt: Date,
}]
```

### 2c. UI

**Dependency section** — below the credential row (in expanded view), alongside the comments section:

```
Dependents (3 services use this credential)
  [service]   Web application          apps/web — reads from env at startup      [Remove]
  [job]       DB backup job            cron/backup.sh:L42                        [Remove]
  [pipeline]  GitHub Actions deploy    .github/workflows/deploy.yml              [Remove]

[+ Add dependent]
```

**Pre-rotation checklist** — when manually triggering rotation (`rotate-now`) or when auto-rotation fires, if `dependents.length > 0`, show a confirmation step:

```
Before rotating — impact assessment

This credential is used by 3 services:
  ● Web application
  ● DB backup job
  ● GitHub Actions deploy

After rotation, these services will need the new credential.
Auto-rotation will update the value in VaultStack, but each
service must be redeployed or restarted to pick up the change.

[Cancel]   [Proceed with rotation]
```

---

## Part 3 — CI/CD pipeline integration

### 3a. What it is

The `.env` file for production is either committed to the repo (a security disaster) or manually copied to the server before deploy (a process disaster). CI/CD integration lets pipelines fetch the credentials they need at deploy time via a scoped API token — never storing them in the repo, never requiring human intervention.

### 3b. Scoped deploy tokens

New concept: a **deploy token** is a read-only API token scoped to a specific project + environment. It can only fetch env variables for that scope — nothing else.

Add to `models/Project.ts`:
```ts
deployTokens: [{
  tokenHash: String,
  label: String,             // e.g. "GitHub Actions — Production", "Vercel deploy"
  environment: String,       // which environment this token can read
  lastUsedAt: Date (nullable),
  createdAt: Date,
  createdBy: ObjectId (ref: User),
  expiresAt: Date (nullable),
  isActive: Boolean (default: true),
}]
```

### 3c. API routes

#### `POST /api/projects/:id/deploy-tokens`
Manager or sysadmin. Creates a deploy token. Returns raw token once.

#### `GET /api/projects/:id/deploy-tokens`
Lists tokens (hash and metadata only — raw token never shown again).

#### `DELETE /api/projects/:id/deploy-tokens/:tokenId`
Revoke a token.

#### `GET /api/deploy/env` — the CI/CD fetch endpoint
Authentication: `Authorization: Bearer <deploy_token>` header only (no session).
Returns all non-deleted env variables for the token's scoped environment in flat key-value format:

```json
{
  "DATABASE_URL": "postgresql://...",
  "AWS_ACCESS_KEY_ID": "AKIA...",
  "STRIPE_SECRET_KEY": "sk_live_..."
}
```

This endpoint intentionally decrypts and returns plaintext — that is its purpose. The deploy token's scope limits what it can access. Every call is logged to AuditLog: `envvar.ci_fetch` with `meta: { tokenLabel, environment, keyCount, ip }`.

Rate limit: 100 calls per hour per token (deploys should not be polling).

### 3d. CI/CD integration guides

Create documentation in `docs/integrations/`:

**`docs/integrations/github-actions.md`:**
```yaml
# .github/workflows/deploy.yml
- name: Fetch environment variables
  run: |
    curl -s -H "Authorization: Bearer ${{ secrets.VAULTSTACK_TOKEN }}" \
      https://api.yourapp.com/api/deploy/env > .env
  env:
    VAULTSTACK_TOKEN: ${{ secrets.VAULTSTACK_TOKEN }}
```

**`docs/integrations/gitlab-ci.md`:**
```yaml
fetch-env:
  script:
    - curl -s -H "Authorization: Bearer $VAULTSTACK_TOKEN"
        https://api.yourapp.com/api/deploy/env > .env
```

**Vercel integration** — Vercel has its own env var system. Document how to use Vercel's build hooks to pull from VaultStack into Vercel environment variables via their API.

### 3e. UI

**Deploy tokens page** — on the project settings tab, add a "Deploy tokens" section:

```
Deploy tokens (CI/CD integration)
─────────────────────────────────────────────────────────────
  GitHub Actions — Production   staging env   Active   Used 2h ago   [Revoke]
  Vercel — Production           production    Active   Used 12m ago  [Revoke]
─────────────────────────────────────────────────────────────
[+ Generate deploy token]
```

Generate deploy token modal:
```
Label:        [GitHub Actions — Production]
Environment:  [production ▾]
Expires:      [Never ●] [Date ○]

[Cancel]   [Generate token]
```

On generation, show the token in a copyable code block with setup instructions:

```
Your deploy token (shown once):
[eyJh... ━━━━━━━━━━━━━━━━━━━━━━━━ ⎘]

Add this to your CI/CD secrets as VAULTSTACK_TOKEN.
Then add this step to your pipeline:

curl -H "Authorization: Bearer $VAULTSTACK_TOKEN" \
  https://api.yourapp.com/api/deploy/env > .env
```

---

## Part 4 — SSO / SAML login

### 4a. What it is

Every tool with its own password is a security liability and a support burden. When an employee leaves, the offboarding checklist must manually deactivate accounts in every tool. SSO means deactivating someone in Google Workspace or Azure AD instantly revokes their VaultStack access. It is also the feature that unlocks enterprise sales — large organisations will not adopt tools without SSO.

### 4b. Install: `npm install passport passport-saml`

Add to `apps/api`.

### 4c. New model: `models/SSOConfig.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required, unique),
  provider: String (enum: ['google', 'azure_ad', 'okta', 'saml_generic']),
  isEnabled: Boolean (default: false),

  // SAML config
  entryPoint: String,         // IdP SSO URL
  issuer: String,             // SP entity ID (your VaultStack instance URL)
  cert: String (encrypted),   // IdP public certificate
  callbackUrl: String,        // ACS URL: https://api.yourapp.com/api/auth/sso/callback

  // Role mapping — map IdP group/role to VaultStack role
  roleMappings: [{
    idpGroup: String,          // e.g. "engineering-managers" (from IdP)
    vaultRole: String,         // e.g. "manager"
  }],

  // Provisioning
  autoProvisionUsers: Boolean (default: true),   // create user on first SSO login if not found
  defaultRole: String (default: 'developer'),
  allowPasswordLogin: Boolean (default: true),   // if false, SSO is the only login method

  configuredBy: ObjectId (ref: User),
  configuredAt: Date,
}
```

### 4d. SAML routes

#### `GET /api/auth/sso/metadata`
Returns SP metadata XML. Used by the IdP admin to configure the integration.

#### `GET /api/auth/sso/login`
Redirects to the IdP SSO URL.

#### `POST /api/auth/sso/callback`
SAML assertion consumer service (ACS). Processes the IdP response.

1. Verify signature with the stored `cert`
2. Extract `email`, `name`, `groups`/`roles` attributes from the assertion
3. Find existing user by email. If not found and `autoProvisionUsers = true` → create user with `defaultRole` (or mapped role from `roleMappings`)
4. Apply role mapping: if user's IdP group matches a `roleMappings` entry, update their VaultStack role
5. Issue a JWT, set cookie, redirect to dashboard

#### `POST /api/auth/sso/configure`
Sysadmin only. Save/update SSO config.

### 4e. Google Workspace (OIDC as an alternative to SAML)

For simpler setups, support Google OIDC alongside SAML:

Install: `npm install passport-google-oauth20`

```
GET /api/auth/google         → redirect to Google OAuth
GET /api/auth/google/callback → handle OAuth response
```

### 4f. SSO settings UI

Route: `/settings/organisation/sso`

```
Single Sign-On (SSO)

[Toggle: Enable SSO]

Provider:
  [Google Workspace ●]  [Azure Active Directory ○]  [Okta ○]  [Generic SAML ○]

── Google Workspace ──────────────────────────────────────

Client ID:      [_______________________________________]
Client Secret:  [_______________________________________]
Allowed domain: [yourcompany.com]  (restrict to org domain)

── Role mapping ──────────────────────────────────────────
Google Group          →    VaultStack Role
[engineers ___]            [developer ▾]     [Remove]
[team-leads ___]           [manager ▾]       [Remove]
[exec-team ___]            [ceo ▾]           [Remove]
[+ Add mapping]

── Options ───────────────────────────────────────────────
[Toggle]  Auto-provision new users on first login
Default role for new users:  [developer ▾]
[Toggle]  Require SSO — disable password login

[Save SSO config]   [Test SSO connection]
```

**Login page update** — when SSO is configured, add a second button below the password form:

```
─── or ───────────────────────────────
[Continue with Google]
```

---

## Part 5 — Anomaly detection on audit log

### 5a. What it is

A compromised account reveals 40 credentials in 3 minutes at 2am. Every individual reveal is logged. But nobody reviews the audit log in real time — the breach is discovered 6 days later. Anomaly detection catches the pattern, not the individual event.

### 5b. Detection rules (`lib/anomaly/rules.ts`)

```ts
export interface AnomalyRule {
  id: string;
  name: string;
  severity: 'high' | 'medium' | 'low';
  check: (event: AuditLogDoc, recentEvents: AuditLogDoc[]) => AnomalyResult | null;
}

export const ANOMALY_RULES: AnomalyRule[] = [
  {
    id: 'bulk_reveal',
    name: 'Bulk credential reveal',
    severity: 'high',
    check: (event, recent) => {
      // If this is a reveal event, count reveals by this user in the last 5 minutes
      if (event.action !== 'credential.view') return null;
      const recentReveals = recent.filter(e =>
        e.actorId.equals(event.actorId) &&
        e.action === 'credential.view' &&
        e.createdAt > new Date(Date.now() - 5 * 60 * 1000)
      );
      if (recentReveals.length >= 5) {
        return { rule: 'bulk_reveal', count: recentReveals.length, windowMinutes: 5 };
      }
      return null;
    }
  },
  {
    id: 'off_hours_access',
    name: 'Off-hours credential access',
    severity: 'medium',
    // Flag reveals between 22:00 and 06:00 UTC for users with no history of off-hours access
  },
  {
    id: 'first_access_new_ip',
    name: 'First access from new IP',
    severity: 'medium',
    // Cross-reference req IP against the user's last 30 days of IPs in the audit log
  },
  {
    id: 'rapid_env_export',
    name: 'Multiple environment exports in short window',
    severity: 'high',
    // More than 3 env exports by the same user within 10 minutes
  },
  {
    id: 'access_before_offboarding',
    name: 'Access after offboarding initiated',
    severity: 'high',
    // Any credential reveal by a user with an active OffboardingChecklist
  },
  {
    id: 'break_glass_after_rejection',
    name: 'Break-glass activation shortly after request rejection',
    severity: 'medium',
    // Break-glass activated within 30 minutes of a rejected permission request by the same user
  }
];
```

### 5c. New model: `models/AnomalyEvent.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  actorId: ObjectId (ref: User, required),
  ruleId: String (required),           // which rule triggered
  ruleName: String,
  severity: String (enum: ['high','medium','low']),
  triggerAuditLogId: ObjectId (ref: AuditLog),
  meta: Mixed,                         // rule-specific context
  status: String (enum: ['open','acknowledged','false_positive'], default: 'open'),
  acknowledgedBy: ObjectId (ref: User, nullable),
  acknowledgedAt: Date (nullable),
  acknowledgeNote: String,
  createdAt: Date,
}
// Indexes: organisationId, actorId, severity, status, createdAt
// TTL: 90 days
```

### 5d. Detection flow

Anomaly detection runs as a post-save hook on AuditLog:

```ts
AuditLogSchema.post('save', async function(doc) {
  const recentEvents = await AuditLog.find({
    organisationId: doc.organisationId,
    actorId: doc.actorId,
    createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }  // last 30 min
  }).sort({ createdAt: -1 }).limit(50);

  for (const rule of ANOMALY_RULES) {
    const result = rule.check(doc, recentEvents);
    if (result) {
      const anomaly = await AnomalyEvent.create({
        organisationId: doc.organisationId,
        actorId: doc.actorId,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        triggerAuditLogId: doc._id,
        meta: result,
      });
      // Notify sysadmin and (for high severity) C-suite
      await createNotification({ type: 'anomaly.detected', ... });
      // Push SSE event to connected admins
      pushToRole('sysadmin', { type: 'anomaly_detected', severity: rule.severity, ... });
      // Send Slack alert to security channel (if configured)
    }
  }
});
```

### 5e. API routes

#### `GET /api/anomalies`
Sysadmin only. Query: `?severity=high&status=open`.
Returns paginated anomaly events with populated actor and audit log entry.

#### `POST /api/anomalies/:id/acknowledge`
Sysadmin only.
```json
{ "status": "acknowledged" | "false_positive", "note": "Rahul was doing a scheduled audit" }
```

### 5f. UI

**Anomalies page** (`/settings/anomalies`):

```
Security anomalies

[Filter: All ●] [Open] [High severity] [This week]

[HIGH]  Bulk credential reveal — Rahul Mehta               2h ago   [Acknowledge]
        5 credentials revealed in 3 minutes (XYZ Commerce)
        [View in audit log →]

[MED]   First access from new IP — Priya Sharma             5h ago   [Acknowledge]
        IP 185.x.x.x — not seen in last 30 days
        [View in audit log →]
```

Red badge on sidebar nav item for open high-severity anomalies.

**Security risk dashboard** (Sprint 2, Part 8) — add "Open anomalies" stat card.

---

## Part 6 — Compliance readiness score

### 6a. What it is

VaultStack already implements most SOC 2 CC6 controls and ISO 27001 A.9 access management controls. A compliance score UI maps each platform feature to the relevant control, giving compliance teams a living readiness dashboard instead of a spreadsheet.

### 6b. Control definitions (`lib/compliance/controls.ts`)

```ts
export interface ComplianceControl {
  id: string;
  framework: 'soc2' | 'iso27001' | 'gdpr';
  controlRef: string;          // e.g. 'CC6.1', 'A.9.4.1'
  title: string;
  description: string;
  check: (org: Organisation) => Promise<ComplianceCheckResult>;
}

export interface ComplianceCheckResult {
  status: 'passing' | 'partial' | 'failing' | 'not_applicable';
  evidence: string;            // human-readable explanation of what was checked
  score: number;               // 0, 50, or 100
  remediation?: string;        // what to do if not passing
}
```

**SOC 2 CC6 controls to implement:**

| Control | Check |
|---|---|
| CC6.1 — Logical access security | Is RBAC enabled with defined roles? ✓ always passing |
| CC6.2 — New access provisioning | Is invite-only enabled? Are roles assigned on creation? |
| CC6.3 — Access removal on termination | Is offboarding workflow used for deactivated users? Check last 5 deactivations |
| CC6.6 — Logical access restriction | Is 4-eyes policy enabled for critical credentials? |
| CC6.7 — Transmission encryption | Is HTTPS configured? (check `NEXT_PUBLIC_APP_URL` starts with `https://`) |
| CC6.8 — Vulnerability detection | Are access reviews completed on schedule? |

**ISO 27001 A.9 controls:**

| Control | Check |
|---|---|
| A.9.2.1 — User registration | Is SSO configured OR invite-only login enabled? |
| A.9.2.2 — Privileged access | Is sysadmin role restricted to ≤ 2 users? |
| A.9.2.5 — Access review | Are access reviews configured and completed on schedule? |
| A.9.4.1 — Information access restriction | Is IP allowlisting enabled for production credentials? |
| A.9.4.2 — Secure log-on procedures | Is brute-force lockout enabled (Phase 12)? |

### 6c. API route: `GET /api/compliance/score`

Sysadmin only. Runs all checks and returns:

```json
{
  "soc2": {
    "overallScore": 75,
    "controls": [
      { "ref": "CC6.1", "title": "Logical access security", "status": "passing", "score": 100, "evidence": "9 distinct roles configured with RBAC" },
      { "ref": "CC6.3", "title": "Access removal on termination", "status": "partial", "score": 50, "evidence": "2 of 5 recent deactivations used the offboarding workflow", "remediation": "Enable offboarding requirement in org settings" }
    ]
  },
  "iso27001": { "overallScore": 60, "controls": [ ... ] },
  "gdpr": { "overallScore": 80, "controls": [ ... ] }
}
```

### 6d. UI

Route: `/settings/compliance`

```
Compliance readiness

SOC 2 Type II                      ISO 27001                         GDPR
[████████████████░░░░]  75%        [████████████░░░░░░░░]  60%       [████████████████░░░░]  80%

── SOC 2 CC6 controls ──────────────────────────────────────────────────

[✓]  CC6.1  Logical access security          Passing   9 roles configured
[!]  CC6.3  Access removal on termination    Partial   2/5 deactivations used offboarding
            Remediation: Enable offboarding requirement in settings →
[✓]  CC6.6  Logical access restriction       Passing   4-eyes policy enabled for critical creds
[✗]  CC6.7  Transmission encryption          Failing   App URL uses HTTP
            Remediation: Configure HTTPS for your deployment

[Export SOC 2 evidence report →]
```

Colors: ✓ green, ! amber, ✗ red.

"Export evidence report" → triggers report generation (Phase 13, Part 6) pre-filtered to the selected framework.

---

## Part 7 — Local dev secrets injection agent

### 7a. What it is

.env files get accidentally committed. They get out of sync across developers. A new developer spends half a day on their first day hunting for the right values. The local agent is a lightweight background process that intercepts process startup and injects the correct secrets from VaultStack — the .env file is removed from the workflow entirely.

### 7b. Architecture

The agent is a small Node.js daemon (the CLI tool from Sprint 2 extended with a `daemon` command):

```bash
$ vaultstack daemon start
VaultStack agent started — PID 12345
Config: XYZ Commerce / staging
Watching for: npm, node, python, python3, uvicorn, gunicorn, go run
```

The agent runs in the background and intercepts process starts using Node's `child_process.spawn` hooks OR by writing a shell wrapper.

**Shell wrapper approach (simpler and more reliable):**

`vaultstack daemon init` writes a small shell function to `~/.zshrc` / `~/.bashrc`:

```bash
# Added by VaultStack daemon
vs_inject() {
  if [ -f ".vaultstack.project" ]; then
    eval "$(vaultstack env --format=export)"
    "$@"
  else
    "$@"
  fi
}
alias npm="vs_inject npm"
alias node="vs_inject node"
alias python="vs_inject python3"
```

When `npm run dev` is called in a directory with a `.vaultstack.project` file, the wrapper fetches the current env variables and injects them before starting the process.

**`.vaultstack.project` file** (committed to the repo, not secret):

```json
{
  "project": "xyz-commerce",
  "environment": "staging"
}
```

### 7c. CLI extension

Add to `apps/cli`:

#### `vaultstack daemon init`
Adds the shell wrapper to the user's profile. Asks which shell (`bash`, `zsh`, `fish`).

#### `vaultstack daemon status`
Shows which projects are configured and when env vars were last fetched.

#### `vaultstack env --format=export`
Outputs all env variables in `export KEY=VALUE` format (for shell `eval`).
This is the command the shell wrapper calls.

#### `vaultstack init`
Interactive project setup in the current directory. Creates `.vaultstack.project` file.

```
$ vaultstack init
Select project: [XYZ Commerce ▾]
Select environment: [staging ▾]
Created .vaultstack.project
Add .env to your .gitignore? [Y/n]  Y

Done! Run 'vaultstack daemon init' to enable automatic injection.
```

### 7d. Caching

The agent caches fetched values in memory for 5 minutes to avoid hitting the API on every process start. Cache is invalidated when a `credential_updated` SSE event is received.

---

## Part 8 — SDK libraries

### 8a. What it is

Some secrets cannot be baked into a .env file at deploy time — dynamically rotated credentials, feature flags backed by secrets, or credentials that change frequently. SDK libraries enable runtime secret fetching, which is the model used by AWS Secrets Manager and HashiCorp Vault. This positions VaultStack as a secrets infrastructure layer, not just a storage UI.

### 8b. Authentication

SDKs authenticate using deploy tokens (Part 3 of this sprint) — scoped read-only tokens per project+environment.

### 8c. Node.js SDK (`packages/node-sdk/`)

Install: `npm install @vaultstack/node`

```ts
import { VaultStack } from '@vaultstack/node';

const vault = new VaultStack({
  apiUrl: process.env.VAULTSTACK_API_URL,
  token: process.env.VAULTSTACK_TOKEN,
  project: 'xyz-commerce',
  environment: 'production',
  cache: { ttl: 300 },       // cache for 5 minutes
});

// Fetch a single secret
const dbUrl = await vault.get('DATABASE_URL');

// Fetch multiple
const { STRIPE_SECRET_KEY, SENDGRID_API_KEY } = await vault.getMany([
  'STRIPE_SECRET_KEY',
  'SENDGRID_API_KEY',
]);

// Inject all secrets into process.env
await vault.injectAll();

// Watch for updates (uses SSE or polling)
vault.on('update', (key, newValue) => {
  console.log(`${key} was updated — consider restarting`);
});
```

**Internal implementation:**
- `get(key)` → hits `GET /api/deploy/env` with deploy token, returns value for that key
- Result is cached for `ttl` seconds
- `injectAll()` → fetches all and sets `process.env[key] = value` for each
- `on('update')` → opens an SSE connection to `GET /api/deploy/env/changes` (new endpoint that pushes events when any env var in the scope changes)

### 8d. Python SDK (`packages/python-sdk/`)

Publish as `vaultstack-python` on PyPI.

```python
from vaultstack import VaultStack

vault = VaultStack(
    api_url=os.getenv("VAULTSTACK_API_URL"),
    token=os.getenv("VAULTSTACK_TOKEN"),
    project="xyz-commerce",
    environment="production",
    cache_ttl=300,
)

db_url = vault.get("DATABASE_URL")
vault.inject_all()   # sets os.environ for all vars
```

### 8e. New API endpoint for SDKs

#### `GET /api/deploy/env/changes` (SSE)
Streams `data: { key, updatedAt }` events when env variables in the deploy token's scope are updated. Used by SDKs to invalidate their cache and notify the application.

### 8f. Documentation (`docs/sdk/`)

Create `docs/sdk/node.md`, `docs/sdk/python.md`, `docs/sdk/go.md` with:
- Installation
- Authentication setup
- Basic usage examples
- Cache configuration
- Watching for updates
- TypeScript types (for Node SDK)

---

## New models

| Model | Purpose |
|---|---|
| `RotationConfig` | Automated credential rotation configuration per credential |
| `SSOConfig` | SAML/OIDC SSO configuration per organisation |
| `AnomalyEvent` | Detected security anomalies from audit log analysis |
| Deploy tokens on `Project` | Scoped read-only tokens for CI/CD and SDKs |
| CLI tokens on `User` | Personal tokens for the CLI tool (Sprint 2) |

---

## New AuditLog actions

```
'credential.auto_rotated', 'rotation.failed', 'rotation.config_created',
'deploy_token.created', 'deploy_token.revoked', 'envvar.ci_fetch',
'sso.configured', 'sso.login',
'anomaly.detected', 'anomaly.acknowledged',
'compliance.report_generated',
'sdk.secret_fetched',
```

---

## New cron jobs

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/run-rotations` | `0 3 * * *` | Execute due automated rotations |
| `/api/cron/compute-rotation-dates` | `0 1 * * *` | Update `nextRotationAt` for all configs |

---

## New env variables

```env
# Rotation engine
AWS_ROTATION_ROLE_ARN=   # optional: dedicated IAM role for VaultStack to assume during rotation

# SSO
SAML_SP_ENTITY_ID=https://api.yourapp.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AZURE_TENANT_ID=
OKTA_DOMAIN=
```

---

## Settings sidebar final state

```
Settings
  ├── My profile
  ├── Security              ← CLI tokens section added here

Organisation
  ├── General               ← SSO policy, IP policy, entropy policy, JIT policy, break-glass policy
  ├── Structure & teams
  ├── Roles & permissions
  ├── Members
  ├── Permission requests   [badge]
  ├── Access reviews        [badge]
  ├── Offboarding           [badge]
  ├── Break-glass           [badge]
  ├── JIT access            [badge]
  ├── Anomalies             [badge]   ← NEW
  ├── Compliance            ← NEW
  ├── Change windows
  ├── Sharing policy
  ├── Approvals             [badge]
  ├── Webhooks
  ├── Reports
  └── Audit log

Integrations
  ├── Slack
  ├── SSO / SAML            ← NEW
  └── Webhooks
```

---

## Deliverable checklist

**Part 1 — Rotation engine**
- [ ] `RotationConfig` model with all provider config fields
- [ ] `lib/rotation/` directory with all 5 provider implementations
- [ ] AWS IAM rotation: creates new key pair, saves both values, deletes old key
- [ ] PostgreSQL rotation: connects as admin, runs ALTER USER, saves new password
- [ ] MongoDB rotation: calls updateUser, saves new password
- [ ] GitHub token rotation: calls GitHub API, saves new token
- [ ] Generic webhook rotation: POSTs to configured URL, saves response value
- [ ] Orchestrator handles pending state to prevent concurrent runs
- [ ] Failure path saves error and sends high-priority alert
- [ ] Rotation cron runs daily at 3am UTC
- [ ] `rotate-now` endpoint triggers immediate rotation
- [ ] Rotation config UI in credential settings with test and rotate-now buttons
- [ ] Pre-rotation checklist shown when `dependents.length > 0`

**Part 2 — Dependency map**
- [ ] `dependents` array on Credential model
- [ ] Add/remove dependent UI in expanded credential view
- [ ] Pre-rotation checklist shows dependent services

**Part 3 — CI/CD integration**
- [ ] Deploy token model on Project
- [ ] Token generation returns raw token once (same UX as GitHub PATs)
- [ ] `GET /api/deploy/env` returns flat key-value JSON, authenticated by deploy token
- [ ] Rate limiting: 100 calls/hour per token
- [ ] AuditLog `envvar.ci_fetch` written with IP and key count
- [ ] Deploy tokens settings UI on project settings tab
- [ ] Integration guide documentation created

**Part 4 — SSO**
- [ ] `SSOConfig` model
- [ ] `passport-saml` installed and configured
- [ ] SP metadata endpoint works
- [ ] SAML callback processes assertion, creates/updates user
- [ ] Role mapping applies IdP groups to VaultStack roles
- [ ] Google OIDC flow working
- [ ] `autoProvisionUsers` creates user on first SSO login
- [ ] SSO settings UI with provider selector, role mapping, and test button
- [ ] Login page shows SSO button when configured
- [ ] `allowPasswordLogin = false` hides password form

**Part 5 — Anomaly detection**
- [ ] `AnomalyEvent` model with TTL
- [ ] All 6 detection rules implemented in `lib/anomaly/rules.ts`
- [ ] Post-save hook on AuditLog runs all rules
- [ ] High-severity anomaly sends Slack alert to security channel
- [ ] SSE push to connected sysadmins on anomaly
- [ ] Anomalies page renders with filter tabs and severity badges
- [ ] Acknowledge/false-positive actions work
- [ ] Security risk dashboard updated with open anomaly count

**Part 6 — Compliance score**
- [ ] All SOC 2 CC6 checks implemented
- [ ] All ISO 27001 A.9 checks implemented
- [ ] `GET /api/compliance/score` returns results for all frameworks
- [ ] Compliance page renders with traffic-light indicators
- [ ] "Export evidence report" triggers PDF generation

**Part 7 — Local dev agent**
- [ ] `vaultstack daemon init` writes shell wrapper to user profile
- [ ] `.vaultstack.project` file format documented
- [ ] `vaultstack init` creates the project file interactively
- [ ] `vaultstack env --format=export` outputs shell-compatible export statements
- [ ] Cache TTL 5 minutes with SSE-based invalidation

**Part 8 — SDKs**
- [ ] Node.js SDK package created at `packages/node-sdk`
- [ ] `get(key)` and `getMany(keys)` work with caching
- [ ] `injectAll()` sets `process.env` for all variables
- [ ] Python SDK created (basic get + inject_all)
- [ ] `GET /api/deploy/env/changes` SSE endpoint delivers update events
- [ ] SDK documentation in `docs/sdk/`

**General**
- [ ] New cron jobs added to `vercel.json`
- [ ] All new environment variables added to `.env.local.example` and documented
- [ ] ESLint clean across all packages
- [ ] `npm run build` zero TypeScript errors across all packages
- [ ] Integration tests for: rotation success + failure paths, deploy token auth, SSO login flow, anomaly rule triggers, compliance check accuracy
