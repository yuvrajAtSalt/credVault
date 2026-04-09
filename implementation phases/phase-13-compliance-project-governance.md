# VaultStack — Phase 13: Industry-Standard Project Management, Compliance & Operational Maturity

> Prerequisite: Phase 12 complete. Email, search, real-time updates all working.
>
> This phase elevates VaultStack from a credentials tool to a full project governance platform.
> Every feature here is drawn from how engineering organisations at 50–500 person scale
> actually operate: access reviews, compliance trails, SLA tracking, change windows,
> onboarding/offboarding checklists, credential sharing policies, and operational runbooks.

---

## Overview of systems added in this phase

1. **Access review cycles** — periodic forced review of who has access to what
2. **Offboarding workflow** — structured checklist when an employee leaves
3. **Credential sharing policy** — org-level rules on how secrets move
4. **Change windows** — scheduled maintenance periods during which credentials can be rotated
5. **Project health dashboard** — stale credentials, missing envs, coverage gaps
6. **Compliance reports** — exportable PDF/CSV reports for audits
7. **SLA and uptime tagging** — mark projects and credentials as business-critical
8. **Runbook attachments** — link documentation to credentials and projects
9. **Two-person rule (4-eyes principle)** — critical credentials require a second approver
10. **Activity digest emails** — weekly summary for managers and C-suite

---

## Part 1 — Access review cycles

### 1a. What it is

Every 30/60/90 days (configurable), sysadmin or managers are reminded to review who still needs access to each project and each visibility grant. This is a SOC 2 / ISO 27001 requirement. Without it, ex-contractors, rotated team members, and forgotten grants accumulate indefinitely.

### 1b. New model: `models/AccessReview.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  projectId: ObjectId (ref: Project, required),
  initiatedBy: ObjectId (ref: User),
  status: String (enum: ['pending','in_progress','completed','overdue'], default: 'pending'),
  dueDate: Date (required),
  completedAt: Date (nullable),
  reviewPeriodDays: Number,        // 30 | 60 | 90

  // Snapshot of membership at the time review was initiated
  membersToReview: [{
    userId: ObjectId (ref: User),
    name: String,                  // snapshot in case user is later deleted
    role: String,
    addedAt: Date,
    visibilityScope: String,       // 'own' | 'all'
    decision: String (enum: ['approved','removed','pending'], default: 'pending'),
    decidedBy: ObjectId (ref: User, nullable),
    decidedAt: Date (nullable),
    note: String,
  }],

  createdAt: Date,
  updatedAt: Date,
}
// Indexes: organisationId, projectId, status, dueDate
```

### 1c. Org settings: access review config

Add to Organisation model:
```ts
accessReviewPolicy: {
  enabled: Boolean (default: false),
  frequencyDays: Number (default: 90),    // 30 | 60 | 90 | 180
  reminderDaysBeforeDue: Number (default: 7),
  autoRevokeOnMiss: Boolean (default: false),  // if true, pending decisions auto-revoke on due date
}
```

Settings UI: `/settings/organisation/general` — add "Access review" section:
```
Access reviews
[Toggle]  Enable periodic access reviews
Frequency  [Select: Every 30 / 60 / 90 / 180 days]
Reminder   [Input: N] days before due date
[Toggle]  Auto-revoke unreviewed access when review expires
```

### 1d. API routes

#### `POST /api/access-reviews/initiate`
Sysadmin or manager (for their projects).
Body: `{ projectId, dueDate? }` — if no dueDate, default = now + `frequencyDays`.
Snapshots current membership, creates review document, creates Notification for reviewer(s), enqueues email.

#### `GET /api/access-reviews`
Query: `?status=pending&projectId=...&page=&limit=`
Returns reviews with populated member details.

#### `PATCH /api/access-reviews/:reviewId/members/:userId`
Record a decision for one member.
Body: `{ decision: 'approved' | 'removed', note? }`
If `decision === 'removed'` → also call the member removal logic (keeps visibility grant handling from Phase 10).

#### `POST /api/access-reviews/:reviewId/complete`
Mark the review complete. Only callable when all members have a non-pending decision, OR sysadmin override.

#### Cron: `GET /api/cron/check-access-reviews`
Runs daily. Finds reviews where `dueDate < now` and `status !== 'completed'`:
- Sets status → `overdue`
- If `autoRevokeOnMiss === true` → auto-removes all `pending` members
- Sends overdue notification to sysadmin
Add to `vercel.json` schedule: `0 8 * * *`.

### 1e. Access review UI

Route: `/settings/access-reviews`

List of all reviews across all accessible projects. Filter by status, project.

**Review detail page** (`/settings/access-reviews/:reviewId`):

```
Access review — XYZ Commerce
Due: 15 May 2025  ·  12 members to review  ·  3 reviewed  ·  9 pending

