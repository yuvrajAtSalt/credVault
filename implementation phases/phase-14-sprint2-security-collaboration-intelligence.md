# VaultStack — Phase 14 (Sprint 2): Security Depth, Collaboration Efficiency & Operational Intelligence

> Prerequisite: Phase 14 Sprint 1 complete. JIT access, break-glass, secret versioning, templates,
> drift detection, and changelog all working.

---

## Overview of systems added in this sprint

1. **IP and device-based access rules** — restrict credential reveals to trusted network locations
2. **Secret entropy scoring** — surface weak and reused credentials in the health dashboard
3. **Duplicate secret detection** — flag when the same value exists across multiple projects
4. **Credential comments and threads** — keep context and decisions next to the credential
5. **Credential request hints** — tell team members what a hidden credential is and who to ask
6. **Slack integration** — approval requests and break-glass alerts delivered as interactive Slack messages
7. **CLI tool** — `vaultstack pull`, `vaultstack diff`, `vaultstack run` for terminal-first developers
8. **Security risk dashboard** — org-wide posture view with trend lines for leadership
9. **Credential access analytics** — usage patterns per credential and per user

---

## Part 1 — IP and device-based access rules

### 1a. What it is

A compromised account logging in from an unexpected IP address can reveal every credential it has access to. IP allowlisting adds a second factor that requires zero friction for legitimate users working from their usual locations — but blocks attackers operating from different networks.

### 1b. Model update: `models/Organisation.ts`

```ts
ipAccessPolicy: {
  enabled: Boolean (default: false),
  mode: String (enum: ['allowlist','audit_only'], default: 'audit_only'),
    // allowlist: block reveals from non-whitelisted IPs
    // audit_only: allow but log a warning — useful for teams with dynamic IPs
  allowedCidrs: [String],    // e.g. ['203.0.113.0/24', '10.0.0.0/8']
  allowedIpLabels: [{        // human-readable labels for the CIDRs
    cidr: String,
    label: String,           // e.g. "Office WiFi", "VPN", "CI/CD servers"
  }],
  bypassRoles: [String],     // roles that bypass IP check (e.g. ['sysadmin'])
}
```

### 1c. Enforcement

In the credential reveal endpoint (`GET /api/projects/:id/credentials/:credId/reveal`) and the env variable reveal endpoint:

```ts
const policy = org.ipAccessPolicy;

if (policy.enabled) {
  const clientIp = getClientIp(req);   // X-Forwarded-For or req.socket.remoteAddress
  const isAllowed = policy.allowedCidrs.some(cidr => ipInCidr(clientIp, cidr));
  const isBypassRole = policy.bypassRoles.includes(req.user.role);

  if (!isAllowed && !isBypassRole) {
    if (policy.mode === 'allowlist') {
      // Create an anomaly notification for sysadmin
      await createNotification({ type: 'anomaly.reveal_blocked_ip', ... });
      return res.status(403).json({
        code: 'IP_NOT_ALLOWED',
        message: `Credential reveals are restricted to trusted networks. Your IP: ${clientIp}`
      });
    } else {
      // audit_only — allow but log
      await AuditLog.create({ action: 'credential.reveal_untrusted_ip',
        meta: { ip: clientIp, credentialId, label } });
    }
  }
}
```

Install `ip-cidr` (npm install ip-cidr) for CIDR range checking.

### 1d. Trusted IP management UI

In `/settings/organisation/general` add "Network access" section:

```
Network access policy
[Toggle]  Enable IP-based access control
Mode      [Audit only — log warnings ●] [Allowlist — block access ○]

Trusted networks:
  [● Office WiFi]      203.0.113.0/24    [Remove]
  [● VPN]              10.0.0.0/8        [Remove]
  [● CI/CD (GitHub)]   192.30.252.0/22   [Remove]

[+ Add trusted network]   Label: [_______]  CIDR: [_______________]

Bypass roles (always allowed):
  [sysadmin ×]  [Add role ▾]
```

### 1e. Anomaly notifications

When a reveal is blocked or a reveal happens from an unknown IP in `audit_only` mode:
- Create a `Notification` for sysadmin: "Credential reveal from untrusted IP: [IP] — Rahul Mehta — Production DB Password"
- URL in notification → `/settings/audit-log?filter=reveal_untrusted_ip`

---

