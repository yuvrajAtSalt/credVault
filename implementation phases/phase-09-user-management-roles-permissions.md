# VaultStack — Phase 09: User Management, Custom Roles & Special Permissions

> Prerequisite: Phase 08 complete. Org hierarchy and team structure builder working.

---

## Core concept

Phase 01 introduced a fixed set of 9 system roles with hardcoded permission flags. This phase makes the permission system **fully dynamic**:

1. **Sysadmin can add users directly** — not just invite-by-email. Full employee onboarding from a single form.
2. **Sysadmin can create custom roles** — beyond the 9 built-in roles, organisations can define their own (e.g. "Tech Lead", "Scrum Master", "Contractor").
3. **Sysadmin can grant special permissions to any individual user** — on top of (or overriding) their role's base permissions. This is the "on request" grant model.

The key design principle: **role permissions are the floor, special grants are the ceiling.**

```
Final effective permissions = Base role permissions
                            + Custom role overrides (if custom role)
                            + Individual special grants
                            - Individual special revocations
```

---

## 1. Model changes

### Update `models/User.ts`

Add:
```ts
// If the user has a custom role (not one of the 9 built-in ROLES),
// this points to the CustomRole document
customRoleId: ObjectId (ref: CustomRole, nullable),

// Array of individual permission grants/revocations on top of their role
specialPermissions: [{
  permission: String,           // e.g. 'canSeeAllProjects', 'canAddCredential'
  value: Boolean,               // true = grant, false = explicitly revoke
  grantedBy: ObjectId (ref: User),
  reason: String,               // why this was granted — required field
  grantedAt: Date,
  expiresAt: Date (nullable),   // optional expiry — if set, grant auto-expires
  isActive: Boolean (default: true),
}],
```

### New model: `models/CustomRole.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  name: String (required),             // e.g. "Tech Lead", "Contractor", "Scrum Master"
  slug: String (required),             // auto-generated, unique per org
  description: String,
  color: String (hex, default: '#5E6C84'),
  badgeLabel: String (max 8 chars),    // short label shown in badges e.g. "TL", "contractor"
  isBuiltIn: Boolean (default: false), // true for the 9 system roles (read-only, cannot delete)

  // The full permission set for this role
  permissions: {
    canSeeAllProjects: Boolean,
    canCreateProject: Boolean,
    canAddCredential: Boolean,
    canManageTeam: Boolean,
    canGrantVisibility: Boolean,
    canSeeAllCredentials: Boolean,
    canManageRoles: Boolean,
    canManageMembers: Boolean,
    canViewAuditLog: Boolean,
    canManageOrgSettings: Boolean,
    isGod: Boolean,
  },

  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: organisationId, slug
// Unique: [organisationId, slug]
```

### New model: `models/PermissionRequest.ts`

When a user needs a special permission they don't have, they can raise a request that the sysadmin reviews.

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  requestedBy: ObjectId (ref: User, required),
  permission: String (required),          // which permission they need
  reason: String (required),              // why they need it
  projectId: ObjectId (ref: Project, nullable),  // if scoped to a specific project
  status: String (enum: ['pending','approved','rejected'], default: 'pending'),
  reviewedBy: ObjectId (ref: User, nullable),
  reviewNote: String,                     // sysadmin's note on approval/rejection
  reviewedAt: Date,
  expiresAt: Date (nullable),             // if approved, sysadmin can set an expiry
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: organisationId, requestedBy, status, createdAt
```

### Update `models/AuditLog.ts` — add actions

```
'user.created', 'user.updated', 'user.deactivated', 'user.reactivated',
'role.created', 'role.updated', 'role.deleted',
'permission.granted', 'permission.revoked', 'permission.expired',
'permission_request.submitted', 'permission_request.approved', 'permission_request.rejected'
```

---

## 2. Permission resolution engine (`lib/permissions.ts`)

This is the most critical piece of this phase. Replace the static `BASE_PERMISSIONS` lookup with a dynamic resolver.