Progress bar: ████░░░░░░░░  25%

─────────────────────────────────────────────────────────
[Avatar] Rahul Mehta    Developer    Added 3mo ago    Visibility: all
         [Keep access ✓]  [Remove ✕]  [Add note...]

[Avatar] Kavya Reddy    QA           Added 6mo ago    Visibility: own
         [Keep access ✓]  [Remove ✕]  [Add note...]
─────────────────────────────────────────────────────────

[Complete review]   ← enabled only when all decided
```

Inline approve/remove — no page reload. Progress bar updates in real time.

---

## Part 2 — Employee offboarding workflow

### 2a. What it is

When an employee leaves, a structured checklist ensures nothing is missed: projects are handed over, credentials they owned are noted, access is fully revoked, equipment is returned. Currently, deactivating a user (Phase 09) only sets `isActive: false`. This is not enough.

### 2b. New model: `models/OffboardingChecklist.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  userId: ObjectId (ref: User, required),           // the departing employee
  initiatedBy: ObjectId (ref: User),
  targetDate: Date,                                  // last working day
  status: String (enum: ['in_progress','completed'], default: 'in_progress'),

  steps: [{
    id: String,                     // e.g. 'project_handover', 'revoke_access', 'credential_audit'
    label: String,
    description: String,
    status: String (enum: ['pending','completed','skipped']),
    completedBy: ObjectId (ref: User, nullable),
    completedAt: Date (nullable),
    note: String,
    meta: Mixed,                    // e.g. { projectsHandedOver: [...] }
  }],

  credentialAudit: [{               // credentials added by this user across all projects
    credentialId: ObjectId,
    projectName: String,
    label: String,
    category: String,
    action: String (enum: ['retain','reassign','delete','pending'], default: 'pending'),
    actionBy: ObjectId (ref: User, nullable),
  }],

  createdAt: Date,
  updatedAt: Date,
}
```

### 2c. Default offboarding steps

```ts
const DEFAULT_STEPS = [
  { id: 'project_handover',    label: 'Hand over active projects',         description: 'Assign a successor manager for each active project this person manages.' },
  { id: 'credential_audit',    label: 'Audit owned credentials',           description: 'Review all credentials added by this employee. Decide to retain, reassign, or delete each.' },
  { id: 'revoke_project_access', label: 'Revoke all project memberships',  description: 'Remove this person from all active projects.' },
  { id: 'revoke_visibility',   label: 'Revoke residual visibility grants', description: 'Remove any remaining credential visibility grants.' },
  { id: 'revoke_special_perms', label: 'Revoke special permissions',       description: 'Cancel all active special permission grants.' },
  { id: 'deactivate_account',  label: 'Deactivate account',                description: 'Set account to inactive. This prevents login.' },
  { id: 'notify_team',         label: 'Notify relevant teams',            description: 'Inform project managers and team leads of the departure.' },
];
```

### 2d. API routes

#### `POST /api/offboarding/initiate`
Sysadmin only.
Body: `{ userId, targetDate }`
Creates checklist with default steps + populates `credentialAudit` by fetching all non-deleted credentials where `addedBy === userId`.
Sends `OffboardingStarted` notification to the initiating admin.

#### `GET /api/offboarding/:checklistId`
Returns full checklist with populated data.

#### `PATCH /api/offboarding/:checklistId/steps/:stepId`
Mark a step complete/skipped.
Body: `{ status, note? }`
When `project_handover` is completed → verify all the user's managed projects have a successor.
When `deactivate_account` is completed → automatically call the user deactivation logic.

#### `PATCH /api/offboarding/:checklistId/credentials/:credentialId`
Record a decision on a credential audit item.
Body: `{ action: 'retain' | 'reassign' | 'delete', assigneeId? }`
`retain` → no change, credential stays under original addedBy.
`reassign` → updates `addedBy` on the credential to `assigneeId`.
`delete` → soft-deletes the credential.

#### `POST /api/offboarding/:checklistId/complete`
All required steps must be completed (not skipped) before this is callable, except `notify_team` which may be skipped. Marks checklist complete, sends completion email to sysadmin.

### 2e. Offboarding UI

Route: `/settings/offboarding` — list of active and completed checklists.

**Checklist detail** (`/settings/offboarding/:id`):

```
Offboarding — Rahul Mehta
Last working day: 30 April 2025    Status: In progress    3 / 7 steps complete

