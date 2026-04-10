# VaultStack — Phase 14 (Sprint 1): Zero-Trust Access, Secret Versioning & Daily Developer Value

> Prerequisite: Phase 13 complete. Compliance dashboard, access reviews, and offboarding working.
>
> This sprint is deliberately ordered by ROI — every item here has high impact and low-to-medium
> effort. The goal is to deliver features that developers and managers use every single day, not
> only during quarterly reviews.

---

## Overview of systems added in this sprint

1. **Time-bound project memberships** — auto-expiring access for contractors and temp employees
2. **Just-in-time (JIT) access requests** — temporary credential access with automatic revocation
3. **Break-glass emergency protocol** — instant production access during P1 outages with full audit trail
4. **Secret versioning and rollback** — encrypted historical ledger for every credential value
5. **Project credential templates** — predefined schemas for common stacks
6. **Environment drift detection** — alert when staging and production have diverged
7. **Project changelog feed** — human-readable summary of everything that changed on a project

---

## Part 1 — Time-bound project memberships

### 1a. What it is

The single most common access hygiene gap in small teams: a contractor joins a project for 3 months, the engagement ends, and 6 months later they still have project access because removing them was manual and got forgotten. This feature makes access expiry automatic and zero-effort.

### 1b. Model update: `models/Project.ts`

Update the `members` subdocument to include an optional expiry:

```ts
members: [{
  userId: ObjectId (ref: User),
  addedBy: ObjectId (ref: User),
  addedAt: Date,
  memberType: String (enum: ['contributor','observer'], default: 'contributor'),
  projectRole: String (nullable),
  expiresAt: Date (nullable),          // NEW — null = permanent access
  expiryNotifiedAt: Date (nullable),   // NEW — tracks when the 7-day warning was sent
}]
```

### 1c. API changes

#### `POST /api/projects/:id/members`

Add optional `expiresAt` to the request body:

```ts
Body: {
  userId: string,
  memberType?: 'contributor' | 'observer',
  projectRole?: string,
  expiresAt?: string,   // ISO date string — null means permanent
}
```

If `expiresAt` is in the past → return `400 { code: 'EXPIRY_IN_PAST' }`.

#### `PATCH /api/projects/:id/members/:userId`

Allow updating `expiresAt` on an existing membership. Manager and above only.

### 1d. Expiry cron: `GET /api/cron/check-member-expiry`

Runs daily at 07:00 UTC. Add to `vercel.json`: `"schedule": "0 7 * * *"`.

Two passes per execution:

**Pass 1 — 7-day warning:** Find memberships where `expiresAt` is between now and now+7 days AND `expiryNotifiedAt` is null. For each:
- Create a Notification for the member: "Your access to [project] expires in [N] days."
- Create a Notification for the project manager: "[Name]'s access to [project] expires in [N] days."
- Enqueue a warning email to both
- Set `expiryNotifiedAt = now`

**Pass 2 — Execute expiry:** Find memberships where `expiresAt < now`. For each:
- Execute the member removal logic from Phase 10 (preserves visibility grants by default)
- Create a Notification for the removed member: "Your access to [project] has expired."
- Notify the project manager
- Write AuditLog `member.expired` with `meta: { reason: 'membership_expiry', expiresAt }`

### 1e. UI

**Add member modal** — add an optional "Access expires" date field using the custom `<DatePicker>` from Phase 11:

```
Access duration
[Toggle: Permanent ●] [Time-limited ○]

If time-limited:
Expires on:  [DD / MM / YYYY]     ← DatePicker, minDate = tomorrow
```

**Members list on project detail page** — show expiry badge next to each time-limited member:

```
[Avatar] Rahul Mehta   developer   [expires in 12 days]
[Avatar] Kavya Reddy   qa          [expires in 3 days]  ← amber badge
[Avatar] Priya Sharma  manager     [permanent]
```

Badges: green for `> 14 days`, amber for `7–14 days`, red for `< 7 days`. No badge for permanent members.

Managers can click the expiry badge to edit the date inline.

---

## Part 2 — Just-in-time (JIT) access requests

### 2a. What it is

Instead of granting permanent project membership or permanent visibility grants, any user can request time-bounded access to a specific project, environment, or credential. When the window closes, access is automatically revoked. This is the zero-trust principle applied to day-to-day operations — no standing privileges.

