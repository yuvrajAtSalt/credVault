# VaultStack — Phase 10: Access Rules, Project Governance & Industry-Grade Project Management

> Prerequisite: Phase 09 complete. Custom roles and special permissions working.

---

## Overview

This phase codifies the real-world rules of how people interact with projects, credentials, and each other. It is the single most important correctness phase — every rule here reflects how actual engineering organisations operate, and getting them wrong causes data leaks or operational blockers.

The rules are grouped into five concern areas:

1. **Project membership vs project access** — leaving a project ≠ losing credential visibility in all cases
2. **Credential ownership and edit rights** — who can touch whose credentials
3. **Hierarchy-based project governance** — who can invite, remove, and manage across projects
4. **Multi-project and cross-team membership** — a person can serve many masters
5. **Industry-standard project management rules** not covered in earlier phases

---

## Part 1 — Project membership vs credential access

### Rule set

| Situation | Can see project? | Can see credentials? | Can add credentials? |
|---|---|---|---|
| Active member, no visibility grant | Yes | Own only | Yes |
| Active member, visibility grant `all` | Yes | All | Yes |
| **Removed from project** | **No** | **Retains visibility per role** | **No** |
| Deactivated user | No | No | No |
| Executive (CEO/COO/CFO) — never a formal member | Yes (all projects) | Yes (all credentials) | Yes (if on project) |
| Sysadmin | Yes (all) | Yes (all) | Yes (all) |

### What "removed from project" means

When a member is removed from `project.members`, their `visibilityGrant` entries for that project are **preserved, not deleted**. This means:

- They lose the ability to navigate to the project in the UI (project is not listed for them)
- They lose the ability to add new credentials
- They **retain read access** to any credentials they were previously granted visibility on — because those credentials may reference their earlier work and other team members may need to know who configured what
- This is the "institutional knowledge" principle — removing someone from active work doesn't erase their historical contribution

**However**, a manager or sysadmin can explicitly revoke residual access by deleting the visibility grant after removal.

### API changes

#### `DELETE /api/projects/:projectId/members/:userId`

Update this endpoint:

1. Remove user from `project.members[]`
2. Do NOT delete `visibilityGrants` for this user — preserve them
3. Write AuditLog `member.removed` with `meta: { retainedVisibilityGrants: N }`
4. Return in response: `{ removed: true, retainedGrants: N, canRevokeUrl: "/api/projects/:id/visibility/:userId/revoke" }`

Add a UI warning on the remove confirmation dialog:
> "Removing [name] will revoke their active project access. They will retain read-only visibility to credentials they were previously granted access to. [Revoke residual access too] (optional checkbox)"

If the checkbox is checked → also delete their visibility grants in the same call.

#### New endpoint: `DELETE /api/projects/:projectId/visibility/:userId/revoke-all`

Removes all visibility grants for a user on a project. Used post-removal for a clean severance.

Who can call: project manager, sysadmin, any user above the target in the org hierarchy (see Part 3).

---

## Part 2 — Credential ownership and edit rights

### Rule set