[Progress: ████████░░░░░░  43%]

Step 1: Hand over active projects  [✓ Completed]
  XYZ Commerce → Priya Sharma
  Gamma CRM    → Sunil Kumar

Step 2: Audit owned credentials  [In progress]
  ┌──────────────────────────────────────────────────────────┐
  │ SendGrid API Key   SMTP   XYZ Commerce   [Retain ▾] [✓]  │
  │ DB Password        DB     Alpha Analytics [Reassign ▾] →  │
  │ AWS Access Key     S3     Beta Mobile    [Delete ▾]  [✓] │
  └──────────────────────────────────────────────────────────┘

Step 3: Revoke project memberships  [Pending]   [Complete step]

...
```

---

## Part 3 — Credential sharing policy

### 3a. What it is

Organisations need rules about HOW credentials leave VaultStack. Can developers export `.env` files? Can they copy individual secrets to Slack? This policy layer adds guardrails.

### 3b. Org settings: sharing policy

Add to Organisation model:
```ts
credentialSharingPolicy: {
  allowEnvFileExport: Boolean (default: true),
  allowCopyToClipboard: Boolean (default: true),
  allowBulkExport: Boolean (default: false),        // bulk export of all creds in a project
  requireExportJustification: Boolean (default: false), // if true, user must state why before export
  maxExportsPerDayPerUser: Number (default: 0),     // 0 = unlimited
  allowedExportRoles: [String],                     // empty = all roles; else restrict to these roles
  watermarkExports: Boolean (default: false),        // append org/user info to exported files
}
```

### 3c. Enforcement

#### Export endpoint (`GET /api/projects/:id/envs/:envId/export` — Phase 07)

Apply policy checks before returning the file:

```ts
const policy = org.credentialSharingPolicy;

if (!policy.allowEnvFileExport) return 403 { code: 'EXPORT_DISABLED' };
if (policy.allowedExportRoles.length > 0 && !policy.allowedExportRoles.includes(user.role))
  return 403 { code: 'ROLE_NOT_PERMITTED_TO_EXPORT' };
if (policy.requireExportJustification && !body.justification)
  return 400 { code: 'JUSTIFICATION_REQUIRED' };
if (policy.maxExportsPerDayPerUser > 0) {
  const todayCount = await AuditLog.countDocuments({
    actorId: user._id, action: 'envvar.export',
    createdAt: { $gte: startOfDay }
  });
  if (todayCount >= policy.maxExportsPerDayPerUser)
    return 429 { code: 'DAILY_EXPORT_LIMIT_REACHED' };
}

if (policy.watermarkExports) {
  // Append to the file:
  // # Exported by: Rahul Mehta (developer) at 2025-04-10 09:32 UTC
  // # Organisation: Acme Corp | Do not share outside the organisation
}
```

#### Clipboard copy

The copy action is client-side. If `allowCopyToClipboard === false`, disable the copy button on all credential rows and show a tooltip: "Copying is disabled by your organisation policy."

Fetch policy once at dashboard load and store in context.

#### Export justification modal

If `requireExportJustification === true`, show a modal before the export download starts:

```
Why do you need this export?
[_____________________________________________]
You are about to download 12 environment variables for XYZ Commerce (staging).
This action will be logged.

[Cancel]   [Proceed with export]
```

### 3d. Policy settings UI

In `/settings/organisation/general`, add "Credential sharing policy" section using custom Toggle and Select components.

---

## Part 4 — Change windows

### 4a. What it is

Production credentials should not be rotated at random times. Change windows define scheduled periods (e.g. "every Tuesday 02:00–04:00 UTC") during which changes to production credentials are permitted. Outside a window, writes to production credentials require an override reason.

### 4b. New model: `models/ChangeWindow.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  name: String (required),              // e.g. "Weekly maintenance window"
  description: String,
  schedule: {
    type: String (enum: ['recurring','one_time']),
    // recurring:
    dayOfWeek: Number (0=Sun, 1=Mon...6=Sat, nullable),
    startHour: Number,                  // UTC hour 0-23
    startMinute: Number,
    durationMinutes: Number,
    // one_time:
    startAt: Date (nullable),
    endAt: Date (nullable),
  },
  appliesToEnvironments: [String],      // e.g. ['production'] — empty = all
  appliesToProjects: [ObjectId],        // empty = org-wide
  requiresApprovalOutsideWindow: Boolean (default: true),
  isActive: Boolean (default: true),
  createdBy: ObjectId (ref: User),
  createdAt: Date,
}
// Index: organisationId, isActive
```

### 4c. Enforcement

In `POST /api/projects/:id/credentials` and `PATCH /api/projects/:id/credentials/:credId`:

```ts
// Check if credential's environment matches any active change window
// If outside window AND requiresApprovalOutsideWindow === true:
//   - Allow the write BUT require body.changeReason (string, required)
//   - Log the out-of-window change in AuditLog with meta.outOfWindow: true
//   - Notify project manager + sysadmin