## Part 2 — Secret entropy scoring

### 2a. What it is

"password123" is technically a valid database password and VaultStack currently stores it with the same trust as a 64-character random string. Entropy scoring makes weak credentials visible without exposing their values — the score is computed from the value, then the value is discarded.

### 2b. Algorithm (`lib/entropy.ts`)

```ts
export interface EntropyScore {
  score: number;          // 0–100
  grade: 'weak' | 'fair' | 'medium' | 'strong' | 'excellent';
  bitEntropy: number;     // Shannon entropy in bits
  reasons: string[];      // e.g. ['too short', 'no uppercase', 'common pattern detected']
}

export function scoreSecret(value: string): EntropyScore {
  // Shannon entropy: H = -sum(p_i * log2(p_i)) for each unique character
  // Multiply by string length to get total bits
  // Grade:
  //   0-20   = weak (score < 20 bits)
  //   20-40  = fair
  //   40-60  = medium
  //   60-80  = strong
  //   80+    = excellent
  // Penalty reasons:
  //   length < 12 → "too short"
  //   no uppercase → "no uppercase characters"
  //   no numbers → "no numeric characters"
  //   no special chars → "no special characters"
  //   matches common patterns (all same char, sequential, keyboard walk) → "predictable pattern"
  //   appears in common password list (check against top-10k list shipped as a Set) → "commonly used password"
}
```

Ship a `lib/common-passwords.ts` that exports a `Set<string>` containing the top 10,000 common passwords (hardcoded, compiled at build time — not fetched at runtime).

### 2c. Score computation on save

In the `Credential` pre-save hook, after encrypting the value but before saving:

```ts
if (this.isModified('value') && this.isSecret) {
  const plainValue = decryptForScoring(this.value);
  const score = scoreSecret(plainValue);
  this.entropyScore = score.score;
  this.entropyGrade = score.grade;
  this.entropyReasons = score.reasons;
  // plainValue is not stored — it goes out of scope after this
}
```

Add to `models/Credential.ts`:
```ts
entropyScore: Number (nullable),
entropyGrade: String (enum: ['weak','fair','medium','strong','excellent'], nullable),
entropyReasons: [String],
```

### 2d. Enforcement policies

Add to Organisation model:
```ts
entropyPolicy: {
  enabled: Boolean (default: false),
  minimumGrade: String (enum: ['fair','medium','strong','excellent'], default: 'medium'),
  blockWeakSecrets: Boolean (default: false),   // if true, reject saves below minimumGrade
  warnOnWeak: Boolean (default: true),
  applyToEnvironments: [String] (default: ['production']),  // only enforce on prod by default
}
```

If `blockWeakSecrets === true` and the credential's environment is in `applyToEnvironments` and the new value is below `minimumGrade` → return `400 { code: 'ENTROPY_TOO_LOW', grade: 'weak', minimumRequired: 'medium' }`.

### 2e. UI

**Credential row** — show a small entropy indicator next to the masked value:

```
[••••••••••••]  [● strong]      ← green dot
[••••••••••••]  [● weak]        ← red dot, hover tooltip shows reasons
[••••••••••••]                  ← no dot for non-secret credentials
```

**Add/edit credential form** — show a live entropy meter as the user types:

```
Value  [__________________]  [show]
       Strength: [████████░░]  Strong
```

Update the meter on every keystroke. The meter uses the same `scoreSecret()` function called client-side (the function is pure — copy it to the frontend or expose via a non-authenticated `/api/util/entropy-check` endpoint).

**Project health score** — entropy contributes:
- Any `weak` credential in production → -15 points per credential (capped at -30)
- Any `fair` credential in production → -5 points per credential (capped at -15)

**Health dashboard** — "Weak secrets" section lists all credentials with `grade === 'weak'` that the viewer can see.

---

## Part 3 — Duplicate secret detection

### 3a. What it is

The same AWS access key stored under 5 different labels across 3 projects. When that key is rotated in one place, the 4 copies silently stay stale. Services break without warning. Duplicate detection surfaces this before it causes an incident.

### 3b. Hashing strategy

Detect duplicates without decrypting by storing a deterministic HMAC of the value:

