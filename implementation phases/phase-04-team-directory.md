# VaultStack — Phase 04: Team Management & Employee Directory

> Prerequisite: Phase 03 complete. Credentials work end-to-end.

---

## Goal

Build the Team page (project-scoped and org-wide member management) and the Employee Directory with a visual org hierarchy tree showing the reporting chain across all roles.

---

## 1. Member / Team API Routes

### `GET /api/members`

Returns all users in the organisation (for sysadmin, manager, ceo, coo, cfo) or only co-members on shared projects (for others).

Query params: `?role=developer&search=rahul&department=Engineering`

Response per user:
```json
{
  "_id": "...",
  "name": "Rahul Mehta",
  "initials": "RM",
  "email": "rahul@company.com",
  "role": "developer",
  "jobTitle": "Senior Backend Engineer",
  "department": "Engineering",
  "avatarUrl": null,
  "reportingTo": { "_id":"...", "name":"Priya Sharma", "role":"manager" },
  "isActive": true,
  "projectCount": 3,
  "lastLoginAt": "..."
}
```

### `GET /api/members/:id`

Single member profile. Same visibility rules.

### `PATCH /api/members/:id`

Who can call: sysadmin (any field), self (jobTitle, department, avatarUrl only).

Body: any subset of `{ name, role, jobTitle, department, avatarUrl, reportingTo, isActive }`

Changing `role` → sysadmin only. Write AuditLog.

### `POST /api/members/:id/deactivate`

Sets `isActive: false`. Sysadmin only.

### `GET /api/members/org-chart`

Returns the full org hierarchy as a nested tree.

Algorithm: fetch all users, build a tree rooted at users with `reportingTo: null`, then nest by `reportingTo` pointer.

Response:
```json
{
  "tree": [
    {
      "_id": "...",
      "name": "Dhruv Joshi",
      "role": "ceo",
      "children": [
        {
          "_id": "...",
          "name": "Arjun Rao",
          "role": "coo",
          "children": [ ... ]
        }
      ]
    }
  ]
}
```

---

## 2. Team Page (`app/(dashboard)/team/page.tsx`)

### Two tabs: "All members" and "By project"

**All members tab:**

Search bar + Role filter (multi-select) + Department filter.

Table layout (match brand-store's table component if one exists, otherwise build `DataTable.tsx`):

| | Name | Role | Department | Projects | Last active | |
|---|---|---|---|---|---|---|
| [Avatar] | Rahul Mehta | developer badge | Engineering | 3 | 2 days ago | [Edit] |

Edit button → opens `EditMemberModal`. Only visible to permitted roles.

"Invite member" button top-right → `InviteMemberModal`. Visible to manager, sysadmin.

**By project tab:**

Accordion list: each project expands to show its members with their roles and visibility grant status (a lock/unlock icon showing whether they have full visibility).

Visibility toggle inline (for managers/sysadmin).

---

## 3. Invite Member Modal (`components/team/InviteMemberModal.tsx`)

Fields:
- Full name (required)
- Email (required)
- Role (Select, all 9 roles; only sysadmin can assign sysadmin/ceo/coo/cfo/cmo)
- Job title
- Department
- Reports to (searchable user select, shows avatar + name + role)

On submit → `POST /api/auth/invite`. Show the returned invite link in a copyable field.

---

## 4. Edit Member Modal (`components/team/EditMemberModal.tsx`)

Same fields as invite. Role change shows a yellow warning: "Changing this user's role will update their access across all projects immediately."

Deactivate button (danger, sysadmin only) with `ConfirmDialog`.

---

## 5. Employee Directory (`app/(dashboard)/directory/page.tsx`)

### 5a. List view (default)

A grid of `MemberProfileCard` components.

Card:
```
[Avatar XL]
[Name, bold]
[Job title, secondary]
[Role badge]
[Department chip]
[Reports to: Avatar sm + Name]
[Email link]
```

Filter: by role, department, search.

### 5b. Org chart view (toggle in top-right)

A visual hierarchy tree using pure CSS (no D3 required — use nested flexbox/grid with connector lines).

**Layout rules:**
- Root nodes (no `reportingTo`) at the top
- Each level indented, connected with a vertical line + horizontal branch
- Each node is a compact card: Avatar sm + Name + Role badge + Job title
- Hover → shows a tooltip with email + department + project count
- Click → opens `MemberProfileCard` in a slide-over panel

**Implementation approach (CSS-only tree):**

```tsx
// Recursive component
function OrgNode({ user, children }) {
  return (
    <div className="org-node">
      <MemberCompactCard user={user} />
      {children.length > 0 && (
        <div className="org-children">
          {children.map(child => (
            <OrgNode key={child._id} user={child} children={child.children} />
          ))}
        </div>
      )}
    </div>
  );
}
```

CSS connector lines: use `::before` / `::after` pseudo-elements with `border-left` and `border-top` on `.org-children` children to draw the tree lines. Color: `#DFE1E6`.

### 5c. Member profile slide-over (`components/directory/MemberProfileSlideOver.tsx`)

Right-side panel (slide from right on click). Width `380px`.

Contains:
- Avatar XL + name + role badge + job title + department
- "Reports to" chain: show up to 3 levels up as breadcrumb
- Direct reports list (if any)
- Projects they are a member of (cards, click-through)
- "Edit" button (if permitted)

---

## 6. Org hierarchy in Tailwind

Add to `tailwind.config`:

```js
// Connector line colors already covered by vault.border token
// Add these utilities for the org tree:
'.org-children': { position: 'relative', paddingLeft: '32px', borderLeft: '1px solid #DFE1E6' },
'.org-node': { position: 'relative', marginBottom: '8px' },
```

Or use `@layer components` in `globals.css` — match brand-store's custom CSS pattern.

---

## Deliverable checklist

- [x] `GET /api/members` returns filtered list based on role (RBAC: sysadmin/manager/execs see all, others see co-members)
- [x] `GET /api/members/org-chart` returns correct nested tree (recursive buildMap algorithm)
- [x] Team page renders with both tabs (All members + By project)
- [x] Search and filter work on table (client-side filter + API query params)
- [x] Invite member modal creates user, invite link shown with copy button
- [x] Edit member modal updates role + metadata (self can edit safe fields; sysadmin can edit all)
- [x] Deactivate works (sysadmin only, ConfirmDialog)
- [x] Directory list view renders with role + search filters
- [x] Org chart view renders the full tree with CSS connector lines (::before pseudo-elements)
- [x] Member profile slide-over opens on click, fetches full member data
- [x] Slide-over shows reporting chain, projects, edit button
- [x] `lib/utils.ts` created with formatDistanceToNow, getInitials, truncate helpers
- [x] Route ordering: /org-chart static before /:id dynamic to prevent param collision