// Inside window: allow normally
// Outside window, no changeReason provided: return 400 { code: 'CHANGE_WINDOW_REQUIRED', message: '...' }
```

Same logic for env variable writes.

### 4d. UI

When a user tries to edit a production credential outside a change window, the edit form shows a warning banner:

```
⚠  Outside change window
Production credentials should be modified during the weekly maintenance window
(Tuesday 02:00–04:00 UTC). You can still proceed, but you must provide a reason.

Change reason (required):
[_____________________________________________]
```

### 4e. Change windows settings UI

Route: `/settings/organisation/change-windows`

List of defined windows. Create/edit/delete. Toggle active/inactive.

---

## Part 5 — Project health dashboard

### 5a. What it is

A single view showing the "hygiene score" of all projects — which ones have stale credentials, missing environments, no recent activity, or expiring secrets.

### 5b. Health score algorithm (`lib/projectHealth.ts`)

```ts
interface ProjectHealthScore {
  projectId: string;
  score: number;               // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: HealthIssue[];
}

interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  url: string;                 // deep link to fix it
}
```

**Scoring rules:**

| Issue | Severity | Score deduction |
|---|---|---|
| Has credentials expiring in ≤ 7 days | critical | -25 |
| Has credentials expiring in ≤ 30 days | warning | -10 |
| No credentials added in > 180 days + project is active | warning | -10 |
| Has `sensitivityLevel: critical` credential with no rotation in > 90 days | critical | -20 |
| No environment defined at all | warning | -15 |
| Environment exists but has < 3 variables | info | -5 |
| Env variable with `isSecret: true` has `isOverridden: false` in all envs (same value in staging + prod) | warning | -10 |
| Project has active members with `visibilityScope: all` and role `developer` | info | -5 |
| No access review completed in > `frequencyDays` | warning | -10 |
| Has pending credential access requests > 7 days old | info | -5 |

Grade brackets: A = 90–100, B = 75–89, C = 60–74, D = 40–59, F = 0–39.

### 5c. API

#### `GET /api/projects/health`
Sysadmin/manager only. Computes health scores for all accessible projects.
Returns array sorted by score ascending (worst first).

#### `GET /api/projects/:id/health`
Health score for a single project. Accessible to all project members.

### 5d. Health UI

**Dashboard widget (all roles):** A "Project health" card showing the user's worst-scoring project with the top 2 issues and a "Fix it →" link.

**Health overview page** (`/projects/health` — sysadmin and managers):

```
Project health overview
[Filter: All grades ▾]  [Sort: Worst first ▾]

