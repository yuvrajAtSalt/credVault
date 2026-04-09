# VaultStack — Phase 08: Organisation Hierarchy & Team Structure Builder

> Prerequisite: Phase 07 complete. Employee directory (Phase 04) renders a flat list and a basic org chart. This phase replaces that basic chart with a fully managed, sysadmin-controlled hierarchy.

---

## Core concept

The organisation is structured as a **tree of reporting relationships**. Every employee has at most one direct manager (`reportingTo`). The sysadmin can:

1. Create named **teams** (e.g. "Engineering", "Product", "Finance") with a team lead
2. Assign employees to teams
3. Set the reporting chain for each employee (who reports to whom)
4. Designate the root of the org (the top-level person — usually CEO)

The employee directory (Phase 04) is then driven entirely by this structured data, rendering a real visual org chart.

---

## 1. Model changes

### Update `models/User.ts`

The `reportingTo` field already exists from Phase 01. No schema change needed. But add:

```ts
teamId: ObjectId (ref: Team, nullable),   // which team this user belongs to
isOrgRoot: Boolean (default: false),       // true for the top-level person (CEO / founder)
```

Add a compound index: `[organisationId, isOrgRoot]` — enforce only one root per org at the application layer (not DB unique, since false values are common).

### New model: `models/Team.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  name: String (required),                  // e.g. "Engineering", "Product", "Finance"
  slug: String (required),                  // lowercase-hyphenated, unique per org
  description: String,
  color: String (hex, default '#0052CC'),   // used as the team's color tag in the directory
  icon: String (nullable),                  // optional lucide-react icon name e.g. "code-2", "bar-chart"
  leadId: ObjectId (ref: User, nullable),   // the team lead / manager of this team
  parentTeamId: ObjectId (ref: Team, nullable),  // for nested teams e.g. "Backend" under "Engineering"
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: organisationId, leadId, parentTeamId
// Unique: [organisationId, slug]
```

### New model: `models/OrgSnapshot.ts`

Stores a point-in-time snapshot of the org chart. Used to show "as of [date]" historical views.

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  label: String,          // e.g. "Q1 2025 structure"
  snapshot: Mixed,        // the full serialised tree JSON at that moment
  createdBy: ObjectId (ref: User),
  createdAt: Date,
}
// Index: organisationId, createdAt
```

---

## 2. API Routes

Base path: `/api/org`

### Teams

#### `GET /api/org/teams`
Returns all teams for the organisation, with:
- `lead`: populated user (name, role, avatar)
- `memberCount`: number of users with `teamId === this team`
- `parentTeam`: populated parent team name + color (if nested)

Who can call: all authenticated users (teams are visible org-wide).

#### `POST /api/org/teams`
Who can call: sysadmin only.

Body:
```json
{
  "name": "Engineering",
  "description": "Builds and maintains all products",
  "color": "#0052CC",
  "icon": "code-2",
  "leadId": "<userId>",
  "parentTeamId": null
}
```

Auto-generates `slug` from name.

#### `PATCH /api/org/teams/:teamId`
Sysadmin only.
Body: any subset of `{ name, description, color, icon, leadId, parentTeamId }`.
If `leadId` changes → write AuditLog `team.lead_changed`.

#### `DELETE /api/org/teams/:teamId`
Sysadmin only.
Sets `teamId: null` on all members of this team before deletion.
Returns 409 if team has sub-teams (must reassign or delete sub-teams first).

---

### Reporting relationships

#### `GET /api/org/chart`

Returns the full org tree starting from the root user(s).

Build the tree server-side:
1. Find all users in the org
2. Find root(s): `isOrgRoot: true`, or fallback to users where `reportingTo === null`
3. Recursively build children by matching `reportingTo` pointer
4. Each node includes: `_id`, `name`, `initials`, `role`, `jobTitle`, `department`, `teamId` (populated), `avatarUrl`, `isOrgRoot`, `children[]`

Response:
```json
{
  "roots": [
    {
      "_id": "...",
      "name": "Dhruv Joshi",
      "role": "ceo",
      "jobTitle": "Chief Executive Officer",
      "team": null,
      "isOrgRoot": true,
      "children": [
        {
          "_id": "...",
          "name": "Arjun Rao",
          "role": "coo",
          "children": [
            {
              "_id": "...",
              "name": "Priya Sharma",
              "role": "manager",
              "team": { "name": "Engineering", "color": "#0052CC" },
              "children": [ ... ]
            }
          ]
        }
      ]
    }
  ],
  "unassigned": [
    { "_id":"...", "name":"New Hire", "role":"developer" }
  ]
}
```