```ts
// On every credential save, compute a salted HMAC using a separate HMAC_SECRET key
// (different from the encryption key — never derives the value):
import { createHmac } from 'crypto';

export function computeValueFingerprint(value: string): string {
  return createHmac('sha256', process.env.HMAC_SECRET!)
    .update(value)
    .digest('hex');
}
```

Add `HMAC_SECRET` to `.env.local.example`.

Add to `models/Credential.ts`:
```ts
valueFingerprint: String (nullable),   // HMAC-SHA256 of the plaintext value
```

Set on every save in the pre-save hook alongside encryption.

### 3c. Duplicate detection query

```ts
// Find all credentials in the same org that share a fingerprint
async function findDuplicates(credentialId: string, fingerprint: string, orgId: string) {
  return Credential.find({
    _id: { $ne: credentialId },
    organisationId: orgId,
    valueFingerprint: fingerprint,
    isDeleted: false,
  }).populate('projectId', 'name').select('label category projectId addedBy');
}
```

### 3d. API route

#### `GET /api/credentials/duplicates`
Sysadmin only. Finds all groups of credentials sharing the same fingerprint.

Returns:
```json
[
  {
    "fingerprint": "abc123...",
    "count": 3,
    "credentials": [
      { "label": "AWS Access Key", "project": "XYZ Commerce", "category": "storage" },
      { "label": "S3 Key", "project": "Alpha Analytics", "category": "storage" },
      { "label": "Access key ID", "project": "Beta Mobile", "category": "custom" }
    ]
  }
]
```

### 3e. UI

**Credential row** — a small `[copies: 2]` badge appears when duplicates are detected. Hover tooltip: "This value is stored in 2 other projects." Only visible to sysadmin and managers.

**Project health score** — any credential with `> 0` duplicates → -5 points per duplicate group (info-level, capped at -10).

**Duplicates report** in `/settings/reports` — add "Duplicate secrets report" as a fourth report type. Lists all duplicate groups with links to each location.

---

## Part 4 — Credential comments and threads

### 4a. What it is

"Why does this S3 key have ListBucket but not PutObject?" — this question gets asked in Slack, the answer is lost, and 6 months later someone asks it again. Comments keep decisions and context next to the credential permanently.

### 4b. New model: `models/CredentialComment.ts`

```ts
{
  credentialId: ObjectId (ref: Credential, required),
  projectId: ObjectId (ref: Project, required),
  organisationId: ObjectId (ref: Organisation, required),
  authorId: ObjectId (ref: User, required),
  body: String (required, maxLength: 2000),
  parentId: ObjectId (ref: CredentialComment, nullable),   // for threaded replies
  isEdited: Boolean (default: false),
  editedAt: Date (nullable),
  isDeleted: Boolean (default: false),   // soft delete — shows "Comment deleted" placeholder
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: credentialId, authorId, parentId
// TTL: none — comments are permanent (data retention policy covers org-wide deletion)
```

### 4c. API routes

#### `GET /api/projects/:id/credentials/:credId/comments`
Returns threaded comment tree for a credential.
Who can call: any project member (comments are visible regardless of credential visibility grant — the comment discusses the credential, not reveals its value).

Response: flat list with `parentId` references. Frontend renders the tree.

#### `POST /api/projects/:id/credentials/:credId/comments`
Body: `{ body, parentId? }`
Any project member. Creates a notification for the credential's `addedBy` user if not the commenter.

#### `PATCH /api/projects/:id/credentials/:credId/comments/:commentId`
Body: `{ body }`
Author only. Sets `isEdited = true`.

#### `DELETE /api/projects/:id/credentials/:credId/comments/:commentId`
Author, project manager, or sysadmin. Soft-deletes.

### 4d. UI

**Comment section** — below each credential row in the expanded view (click to expand), add a comments thread. Collapsed by default; a `[💬 3 comments]` indicator on the row shows count.

```
[💬 3]  Production DB Password   [••••••••]  [○]  [⎘]  [✎]  [↓ expand]

  ▼  expanded:

  Comments (3)
  ─────────────────────────────────────────────────────
  [RM]  Rahul Mehta  · 2 days ago
        This key has read-only IAM permissions. Do NOT use for writes —
        the write key is a separate entry below.

    ↳  [PS]  Priya Sharma  · 1 day ago
             Confirmed — I tried using this for an S3 upload and got 403.
             Using the write key (AWS Secret Key — Write) instead.

  ─────────────────────────────────────────────────────
  [You]  Write a comment...
         [______________________________________]
         [Post comment]
```