┌──────────────────────────────────────────────────────┐
│ F  XYZ Commerce                Score: 35/100          │
│    ● 2 credentials expiring in 3 days    [Fix →]      │
│    ● Critical credential unchanged 94 days [Fix →]   │
│    ● No access review in 97 days         [Fix →]      │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ C  Alpha Analytics             Score: 68/100          │
│    ⚠ No environment defined                [Fix →]    │
└──────────────────────────────────────────────────────┘
```

Grade shown as a large letter badge: F=red, D=orange, C=amber, B=teal, A=green.

On the **project detail page**, add a health score chip in the project header:
```
[A 94]  XYZ Commerce  [active]  [react]  [production]
```
Clicking the chip opens the health detail panel.

---

## Part 6 — Compliance reports

### 6a. Report types

Three built-in report types, all exportable as PDF and CSV:

#### Report 1: Access audit report
For a given date range, shows:
- All project memberships (who had access to what, when)
- All visibility grants (who could see what)
- All credential reveals (who revealed what, when, what reason for critical)
- All access review results

#### Report 2: Credential lifecycle report
- All credentials created, edited, deleted in the period
- Which ones are expiring, which were rotated
- Out-of-change-window modifications
- Export actions (by whom, when, format)

#### Report 3: User activity report
- Login/logout events
- Permission grants and revocations
- Onboarding and offboarding actions
- Role changes

### 6b. API

#### `POST /api/reports/generate`
Sysadmin only.
Body:
```json
{
  "type": "access_audit" | "credential_lifecycle" | "user_activity",
  "from": "2025-01-01",
  "to": "2025-03-31",
  "format": "pdf" | "csv",
  "projectIds": [],       // empty = all projects
  "userIds": []           // empty = all users
}
```

Generating a report is async — returns `{ reportId, status: 'generating' }`.

#### `GET /api/reports/:reportId`
Returns report status (`generating` | `ready` | `failed`) and a download URL when ready.

### 6c. Report generation model: `models/Report.ts`

```ts
{
  organisationId: ObjectId,
  type: String,
  parameters: Mixed,
  status: String (enum: ['generating','ready','failed']),
  fileUrl: String (nullable),        // stored in /tmp or object storage
  fileSize: Number,
  generatedBy: ObjectId (ref: User),
  generatedAt: Date (nullable),
  error: String (nullable),
  createdAt: Date,
}
// TTL: auto-delete after 30 days
```

### 6d. Report generation

Use `@react-pdf/renderer` (already introduced in Phase 12).

Each report type has a React PDF template in `lib/reports/templates/`. The template receives the raw data and renders it into a structured PDF with:
- Cover page: VaultStack logo, org name, report type, date range, generated by, generated at
- Table of contents
- Sections matching the report type
- Footer: page numbers, confidentiality notice

For CSV: use `csv-stringify` (npm install csv-stringify) — stream rows directly.

### 6e. Reports UI

Route: `/settings/reports`
Sysadmin only.

```
Compliance reports

[+ Generate report]

Past reports:
  Access audit  · Jan 2025 – Mar 2025  · PDF  · 234 KB  · [Download] [Delete]
  User activity · Q4 2024             · CSV  · 18 KB   · [Download] [Delete]
```

Generate report modal: type select, date range picker (custom DateRangePicker component), format toggle, optional project/user filter.

When generating: show a spinner in the report row with "Generating..." text. Poll `GET /api/reports/:id` every 3 seconds until `status === 'ready'`, then enable the Download button.

---

## Part 7 — Business criticality tagging

### 7a. What it is

Not all projects are equal. A production payment API is more critical than an internal analytics dashboard. Tagging projects and credentials with a criticality level enables prioritised health monitoring and stricter policies.

### 7b. Model updates

Add to `models/Project.ts`:
```ts
criticality: String (enum: ['low','medium','high','critical'], default: 'medium'),
slaUptimePercent: Number (nullable),     // e.g. 99.9
oncallContact: String (nullable),         // email or phone of on-call person
```

Add to `models/Credential.ts` (already has `sensitivityLevel` — this is separate):
```ts
businessCriticality: String (enum: ['low','medium','high','critical'], default: 'medium'),
```

### 7c. Criticality UI

On the project card and project header, show a criticality badge:
```
[● CRITICAL]  [● HIGH]  [● MEDIUM]  [● LOW]
```
Colors: critical=red, high=orange, medium=amber, low=green.

In the project settings tab, allow managers and above to set criticality, SLA uptime %, and on-call contact.

Health scoring uses criticality as a multiplier: a `critical` project with an expiring credential scores 2× worse than a `low` project.

---

## Part 8 — Runbook attachments

### 8a. What it is

Credentials don't exist in a vacuum. A database password should link to the runbook that explains how to rotate it. An AWS key should link to the IAM policy documentation. This is the "why and how" layer on top of the "what".

### 8b. Model update: `models/Credential.ts`

```ts
runbook: {
  url: String (nullable),             // external link e.g. Confluence, Notion, GitHub Wiki
  description: String (nullable),     // one-line description of what the runbook covers
  rotationSteps: String (nullable),   // plain-text steps for rotating this credential
  lastRotatedAt: Date (nullable),     // when was this credential last actually rotated
  rotatedBy: ObjectId (ref: User, nullable),
},
```

### 8c. Runbook UI

On the credential row, add a `[📖]` runbook icon button. Only shown if `runbook.url` or `runbook.rotationSteps` is set.

Clicking opens a **Runbook panel** (side panel or modal):

```
Runbook — Production DB Password

