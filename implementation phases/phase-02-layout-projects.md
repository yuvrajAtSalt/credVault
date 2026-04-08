# VaultStack — Phase 02: Layout Shell, Dashboard & Project CRUD

> Prerequisite: Phase 01 complete. Auth works. JWT cookie is being set on login.

---

## Goal

Build the full application shell (sidebar + topbar), the dashboard page, and complete project CRUD with member assignment. This is the first phase where the app looks and feels like a real product.

---

## 1. Layout Shell (`components/layout/`)

### Sidebar (`components/layout/Sidebar.tsx`)

Jira-style left sidebar. Fixed width `240px`. Background `#172B4D` (dark navy).

Structure:
```
[Logo / App name]             ← "VaultStack" in white, top 20px
[Nav section: Workspace]
  Dashboard
  Projects
  Team
  Employee Directory
[Nav section: Admin]          ← only visible to sysadmin and manager+
  Permissions
  Audit Log                   ← only sysadmin
  Settings
[Bottom: User card]
  [Avatar] [Name] [Role badge]
```

- Active nav item: blue left border `2px solid #0052CC` + light blue background `#0065FF1A`
- Inactive: white/60% opacity text, hover white text
- Role badge uses role color (define per role in constants)
- Nav items shown/hidden based on `usePermissions()` hook
- On mobile: collapsible, toggle button in topbar

### Topbar (`components/layout/Topbar.tsx`)

White bar, `height: 56px`, `border-bottom: 1px solid #DFE1E6`.

Left: page title (dynamic, from page metadata or prop)
Right: `[Notification bell (placeholder)] [Avatar + name dropdown]`

Dropdown: "Profile", "Switch role" (dev-only debug, toggle with `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`), "Logout"

### Page wrapper (`components/layout/PageWrapper.tsx`)

```tsx
// Props: title, subtitle?, actions? (ReactNode for top-right buttons), children
// Renders: page title row + subtitle + action buttons + children
// Consistent padding: px-6 py-5
```

### Dashboard layout (`app/(dashboard)/layout.tsx`)

Sidebar + main content area. Main area has `background: #F4F5F7`, `min-height: 100vh`.

---

## 2. Shared UI Components (`components/ui/`)

Build these atoms — match brand-store's component API style:

### `Button.tsx`
Variants: `primary` | `secondary` | `ghost` | `danger`
Sizes: `sm` | `md` | `lg`
Props: `loading?: boolean`, `icon?: ReactNode`, `disabled?`

### `Badge.tsx`
Each role gets a consistent color badge. Pull colors from `ROLE_BADGE_COLORS` in constants.
Also support generic `variant`: `success | warning | danger | info | neutral`

### `Avatar.tsx`
Shows initials or image. Sizes: `sm (24px)` | `md (32px)` | `lg (40px)` | `xl (56px)`
Background derived from user's role color (light tint) with dark role-color text.

### `Modal.tsx`
Headless modal with backdrop. Props: `isOpen`, `onClose`, `title`, `children`, `footer?`
`width`: `sm (400px)` | `md (520px)` | `lg (680px)`

### `Input.tsx`, `Select.tsx`, `Textarea.tsx`
Match brand-store's form field patterns. Label + field + error message. Border `#DFE1E6`, focus `#0052CC`.

### `Tooltip.tsx`
Simple hover tooltip. Used on masked credential values and permission indicators.

### `ConfirmDialog.tsx`
A specialised Modal for destructive actions. Red confirm button, descriptive message.

---

## 3. Project API Routes

### `GET /api/projects`
- Returns projects the current user can see (based on role permissions + member list)
- sysadmin/ceo/coo/cfo: all projects
- Others: only projects where `members[].userId === currentUser._id`
- Populate `members.userId` (name, avatar, role only — no sensitive fields)

### `POST /api/projects`
- Who can call: anyone whose `canCreateProject === true` (all roles in the updated permission matrix)
- Body: `{ name, description?, color?, tags?, status? }`
- Auto-adds creator as a member
- Writes AuditLog `project.create`

### `GET /api/projects/:id`
- Returns full project with populated members
- 403 if user doesn't have access

### `PATCH /api/projects/:id`
- Manager, sysadmin, or project creator only
- Body: any subset of `{ name, description, color, tags, status }`

### `DELETE /api/projects/:id` (soft archive)
- Sets `status: 'archived'`
- sysadmin only

### `POST /api/projects/:id/members`
- Who can call: manager (for their projects), sysadmin, or any `canManageTeam` role
- Body: `{ userId }`
- Adds user to `project.members`
- Writes AuditLog `member.invite`

### `DELETE /api/projects/:id/members/:userId`
- Same permission as above
- Writes AuditLog `member.remove`

---

## 4. Project UI

### Project list page (`app/(dashboard)/projects/page.tsx`)

Two-column card grid (responsive: 1 col on mobile). Each card:
- Colored left border (project color)
- Project name (bold) + description (truncated 2 lines)
- Tag badges
- Member avatar stack (max 4, then `+N`)
- Status badge
- Click → navigate to `/projects/[id]`

Filter bar at top: search input + status filter dropdown.

"New project" button top-right — visible only if `canCreateProject`.

### Create project modal

Triggered by "New project" button.

Fields: Name (required), Description, Color picker (6 preset swatches), Tags (multi-input chip), Status.

On submit: `POST /api/projects`, close modal, refresh list.

### Project detail page (`app/(dashboard)/projects/[id]/page.tsx`)

For Phase 02, show:
- Project header (name, description, color dot, status badge, tags)
- Members section: avatar + name + role badge grid
- "Add member" button (if permitted) → opens member search modal
- Placeholder tabs for "Credentials" (built in Phase 03)

---

## 5. Dashboard Page (`app/(dashboard)/dashboard/page.tsx`)

Stats row (4 cards): Total projects, Team members, Credentials stored, Your role.

Project grid below (same card component as projects page, limited to 6, "View all" link).

If sysadmin: show a purple "God mode active" notice banner at top.

---

## Deliverable checklist

- [ ] Sidebar renders with correct role-based nav visibility
- [ ] Active route highlights correctly
- [ ] Dashboard stats load from API
- [ ] Project list page renders with cards, filter, and search
- [ ] Create project modal works end-to-end (creates in DB, appears in list)
- [ ] Project detail page shows header and members
- [ ] Add / remove member works
- [ ] All UI components in `components/ui/` built and exported from `components/ui/index.ts`
- [ ] Mobile sidebar collapse works
- [ ] ESLint passes, no `any` types without comment justification