### 2b. New model: `models/JITRequest.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  requestedBy: ObjectId (ref: User, required),

  // What they want access to
  scope: String (enum: ['project','environment','credential'], required),
  projectId: ObjectId (ref: Project, required),
  environmentId: ObjectId (ref: Environment, nullable),   // if scope = environment
  credentialId: ObjectId (ref: Credential, nullable),      // if scope = credential

  // Duration
  requestedDurationHours: Number (required),    // how long they want access
  requestedDurationMax: Number (default: 24),   // org policy cap — configurable
  reason: String (required),

  // Lifecycle
  status: String (enum: ['pending','approved','rejected','active','expired','revoked'], default: 'pending'),
  approvedBy: ObjectId (ref: User, nullable),
  approvedAt: Date (nullable),
  approvedDurationHours: Number (nullable),    // approver may grant less than requested
  accessExpiresAt: Date (nullable),            // set when approved = approvedAt + approvedDurationHours
  rejectedBy: ObjectId (ref: User, nullable),
  rejectionNote: String,
  revokedBy: ObjectId (ref: User, nullable),   // for manual early revocation
  revokedAt: Date (nullable),

  // What was actually granted (snapshot for clean revocation)
  grantedMembership: Boolean (default: false),       // was a project membership created?
  grantedVisibilityScope: String (nullable),         // 'all' | 'own' — visibility grant created?
  grantedCredentialReveal: Boolean (default: false), // one-time credential reveal?

  createdAt: Date,
  updatedAt: Date,
}
// Indexes: organisationId, requestedBy, status, accessExpiresAt
```

### 2c. Org settings: JIT policy

Add to Organisation model:
```ts
jitPolicy: {
  enabled: Boolean (default: false),
  maxDurationHours: Number (default: 24),
  requireReason: Boolean (default: true),
  allowedScopes: [String] (default: ['project','environment','credential']),
  autoApproveForManagers: Boolean (default: false),  // managers can self-approve for their projects
}
```

Settings UI in `/settings/organisation/general` — "Just-in-time access" section.

### 2d. API routes

#### `POST /api/jit/request`
Any authenticated user can call this.

```json
{
  "scope": "credential",
  "projectId": "...",
  "credentialId": "...",
  "requestedDurationHours": 4,
  "reason": "Production DB is unresponsive — need to verify connection string"
}
```

Validation: `requestedDurationHours <= org.jitPolicy.maxDurationHours`.

Creates `JITRequest` document. Notifies eligible approvers (project managers + sysadmin). Write AuditLog `jit.requested`.

#### `GET /api/jit/requests`
Query: `?status=pending&projectId=...`

Sysadmin: all org requests. Manager: requests on their projects. Others: their own requests.

#### `POST /api/jit/requests/:id/approve`
Project manager (for their projects) or sysadmin.

```json
{
  "approvedDurationHours": 4,   // may differ from requested — approver can reduce
  "note": "Approved for incident triage only"
}
```

Actions on approval:
1. Set `status = active`, `accessExpiresAt = now + approvedDurationHours`
2. Based on `scope`:
   - `project` → add user to `project.members` with `expiresAt = accessExpiresAt`, set `grantedMembership = true`
   - `environment` → add a scoped visibility grant limited to that environment, set `grantedVisibilityScope = 'all'`
   - `credential` → add a one-time-use reveal token valid until `accessExpiresAt`, set `grantedCredentialReveal = true`
3. Push real-time SSE event to requester: `jit_approved`
4. Send email notification to requester
5. Write AuditLog `jit.approved`

#### `POST /api/jit/requests/:id/reject`
```json
{ "rejectionNote": "Use the standard visibility request process instead" }
```
Write AuditLog `jit.rejected`.

#### `POST /api/jit/requests/:id/revoke`
Manual early revocation. Project manager or sysadmin.
Triggers the same cleanup as expiry (see cron below).
Write AuditLog `jit.revoked`.

### 2e. JIT expiry cron: `GET /api/cron/expire-jit-access`

Runs every 5 minutes: `"schedule": "*/5 * * * *"` in `vercel.json`.

Finds all JIT requests where `status = active` AND `accessExpiresAt < now`. For each:
1. If `grantedMembership = true` → remove from `project.members`
2. If `grantedVisibilityScope` is set → delete the visibility grant
3. If `grantedCredentialReveal = true` → invalidate the reveal token
4. Set `status = expired`
5. Notify the user: "Your JIT access to [scope] has expired."
6. Write AuditLog `jit.expired`

### 2f. UI

**"Request temporary access" button** — appears in three places:
- On the project list when a project is locked (user is not a member): "Request temporary access"
- On the credentials lock notice (Phase 03): "Request temporary access"
- On the env variable lock notice (Phase 07): "Request temporary access"

**JIT request modal:**
```
Request temporary access