Description: Primary PostgreSQL password for the production cluster

Rotation steps:
  1. Connect to the DB admin console
  2. Run: ALTER USER xyz_admin PASSWORD 'new_password';
  3. Update this credential in VaultStack
  4. Restart the application pods
  5. Verify connectivity

External doc: [Confluence: DB Rotation Procedure →]

Last rotated: 45 days ago by Rahul Mehta
[Mark as rotated now]  ← updates lastRotatedAt + rotatedBy
```

"Mark as rotated now" button: updates `runbook.lastRotatedAt = now` and `rotatedBy = currentUser`. Writes AuditLog `credential.rotated`. Clears any expiry warning if the credential has an `expiresAt`.

### 8d. Runbook add/edit form

On `AddCredentialModal` and the credential edit flow, add a collapsible "Runbook (optional)" section at the bottom:
- URL field
- Description field
- Rotation steps (Textarea)

---

## Part 9 — Two-person rule (4-eyes principle)

### 9a. What it is

For `sensitivityLevel: critical` credentials, a single person should never be able to reveal, export, or rotate alone without a second person's approval. This is the 4-eyes principle used in banking, healthcare, and high-security engineering contexts.

### 9b. New model: `models/ApprovalRequest.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  requestedBy: ObjectId (ref: User, required),
  action: String (enum: ['reveal','export','rotate','delete']),
  targetType: String (enum: ['Credential','EnvVariable']),
  targetId: ObjectId (required),
  targetLabel: String,            // snapshot for display
  projectId: ObjectId (ref: Project),
  reason: String (required),
  status: String (enum: ['pending','approved','rejected','expired'], default: 'pending'),
  approvedBy: ObjectId (ref: User, nullable),
  approvedAt: Date (nullable),
  rejectedBy: ObjectId (ref: User, nullable),
  rejectionNote: String,
  expiresAt: Date,                // approval expires after 15 minutes
  usedAt: Date (nullable),        // when the approved action was actually performed
  createdAt: Date,
}
// Index: organisationId, requestedBy, status, expiresAt
```

### 9c. Policy config

Add to Organisation model:
```ts
fourEyesPolicy: {
  enabled: Boolean (default: false),
  appliesToSensitivity: [String] (default: ['critical']),   // 'sensitive' | 'critical'
  approverRoles: [String] (default: ['manager', 'sysadmin']),  // who can approve
  approvalExpiryMinutes: Number (default: 15),
}
```

### 9d. Enforcement flow

When a user tries to reveal/export/delete a `critical` credential and `fourEyesPolicy.enabled === true`:

**Step 1 — Request:**
The reveal button opens a modal:
```
Approval required

You need a second approver to access this critical credential.
An approval request will be sent to your project manager.

Reason for access (required):
[____________________________________________]

[ Cancel ]   [ Request approval ]
```

Submits to `POST /api/approval-requests`.
Sends real-time SSE push + email to all eligible approvers.

**Step 2 — Approver notification:**
The approver sees a notification: "[Name] is requesting to reveal [credential label] on [project]".
Clicking → `/settings/approvals` page or inline in the notification panel.

```
[Name] wants to reveal: Production DB Password (XYZ Commerce)
Reason: "Emergency deployment fix — prod is down"
Expires in: 14 minutes

[Reject]  [Approve]
```

Approve → `POST /api/approval-requests/:id/approve`.

**Step 3 — Requester action:**
The requester's credential row updates in real-time (SSE: `approval_granted` event) — the reveal button becomes active and shows "Approved (expires 14 min)".

After the reveal, `usedAt` is set. The approval can only be used once.

### 9e. Approvals UI

Route: `/settings/approvals`

Pending approval requests requiring my action (as an approver).
My pending requests (as a requester).
History: last 30 days.

---

## Part 10 — Weekly activity digest emails

### 10a. What it is

Every Monday at 08:00 UTC, managers and C-suite receive a digest of the previous week's activity across their projects.

### 10b. Digest content (per recipient)

**For managers:** Scoped to their projects only.
- New credentials added
- Credentials expiring soon
- Access review status
- New team members added or removed
- Permission requests submitted or resolved
- Project health score changes

**For C-suite and sysadmin:** Org-wide.
- Summary stats (new users, new projects, total credentials, active sessions)
- Worst-scoring health projects
- Open offboarding checklists
- Overdue access reviews
- Pending approval requests

### 10c. Email template: `templates/WeeklyDigest.tsx`

Props: `{ recipientName, role, weekRange, sections: DigestSection[] }`

```
VaultStack — Weekly digest
Week of 7–13 April 2025