Comments support **@mentions** — type `@` to open a miniature `UserSelect` dropdown showing project members. The mentioned user gets a notification.

---

## Part 5 — Credential request hints

### 5a. What it is

A new developer joins the project. They can see that `DATABASE_URL` exists but is hidden behind a lock. They have no idea what service it connects to, what format the value should be in, or who to ask. A hint field — visible to all project members regardless of visibility — turns the locked credential from a mystery into a guided next step.

### 5b. Model update: `models/Credential.ts`

```ts
hint: {
  description: String (nullable),    // what is this? e.g. "Primary PostgreSQL connection string for the xyz_commerce database"
  format: String (nullable),         // expected format e.g. "postgresql://user:pass@host:5432/dbname"
  contactUserId: ObjectId (ref: User, nullable),  // who to ask
  externalDocUrl: String (nullable), // link to internal wiki or Confluence page
}
```

### 5c. API update

#### `PATCH /api/projects/:id/credentials/:credId`

Allow updating `hint.*` fields. The hint fields are NOT secret and do NOT require the caller to have visibility on the credential — anyone on the project can add a hint to help teammates.

The reveal endpoint response ALWAYS includes `hint` regardless of visibility.

### 5d. UI

**Locked credential row** — instead of just `[🔒 DATABASE_URL — hidden]`, show the hint if it exists:

```
[🔒]  DATABASE_URL
      Primary PostgreSQL connection string for the xyz_commerce database
      Format: postgresql://user:pass@host:5432/dbname
      Ask: Priya Sharma (manager)  ·  [Request access]  ·  [Confluence →]
```

If no hint exists, show: `[🔒 DATABASE_URL — hidden]  [Add hint]` (any project member can add a hint even if they can't see the value).

**Add/edit hint form** — small collapsible section in the Add Credential modal and in the edit flow:

```
Hint for team members (visible to everyone on this project)
Description  [_______________________________________________]
Format       [_______________________________________________]
Contact      [UserSelect — who to ask about this credential]
Docs URL     [_______________________________________________]
```

---

## Part 6 — Slack integration

### 6a. What it is

Most small teams make decisions in Slack. If an approval request requires opening a second application, it sits unreviewed. Slack integration delivers interactive approval requests, break-glass alerts, and expiry warnings as Slack messages with action buttons — decisions happen in 30 seconds instead of 3 hours.

### 6b. Model: `models/SlackIntegration.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required, unique),
  accessToken: String (encrypted),          // Slack bot token — encrypted at rest
  teamId: String,                           // Slack workspace ID
  teamName: String,
  defaultChannelId: String (nullable),      // fallback channel for org-wide alerts
  installedBy: ObjectId (ref: User),
  installedAt: Date,
  isActive: Boolean (default: true),

  // Per-event channel routing
  channelRoutes: [{
    event: String,                          // notification type e.g. 'break_glass.activated'
    channelId: String,
    channelName: String,
  }],

  // Per-user DM routing — map VaultStack userId to Slack userId
  userMappings: [{
    vaultUserId: ObjectId,
    slackUserId: String,
  }],

  createdAt: Date,
}
```

### 6c. Slack app setup

Install: `npm install @slack/web-api @slack/bolt`.

Create a Slack app with the following scopes:
- `chat:write` — post messages
- `users:read.email` — look up Slack users by email for DMs
- `channels:read` — list channels for the channel picker

Add to `.env.local.example`:
```env
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=            # set after OAuth installation
```

### 6d. OAuth installation flow

Route: `GET /api/integrations/slack/install` → redirects to Slack OAuth.
Callback: `GET /api/integrations/slack/callback` → exchanges code for token, saves `SlackIntegration`.

### 6e. Message delivery (`lib/slack.ts`)

```ts
export interface SlackMessage {
  channelOrUserId: string;   // channel ID or user DM ID
  text: string;              // fallback plain text (for notifications)
  blocks: any[];             // Slack Block Kit blocks — rich formatted message
}

export async function sendSlackMessage(
  orgId: string,
  message: SlackMessage
): Promise<void>

export async function sendSlackDM(
  orgId: string,
  vaultUserId: string,
  message: SlackMessage
): Promise<void>
```

### 6f. Slack message templates

**Permission / JIT approval request:**
```
[Block Kit]
─────────────────────────────────────
🔐  Access request — VaultStack