Scope:       [Project / Specific environment / Specific credential]
Duration:    [1h] [2h] [4h] [8h] [24h]  ← pill selector, max set by org policy
Reason:      [required textarea]

[Cancel]   [Submit request]
```

**JIT dashboard** — on the main dashboard, a new card:

```
Active JIT sessions  (2)
  [●]  Rahul — XYZ Commerce credentials — expires in 2h 14m  [Revoke]
  [●]  Kavya — Alpha Analytics project — expires in 47m       [Revoke]
```

Visible to: managers (their projects) and sysadmin.

**My active JIT sessions** — on the user's dashboard:

```
Your active temporary access
  DB Password — XYZ Commerce — expires in 2h 14m
```

With a countdown timer updating in real time via the SSE connection.

---

## Part 3 — Break-glass emergency protocol

### 3a. What it is

The four-eyes principle and JIT approval queues are correct for normal operations. But during a P1 outage at 3am with production down and every second costing money, a 10-minute approval wait is unacceptable. Break-glass is the emergency exit — it provides instant access to critical credentials while making the action so visible and so auditable that it becomes its own deterrent against abuse.

### 3b. New model: `models/BreakGlassEvent.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  activatedBy: ObjectId (ref: User, required),
  reason: String (required),               // the incident description — required always
  incidentId: String (nullable),           // optional ticket/PagerDuty ID
  projectId: ObjectId (ref: Project, required),

  // What was accessed during the break-glass window
  credentialsAccessed: [{
    credentialId: ObjectId,
    label: String,                         // snapshot
    revealedAt: Date,
  }],

  // Lifecycle
  activatedAt: Date (required),
  windowMinutes: Number (default: 60),     // how long the window stays open
  expiresAt: Date (required),
  closedAt: Date (nullable),               // manually closed before expiry
  closedBy: ObjectId (ref: User, nullable),

  // Post-incident
  reviewStatus: String (enum: ['pending_review','reviewed','waived'], default: 'pending_review'),
  reviewedBy: ObjectId (ref: User, nullable),
  reviewNote: String,
  reviewedAt: Date (nullable),

  createdAt: Date,
}
// Indexes: organisationId, activatedBy, reviewStatus, activatedAt
```

### 3c. Org settings: break-glass policy

Add to Organisation model:
```ts
breakGlassPolicy: {
  enabled: Boolean (default: false),
  allowedRoles: [String] (default: ['sysadmin', 'devops', 'manager']),
  windowMinutes: Number (default: 60),
  requireIncidentId: Boolean (default: false),
  notifyRoles: [String] (default: ['sysadmin', 'ceo', 'coo']),
}
```

### 3d. API routes

#### `POST /api/break-glass/activate`
Who can call: roles listed in `breakGlassPolicy.allowedRoles`.

```json
{
  "projectId": "...",
  "reason": "Production DB connection dropping intermittently — P1 incident",
  "incidentId": "INC-4521"
}
```

Actions:
1. Create `BreakGlassEvent` document
2. Immediately grant the activating user a temporary JIT-style membership on the project with `expiresAt = now + windowMinutes`
3. Bypass all four-eyes checks — they can reveal any credential on that project without an approval
4. Push high-priority SSE event to ALL connected users with roles in `notifyRoles`
5. Send URGENT email to all notifyRoles members — subject line: `⚠ BREAK-GLASS ACTIVATED — [user] — [project]`
6. Send Slack notification (Phase 14 Sprint 2) if configured
7. Write AuditLog `break_glass.activated` — mark as `severity: critical`

Response includes `{ breakGlassId, expiresAt, message: "Break-glass active. All access is being logged." }`.

#### `GET /api/break-glass/active`
Returns all currently active break-glass events across the org. Sysadmin and notifyRoles only.

#### `POST /api/break-glass/:id/close`
Manually close a break-glass window before it expires. The activating user or sysadmin.

#### `GET /api/break-glass/history`
Paginated history of all events. Sysadmin only. Filters by user, project, date range, review status.

#### `POST /api/break-glass/:id/review`
Sysadmin only. Records the post-incident review.
```json
{
  "reviewNote": "Access was legitimate. Rahul resolved the DB connection pool issue within 40 minutes.",
  "reviewStatus": "reviewed"
}
```

### 3e. Break-glass credential reveal tracking

When a user reveals a credential while a break-glass event is active, the reveal endpoint must:
1. Detect that a break-glass event is active for this user + project
2. Log the reveal to `breakGlassEvent.credentialsAccessed`
3. Tag the AuditLog entry: `meta.breakGlass: true, meta.breakGlassId: '...'`
4. Do NOT send the usual visibility check — break-glass bypasses it

### 3f. UI

**Activate break-glass button** — NOT in the normal navigation. Placed only in:
- The project detail page: a red "Break-glass" button in the project action menu (three-dot)
- A keyboard shortcut: `Ctrl+Shift+B` when on a project page (with confirmation)

The button is styled to be unmistakable — red background, warning icon.

**Activation modal:**
```
⚠  Break-glass activation