Your projects this week
───────────────────────
XYZ Commerce            Health: B (82)   2 new credentials   1 expiring
Alpha Analytics         Health: A (94)   No changes
Beta Mobile             Health: C (66)   ⚠ 3 expiring soon

Access reviews due
───────────────────────
XYZ Commerce review due in 7 days   [Start review →]

[View full dashboard →]
```

### 10d. Digest cron

`GET /api/cron/weekly-digest` — runs every Monday at 08:00 UTC.
Add to `vercel.json`: `"schedule": "0 8 * * 1"`.

Builds per-recipient digest, enqueues email via EmailQueue.

Users can opt out in notification preferences (new toggle: "Weekly activity digest").

---

## Part 11 — Misc industry standards

### 11a. Data retention policy

Add to Organisation model:
```ts
dataRetentionPolicy: {
  auditLogRetentionDays: Number (default: 365),
  notificationRetentionDays: Number (default: 90),   // already on TTL index
  reportRetentionDays: Number (default: 30),
  deletedCredentialRetentionDays: Number (default: 30),  // days before hard-delete of soft-deleted creds
}
```

Cron: `GET /api/cron/enforce-retention` — runs weekly. Hard-deletes soft-deleted credentials past their retention window. Purges old AuditLog entries.

### 11b. GDPR right-to-erasure

`POST /api/admin/users/:userId/erase`
Sysadmin only. Only callable after offboarding is complete.

Actions:
1. Replace `user.name` with "Deleted User"
2. Replace `user.email` with `deleted_[hash]@erased.local`
3. Clear `user.avatarUrl`, `user.jobTitle`, `user.department`, `user.passwordHash`
4. Set `user.isErased = true`
5. Preserve `user._id` so AuditLog references remain intact (but display "Deleted User")
6. Write AuditLog `user.erased`

### 11c. Immutable audit log

The AuditLog must be truly immutable — no update or delete operations permitted.

Enforce in the Mongoose model:
```ts
// Override the update and delete operations to throw
AuditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'deleteMany'], function() {
  throw new Error('AuditLog entries are immutable and cannot be modified or deleted.');
});
```

Add MongoDB collection-level validation to reject any document updates (this requires a DB-level `$jsonSchema` validator or a MongoDB Atlas trigger — document in README for production setup).

### 11d. Webhook outbound notifications

Allow sysadmins to register webhook endpoints that receive events in real time.

`POST /api/settings/webhooks`
Body: `{ url, events: ['credential.created', 'member.added', ...], secret }`

When a matching event occurs, send a signed POST request to the webhook URL:
```json
{
  "event": "credential.created",
  "timestamp": "2025-04-10T09:00:00Z",
  "organisation": "acme-corp",
  "data": { ... }
}
```

Signed with `X-VaultStack-Signature: sha256=<hmac>` using the webhook secret. Receivers can verify the signature.

Model: `models/Webhook.ts` — stores URL, events filter, secret (encrypted), isActive, lastDeliveredAt, failureCount.

Delivery via the EmailQueue pattern — a `WebhookQueue` model with retry logic.

---

## New model summary

| Model | Purpose |
|---|---|
| `AccessReview` | Periodic membership reviews |
| `OffboardingChecklist` | Structured employee offboarding |
| `ChangeWindow` | Scheduled maintenance windows |
| `Report` | Async compliance report generation |
| `ApprovalRequest` | 4-eyes principle for critical credentials |
| `Webhook` | Outbound event webhooks |

---

## New AuditLog actions

```
'access_review.initiated', 'access_review.decision', 'access_review.completed', 'access_review.overdue',
'offboarding.initiated', 'offboarding.step_completed', 'offboarding.completed',
'credential.rotated', 'credential.out_of_window_change',
'approval_request.submitted', 'approval_request.approved', 'approval_request.rejected', 'approval_request.used',
'report.generated', 'report.downloaded',
'webhook.registered', 'webhook.delivered', 'webhook.failed',
'user.erased', 'data_retention.enforced'
```

---

## New routes — settings sidebar additions

```
Settings
  ├── My profile
  ├── Security
  Organisation
  ├── General
  ├── Structure & teams
  ├── Roles & permissions
  ├── Members
  ├── Permission requests     [pending badge]
  ├── Access reviews          [overdue badge]     ← NEW
  ├── Offboarding             [in_progress badge] ← NEW
  ├── Change windows                              ← NEW
  ├── Sharing policy                              ← NEW
  ├── Approvals               [pending badge]     ← NEW
  ├── Webhooks                                    ← NEW
  ├── Reports                                     ← NEW
  └── Audit log