`unassigned` = users with no `reportingTo` and `isOrgRoot: false`. These float outside the tree and are shown in a separate "Unassigned" section in the UI.

Who can call: all authenticated users.

#### `PATCH /api/org/members/:userId/reporting`
Sysadmin only.

Body:
```json
{
  "reportingTo": "<managerId or null>",
  "teamId": "<teamId or null>",
  "isOrgRoot": false
}
```

Validation:
- Prevent circular reporting chains (A reports to B, B reports to A). Walk up the chain before saving — if `userId` is found in the ancestor chain of `reportingTo`, return 409 with message "This would create a circular reporting chain."
- Only one `isOrgRoot: true` per org — if setting `isOrgRoot: true`, unset the previous root first.

Write AuditLog `member.reporting_changed` with `meta: { previous, updated }`.

#### `POST /api/org/members/bulk-assign`
Sysadmin only.

Body:
```json
{
  "assignments": [
    { "userId": "...", "reportingTo": "...", "teamId": "..." },
    { "userId": "...", "reportingTo": "...", "teamId": "..." }
  ]
}
```

Process all in a single transaction. Used when onboarding a whole team at once or doing a reorg.

Returns `{ updated: N, errors: [...] }`.

#### `GET /api/org/members/:userId/chain`
Returns the full reporting chain upward from a user (their manager, their manager's manager, etc.) up to root.

```json
{
  "chain": [
    { "name": "Priya Sharma", "role": "manager" },
    { "name": "Arjun Rao", "role": "coo" },
    { "name": "Dhruv Joshi", "role": "ceo" }
  ]
}
```

Used in the directory slide-over panel.

#### `POST /api/org/snapshots`
Sysadmin only. Saves a snapshot of the current org tree.
Body: `{ label }`.
Calls `GET /api/org/chart` internally and stores the result in `OrgSnapshot`.

#### `GET /api/org/snapshots`
Returns list of snapshots (label + createdAt + createdBy).

---

## 3. New page — Org Structure Builder

Route: `/settings/organisation/structure`

Accessible only to sysadmin. Add link in the Settings sidebar nav under "Organisation".

This is the sysadmin's control panel for building the hierarchy.

### 3a. Layout

Split view:
```
┌─────────────────────────┬──────────────────────────────┐
│  Teams panel (left)     │  Org chart + member editor   │
│  240px                  │  (right, main area)          │
└─────────────────────────┴──────────────────────────────┘
```

### 3b. Teams panel (left)

Scrollable list of all teams. Each row:
```
[color dot] Engineering (12 members)
            Lead: Priya Sharma
            [Edit] [Delete]
```

Nested sub-teams indented under parent.

"+ New team" button at top.

Clicking a team filters the org chart on the right to highlight that team's members.

### 3c. Org chart (right — main area)

A **fully interactive drag-and-drop org chart** where the sysadmin can:

1. **Drag a member node** and drop it onto another member to change their `reportingTo`
2. **Click a node** to open the Member Editor panel (right side-over)
3. **Search** for a member (highlights/scrolls to their node)
4. **Zoom in/out** (CSS `transform: scale()` on the tree container, with `+`/`-` buttons and a reset button)

**Drag-and-drop implementation:**

Use `@dnd-kit/core` + `@dnd-kit/sortable` (or match brand-store's DnD library if it uses one).

Each node is a `<Draggable>`. The whole tree container is a `<Droppable>` that detects which node the draggable is released over.

On drop:
- Show a confirmation tooltip: "Move [name] to report to [target name]?" with Confirm / Cancel
- On confirm → `PATCH /api/org/members/:userId/reporting`
- Optimistic update: re-render tree immediately, revert on API error

**Node card design:**
```
┌────────────────────────┐
│ [Avatar]  Name         │
│           Job title    │
│ [Role badge] [Team dot]│
└────────────────────────┘
```
- Width: `160px`
- White card, `border: 1px solid #DFE1E6`, `border-radius: 8px`
- Team color dot in bottom-right corner
- Root node: `border: 2px solid #0052CC` + a small crown icon `👑` → use `<Crown />` from lucide-react, size 12px
- Hover: subtle blue border tint
- Drag active: card lifts (add `box-shadow: 0 4px 12px rgba(0,82,204,0.2)`)

**Connector lines:**

Use SVG overlay drawn on top of the tree. On each render, calculate node positions using `getBoundingClientRect()` and draw SVG `<path>` elements (cubic bezier curves) from parent center-bottom to child center-top.

```ts
// Path from parent to child:
// M parentX,parentBottom C parentX,midY childX,midY childX,childTop
const d = `M ${px},${py} C ${px},${my} ${cx},${my} ${cx},${cy}`;
```

Connector color: `#DFE1E6` normally, `#0052CC` when the connected node is hovered.

**Unassigned members strip:**

Below the tree, a horizontal scrollable strip labeled "Unassigned":
```
[ Avatar Name ]  [ Avatar Name ]  [ Avatar Name ]  →
```
Each chip is also draggable — drag from the strip onto a node to assign a reporting relationship.

### 3d. Member editor slide-over

Opens from the right when a node is clicked. `380px` width.

Sections:

**Identity**
- Avatar (large) + Name + Role badge
- Job title (editable Input)
- Department (editable Input)

**Reporting**
- "Reports to" field: searchable user select showing avatar + name + role
- Shows current manager's card inline (avatar, name, role)
- "Clear" button to remove reporting (moves to unassigned)
- Button: "View reporting chain" → inline expand showing the chain up to root (fetched from `/api/org/members/:id/chain`)

**Team**
- "Assign to team" select (all teams listed with color dots)
- Shows current team name + color

**Org root**
- Toggle: "Set as organisation root (top of hierarchy)"
- Warning if toggling on: "This will remove [current root name]'s root status."

**Quick actions**
- "View profile" → links to directory profile page
- "View projects" → links to team page filtered to this member

Save button at bottom (saves reporting + team + jobTitle + department in one call).

---

## 4. Update Employee Directory (Phase 04)

The directory in Phase 04 has a basic org chart. Replace the tree rendering with the new data from `GET /api/org/chart`.

### 4a. Org chart view enhancements

- Render using the same SVG bezier connector approach from the builder (extract as shared `OrgTreeRenderer` component)
- Add zoom controls (`+` / `-` / reset, CSS scale)
- Add "Filter by team" dropdown (highlights team members, dims others)
- Add member count at each sub-tree level (small badge on the connector: "3 reports")
- Read-only in the directory (no drag-and-drop, no editing)

### 4b. Reporting chain in slide-over

Replace the manually-built chain from Phase 04 with the `/api/org/members/:id/chain` API call. Shows the actual path from the member up to the root.

---

## 5. Team filter on Team page (Phase 04)

On the Team page (`/team`), add a "Teams" filter section in the sidebar or filter bar:

```
Filter by team:
[ ] All
[●] Engineering  (12)
[●] Product      (6)
[●] Finance      (4)
[ ] No team      (2)
```

Clicking a team filters the member table/grid to that team's members.

---

## 6. Audit log additions

Add to `AuditLog` action enum:
```
'team.create', 'team.update', 'team.delete', 'team.lead_changed',
'member.reporting_changed', 'member.team_assigned', 'org.snapshot_saved'
```

---

## 7. Validation rules summary

| Rule | Where enforced |
|---|---|
| No circular reporting chain | API: walk ancestors before saving |
| Only one `isOrgRoot` per org | API: unset previous root before setting new |
| Team slug unique per org | DB: compound unique index |
| Cannot delete team with sub-teams | API: check before delete |
| Only sysadmin can edit reporting | API + middleware |

---

## Deliverable checklist

- [x] `Team` model created with compound unique index on `[organisationId, slug]`
- [x] `OrgSnapshot` model created
- [x] `User` model updated with `teamId` and `isOrgRoot` fields
- [x] `GET /api/org/chart` returns correct nested tree with `unassigned` array
- [x] Circular chain detection works (API returns 409 on attempt)
- [x] Single root enforcement works
- [x] `GET /api/org/members/:id/chain` returns correct ancestor chain
- [x] `POST /api/org/members/bulk-assign` processes all assignments, returns counts
- [x] Snapshot save and list endpoints work
- [x] Org structure builder page renders (sysadmin only)
- [x] Teams panel renders nested teams, create/edit/delete work
- [x] Org chart renders SVG bezier connectors correctly
- [x] Drag-and-drop works: drag node → drop on target → confirmation → API call
- [x] Unassigned strip renders, dragging from it onto tree assigns reporting
- [x] Zoom in/out/reset works on org chart
- [x] Member editor slide-over opens, saves reporting + team + fields
- [x] "Set as org root" toggle works with warning
- [x] Employee directory org chart replaced with new renderer
- [x] Directory org chart has zoom + team filter
- [x] Team page has team filter sidebar
- [x] AuditLog entries written for all org structure actions
- [x] ESLint clean, `npm run build` passes with zero TypeScript errors