You are about to bypass all access controls for XYZ Commerce.
This action will be immediately reported to:
  • Arjun Rao (Sysadmin)
  • Dhruv Joshi (CEO)
  • Meera Nair (COO)

Incident reason (required):
[____________________________________________]

Incident ID (optional, e.g. PagerDuty, Jira):
[____________________________________________]

[Cancel]   [Activate break-glass — 60 min window]
```

**Active break-glass banner** — when a break-glass window is active, a persistent RED banner appears at the top of every page for the activating user:

```
⚠  BREAK-GLASS ACTIVE — XYZ Commerce — expires in 47m  [Close window]
All credential access during this period is being logged and will require post-incident review.
```

**Break-glass dashboard** (`/settings/break-glass`):
- Pending review events (requires mandatory review before they can be dismissed)
- History of past events with who activated, what was accessed, and review status

A red badge on the sidebar "Break-glass" nav item shows the count of events pending review.

---

## Part 4 — Secret versioning and rollback

### 4a. What it is

Every time a credential value is changed, the previous value must be preserved in an encrypted ledger. Any authorised user can view the history and an admin can restore any previous version. This prevents the scenario where a wrong credential update causes a production outage that requires recreating the secret from scratch.

### 4b. New model: `models/CredentialVersion.ts`

```ts
{
  credentialId: ObjectId (ref: Credential, required),
  projectId: ObjectId (ref: Project, required),
  organisationId: ObjectId (ref: Organisation, required),
  version: Number (required),                // 1, 2, 3... auto-incremented
  value: String (required),                  // AES-256-GCM encrypted — same lib as Phase 06
  isSecret: Boolean,                         // snapshot from that version
  changedBy: ObjectId (ref: User, required),
  changedAt: Date (required),
  changeNote: String (nullable),             // optional note explaining the change
  restoredFrom: Number (nullable),           // if this version was a restore, which version was it from?
  createdAt: Date,
}
// Indexes: credentialId, version
// TTL policy: configurable per org — default: retain all versions (no TTL)
```

Same model for env variables: `models/EnvVariableVersion.ts` — identical shape but references `EnvVariable`.

### 4c. Version creation hook

In the Credential model pre-save hook (before the value changes):

```ts
CredentialSchema.pre('save', async function(next) {
  if (this.isModified('value') && !this.isNew) {
    // Capture the CURRENT (pre-change) value as a new version
    const latestVersion = await CredentialVersion.findOne(
      { credentialId: this._id },
      {},
      { sort: { version: -1 } }
    );
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    await CredentialVersion.create({
      credentialId: this._id,
      projectId: this.projectId,
      organisationId: this.organisationId,
      version: nextVersion,
      value: this.value,              // current (pre-update) encrypted value
      isSecret: this.isSecret,
      changedBy: this._currentEditorId,  // set by the API route before save
      changedAt: new Date(),
    });
  }
  next();
});
```

Add `_currentEditorId` as a virtual field on the model — set by API routes before calling save.

On credential creation (first save), also create version 1 immediately after insert.

### 4d. API routes

#### `GET /api/projects/:id/credentials/:credId/versions`
Returns version history, newest first.

Permissions: same as viewing the credential — visibility rules from Phase 03 apply.

Response:
```json
[
  {
    "version": 3,
    "changedBy": { "name": "Rahul Mehta", "role": "developer" },
    "changedAt": "2025-04-10T09:00:00Z",
    "changeNote": "Rotated after Q1 review",
    "isCurrentVersion": true,
    "value": "[ENCRYPTED]"
  },
  {
    "version": 2,
    "changedBy": { "name": "Priya Sharma", "role": "manager" },
    "changedAt": "2025-01-15T14:30:00Z",
    "restoredFrom": null,
    "value": "[ENCRYPTED]"
  },
  {
    "version": 1,
    "changedBy": { "name": "Rahul Mehta", "role": "developer" },
    "changedAt": "2024-10-01T11:00:00Z",
    "value": "[ENCRYPTED]"
  }
]
```

#### `GET /api/projects/:id/credentials/:credId/versions/:version/reveal`
Reveal the value of a specific version.
Permissions: same as the main credential reveal endpoint.
Write AuditLog `credential.version_revealed` with `meta: { version }`.

#### `POST /api/projects/:id/credentials/:credId/versions/:version/restore`
Restore a previous version as the current value.
Who can call: project manager, sysadmin — NOT the original developer (restore is a privileged action).

Actions:
1. Decrypt the historical version's value
2. Update the credential's `value` to the restored value (this triggers the pre-save hook, creating a new version that records the restore)
3. Set `changeNote = "Restored from version N"` and `restoredFrom = N` on the new version
4. Write AuditLog `credential.version_restored` with `meta: { fromVersion: N, toVersion: N+1 }`
5. Push SSE event `credential_updated` to project members

Same endpoints for env variables under `/api/projects/:id/envs/:envId/variables/:varId/versions/`.

### 4e. UI

**Version history icon** on each credential row — a clock icon `(⏱)` already exists from Phase 10 for audit history. Extend this to show the full version ledger:

```
Version history — Production DB Password