```

---

## Deliverable checklist

**Part 1 — Access reviews**
- [ ] `AccessReview` model created
- [ ] Access review policy in org settings (frequency, auto-revoke toggle)
- [ ] `POST /api/access-reviews/initiate` snapshots membership correctly
- [ ] Per-member approve/remove decisions work and execute membership changes
- [ ] Overdue cron runs, sets status, auto-revokes if configured
- [ ] Review detail UI with progress bar and inline decision buttons
- [ ] Notification and email sent when review is initiated and overdue

**Part 2 — Offboarding**
- [ ] `OffboardingChecklist` model with default steps
- [ ] Credential audit populated from user's entire history
- [ ] Each step can be completed or skipped
- [ ] Credential audit decisions (retain/reassign/delete) execute correctly
- [ ] `deactivate_account` step triggers user deactivation
- [ ] Cannot complete deactivation from Phase 09 without initiating offboarding first
- [ ] Offboarding UI with step-by-step progress

**Part 3 — Sharing policy**
- [ ] Policy config on Organisation model
- [ ] Export endpoint enforces all policy rules
- [ ] Export justification modal appears when required
- [ ] Clipboard copy disabled when policy disallows it
- [ ] Watermark appended to exported files when enabled
- [ ] Policy settings UI with all toggles

**Part 4 — Change windows**
- [ ] `ChangeWindow` model with recurring and one-time schedule types
- [ ] Credential write endpoints check for active window
- [ ] Out-of-window write blocked without `changeReason`
- [ ] Warning banner in credential edit form when outside window
- [ ] AuditLog records `outOfWindow: true` flag
- [ ] Change windows settings UI

**Part 5 — Health dashboard**
- [ ] `lib/projectHealth.ts` computes score with all 10 rules
- [ ] Criticality multiplier applied to scoring
- [ ] `GET /api/projects/health` returns sorted results
- [ ] Health overview page with grade badges
- [ ] Health chip on project detail header
- [ ] Dashboard widget shows worst project

**Part 6 — Compliance reports**
- [ ] `Report` model with TTL
- [ ] All 3 report types generate correctly (access audit, credential lifecycle, user activity)
- [ ] PDF output: cover page, ToC, sections, footer with page numbers
- [ ] CSV output: properly formatted with headers
- [ ] Async generation with polling until ready
- [ ] Reports UI with generate modal, status, download button

**Part 7 — Criticality tagging**
- [ ] `criticality`, `slaUptimePercent`, `oncallContact` on Project model
- [ ] `businessCriticality` on Credential model
- [ ] Criticality badge on project cards and detail page
- [ ] Editable in project settings by managers and above

**Part 8 — Runbooks**
- [ ] `runbook` subdocument on Credential model
- [ ] Runbook panel opens from `[📖]` icon
- [ ] "Mark as rotated" updates `lastRotatedAt` + clears expiry warning
- [ ] Runbook fields in AddCredentialModal (collapsible section)

**Part 9 — 4-eyes approval**
- [ ] `ApprovalRequest` model with expiry
- [ ] 4-eyes policy config in org settings
- [ ] Reveal blocked for critical credentials — approval modal shown
- [ ] SSE push delivers approval to requester in real time
- [ ] Approvals page for pending requests
- [ ] Approval expires after configured minutes — `expired` status set by cron

**Part 10 — Weekly digest**
- [ ] `WeeklyDigest` email template (manager and C-suite variants)
- [ ] Cron at Monday 08:00 UTC builds and enqueues digests
- [ ] Opt-out toggle in notification preferences

**Part 11 — Standards**
- [ ] Data retention cron enforces configured windows
- [ ] GDPR erasure endpoint anonymises PII while preserving audit log structure
- [ ] AuditLog pre-hooks block any update/delete operations
- [ ] Webhook model and delivery queue
- [ ] Webhook signature verification with HMAC-SHA256

**General**
- [ ] All new cron routes added to `vercel.json`
- [ ] All new routes added to settings sidebar with appropriate badges
- [ ] All new audit log actions written correctly
- [ ] ESLint clean
- [ ] `npm run build` zero TypeScript errors
- [ ] Integration tests for: access review flow, 4-eyes approval flow, offboarding deactivation guard