Rahul Mehta (Developer) is requesting:
Temporary access to: XYZ Commerce (4 hours)
Reason: "Production DB unresponsive — need to verify config"

[Approve ✓]  [Reject ✕]  [View in VaultStack →]
─────────────────────────────────────
```

The `[Approve]` and `[Reject]` buttons use Slack interactive components (`actions` block). Clicking sends a Slack interactivity POST to:

**`POST /api/integrations/slack/actions`** — Slack interactivity endpoint.

This endpoint verifies the Slack request signature, parses the action payload, and calls the same approval/rejection logic as the regular API routes.

**Break-glass alert (sent to all notifyRoles + default channel):**
```
🚨  BREAK-GLASS ACTIVATED

Activated by: Rahul Mehta (DevOps)
Project: XYZ Commerce
Reason: "Production DB connection failing — P1"
Window: 60 minutes (expires 10:45 UTC)

This event requires a mandatory post-incident review.
[View event →]
```

**Expiry warning:**
```
⚠  Credential expiring soon — VaultStack

SendGrid API Key — XYZ Commerce — expires in 5 days
AWS Access Key — Alpha Analytics — expires in 12 days

[View dashboard →]
```

### 6g. Slack integration settings UI

Route: `/settings/integrations/slack`

```
Slack integration

[Connect to Slack]        ← OAuth button, pre-install
─────────────────────────
Connected workspace: Acme Corp (T0123ABCDEF)   [Disconnect]