v3  Current    Rahul Mehta   10 Apr 2025  "Rotated after Q1 review"    [Reveal v3]
v2             Priya Sharma  15 Jan 2025                                 [Reveal v2]  [Restore to v2]
v1  Initial    Rahul Mehta   01 Oct 2024                                 [Reveal v1]  [Restore to v1]
```

Restore button shows a `ConfirmDialog`:
```
Restore version 2?
This will replace the current value with the value from 15 Jan 2025.
The current value will be saved as version 4.
A notification will be sent to the project team.

[Cancel]   [Restore]
```

**Change note on edit** — when updating a credential value, add an optional "Change note" field to the edit form:

```
New value         [••••••••••••••••]  [show]
Change note       [Rotated — old key expired]   (optional)
```

---

## Part 5 — Project credential templates

### 5a. What it is

Every Node.js + MongoDB + AWS project starts by manually adding the same 8–10 credential keys. Every Next.js + Postgres + Stripe project starts the same way. Templates let teams scaffold the credential panel of a new project in one click instead of 15 minutes of manual data entry.

### 5b. New model: `models/CredentialTemplate.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, nullable),  // null = built-in global template
  name: String (required),                                  // e.g. "Node.js + MongoDB + AWS"
  description: String,
  isBuiltIn: Boolean (default: false),                     // system templates cannot be deleted
  tags: [String],                                          // for filtering in the picker
  icon: String (nullable),                                 // lucide-react icon name

  // Credential stubs to create (values left blank — just structure)
  credentialStubs: [{
    category: String,
    label: String,
    isSecret: Boolean (default: true),
    environment: String (default: 'all'),
    group: String,
    runbookDescription: String (nullable),
    hint: String (nullable),                              // Phase 14 Sprint 2 request hints
  }],

  // Env variable stubs to create
  envStubs: [{
    key: String,
    isSecret: Boolean (default: true),
    group: String,
    environment: String (enum: ['staging','production','development','all'], default: 'all'),
  }],

  createdBy: ObjectId (ref: User, nullable),
  createdAt: Date,
  updatedAt: Date,
}
```

### 5c. Built-in templates to seed

Seed these on first run (`scripts/seed-templates.ts`):

| Template | Credentials included |
|---|---|
| Node.js + MongoDB + AWS S3 | DB URI, DB name, AWS Access Key, AWS Secret, S3 Bucket, AWS Region |
| Next.js + PostgreSQL + Stripe | DB URL, Stripe Secret Key, Stripe Webhook Secret, NextAuth Secret |
| React + Firebase | Firebase API Key, Auth Domain, Project ID, Storage Bucket, Messaging Sender ID |
| Django + PostgreSQL + Redis | DB URL, Redis URL, Django Secret Key, Allowed Hosts |
| Generic API service | API Base URL, API Key, Webhook Secret, Service Account Email |
| Email-heavy app | SMTP Host, SMTP Port, SMTP User, SMTP Pass, From Email, SendGrid API Key |

### 5d. API routes

#### `GET /api/credential-templates`
Returns all built-in templates + org's custom templates.

#### `POST /api/credential-templates`
Manager or sysadmin. Create a custom org template.

#### `POST /api/projects/:id/apply-template`
```json
{ "templateId": "...", "environments": ["staging", "production"] }
```

Actions:
1. Fetch the template
2. For each `credentialStub` → create a `Credential` document with empty `value` (or a placeholder `__FILL_IN__`)
3. For each `envStub` → create an `EnvVariable` in each specified environment with `value = '__FILL_IN__'`
4. Return `{ credentialsCreated: N, envVariablesCreated: N }`

The UI then navigates the user to the credentials panel with a "Fill in" mode active — unfilled values are highlighted in amber.

### 5e. UI

**Template picker on project creation** — on the Create Project modal (Phase 02), after the basic fields, add a final optional step:

```
Apply a credential template? (optional)