| Actor | Own credentials | Other's credentials (same project) |
|---|---|---|
| Developer / QA / DevOps | Edit + Delete | View only (if granted visibility) |
| Manager (on their project) | Edit + Delete own | Edit + Delete anyone's on that project |
| Manager (not on project) | N/A | No access |
| COO / CFO / CMO / CEO | Edit + Delete own | View only (cannot edit others') |
| Sysadmin | Edit + Delete all | Edit + Delete all |

### Key principle
People below the management tier (developer, devops, QA) **can never edit or delete another person's credential**, regardless of visibility grants. A visibility grant gives read access, not write access. These are two separate axes.

### API enforcement

#### `PATCH /api/projects/:id/credentials/:credId`

Update the permission check:

```ts
const isOwner = credential.addedBy.toString() === req.user._id.toString();
const isProjectManager = req.permissions.canManageTeam && project.members.some(
  m => m.userId.toString() === req.user._id.toString()
);
const isSysadmin = req.permissions.isGod;

// Executives (canSeeAllCredentials) can only edit their OWN credentials
if (!isOwner && !isProjectManager && !isSysadmin) {
  return res.status(403).json({
    error: 'You can only edit credentials you added yourself.',
    code: 'CREDENTIAL_EDIT_NOT_OWNER'
  });
}
```

Same logic for `DELETE /api/projects/:id/credentials/:credId`.

#### `PATCH /api/projects/:id/envs/:envId/variables/:varId`

Apply identical ownership checks for environment variables.

### UI enforcement

On `CredentialRow` and `EnvVariableRow`:

- Edit button (`✎`): visible only if `isOwner || isProjectManager || isSysadmin`
- Delete button (`✕`): same condition
- If user has visibility but cannot edit → show a `(i)` tooltip on hover of the row: "Added by [name] — view only"

---

## Part 3 — Hierarchy-based project governance

### The hierarchy levels

```
Sysadmin           ← God. No restrictions.
─────────────────────────────────────────
CEO / COO / CFO    ← C-suite. Full cross-project authority.
─────────────────────────────────────────
CMO                ← Senior, but domain-scoped (marketing/comms).
Manager            ← Project-scoped authority.
─────────────────────────────────────────
DevOps / Developer / QA / Custom roles ← Individual contributors.
```

### Governance rules

**C-suite (CEO, COO, CFO) and Sysadmin can:**
- See all projects without being a member
- Invite any user to any project
- Remove any user from any project (except sysadmin accounts — only sysadmin can manage sysadmins)
- Change any project's settings (name, description, status)
- Grant or revoke visibility on any project

**CMO can:**
- See all projects they are a member of
- Invite any user into projects they are a member of
- Remove members from projects they are a member of (only people below them in hierarchy — not other CMOs or C-suite)
- Manage credentials on their projects like a manager

**Manager can:**
- Only manage projects they are explicitly a member of
- Invite people from their direct team (`team.leadId === manager` OR `member.reportingTo === manager`) into any project the manager is on
- Remove members from their projects — only members who report to them (direct or indirect reports in the hierarchy chain) — cannot remove a peer manager or someone from another team's hierarchy
- Cannot invite someone from another manager's team without that manager being on the same project

**Individual contributors (Developer, DevOps, QA) can:**
- View projects they are members of
- Add credentials to projects they are members of
- Cannot invite anyone to any project
- Cannot remove anyone from any project
- Cannot change project settings

### Hierarchy check utility (`lib/hierarchy.ts`)

```ts
/**
 * Returns true if `actorId` is above `targetId` in the org reporting chain.
 * "Above" means: actorId === targetId's manager, OR actorId is an ancestor
 * of targetId's manager (transitively up the chain).
 */
export async function isAboveInHierarchy(
  actorId: string,
  targetId: string,
  organisationId: string
): Promise<boolean>

/**
 * Returns the role tier level for comparison.
 * sysadmin=0, ceo=1, coo=1, cfo=1, cmo=2, manager=3, devops=4, developer=4, qa=4
 * Custom roles: use the lowest built-in equivalent based on their permissions.
 */
export function getRoleTier(role: string, permissions: EffectivePermissions): number

/**
 * Returns true if actor can perform management actions on target.
 * Combines tier check + hierarchy check.
 */
export async function canManage(
  actor: User,
  target: User,
  context: 'project' | 'org'
): Promise<boolean>
```

### API enforcement updates

#### `POST /api/projects/:id/members` (add member)

```ts
// Existing: manager can add, sysadmin can add
// New enforcement:
if (actorTier <= 1) {
  // C-suite + sysadmin: can add anyone
} else if (actor.role === 'cmo') {
  // CMO: can add anyone to their own projects
  if (!project.members.includes(actor._id)) return 403;
} else if (actor.role === 'manager' || permissions.canManageTeam) {
  // Manager: can only add people from their team or direct reports
  const canInvite = await isInManagersTeam(actor._id, targetUser._id);
  if (!canInvite) return 403 "You can only invite members from your team";
} else {
  return 403 "Individual contributors cannot invite members";
}
```

#### `DELETE /api/projects/:id/members/:userId` (remove member)

```ts
if (actorTier <= 1) {
  // C-suite: can remove anyone (except sysadmins)
  if (targetUser.role === 'sysadmin' && actor.role !== 'sysadmin') return 403;
} else if (actor.role === 'manager') {
  // Manager: can only remove people they manage hierarchically
  const canRemove = await canManage(actor, targetUser, 'project');
  if (!canRemove) return 403 "You can only remove members who report to you";
} else {
  return 403;
}
```

### UI enforcement

On the project members list, the "Remove" button renders conditionally:

```tsx
const canRemoveThisMember = (
  permissions.isGod ||
  (actorTier <= 1 && member.role !== 'sysadmin') ||
  (actor.role === 'manager' && isInMyHierarchy(member))
);
```

Invite button similarly gated — if the user cannot invite, the button is hidden, not just disabled (don't show UI affordances for things the user structurally cannot do).

---

## Part 4 — Multi-project, cross-team membership

### Rules

- A user can be a member of unlimited projects simultaneously
- A user can have different visibility grants on different projects (e.g. full visibility on Project A, limited on Project B)
- A user can report to one manager in the org hierarchy but work on projects owned by different managers — **project membership and org reporting are independent axes**
- When a manager invites someone from another team, that person's primary reporting line does not change — they are just a collaborator on that project
- A user's effective permissions are org-wide (role-based), not project-scoped — but visibility grants ARE project-scoped

### Project membership dashboard widget

Add to the user's profile slide-over (Phase 04) and the user's own dashboard a "Project memberships" section:

```
Projects you're on (4):
  [●] XYZ Commerce    Manager: Priya Sharma    [active member]
  [●] Alpha Analytics  Manager: Sunil Kumar     [active member]
  [●] Beta Mobile      Manager: Priya Sharma    [removed — residual access]
  [●] Gamma CRM        Manager: Arjun Rao       [active member]
```

"Removed — residual access" is shown when the user has been removed from members[] but retains visibility grants.

### API: `GET /api/members/:userId/projects`

Returns all projects the user has ANY relationship with (active member OR residual visibility grant). Includes `membershipStatus: 'active' | 'removed_residual' | 'removed_clean'`.

---

## Part 5 — Industry-grade rules not yet covered

### 5a. Project roles (not org roles)

A user can have a different **project-level role label** from their org role. E.g. Rahul is a "Developer" in the org but is the "Tech Lead" on XYZ Commerce.

Add `projectRole` field to the `project.members` subdocument:

```ts
members: [{
  userId: ObjectId,
  addedBy: ObjectId,
  addedAt: Date,
  projectRole: String (nullable),   // e.g. "Tech Lead", "Security Reviewer", "Observer"
}]
```

This is a display-only label — it does not change permissions. It helps the team understand context.

UI: show in the project members list. Editable by project manager and above. Small badge next to the member's org role badge.

---

### 5b. Project archival and access freeze

When a project is archived (status → `archived`):
- No new credentials or env variables can be added
- No new members can be added or removed
- Existing members retain read access
- All credential reveal actions are still logged

API enforcement: add a middleware check `if (project.status === 'archived') return 403 { code: 'PROJECT_ARCHIVED', message: 'This project is archived. No changes are permitted.' }` on all write endpoints under `/api/projects/:id/*`.

UI: show a yellow "Archived" banner at the top of the project page. All add/edit/delete buttons hidden. A "Reactivate project" button visible to sysadmin and C-suite.

---

### 5c. Credential change history (audit trail per credential)

Every credential and env variable should have a visible change history accessible from the UI.

Add endpoint: `GET /api/projects/:id/credentials/:credId/history`

Returns AuditLog entries scoped to this credential, sorted newest-first:

```json
[
  { "action": "credential.edit", "actor": { "name": "Rahul Mehta" }, "at": "...", "meta": { "changedFields": ["value"] } },
  { "action": "credential.view", "actor": { "name": "Priya Sharma" }, "at": "..." },
  { "action": "credential.create", "actor": { "name": "Rahul Mehta" }, "at": "..." }
]
```

UI: a small clock icon `(⏱)` on each credential row. Click → inline expand or tooltip showing last 5 history entries. "View full history" link opens a modal with paginated history.

Same for env variables: `GET /api/projects/:id/envs/:envId/variables/:varId/history`.

---

### 5d. Project observer role

Sometimes C-suite or auditors need to be added to a project to watch it without being active contributors. Add a `memberType` field to `project.members`:

```ts
memberType: String (enum: ['contributor', 'observer'], default: 'contributor')
```

Observer rules:
- Can see the project
- Can see credentials per their visibility grant
- Cannot add credentials or env variables
- Cannot be granted a visibility grant manually — they always see all (they're on the project to audit, not contribute)
- Their presence does not count toward "team member" stats

C-suite and above are treated as implicit observers on all projects.

API: `PATCH /api/projects/:id/members/:userId` — body `{ memberType: 'observer' }`. Manager and above can set.

UI: observer badge on the member chip in the project members list. "Observer mode" notice on the project header when the current user is an observer.

---

### 5e. Credential expiry and rotation reminders

Credentials like API keys, SSL certificates, and database passwords rotate. Add an optional `expiresAt` field to `Credential` and `EnvVariable`:

```ts
expiresAt: Date (nullable),
rotationReminderDays: Number (default: 30),   // remind N days before expiry
```

Dashboard widget: "Expiring soon" section. Shows credentials expiring within `rotationReminderDays` days, sorted by closest expiry.

```
⚠ 3 credentials expiring soon
  XYZ Commerce / SendGrid API key — expires in 5 days
  Alpha Analytics / AWS Access Key — expires in 12 days
  Gamma CRM / SSL Certificate — expires in 28 days
```

API: `GET /api/dashboard/expiring-credentials` — returns credentials where `expiresAt < now + rotationReminderDays` across all projects the user can see.

UI: also shown as a warning badge on the credential row itself.

---

### 5f. Sensitive credential flag

Some credentials are more sensitive than others (production DB root password vs a staging API key). Add:

```ts
sensitivityLevel: String (enum: ['normal', 'sensitive', 'critical'], default: 'normal')
```

Rules for `critical` credentials:
- Can only be added by manager, devops, or sysadmin — not junior developer / QA
- Reveal action requires a reason (a prompt appears: "Why are you accessing this credential?") — the reason is stored in the AuditLog
- Cannot be exported in env file exports — they are redacted as `[REDACTED — critical credential]`
- Shown with a red `⚠ CRITICAL` badge in the credential row

API enforcement on reveal: if `sensitivityLevel === 'critical'` → require `reason` in the request body.

UI: on reveal click for critical credentials, show a modal: "This is a critical credential. Please state why you need to access it:" → [Textarea] → [Proceed] / [Cancel].

---

### 5g. Credential access request (project-scoped)

Similar to the permission request flow from Phase 09, but scoped to a specific credential.

If a developer cannot see a credential (locked), the lock notice row now has a "Request access" button:

```
[🔒 DATABASE_URL — hidden]   [Request access]
```

This creates a `PermissionRequest` with:
```ts
{
  type: 'credential_visibility',
  projectId: ...,
  credentialId: ...,
  permission: 'canSeeAllCredentials'
}
```

The manager (not just sysadmin) receives the request since this is a project-level decision. Add manager review of credential visibility requests to the manager's notification surface.

---

### 5h. Project handover

When a manager leaves a project or the organisation, their projects need a designated successor. Add:

`POST /api/projects/:id/handover`

Body: `{ newManagerId }`

Who can call: sysadmin, C-suite, the outgoing manager themselves.

Actions:
1. Removes the outgoing manager from `project.members` (or changes their `memberType` to `observer`)
2. Adds `newManagerId` as a member if not already
3. Transfers any pending credential access requests to the new manager
4. Writes AuditLog `project.handover`

UI: accessible from the project settings tab. Also surfaced when deactivating a user who is a manager on active projects — the deactivation flow prompts: "This user manages [N] projects. Assign a successor before deactivating." Cannot complete deactivation without resolving open projects.

---

### 5i. Bulk operations for sysadmin

Add a bulk operations panel accessible on the User Management page (Phase 09) and Team page:

**Bulk actions:**
- Select multiple users via checkboxes
- Bulk assign to team
- Bulk assign to project
- Bulk change role
- Bulk deactivate (with confirmation)

API: `POST /api/admin/users/bulk-update`

Body:
```json
{
  "userIds": ["...", "..."],
  "action": "assign_team" | "assign_project" | "change_role" | "deactivate",
  "payload": { "teamId": "..." }
}
```

Returns `{ updated: N, errors: [...] }`.

UI: floating action bar that appears at the bottom of the table when one or more rows are checked:

```
3 employees selected   [Assign to team ▾]  [Add to project ▾]  [Change role ▾]  [Deactivate]   [✕ clear]
```

---

### 5j. Project-level credential categories (custom)

Phase 03 hardcoded 6 categories: GitHub, Storage, Database, SMTP, Deploy, Custom.

Allow project managers to define additional custom categories specific to their project:

`POST /api/projects/:id/credential-categories`

Body: `{ name, icon?, description? }`

These appear as additional tabs in the credential panel for that project only.

`GET /api/projects/:id/credential-categories` — returns built-in + custom categories.

Sysadmin can also define org-wide custom categories in org settings that apply to all projects.

---

## 6. Model updates summary

### `models/Project.ts` — add fields

```ts
members: [{
  userId: ObjectId,
  addedBy: ObjectId,
  addedAt: Date,
  memberType: String (enum: ['contributor','observer'], default: 'contributor'),
  projectRole: String (nullable),     // display label e.g. "Tech Lead"
}],
credentialCategories: [{             // custom categories for this project
  name: String,
  icon: String,
  slug: String,
}]
```

### `models/Credential.ts` — add fields

```ts
expiresAt: Date (nullable),
rotationReminderDays: Number (default: 30),
sensitivityLevel: String (enum: ['normal','sensitive','critical'], default: 'normal'),
revealReasons: [{                    // for critical credentials
  userId: ObjectId,
  reason: String,
  at: Date,
}]
```

### `models/EnvVariable.ts` — add fields

```ts
expiresAt: Date (nullable),
sensitivityLevel: String (enum: ['normal','sensitive','critical'], default: 'normal'),
```

### `models/PermissionRequest.ts` — add fields

```ts
type: String (enum: ['permission','credential_visibility'], default: 'permission'),
credentialId: ObjectId (ref: Credential, nullable),
reviewableBy: String (enum: ['sysadmin','manager'], default: 'sysadmin'),
```

---

## 7. AuditLog additions

```
'member.removed', 'member.type_changed', 'project.archived', 'project.reactivated',
'project.handover', 'credential.expiry_set', 'credential.reveal_critical',
'credential.category_added', 'visibility.residual_revoked',
'bulk.team_assign', 'bulk.role_change', 'bulk.deactivate'
```

---

## Deliverable checklist

**Part 1 — Removal vs access**
- [ ] Removing a member preserves visibility grants by default
- [ ] Remove endpoint returns `retainedGrants` count
- [ ] "Revoke residual access" checkbox in remove confirmation dialog
- [ ] `DELETE /api/projects/:id/visibility/:userId/revoke-all` endpoint works

**Part 2 — Credential ownership**
- [ ] Edit/delete credential blocked for non-owners below manager tier
- [ ] `CredentialRow` edit/delete buttons hidden correctly per ownership rules
- [ ] Tooltip "Added by [name] — view only" shown on non-editable rows

**Part 3 — Hierarchy governance**
- [ ] `lib/hierarchy.ts` implemented with `isAboveInHierarchy`, `getRoleTier`, `canManage`
- [ ] Add member API enforces manager-team restriction
- [ ] Remove member API enforces hierarchy restriction
- [ ] Invite button hidden for individual contributors

**Part 4 — Multi-project**
- [ ] `GET /api/members/:userId/projects` returns memberships with status
- [ ] Dashboard / profile shows membership list with residual status

**Part 5 — Industry rules**
- [ ] Project roles (projectRole label) field editable in members list
- [ ] Archived projects block all write operations with correct error code
- [ ] Credential change history endpoint and UI (inline expand + modal)
- [ ] Observer member type works, cannot add credentials
- [ ] Credential expiry field and dashboard "Expiring soon" widget
- [ ] Sensitivity levels enforced (critical: reason required on reveal, redacted on export)
- [ ] Critical credential reveal reason prompt modal
- [ ] Credential access request from lock notice row
- [ ] Manager receives credential access requests (not just sysadmin)
- [ ] Project handover flow (API + UI in project settings)
- [ ] Deactivation blocked until open projects are handed over
- [ ] Bulk user operations (assign team, assign project, change role, deactivate)
- [ ] Bulk action floating bar in user table
- [ ] Custom credential categories per project (add + display as extra tabs)

**General**
- [ ] All new audit log actions written correctly
- [ ] ESLint clean
- [ ] `npm run build` zero TypeScript errors
- [ ] All existing tests still pass
- [ ] New API routes covered by integration tests for the critical permission paths
