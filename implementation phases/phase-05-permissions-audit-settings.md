# VaultStack — Phase 05: Permissions Matrix, Audit Log & Settings

> Prerequisite: Phase 04 complete. Team page and directory work.

---

## Goal

Build the permissions management UI, a full audit log with filtering, and organisation + personal settings pages. This phase completes the admin control surface.

---

## 1. Permissions Page (`app/(dashboard)/settings/permissions/page.tsx`)

Visible to: sysadmin only (enforced in middleware + API).

### 1a. Permission matrix table

A full-width table: rows = roles, columns = permissions.

| Role | See all projects | Create project | Add credential | Manage team | Grant visibility | Manage roles | See all creds | God mode |
|---|---|---|---|---|---|---|---|---|
| System Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CEO | ✓ | ✓ | ✓ | — | — | — | ✓ | — |
| ... | | | | | | | | |

- ✓ = `<CheckCircle />` icon, `text-green-600`
- — = `<Minus />` icon, `text-gray-400`
- Row header: role badge + label
- Column headers: short labels with a `<Tooltip>` explaining each permission
- Table is read-only in this phase (future: custom permission overrides per org)

### 1b. Role legend panel

Below the matrix, a card grid (3 per row) — one card per role:

```
[Role badge]  System Admin
              "Full God-mode access. Sees and manages everything."
              Permissions: [list of granted ones as small badges]
```

---

## 2. Audit Log Page (`app/(dashboard)/settings/audit-log/page.tsx`)

Visible to: sysadmin only.

### 2a. API route: `GET /api/audit-log`

Query params:
- `?action=credential.view`
- `?actorId=...`
- `?targetType=Credential`
- `?from=2024-01-01&to=2024-12-31`
- `?page=1&limit=50`

Returns paginated `AuditLog` entries with populated `actorId` (name, role, initials).

### 2b. UI

Filter bar: Action type (Select), Actor (searchable user select), Date range (two date inputs), "Clear filters" button.

Table:

| Time | Actor | Action | Target | Details |
|---|---|---|---|---|
| 2h ago | [Avatar sm] Rahul Mehta (dev) | credential.view | Credential: "DB Password" | Project: XYZ Commerce |

- Paginated: show 50 per page, pagination controls at bottom
- Action badges color-coded: `credential.*` → blue, `project.*` → teal, `member.*` → amber, `login/logout` → gray, `visibility.*` → purple
- Clicking a row expands inline to show the full `meta` JSON object in a code block

---

## 3. Organisation Settings (`app/(dashboard)/settings/organisation/page.tsx`)

Visible to: sysadmin.

### API route: `GET /api/settings/organisation`
Returns the Organisation document.

### API route: `PATCH /api/settings/organisation`
Body: `{ name?, logoUrl?, hierarchy? }`

### UI

Form card:
- Organisation name (Input)
- Logo URL (Input + preview)
- Role hierarchy order (drag-to-reorder list of all roles)
  - Use a simple drag-and-drop list (implement with mouse events, no library, or use `@dnd-kit/sortable` if brand-store already uses it)
  - Order here controls the display order in the Employee Directory org chart

Save button at bottom. Success toast on save.

---

## 4. Personal Settings (`app/(dashboard)/settings/profile/page.tsx`)

Accessible to all roles (themselves only).

### API: `PATCH /api/members/:id` (reuse from Phase 04)

### UI

Profile card:
- Avatar (large, with "Change" overlay on hover → file input, uploads to `/api/upload/avatar`)
- Full name
- Job title
- Department
- Email (read-only, shown greyed out)
- Role (read-only, greyed out — only sysadmin can change it)

Password change section (separate card):
- Current password
- New password
- Confirm new password

### API route: `POST /api/auth/change-password`

Verify current password, hash new one, update user.

---

## 5. Settings navigation

Add a "Settings" section to the sidebar (already stubbed in Phase 02):

```
Settings
  ├── Profile          (all roles)
  ├── Organisation     (sysadmin)
  ├── Permissions      (sysadmin)
  └── Audit Log        (sysadmin)
```

Use a nested nav group in the sidebar, collapsible with an arrow indicator.

---

## 6. Toast notification system

If brand-store has a toast/notification system, reuse it. Otherwise build `components/ui/Toast.tsx`:

- Fixed position bottom-right
- Auto-dismiss after 3.5s
- Variants: success (green), error (red), info (blue), warning (amber)
- Hook: `useToast()` → `{ toast }` where `toast.success('Saved')`, `toast.error('Failed')`
- Store in a Context at the dashboard layout level

Use toasts on: form saves, credential copy, invite sent, permission changes, deactivation.

---

## 7. Empty states

Every list/table should have a well-designed empty state:

- Icon (from lucide-react, relevant to the content)
- Heading: "No projects yet" / "No credentials added" / "No audit events"
- Sub-text: contextual guidance
- CTA button if the user has permission to create

---

## Deliverable checklist

- [x] Permissions matrix page renders correct ✓/— for all 9 roles × 8 permissions
- [x] Role legend cards render below the matrix
- [x] Audit log table renders with paginated data from DB
- [x] Audit log filters (action, actor, date range) work
- [x] Row expand shows meta JSON
- [x] Organisation settings form saves name, logo, hierarchy order
- [x] Drag-to-reorder hierarchy works and persists
- [x] Profile settings form saves jobTitle, department, avatar
- [x] Password change works (verify old → hash new → save)
- [x] Toast system works for success/error/info/warning
- [x] All list pages have proper empty states
- [x] Settings sidebar nav group is collapsible
- [x] ESLint clean