[Node.js + MongoDB + AWS]     [Next.js + PostgreSQL + Stripe]
[React + Firebase]            [Django + PostgreSQL + Redis]
[Generic API service]         [Email-heavy app]
[Your org: MERN + Cloudinary] [Create new template]

Skip this step →
```

Each template card shows the categories it populates and the number of credential stubs.

**"Fill in" mode** — after applying a template, the credential panel shows all stubs highlighted in amber with a "Needs value" label. A banner at the top:

```
⚠  3 credentials need values — this project was created from a template.
[Fill in credentials]
```

---

## Part 6 — Environment drift detection

### 6a. What it is

When staging has 28 env variables and production has 22, those 6 missing variables will cause a runtime error on the next production deploy of the feature that needs them. Drift detection catches this before deploy — not after.

### 6b. Algorithm (`lib/envDrift.ts`)

```ts
interface DriftReport {
  projectId: string;
  environmentA: { id: string; name: string; variableCount: number };
  environmentB: { id: string; name: string; variableCount: number };
  onlyInA: string[];      // keys present in A, missing from B
  onlyInB: string[];      // keys present in B, missing from A
  inBoth: string[];       // keys present in both (values may differ — not checked)
  driftScore: number;     // percentage of keys that are not in sync: 0 = perfect, 100 = totally different
  generatedAt: Date;
}

export async function computeDrift(
  envAId: string,
  envBId: string,
): Promise<DriftReport>
```

The drift score = `(onlyInA.length + onlyInB.length) / totalUniqueKeys * 100`.

### 6c. Drift monitoring config

Add to Project model:
```ts
driftMonitoring: {
  enabled: Boolean (default: false),
  baseEnvironmentId: ObjectId (ref: Environment, nullable),   // usually staging or dev
  compareEnvironmentId: ObjectId (ref: Environment, nullable), // usually production
  alertThresholdPercent: Number (default: 10),   // alert when drift > N%
  lastCheckedAt: Date (nullable),
  lastDriftScore: Number (nullable),
}
```

### 6d. Drift check cron: `GET /api/cron/check-env-drift`

Runs daily at 06:00 UTC: `"schedule": "0 6 * * *"`.

For each project with `driftMonitoring.enabled = true`:
1. Compute drift between `baseEnvironmentId` and `compareEnvironmentId`
2. If `driftScore > alertThresholdPercent`:
   - Create a Notification for the project manager: "[Project] — environment drift detected: [N] variables missing from production."
   - Enqueue email to manager
   - Update `lastDriftScore`
3. If `driftScore` went from above threshold to below → send a "drift resolved" notification

### 6e. API route

#### `GET /api/projects/:id/drift`
Returns the current drift report between the configured environments. Computed on-demand (not cached). Used by the UI.

### 6f. UI

**Project health score** (Phase 13) — drift now contributes:
- `driftScore > 20%` → -15 points (warning)
- `driftScore > 40%` → -25 points (critical)

**Drift indicator on the project detail page** — in the environments tab, when `driftMonitoring.enabled`:

```
Drift vs production
  staging has 28 variables  ·  production has 22  ·  Drift: 21%  ⚠

  Missing from production:
    FEATURE_FLAG_NEW_CHECKOUT    [+ Add to production]
    REDIS_URL                    [+ Add to production]
    ANALYTICS_API_KEY            [+ Add to production]
    ... and 3 more