Default alert channel:   [#vaultstack-alerts ▾]

Channel routing:
  Break-glass alerts    [#incidents ▾]
  Approval requests     [DM to approver ●] [Channel ○]
  Expiry warnings       [#engineering ▾]
  Access reviews        [#security ▾]

User mapping:
  Auto-map by email  [Toggle ●]
  ← matches VaultStack email to Slack account automatically

[Save routing]
```

---

## Part 7 — CLI tool

### 7a. What it is

Developers live in the terminal. The web UI is essential for managers, but a developer's daily workflow is: open terminal, run `vaultstack pull --env staging > .env`, start the app. The CLI makes VaultStack part of the development workflow rather than an occasional admin interface.

### 7b. Setup

Create a new package in the monorepo: `apps/cli` or a separate npm package `@vaultstack/cli`.

```bash
pnpm create @turbo/gen workspace --type=app   # or manually add package
```

Stack: Node.js CLI with `commander` (npm install commander) + `chalk` (coloured output) + `ora` (spinners) + `enquirer` (interactive prompts). No framework needed.

Entry: `apps/cli/src/index.ts` compiled to `apps/cli/dist/index.js` with `#!/usr/bin/env node` shebang.

### 7c. Authentication

The CLI authenticates with a **CLI token** — a separate token type from the web JWT. This avoids storing the web JWT on disk.

Add to User model:
```ts
cliTokens: [{
  tokenHash: String,
  label: String,        // e.g. "dev laptop", "CI server"
  lastUsedAt: Date,
  createdAt: Date,
  expiresAt: Date (nullable),
}]
```

Web UI: `/settings/security` — "CLI tokens" section, generate/revoke tokens. Shows token once on generation (like GitHub PATs).

The CLI stores the token in `~/.vaultstack/config.json` on the user's machine.

### 7d. Commands

#### `vaultstack login`
Interactive login — prompts for API URL and token. Saves to `~/.vaultstack/config.json`.

```
$ vaultstack login
API URL: https://api.yourcompany.com
CLI Token: (paste your token from the web app)
✓ Authenticated as Rahul Mehta (developer)
```

#### `vaultstack whoami`
```
$ vaultstack whoami
Rahul Mehta  ·  developer  ·  Engineering
Organisation: Acme Corp
API: https://api.yourcompany.com
```

#### `vaultstack projects`
```
$ vaultstack projects
  ● XYZ Commerce         active   3 envs   12 creds
  ● Alpha Analytics      staging  2 envs   8 creds
  ● Beta Mobile          active   3 envs   5 creds
```

#### `vaultstack pull`
```
$ vaultstack pull --project "XYZ Commerce" --env staging
# Fetches all env variables the user has visibility on

# Output to stdout (pipe to file):
$ vaultstack pull --project "XYZ Commerce" --env staging > .env

# Or write directly:
$ vaultstack pull --project "XYZ Commerce" --env staging --output .env
✓ Written 24 variables to .env

# Short project selector:
$ vaultstack pull -p xyz-commerce -e staging > .env
```

#### `vaultstack diff`
```
$ vaultstack diff --project "XYZ Commerce" staging production

  Keys only in staging (6):
    FEATURE_FLAG_NEW_CHECKOUT
    REDIS_URL
    ANALYTICS_API_KEY
    DEBUG_MODE
    NEXT_PUBLIC_FEATURE_X
    MOCK_PAYMENT_GATEWAY

  Keys only in production (2):
    SENTRY_DSN
    DATADOG_API_KEY

  Keys in both: 18
  Drift score: 22%
```

#### `vaultstack run`
Inject secrets as environment variables into a subprocess — the `.env` file never touches disk:

```bash
$ vaultstack run --project "XYZ Commerce" --env staging -- npm run dev
# Sets all env vars, then runs "npm run dev" as a child process
# Process inherits the injected environment
# On process exit, the injected vars are gone
```

#### `vaultstack set`
Add or update a credential:
```bash
$ vaultstack set --project "XYZ Commerce" --env staging DATABASE_URL "postgresql://..."
✓ DATABASE_URL updated in XYZ Commerce / staging
```

#### `vaultstack versions`
```bash
$ vaultstack versions --project "XYZ Commerce" --credential "Production DB Password"
  v3  current    Rahul Mehta    10 Apr 2025
  v2             Priya Sharma   15 Jan 2025
  v1  initial    Rahul Mehta    01 Oct 2024
```

#### `vaultstack jit`
```bash
$ vaultstack jit request --project "XYZ Commerce" --duration 4h \
    --reason "Debugging production DB connectivity issue"
✓ JIT request submitted. Waiting for approval...
(Polls every 10s. Press Ctrl+C to cancel.)
✓ Approved by Priya Sharma — access active for 4h
```

### 7e. API extension: CLI token auth endpoints

#### `POST /api/auth/cli-token`
Generates a CLI token. Requires valid web session (authenticated user in the web app).
Body: `{ label, expiresAt? }`
Returns the raw token once — never shown again.

#### `DELETE /api/auth/cli-token/:tokenId`
Revoke a CLI token.

Middleware update: accept `Authorization: Bearer <cli_token>` header in addition to the cookie-based auth. CLI tokens have the same permissions as the user's role.

---

## Part 8 — Security risk dashboard

### 8a. What it is

The project health scores from Phase 13 exist per-project. Leadership needs a single view showing the org's overall security posture, whether it is improving or degrading, and where the highest-risk areas are — the kind of view a CISO or CTO wants in a weekly review.

### 8b. API route: `GET /api/dashboard/security-risk`

Sysadmin, CEO, COO, CFO.

Computes and returns:
```json
{
  "overallScore": 72,
  "overallGrade": "C",
  "trend": {
    "direction": "improving",
    "delta": 8,
    "period": "30 days"
  },
  "breakdown": {
    "accessHygiene": 65,
    "secretStrength": 80,
    "expiryCompliance": 70,
    "reviewCompliance": 55,
    "driftCompliance": 85
  },
  "criticalIssues": 3,
  "warningIssues": 11,
  "topRiskyProjects": [
    { "name": "XYZ Commerce", "score": 35, "grade": "F", "issues": 5 },
    { "name": "Gamma CRM", "score": 51, "grade": "D", "issues": 3 }
  ],
  "pendingReviews": 2,
  "pendingBreakGlassReviews": 1,
  "activeJITSessions": 3,
  "weakSecrets": 4,
  "duplicateGroups": 2
}
```

Trend is computed by comparing the current score against a snapshot stored 30 days ago. Store daily snapshots in a `models/RiskSnapshot.ts` document (lightweight — just the score + breakdown + date).

### 8c. UI

Route: `/dashboard/security` — accessible from the main dashboard for sysadmin and C-suite.

```
Security posture — Acme Corp
─────────────────────────────────────────────────────────────

Overall score: C  72/100  ↑ +8 pts over 30 days

[Access hygiene  65]  [Secret strength  80]  [Expiry compliance 70]
[Review compliance 55]  [Drift compliance 85]

─────────────────────────────────────────────────────────────

Top risks (click to go to project)
  F  XYZ Commerce    35/100   5 issues  [→]
  D  Gamma CRM       51/100   3 issues  [→]

─────────────────────────────────────────────────────────────

Live status
  3 active JIT sessions      2 pending access reviews
  1 break-glass pending review   4 weak secrets in production
```

Trend arrow: green upward for improvement, red downward for degradation, gray dash for no change.

The breakdown cards are clickable — clicking "Review compliance 55" navigates to `/settings/access-reviews` filtered to overdue reviews.

---

## Part 9 — Credential access analytics

### 9a. What it is

Nobody knows whether a credential has been revealed once or a thousand times, or whether it is accessed at 2am from unusual IPs. Access analytics surfaces usage patterns that inform rotation schedules, access reviews, and anomaly detection.

### 9b. API route: `GET /api/projects/:id/credentials/:credId/analytics`

Aggregates AuditLog data for this credential.

```json
{
  "totalReveals": 47,
  "last30DaysReveals": 12,
  "lastRevealedAt": "2025-04-09T14:30:00Z",
  "lastRevealedBy": { "name": "Rahul Mehta", "role": "developer" },
  "revealsByUser": [
    { "user": { "name": "Rahul Mehta" }, "count": 28, "lastAt": "..." },
    { "user": { "name": "Priya Sharma" }, "count": 19, "lastAt": "..." }
  ],
  "revealsByHour": [0,0,0,0,0,0,0,2,5,8,6,4,3,4,5,4,3,2,1,0,0,0,0,0],
  "suspiciousEvents": [
    { "type": "bulk_reveal", "at": "2025-04-01T02:14:00Z", "actor": "Rahul Mehta" }
  ]
}
```

### 9c. Project-level analytics: `GET /api/projects/:id/analytics`

```json
{
  "mostAccessedCredentials": [
    { "label": "Production DB Password", "reveals": 47 },
    { "label": "Stripe Secret Key", "reveals": 31 }
  ],
  "leastAccessedCredentials": [
    { "label": "Legacy API Token", "reveals": 0, "lastAccessedDaysAgo": null }
  ],
  "topAccessors": [
    { "user": { "name": "Rahul Mehta" }, "totalReveals": 83 }
  ],
  "revealsByDay": [ { "date": "2025-04-10", "count": 5 }, ... ]
}
```

### 9d. UI

**Per-credential analytics** — on the version history / audit panel for each credential, add an "Analytics" tab alongside "History":

```
Analytics — Production DB Password

Total reveals: 47   Last 30 days: 12   Last revealed: 2 hours ago by Rahul Mehta

Reveals by user:
  Rahul Mehta   ████████████████████████  28
  Priya Sharma  ███████████████████       19

Reveals by hour of day (UTC):
  [sparkline bar chart: 24 bars]

Suspicious events:
  ⚠  Bulk reveal (3 credentials in 2 minutes)   1 Apr 2025 02:14 UTC
```

**Project analytics page** (`/projects/:id/analytics`) — a new tab on the project detail page.

Visible to: project managers and above.

---

## New models

| Model | Purpose |
|---|---|
| `SlackIntegration` | Slack workspace connection and routing config |
| `RiskSnapshot` | Daily org-wide risk score snapshots for trend calculation |
| CLI token subdocument on `User` | Scoped auth tokens for the CLI tool |

---

## New AuditLog actions

```
'credential.reveal_blocked_ip', 'credential.reveal_untrusted_ip',
'credential.comment_added', 'credential.comment_deleted',
'slack.integration_installed', 'slack.action_approved', 'slack.action_rejected',
'cli.token_created', 'cli.token_revoked', 'cli.pull', 'cli.run',
```

---

## New env variables

```env
# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=

# Security
HMAC_SECRET=generate_32_bytes_hex    # for duplicate fingerprinting
```

---

## Settings sidebar additions

```
Integrations                           ← NEW top-level section
  ├── Slack                            ← NEW
  └── Webhooks                         ← moved from Organisation section

Organisation
  ├── General      ← add IP policy + entropy policy sections
  └── ...
```

---

## Deliverable checklist

**Part 1 — IP access rules**
- [ ] `ipAccessPolicy` config on Organisation model
- [ ] `ip-cidr` installed and CIDR matching implemented
- [ ] Reveal endpoint checks IP against allowlist
- [ ] `audit_only` mode logs but does not block
- [ ] Anomaly notification created for blocked/untrusted reveal
- [ ] Trusted network management UI in org settings

**Part 2 — Entropy scoring**
- [ ] `lib/entropy.ts` computes Shannon entropy + grade
- [ ] Common password list compiled into `lib/common-passwords.ts`
- [ ] Entropy computed and stored on every credential save
- [ ] `entropyPolicy` config on Organisation model
- [ ] API rejects weak secrets when `blockWeakSecrets = true`
- [ ] Live entropy meter in add/edit credential form
- [ ] Entropy indicator dot on credential rows
- [ ] Health score updated to include entropy penalties

**Part 3 — Duplicate detection**
- [ ] `HMAC_SECRET` env var added and documented
- [ ] `valueFingerprint` computed and stored on every credential save
- [ ] `GET /api/credentials/duplicates` returns duplicate groups
- [ ] Duplicate badge shown on credential rows (sysadmin/manager only)
- [ ] Duplicate secret report added as 4th report type

**Part 4 — Credential comments**
- [ ] `CredentialComment` model with threading support
- [ ] All 4 CRUD API routes working
- [ ] Comment count badge on credential rows
- [ ] Threaded comment UI in expanded credential view
- [ ] `@mention` user search in comment composer
- [ ] Notification created for `@mentions` and replies to owned credentials

**Part 5 — Request hints**
- [ ] `hint` subdocument on Credential model
- [ ] Hint fields returned regardless of visibility grants
- [ ] Locked credential row shows hint description, format, contact, doc link
- [ ] "Add hint" button visible to all project members even without visibility
- [ ] Hint fields in add/edit credential form (collapsible section)

**Part 6 — Slack integration**
- [ ] `SlackIntegration` model and OAuth installation flow
- [ ] `/api/integrations/slack/install` and `/callback` routes
- [ ] `/api/integrations/slack/actions` interactivity endpoint
- [ ] Request signature verification on actions endpoint
- [ ] Approval request Slack message with Approve/Reject buttons
- [ ] Button click calls approval/rejection logic and replies in thread
- [ ] Break-glass alert sent to configured channel with correct formatting
- [ ] Expiry warning batched per user and sent to Slack DM
- [ ] Slack integration settings page with channel routing UI
- [ ] Auto-map users by email toggle works

**Part 7 — CLI**
- [ ] `apps/cli` package created in monorepo
- [ ] CLI token generation and revocation in web UI (`/settings/security`)
- [ ] API middleware accepts `Authorization: Bearer <cli_token>` header
- [ ] `vaultstack login` saves config to `~/.vaultstack/config.json`
- [ ] `vaultstack pull` outputs valid `.env` file format
- [ ] `vaultstack diff` shows missing keys with drift score
- [ ] `vaultstack run` injects vars into subprocess, never writes to disk
- [ ] `vaultstack set` creates/updates credential via API
- [ ] `vaultstack versions` lists version history
- [ ] `vaultstack jit` polls until approval and confirms access
- [ ] AuditLog entries for `cli.pull` and `cli.run`

**Part 8 — Security risk dashboard**
- [ ] `RiskSnapshot` model with daily snapshot cron
- [ ] `GET /api/dashboard/security-risk` returns all fields
- [ ] Risk dashboard page renders with grade, trend, breakdown cards
- [ ] Trend arrow correct (comparing to 30-day-old snapshot)
- [ ] Breakdown cards navigate to relevant settings pages

**Part 9 — Access analytics**
- [ ] `GET /api/projects/:id/credentials/:credId/analytics` aggregates AuditLog
- [ ] `GET /api/projects/:id/analytics` returns project-wide aggregates
- [ ] Analytics tab on per-credential panel
- [ ] Project analytics page/tab renders charts and top accessor list
- [ ] Suspicious events (bulk reveal detection) computed and shown

**General**
- [ ] ESLint clean across `apps/api`, `apps/web`, `apps/cli`
- [ ] `npm run build` zero TypeScript errors in all packages
- [ ] CLI package has its own `package.json` and can be installed globally with `npm install -g`
- [ ] Integration tests: Slack action approval flow, CLI pull auth, entropy blocking, IP allowlist block