```ts
/**
 * Resolves the effective permission set for a user.
 * Merges: base role perms + custom role perms (if any) + special grants/revocations.
 * Also handles expired grants transparently.
 */
export async function resolvePermissions(user: User): Promise<EffectivePermissions> {
  // 1. Start with base permissions from BUILT_IN_ROLE_PERMISSIONS[user.role]
  //    OR from the CustomRole document if user.customRoleId is set
  // 2. Apply each specialPermission where isActive === true AND (expiresAt is null OR expiresAt > now)
  //    - value: true  → set permission to true  (grant)
  //    - value: false → set permission to false (explicit revoke)
  // 3. Return the merged EffectivePermissions object
}

/**
 * Same as resolvePermissions but synchronous — uses a pre-fetched user object
 * with populated customRoleId. Used in API route handlers after auth middleware
 * has already fetched the user.
 */
export function resolvePermissionsSync(user: PopulatedUser): EffectivePermissions

/**
 * Expire all special permissions past their expiresAt date.
 * Call this in a cron job or on every auth middleware pass.
 */
export async function expireStalePermissions(organisationId: string): Promise<number>
```

### Update auth middleware

In `lib/auth.ts`, after verifying the JWT and fetching the user, run `resolvePermissionsSync` and attach the result to the request context:

```ts
req.permissions = resolvePermissionsSync(user);
req.user = user;
```

All API route handlers should use `req.permissions.canXxx` instead of checking `ROLES[user.role].canXxx`.

### Update `hooks/usePermissions.ts`

The hook now fetches from `GET /api/auth/me/permissions` which returns the resolved effective permissions. Cache with SWR. Invalidate when user data changes.

```ts
GET /api/auth/me/permissions
// Returns the full EffectivePermissions object for the current user
// Including a `specialGrants` summary for display in the UI
```

---

## 3. API Routes

### User management

#### `GET /api/admin/users`
Sysadmin only.

Query params: `?search=&role=&team=&status=active|inactive|all&page=&limit=`

Returns paginated list. Each user includes: `effectivePermissions` (from resolver), `specialPermissionsCount`, `customRole` (populated if set).

#### `POST /api/admin/users`
Sysadmin only. **Direct user creation** — no invite email required for this flow.

Body:
```json
{
  "name": "Kavya Reddy",
  "email": "kavya@company.com",
  "password": "TempPassword123!",       // sysadmin sets a temp password
  "forcePasswordChange": true,           // user must change on first login
  "role": "developer",                   // built-in role OR null if customRoleId used
  "customRoleId": null,
  "jobTitle": "Frontend Engineer",
  "department": "Engineering",
  "teamId": "<teamId>",
  "reportingTo": "<managerId>",
  "isOrgRoot": false
}
```

Validation:
- Email must be unique in the org
- Either `role` OR `customRoleId` must be provided — not both, not neither
- `password` must meet strength requirements (min 8 chars, 1 uppercase, 1 number)

On success:
- Creates user
- If `teamId` set → adds to team
- If `reportingTo` set → sets reporting chain (runs circular check)
- Writes AuditLog `user.created`
- Returns created user + a one-time "setup link" the sysadmin can share (for Phase 10 email — for now just return the temp password)

#### `PATCH /api/admin/users/:userId`
Sysadmin only.
Body: any subset of `{ name, email, role, customRoleId, jobTitle, department, teamId, reportingTo, isActive, forcePasswordChange }`
Writes AuditLog `user.updated`.

#### `POST /api/admin/users/:userId/reactivate`
Sysadmin only. Sets `isActive: true`.
Writes AuditLog `user.reactivated`.

#### `POST /api/admin/users/:userId/reset-password`
Sysadmin only.
Body: `{ newPassword, forcePasswordChange: true }`
Hashes new password. Writes AuditLog.

---

### Custom roles

#### `GET /api/admin/roles`
Returns all roles: built-in 9 (marked `isBuiltIn: true`) + all custom roles for this org.
Includes `memberCount` (users using this role).

#### `POST /api/admin/roles`
Sysadmin only.
Body: `{ name, description?, color?, badgeLabel, permissions: { ... } }`
Auto-generates slug. Writes AuditLog `role.created`.

#### `PATCH /api/admin/roles/:roleId`
Sysadmin only. Cannot edit built-in roles (return 403 with message "Built-in roles cannot be modified").
Body: any subset of `{ name, description, color, badgeLabel, permissions }`.
If permissions change → triggers a cache invalidation for all users with this role.
Writes AuditLog `role.updated`.

#### `DELETE /api/admin/roles/:roleId`
Sysadmin only. Cannot delete built-in roles.
Cannot delete if `memberCount > 0` — return 409: "Reassign all members before deleting this role."
Writes AuditLog `role.deleted`.

---

### Special permissions (individual grants)