```

"+ Add to production" pre-fills `AddVariableModal` with that key.

**Project settings** — enable drift monitoring with environment selects and threshold input.

---

## Part 7 — Project changelog feed

### 7a. What it is

A developer returns from 2 weeks of leave. Something is broken. They need to know what changed while they were gone. The audit log has the answer but it is raw and technical. The changelog is a human-readable digest of project activity — written in plain English, attributed to people, and scannable in 2 minutes.

### 7b. API route

#### `GET /api/projects/:id/changelog`
Query: `?since=2025-03-28&limit=50`

Queries the AuditLog for this project and transforms raw events into human-readable entries:

```ts
// Transformation map
const CHANGELOG_MESSAGES: Record<string, (meta: any, actor: User) => string> = {
  'credential.create':   (m, u) => `${u.name} added ${m.label} to ${m.category}`,
  'credential.edit':     (m, u) => `${u.name} updated ${m.label}`,
  'credential.delete':   (m, u) => `${u.name} removed ${m.label}`,
  'credential.rotated':  (m, u) => `${u.name} rotated ${m.label}`,
  'envvar.create':       (m, u) => `${u.name} added ${m.key} to ${m.environmentName}`,
  'member.added':        (m, u) => `${u.name} added ${m.targetName} to the project`,
  'member.removed':      (m, u) => `${u.name} removed ${m.targetName} from the project`,
  'visibility.grant':    (m, u) => `${u.name} gave ${m.targetName} full credential visibility`,
  'project.archived':    (m, u) => `${u.name} archived this project`,
  'access_review.completed': (m, u) => `${u.name} completed an access review`,
  'break_glass.activated':   (m, u) => `${u.name} activated break-glass access`,
};
```

Groups events by day. Returns:
```json
[
  {
    "date": "2025-04-10",
    "label": "Today",
    "events": [
      { "actor": { "name": "Rahul Mehta", "initials": "RM", "role": "developer" },
        "message": "Rahul Mehta added SendGrid API Key to smtp",
        "at": "2025-04-10T09:30:00Z",
        "url": "/projects/abc123?tab=smtp" }
    ]
  },
  {
    "date": "2025-04-08",
    "label": "2 days ago",
    "events": [ ... ]
  }
]
```

### 7c. UI

**Changelog tab** on project detail page — add "Changelog" to the project tabs alongside Credentials, Environments, Access control, Settings:

```
[Credentials]  [Environments]  [Changelog]  [Access control]  [Settings]
```

**Changelog feed:**

```
Today

  [RM]  Rahul Mehta added SendGrid API Key to smtp                    9:30am
  [PS]  Priya Sharma updated Production DB Password                   8:15am

2 days ago

  [SK]  Sunil Kumar added DATABASE_URL to staging environment          3:45pm  →
  [PS]  Priya Sharma added Kavya Reddy to the project                 11:20am  →
  [AR]  Arjun Rao gave Rahul Mehta full credential visibility         10:05am  →

Last week

  [PS]  Priya Sharma completed an access review                       Fri 4pm  →
  [RM]  Rahul Mehta rotated AWS Access Key                            Wed 2pm  →
```

Each entry is clickable (navigates to `event.url`). Actor avatar shown. Arrow `→` indicates the link is active.

**Dashboard widget** — "Recent activity on your projects" card (Phase 12 added this for the activity feed — update it to use the changelog endpoint for better formatting).

---

## New model summary

| Model | Purpose |
|---|---|
| `JITRequest` | Temporary scoped access with auto-expiry |
| `BreakGlassEvent` | Emergency access bypass with full audit trail |
| `CredentialVersion` | Encrypted historical ledger of credential values |
| `EnvVariableVersion` | Same, for environment variables |
| `CredentialTemplate` | Reusable credential scaffolding for new projects |

---

## New AuditLog actions

```
'jit.requested', 'jit.approved', 'jit.rejected', 'jit.expired', 'jit.revoked',
'break_glass.activated', 'break_glass.closed', 'break_glass.reviewed',
'credential.version_revealed', 'credential.version_restored',
'member.expired',
'template.applied',
```

---

## New cron jobs

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/check-member-expiry` | `0 7 * * *` | Warn and expire time-bound memberships |
| `/api/cron/expire-jit-access` | `*/5 * * * *` | Revoke expired JIT grants every 5 minutes |
| `/api/cron/check-env-drift` | `0 6 * * *` | Detect env variable drift and notify |

---

## Settings sidebar additions

```
Organisation
  ├── General                ← add JIT policy + break-glass policy sections
  ├── Structure & teams
  ├── Roles & permissions
  ├── Members
  ├── Permission requests    [badge]
  ├── Access reviews         [badge]
  ├── Offboarding            [badge]
  ├── Break-glass            [pending review badge]   ← NEW
  ├── JIT access             [active sessions badge]  ← NEW
  ├── Change windows
  ├── Sharing policy
  ├── Approvals              [badge]
  ├── Webhooks
  ├── Reports
  └── Audit log
```

---

## Deliverable checklist

**Part 1 — Time-bound memberships**
- [ ] `expiresAt` and `expiryNotifiedAt` fields on project members subdocument
- [ ] Add member modal includes optional expiry date picker
- [ ] Members list shows expiry badges with color coding
- [ ] Cron `check-member-expiry` sends 7-day warnings and executes expiry
- [ ] Expiry preserves visibility grants (same as manual removal — Phase 10 rule)
- [ ] AuditLog `member.expired` written correctly

**Part 2 — JIT access**
- [ ] `JITRequest` model with all fields and indexes
- [ ] JIT policy config in org settings
- [ ] `POST /api/jit/request` validates duration against policy cap
- [ ] Approve endpoint creates the correct grant type (membership / visibility / reveal token)
- [ ] 5-minute expiry cron revokes all three grant types correctly
- [ ] "Request temporary access" button appears in project lock, credential lock, env lock contexts
- [ ] JIT request modal with scope, duration pills, and reason
- [ ] Active JIT sessions card on manager/sysadmin dashboard
- [ ] Real-time countdown on user's own active sessions via SSE
- [ ] AuditLog entries for all JIT lifecycle events

**Part 3 — Break-glass**
- [ ] `BreakGlassEvent` model with credential access tracking
- [ ] Break-glass policy in org settings
- [ ] Activate endpoint creates JIT membership, sends urgent notifications to all notifyRoles
- [ ] Credential reveal during active break-glass logs to `credentialsAccessed` and tags AuditLog
- [ ] Four-eyes check bypassed for project during active window
- [ ] Red persistent banner shown to activating user
- [ ] Activation modal lists all notifyRoles by name
- [ ] `/settings/break-glass` page with pending reviews and history
- [ ] Pending review badge on sidebar nav item
- [ ] Review endpoint marks event reviewed
- [ ] AuditLog entries marked `severity: critical`

**Part 4 — Secret versioning**
- [ ] `CredentialVersion` and `EnvVariableVersion` models created
- [ ] Pre-save hook creates version entry before every value change
- [ ] Version 1 created on credential creation
- [ ] `GET .../versions` returns history newest-first
- [ ] `GET .../versions/:v/reveal` decrypts and logs the historical value
- [ ] `POST .../versions/:v/restore` restricted to manager/sysadmin
- [ ] Restore creates a new version with `restoredFrom` set
- [ ] Version history panel renders in UI with reveal/restore buttons per row
- [ ] Restore confirmation dialog shows date and who made that version
- [ ] Change note field added to credential edit form

**Part 5 — Credential templates**
- [ ] `CredentialTemplate` model created
- [ ] Built-in templates seeded via `scripts/seed-templates.ts`
- [ ] Template picker added as final optional step in Create Project modal
- [ ] `POST /api/projects/:id/apply-template` creates stubs correctly per environment
- [ ] Unfilled stubs highlighted in amber with "Needs value" label
- [ ] "Fill in credentials" banner shown after template applied
- [ ] Org can create custom templates (manager/sysadmin)

**Part 6 — Environment drift**
- [ ] `lib/envDrift.ts` computes drift report with score
- [ ] `driftMonitoring` config on Project model
- [ ] Daily drift cron fires notifications when threshold exceeded
- [ ] Drift contributes to health score (Phase 13 scoring updated)
- [ ] Drift indicator in the environments tab
- [ ] "Add to production" shortcut pre-fills AddVariableModal
- [ ] Project settings shows drift monitoring toggle + config

**Part 7 — Changelog**
- [ ] `GET /api/projects/:id/changelog` transforms AuditLog into human-readable entries
- [ ] Groups by day with relative day labels
- [ ] All major action types have human-readable transformation messages
- [ ] Changelog tab added to project detail page
- [ ] Feed renders with actor avatar, message, time, and navigation link
- [ ] Dashboard activity widget updated to use changelog format

**General**
- [ ] All new cron routes added to `vercel.json`
- [ ] All new models have correct indexes
- [ ] ESLint clean
- [ ] `npm run build` zero TypeScript errors
- [ ] Integration tests for: JIT grant and expiry cycle, break-glass credential reveal bypass, version restore, drift detection threshold alert