#### `GET /api/admin/users/:userId/permissions`
Returns:
```json
{
  "effectivePermissions": { "canSeeAllProjects": true, ... },
  "rolePermissions": { "canSeeAllProjects": false, ... },    // what the role alone gives
  "specialPermissions": [
    {
      "_id": "...",
      "permission": "canSeeAllProjects",
      "value": true,
      "grantedBy": { "name": "Arjun Rao" },
      "reason": "Temporary access for Q4 audit",
      "grantedAt": "...",
      "expiresAt": "2025-06-01T00:00:00Z",
      "isActive": true,
      "isExpired": false
    }
  ]
}
```

#### `POST /api/admin/users/:userId/permissions/grant`
Sysadmin only.
Body:
```json
{
  "permission": "canSeeAllProjects",
  "value": true,
  "reason": "Temporary access for Q4 audit",
  "expiresAt": "2025-06-01T00:00:00Z"
}
```

If a grant for this permission already exists → update it (don't create duplicate).
Writes AuditLog `permission.granted`.

#### `DELETE /api/admin/users/:userId/permissions/:permissionName`
Revokes a specific special permission (sets `isActive: false`).
Sysadmin only.
Writes AuditLog `permission.revoked`.

---

### Permission requests (user-initiated)

#### `POST /api/permissions/request`
Any authenticated user can call this.
Body: `{ permission, reason, projectId? }`
Creates a `PermissionRequest` with status `pending`.
Writes AuditLog `permission_request.submitted`.

#### `GET /api/admin/permissions/requests`
Sysadmin only.
Query params: `?status=pending|approved|rejected&page=&limit=`
Returns paginated list with populated `requestedBy` (name, role, avatar) and `projectId`.

#### `POST /api/admin/permissions/requests/:requestId/approve`
Sysadmin only.
Body: `{ reviewNote?, expiresAt? }`

- Sets `status: 'approved'`
- Calls the grant logic: adds special permission to the user
- Writes AuditLog `permission_request.approved`

#### `POST /api/admin/permissions/requests/:requestId/reject`
Sysadmin only.
Body: `{ reviewNote }` (required — sysadmin must give a reason)
Sets `status: 'rejected'`.
Writes AuditLog `permission_request.rejected`.

---

## 4. UI

### 4a. User Management page (`/settings/users`)

Sysadmin only. Add to Settings sidebar nav.

**Top bar:**
```
[Search employees...]  [Role ▾]  [Team ▾]  [Status ▾]    [+ Add employee]
```

**Employee table:**

| | Name | Role | Team | Department | Status | Special grants | Last login | |
|---|---|---|---|---|---|---|---|---|
| [Av] | Kavya Reddy | developer | Engineering | Frontend | Active | 2 grants | 2d ago | [Edit] [Permissions] |

- "Special grants" column: a count badge. If `> 0` → amber badge. Click → opens permissions drawer.
- Status chip: green "Active" / red "Inactive"
- `[Edit]` → opens `EditUserModal`
- `[Permissions]` → opens `UserPermissionsDrawer`

**Pagination** at bottom.

---

### 4b. Add Employee modal (`components/admin/AddEmployeeModal.tsx`)

Multi-step modal (3 steps, progress indicator at top):

**Step 1 — Identity**
- Full name (required)
- Email address (required)
- Job title
- Department

**Step 2 — Role & Team**
- Role assignment: two-option toggle
  - "Built-in role" → dropdown of 9 built-in roles with descriptions
  - "Custom role" → dropdown of org's custom roles
- Reports to: searchable user select (avatar + name + role)
- Team: select from org teams (with color dots)
- Org root toggle (sysadmin knows if this is the top-level person)

**Step 3 — Access**
- Temporary password field (with generate button — creates a random 12-char password)
- "Force password change on first login" toggle (default on)
- Preview of effective permissions based on selected role (read-only permission matrix summary)

Footer: `[Back]` `[Next]` / `[Create Employee]` on step 3.

On submit → `POST /api/admin/users`. Show success state with the temp password in a copyable code block and a warning: "Save this password — it will not be shown again."

---

### 4c. Edit User modal (`components/admin/EditUserModal.tsx`)

Tabs:
- **Profile** — name, email, job title, department
- **Role & Team** — role, custom role, team, reporting, org root
- **Account** — reset password, force password change, deactivate/reactivate

Deactivate shows `ConfirmDialog`: "Deactivating [name] will revoke their access to all projects. This can be reversed."

---

### 4d. User Permissions Drawer (`components/admin/UserPermissionsDrawer.tsx`)

Right-side drawer (`480px`). Opens from the `[Permissions]` button on the user table.

**Header section:**
```
[Avatar]  Kavya Reddy
          developer  →  [effective permissions summary]
```

**Effective permissions panel:**

A compact grid showing all permissions with their resolved value and source:

| Permission | Value | Source |
|---|---|---|
| See all projects | ✓ | Special grant |
| Create project | — | Role (developer) |
| Add credential | ✓ | Role (developer) |
| See all credentials | ✓ | Special grant (expires Jun 1) |

Source color coding:
- "Role" → gray
- "Special grant" → blue
- "Special grant (expired)" → red strikethrough
- "Explicitly revoked" → red

**Active special grants list:**

Each grant row:
```
[canSeeAllProjects]   Granted ✓   "Q4 audit access"   Expires: Jun 1 2025   [Revoke]
```

Revoke button → ConfirmDialog → `DELETE .../permissions/:permissionName`.

**Grant new permission form** (at bottom of drawer):

```
Permission:   [Select permission ▾]
Value:        [Grant ●] [Revoke ○]
Reason:       [________________________]  (required)
Expires:      [Date picker]  or  [Never]
              [Grant Permission]
```

Permission select: shows all permissions with descriptions, groups them (Project access / Credential access / Team management / Admin).

---

### 4e. Role Management page (`/settings/roles`)

Sysadmin only. Add to Settings sidebar nav.

**Two sections:**

**Built-in roles** (read-only):
Card grid showing all 9 built-in roles. Each card: role badge, label, description, permission checkmarks, member count. "Cannot be edited" notice.

**Custom roles:**
Same card grid but with `[Edit]` and `[Delete]` buttons. `[+ New role]` button at top.

---

### 4f. Create / Edit Role modal (`components/admin/RoleModal.tsx`)

**Fields:**
- Role name (Input, required)
- Badge label (Input, max 8 chars — live preview of how the badge will look)
- Description (Textarea)
- Color (6 swatches + custom hex — live preview of badge with chosen color)

**Permission matrix (interactive checkboxes):**

Grouped into sections:

*Projects*
- [ ] See all projects (org-wide)
- [ ] Create new projects

*Credentials*
- [ ] Add credentials to assigned projects
- [ ] See all credentials (not just own)
- [ ] Grant credential visibility to others

*Team & members*
- [ ] Manage team members
- [ ] View audit log

*Admin*
- [ ] Manage roles
- [ ] Manage members (create/edit/deactivate)
- [ ] Manage org settings
- [ ] God mode (all of the above + bypass all checks)

Checking "God mode" auto-checks everything and disables the others.

**Live preview panel** (right side of modal):
Shows a mini permission summary card updating in real-time as checkboxes are toggled.

---

### 4g. Permission Requests page (`/settings/permissions/requests`)

Sysadmin only. Add as a sub-nav under Permissions in Settings.

**Filter tabs:** `All`  `Pending (3)`  `Approved`  `Rejected`

**Request card:**
```
┌────────────────────────────────────────────────────────┐
│ [Avatar] Rahul Mehta (developer)           2 hours ago │
│                                                        │
│ Requesting: canSeeAllProjects                          │
│ Reason: "Need to audit the Alpha Analytics project     │
│          credentials before the client demo"           │
│ Project scope: Alpha Analytics                         │
│                                                        │
│ [Reject]                          [Approve ▾]          │
└────────────────────────────────────────────────────────┘
```

"Approve" dropdown:
- Approve with no expiry
- Approve with expiry → shows inline date picker
- Add review note (optional textarea)

"Reject" → opens small inline form for required rejection note.

**Pending count badge** on the sidebar nav item for "Permission Requests" — updates via SWR polling every 60s.

---

### 4h. Request permission — user-facing

Any user (non-sysadmin) sees a "Request access" button in relevant empty states:

- On the projects list when they can't see a project they need → "Request access"
- On the credentials panel when they see the lock notice → "Request visibility"
- On any 403 page → "Request access"

Clicking opens a small modal pre-filled with the permission they need:

```
Request access

You don't have permission to [see all credentials on XYZ Commerce].
Explain why you need this access:
[___________________________________________________]

[ Cancel ]                    [ Submit Request ]
```

Submits to `POST /api/permissions/request`. Shows confirmation: "Request submitted — your admin will review it."

---

## 5. Notification indicator (minimal)

The sidebar "Permission Requests" nav item shows a count badge when there are pending requests. This is the only notification in this phase — no full notification system yet.

Fetch count from: `GET /api/admin/permissions/requests/count?status=pending`

Poll with SWR `refreshInterval: 60000`.

---

## 6. First-login forced password change

If `user.forcePasswordChange === true`, after login the user is redirected to `/change-password` instead of the dashboard. They cannot navigate away until they change their password.

Route: `/change-password` — simple centered card with new password + confirm fields. On success, sets `forcePasswordChange: false`, redirects to dashboard.

---

## 7. Constants update

Update `lib/constants.ts`:

```ts
// All permission keys — single source of truth
export const ALL_PERMISSIONS = [
  'canSeeAllProjects',
  'canCreateProject',
  'canAddCredential',
  'canManageTeam',
  'canGrantVisibility',
  'canSeeAllCredentials',
  'canManageRoles',
  'canManageMembers',
  'canViewAuditLog',
  'canManageOrgSettings',
  'isGod',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string; group: string }> = {
  canSeeAllProjects:    { label: 'See all projects',        description: 'View all projects org-wide, not just assigned ones', group: 'Projects' },
  canCreateProject:     { label: 'Create projects',         description: 'Create new projects in the organisation',           group: 'Projects' },
  canAddCredential:     { label: 'Add credentials',         description: 'Add credentials and env variables to projects',     group: 'Credentials' },
  canGrantVisibility:   { label: 'Grant visibility',        description: 'Allow others to see credentials on your projects',  group: 'Credentials' },
  canSeeAllCredentials: { label: 'See all credentials',     description: 'See credentials added by others, not just own',    group: 'Credentials' },
  canManageTeam:        { label: 'Manage team',             description: 'Add/remove members from projects',                 group: 'Team' },
  canManageMembers:     { label: 'Manage employees',        description: 'Create, edit, deactivate employees',               group: 'Admin' },
  canManageRoles:       { label: 'Manage roles',            description: 'Create and edit custom roles',                     group: 'Admin' },
  canViewAuditLog:      { label: 'View audit log',          description: 'See the full organisation audit trail',            group: 'Admin' },
  canManageOrgSettings: { label: 'Manage org settings',     description: 'Edit organisation name, hierarchy, and settings',  group: 'Admin' },
  isGod:                { label: 'God mode',                description: 'Bypass all permission checks — full access',       group: 'Admin' },
};
```

---

## Deliverable checklist

- [ ] `CustomRole` model with correct indexes and unique constraint
- [ ] `PermissionRequest` model created
- [ ] `User` model updated with `customRoleId`, `specialPermissions[]`, `forcePasswordChange`
- [ ] `lib/permissions.ts` resolver handles: base role → custom role → special grants/revocations → expiry
- [ ] Auth middleware attaches `req.permissions` to every request
- [ ] `GET /api/auth/me/permissions` returns resolved permissions
- [ ] All 9 built-in roles seeded as `CustomRole` documents with `isBuiltIn: true` on first run
- [ ] `POST /api/admin/users` creates user with role/team/reporting in one call
- [ ] Circular chain check runs on user creation (same as Phase 08)
- [ ] `forcePasswordChange` redirect works on login
- [ ] `/change-password` page works and clears the flag
- [ ] Custom role CRUD works (create, edit, delete with member count guard)
- [ ] Special permission grant/revoke API works
- [ ] Permission expiry logic runs and marks expired grants inactive
- [ ] `usePermissions` hook uses resolved permissions from API (not static constants)
- [ ] Add Employee modal (3-step) works end-to-end, shows temp password on success
- [ ] Edit User modal (3-tab) works — all fields save correctly
- [ ] User Permissions drawer opens, shows effective permission table with sources
- [ ] Grant permission form in drawer works with expiry date
- [ ] Role management page shows built-in (read-only) + custom roles
- [ ] Create/Edit role modal permission checkboxes update live preview
- [ ] God mode checkbox locks all others
- [ ] Permission requests page renders with filter tabs and pending count
- [ ] Approve (with optional expiry) and reject (with required note) work end-to-end
- [ ] "Request access" button appears in relevant empty states and 403 screens
- [ ] Request permission modal pre-fills context correctly
- [ ] Pending requests count badge on sidebar nav item
- [ ] AuditLog entries for all actions in this phase
- [ ] ESLint clean, `npm run build` zero TypeScript errors
