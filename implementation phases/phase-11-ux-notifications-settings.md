# VaultStack — Phase 11: UX Overhaul, Notification System, Admin Settings & Profile Restrictions

> Prerequisite: Phase 10 complete.
>
> Before writing a single line of code, open **https://cred-vault-web.vercel.app** and log in with
> each of the 9 role accounts (password `Password123!`) listed at the bottom of this document.
> Screenshot every page, every dropdown, every modal, every form. Build a findings list.
> Then implement every fix in this phase on top of those findings.
>
> Credential accounts for review:
> - sysadmin@credvault.com  (System Admin)
> - ceo@credvault.com       (CEO)
> - coo@credvault.com       (COO)
> - cfo@credvault.com       (CFO)
> - cmo@credvault.com       (CMO)
> - manager@credvault.com   (Manager)
> - devops@credvault.com    (DevOps)
> - developer@credvault.com (Developer)
> - qa@credvault.com        (QA Engineer)
> Password for all: **Password123!**

---

## Part 1 — Custom component library (kill all browser-native UI)

Every native browser `<select>`, `<input type="date">`, browser `<tooltip>`, and any other OS-rendered control must be replaced with a custom-built component. The goal is pixel-perfect consistency across Chrome, Firefox, Safari, and Edge on Mac, Windows, and Linux.

### 1a. `components/ui/Select.tsx` — custom dropdown

Replace every `<select>` in the application.

**Anatomy:**
```
[Trigger button]
  [Selected value or placeholder]    [chevron icon]

[Dropdown panel — rendered in a portal]
  [Search input — if options > 6]
  [Option list]
    [Option row: icon? + label + description?]
    [Option row: selected = blue bg + checkmark]
  [Footer: "Clear selection" — if clearable]
```

**Behaviour:**
- Opens downward, flips upward if insufficient viewport space below
- Rendered in a React Portal (`document.body`) so it is never clipped by `overflow: hidden` parents
- Keyboard: `↑↓` navigate, `Enter` select, `Escape` close, typing filters when search is shown
- Click outside closes
- Animate: `opacity 0 → 1` + `translateY(-4px) → 0` in `120ms ease-out`
- The trigger button takes the full width of its container
- When open: trigger has `border-color: #0052CC` + `box-shadow: 0 0 0 2px rgba(0,82,204,0.2)`

**Props API:**
```ts
interface SelectProps {
  options: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: ReactNode;
    disabled?: boolean;
    group?: string;        // groups options under headers
  }>;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchable?: boolean;   // auto true when options.length > 6
  clearable?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  label?: string;
  hint?: string;
}
```

**Grouped options:** When `group` is set on options, render group headers (non-selectable, uppercase 11px label) between groups.

**Multi-select variant (`MultiSelect.tsx`):**
Same portal approach. Selected values shown as dismissible chips inside the trigger. `[× chip] [× chip] [placeholder...]`

---

### 1b. `components/ui/DatePicker.tsx` — custom date picker

Replace every `<input type="date">` and `<input type="datetime-local">`.

**Layout:**
```
[Input trigger: DD / MM / YYYY]  [calendar icon]

[Calendar panel — portal]
  [← Month Year →]
  [Su Mo Tu We Th Fr Sa]
  [date grid]
  [Today button]  [Clear button]
```

**Behaviour:**
- Click the input or icon to open
- Navigate months with arrows
- Click a date to select and close
- Keyboard: arrow keys move between days, Enter selects, Escape closes
- Dates in the past can be disabled via `minDate` prop (used for expiry pickers — can't expire in the past)
- Selected date shown with `background: #0052CC; color: white; border-radius: 50%`
- Today highlighted with `border: 1px solid #0052CC`
- Portal rendering — never clipped

**Props:**
```ts
interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
}
```

---

### 1c. `components/ui/UserSelect.tsx` — searchable user picker

Used wherever a user needs to be selected (reporting, project member add, team lead, etc.). Built on top of `Select` but with specialised option rendering.

Each option row:
```
[Avatar sm]  [Name]          [Role badge]
             [Job title, secondary]
```

Searchable by name, email, job title. Fetches from `GET /api/members?search=...` with 300ms debounce.

---

### 1d. `components/ui/Combobox.tsx` — free-text + options

For fields like "Group" on credentials (type a new group or pick an existing one). Combines a text input with a dropdown of existing options. Enter creates a new value not in the list.

---

### 1e. `components/ui/ColorPicker.tsx`

6 preset swatches + a custom hex input with a live preview swatch. Used on project, team, role, and environment color fields.

```
[● #0052CC] [● #36B37E] [● #FF5630] [● #FFAB00] [● #6554C0] [● #00B8D9]  [# _______]
```

---

### 1f. `components/ui/Toggle.tsx` — improved

Replace all `<input type="checkbox">` used as toggles with a styled toggle switch. Smooth thumb animation `150ms ease`. Sizes: `sm`, `md`. Label left or right.

---

### 1g. `components/ui/Tooltip.tsx` — improved

Replace any title-attribute or browser tooltip with a custom portal tooltip. Appears after 400ms hover delay. Max width `260px`. Soft shadow. Arrow pointer toward the trigger.

---

### 1h. `components/ui/Badge.tsx` — improved

Ensure every role badge, status chip, and tag throughout the app uses this single component. No inline `className` colour strings scattered around. All colours and labels come from `ROLE_BADGE_COLORS` and `PERMISSION_LABELS` from `lib/constants.ts`.

---

### 1i. Audit entire form surface

Walk every form in the application — modals, settings pages, inline edits. Ensure:
- Every `<select>` → `<Select>` custom component
- Every `<input type="date">` → `<DatePicker>`
- Every user picker → `<UserSelect>`
- Every color field → `<ColorPicker>`
- Every checkbox-as-toggle → `<Toggle>`
- Every `title=` attribute → `<Tooltip>`
- Form field error states: red border + red helper text below the field
- Form field focus states: `box-shadow: 0 0 0 2px rgba(0,82,204,0.2)` + blue border
- Required field indicator: red asterisk `*` to the right of the label

---

## Part 2 — Notification system

### 2a. Data model: `models/Notification.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  userId: ObjectId (ref: User, required),         // recipient
  type: String (enum: see list below, required),
  title: String (required),                        // short heading e.g. "You were added to XYZ Commerce"
  body: String,                                    // one-line detail
  url: String (required),                          // the deep link — where to navigate on click
  isRead: Boolean (default: false),
  readAt: Date (nullable),
  actorId: ObjectId (ref: User, nullable),         // who triggered this
  meta: Mixed,                                     // any extra context { projectId, credentialId, etc. }
  createdAt: Date,
}
// Indexes: userId, isRead, createdAt
// TTL index: auto-delete after 90 days (createdAt, expireAfterSeconds: 7776000)
```

**Notification types:**

```ts
type NotificationType =
  // Project
  | 'project.member_added'       // "Priya added you to XYZ Commerce"
  | 'project.member_removed'     // "You were removed from XYZ Commerce"
  | 'project.archived'           // "XYZ Commerce was archived"
  | 'project.handover'           // "You are now managing XYZ Commerce"
  // Credentials
  | 'credential.expiring_soon'   // "SendGrid API Key expires in 5 days — XYZ Commerce"
  | 'credential.access_request'  // "Rahul Mehta requested visibility on XYZ Commerce" (→ manager)
  | 'credential.access_granted'  // "Your visibility request was approved" (→ requester)
  | 'credential.access_rejected' // "Your visibility request was rejected" (→ requester)
  // Permissions
  | 'permission.granted'         // "You were granted canSeeAllProjects"
  | 'permission.revoked'         // "canSeeAllProjects was revoked"
  | 'permission.expiring_soon'   // "Your special permission expires tomorrow"
  | 'permission_request.received'   // sysadmin: "Rahul requested canSeeAllProjects"
  | 'permission_request.approved'   // "Your permission request was approved"
  | 'permission_request.rejected'   // "Your permission request was rejected"
  // Team / org
  | 'team.assigned'              // "You were assigned to the Engineering team"
  | 'team.lead_appointed'        // "You are now the lead of Engineering"
  | 'member.reporting_changed'   // "You now report to Priya Sharma"
  // Account
  | 'account.password_reset'     // "Your password was reset by an admin"
  | 'account.role_changed'       // "Your role was changed to Senior Developer"
```

---

### 2b. Notification service (`lib/notifications.ts`)

```ts
/**
 * Creates a notification document for one or more recipients.
 * Called internally from API routes whenever a notifiable action occurs.
 */
export async function createNotification(params: {
  organisationId: string;
  userId: string | string[];       // single or bulk
  type: NotificationType;
  title: string;
  body?: string;
  url: string;                     // always an absolute path e.g. "/projects/abc123"
  actorId?: string;
  meta?: Record<string, unknown>;
}): Promise<void>

/**
 * Build the deep link URL for each notification type.
 * Centralise URL construction here so it never diverges.
 */
export function buildNotificationUrl(type: NotificationType, meta: Record<string, unknown>): string
```

**Wire up `createNotification` inside existing API routes:**

| Action | Notification created for |
|---|---|
| `POST /api/projects/:id/members` | The added user |
| `DELETE /api/projects/:id/members/:userId` | The removed user |
| `POST /api/projects/:id/handover` | The new manager |
| `POST /api/projects/:id/visibility` (approve) | The user whose visibility changed |
| `POST /api/admin/permissions/requests/:id/approve` | The requestor |
| `POST /api/admin/permissions/requests/:id/reject` | The requestor |
| `POST /api/admin/users/:id/permissions/grant` | The user receiving the grant |
| `DELETE /api/admin/users/:id/permissions/:name` | The user being revoked |
| `PATCH /api/admin/users/:id` (role change) | The affected user |
| `PATCH /api/admin/users/:id` (password reset) | The affected user |
| `PATCH /api/org/members/:id/reporting` | The affected user |
| `POST /api/org/teams` or team lead assignment | The team lead |
| `GET /api/dashboard/expiring-credentials` (cron) | Project managers and credential owners |
| `POST /api/admin/permissions/requests` (new request) | All sysadmins |
| `POST /api/permissions/request` (credential visibility) | Project managers |

---

### 2c. Notification API routes

#### `GET /api/notifications`
Query: `?read=false&page=1&limit=20`
Returns paginated notifications for the current user, newest first.
Includes `unreadCount: number` in response headers: `X-Unread-Count`.

#### `POST /api/notifications/read`
Body: `{ ids: string[] }` or `{ all: true }`
Marks notifications as read.

#### `DELETE /api/notifications/:id`
Deletes a single notification.

#### `GET /api/notifications/unread-count`
Lightweight endpoint returning `{ count: number }`. Polled every 30s for the bell badge.

---

### 2d. Notification bell (`components/notifications/NotificationBell.tsx`)

Mounted in the topbar, right side, before the avatar.

```
[🔔]  ← badge shows unread count (max "99+")
```

- Red dot badge when `unreadCount > 0`
- Click opens `NotificationPanel`

### 2e. Notification panel (`components/notifications/NotificationPanel.tsx`)

Dropdown panel anchored to the bell. Width `380px`. Max height `520px`. Scrollable.

```
┌─────────────────────────────────────┐
│  Notifications          [Mark all read] │
├─────────────────────────────────────┤
│  [●] You were added to XYZ Commerce     │  ← unread: left blue dot
│      Priya Sharma added you  · 2m ago   │
│      → /projects/abc123                 │
├─────────────────────────────────────┤
│      Your permission request approved   │  ← read: no dot
│      canSeeAllProjects granted · 1h ago │
├─────────────────────────────────────┤
│  [View all notifications →]             │
└─────────────────────────────────────┘
```

Each row:
- Left: notification type icon (coloured, 32px circle background matching the type category)
- Middle: title (bold if unread) + body + relative time ("2m ago", "1h ago", "3d ago")
- Right: `[×]` dismiss button on hover
- Entire row is clickable → navigate to `notification.url` + mark as read

Icon mapping by category:
```
project.*        → folder icon, blue
credential.*     → key icon, amber
permission.*     → lock icon, purple
team.*           → users icon, teal
account.*        → user icon, gray
```

### 2f. Full notifications page (`/notifications`)

Accessible from "View all notifications" link in the panel and from sidebar nav.

Filter tabs: `All`  `Unread`  `Projects`  `Credentials`  `Permissions`  `Account`

List view matching the panel style but full-width. "Mark all as read" button top-right.

Pagination. "No notifications" empty state with the bell icon.

---

## Part 3 — Admin settings overhaul

### 3a. Settings navigation restructure

The current settings nav is likely a flat list. Replace with a structured sidebar:

```
Settings
  ├── [person icon]  My profile
  ├── [lock icon]    Security (password change)

Organisation                          ← only sysadmin
  ├── [building icon]  General
  ├── [sitemap icon]   Structure & teams
  ├── [shield icon]    Roles & permissions
  ├── [users icon]     Members
  ├── [key icon]       Permission requests   [badge: pending count]
  └── [list icon]      Audit log
```

Second-level nav items are indented and smaller (12px). Section headers are non-clickable labels (10px uppercase, secondary color).

Active item: blue left border + light blue background (same pattern as the main sidebar).

### 3b. Organisation General settings (`/settings/organisation/general`)

Clean two-column layout (settings label left, control right):

```
Organisation name        [_________________]
Slug / handle            [_________________]  (read-only after creation)
Logo                     [Upload / URL input]  [preview]
Default timezone         [Select: timezone list]
Date format              [Select: DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD]
Credential reminder      [Input: days before expiry] days
                         [Save changes]
```

All using custom `<Select>`, `<Input>`, `<Toggle>` components.

### 3c. Teams management page (`/settings/organisation/structure`)

Currently this exists (Phase 08) but needs admin-accessible team management separate from the org chart builder.

**Teams list:**

Card grid (3 per row). Each card:
```
┌──────────────────────────────┐
│ [● color dot]  Engineering   │
│ "Builds and maintains..."    │
│                              │
│ Lead: [Avatar] Priya Sharma  │
│ 12 members  · 3 sub-teams   │
│                              │
│ [Edit]  [Manage members]  [✕]│
└──────────────────────────────┘
```

"+ New team" button → `CreateTeamModal`

**Create / Edit Team modal:**
- Name
- Description
- Color (`<ColorPicker>`)
- Icon (grid of 20 lucide-react icon options to pick from)
- Team lead (`<UserSelect>` — searchable)
- Parent team (`<Select>` — for nested teams, optional)

**Manage members for a team** → slide-over panel:
```
Engineering team (12 members)
[Search members to add...]
─────────────────────────────
[Avatar] Rahul Mehta  developer  [Remove from team]
[Avatar] Priya Sharma  manager   [Remove from team]
...
```

Adding a member to a team updates `user.teamId`. Removing sets it to null.

Sysadmin can create teams that are assigned under a manager by setting the team lead to a manager role user. The team then appears under that manager in the org chart.

---

## Part 4 — Profile restrictions (non-admin users)

### Rules

Non-admin users (everyone except sysadmin) **cannot edit**:
- Their own name
- Job title
- Department
- Team assignment
- Role
- Reporting line

They **can edit**:
- Password (via security settings)
- Avatar / profile photo
- Notification preferences (Phase 11 addition — see 4b)

### 4a. Update profile settings page (`/settings/profile`)

For non-sysadmin users, the profile form becomes **read-only display** with a clear notice:

```
ℹ  Your profile information is managed by your organisation administrator.
   To update your name, job title, or team, contact your admin.
```

Name, job title, department, team, role, and reporting-to fields are rendered as read-only text (not inputs). No save button for these fields.

Avatar upload remains editable for all users.

### 4b. Notification preferences

New section on the profile settings page (all users):

```
Notification preferences
─────────────────────────
[Toggle]  Project invitations
[Toggle]  Project removals
[Toggle]  Credential expiry warnings
[Toggle]  Permission request updates
[Toggle]  Role or team changes
[Toggle]  Reporting line changes
```

Stored on the user document:

```ts
notificationPreferences: {
  projectInvitations: Boolean (default: true),
  projectRemovals: Boolean (default: true),
  credentialExpiry: Boolean (default: true),
  permissionRequests: Boolean (default: true),
  roleChanges: Boolean (default: true),
  reportingChanges: Boolean (default: true),
}
```

`createNotification` checks preferences before inserting — if the user has opted out of that category, skip the insert.

### 4c. API enforcement

#### `PATCH /api/members/:userId` (self-edit)

Update the endpoint to enforce the restriction:

```ts
const isSelf = req.user._id.toString() === params.userId;
const isSysadmin = req.permissions.isGod;

const ADMIN_ONLY_FIELDS = ['name', 'role', 'customRoleId', 'jobTitle', 'department', 'teamId', 'reportingTo', 'isOrgRoot'];

if (isSelf && !isSysadmin) {
  const attemptedAdminFields = Object.keys(body).filter(k => ADMIN_ONLY_FIELDS.includes(k));
  if (attemptedAdminFields.length > 0) {
    return res.status(403).json({
      error: `Only an administrator can update: ${attemptedAdminFields.join(', ')}`,
      code: 'PROFILE_FIELD_RESTRICTED'
    });
  }
}
```

---

## Part 5 — Forgot password flow

### 5a. Token model

Add to `models/User.ts`:
```ts
passwordResetToken: String (nullable, hashed),
passwordResetExpires: Date (nullable),
```

### 5b. API routes

#### `POST /api/auth/forgot-password`
Body: `{ email }`

1. Find user by email (always return the same response whether found or not — prevent enumeration: `"If this email exists, a reset link has been sent."`)
2. If found: generate a random 32-byte token, hash it with `crypto.createHash('sha256')`, store hash + expiry (1 hour) on user
3. Build the reset URL: `${NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`
4. In this phase: **do not send email** (email integration is Phase 12). Instead, log the URL to the server console with a clear label: `[PASSWORD RESET LINK]: <url>` — the sysadmin can copy this from the server logs for now.
5. Return `{ message: "If this email exists, a reset link has been sent." }`

#### `POST /api/auth/reset-password`
Body: `{ token, newPassword }`

1. Hash the incoming token and find user where `passwordResetToken === hashedToken` AND `passwordResetExpires > now`
2. Validate password strength
3. Hash new password, save, clear `passwordResetToken` and `passwordResetExpires`
4. Write AuditLog `account.password_reset_self`
5. Return `{ message: "Password updated. Please log in." }`

#### `GET /api/auth/reset-password/validate`
Query: `?token=...`
Returns `{ valid: true }` or `{ valid: false, reason: 'expired' | 'invalid' }`. Used by the frontend to show an error before the user fills the form.

### 5c. Login page updates (`/login`)

Add below the password field:

```
[Forgot your password?]   ← small right-aligned link
```

Clicking navigates to `/forgot-password`.

### 5d. Forgot password page (`/forgot-password`)

Centered card layout matching the login page style.

```
← Back to login

Forgot your password?
Enter your email address and we'll send you a reset link.

[Email address input]

[Send reset link]

─────────────────────────────────────────
Note: In development, the reset link is printed to server logs.
```

After submit: shows a success state (don't navigate away):
```
[✓ envelope icon]
Check your inbox
If an account exists for that email, a reset link has been sent.
You can close this page.
```

### 5e. Reset password page (`/reset-password`)

Token is read from the URL query string. On mount, call `GET /api/auth/reset-password/validate?token=...`.

If invalid or expired:
```
[✕ icon]
This link has expired or is invalid.
Request a new reset link → [link to /forgot-password]
```

If valid:
```
Reset your password

New password          [••••••••••••]  [show/hide toggle]
Confirm new password  [••••••••••••]  [show/hide toggle]

Password strength: [████░░] Medium

[Set new password]
```

Password strength meter: 4 levels (Weak / Fair / Medium / Strong) based on length, uppercase, number, special character. Color: red / amber / yellow / green.

On success: show success message + auto-redirect to `/login` after 3 seconds with a countdown: "Redirecting to login in 3..."

---

## Part 6 — Favicon and app identity

### 6a. Favicon

Create a simple SVG favicon representing a vault / key / lock concept in the VaultStack blue (`#0052CC`).

SVG concept:
```
A shield shape with a keyhole cut out, in #0052CC fill.
Clean, geometric, renders well at 16x16 and 32x32.
```

Generate the following files and add to `/public/`:
- `favicon.svg` — primary SVG favicon
- `favicon-32x32.png` — 32×32 PNG (convert from SVG using `sharp` or `canvas` in a build script)
- `favicon-16x16.png` — 16×16 PNG
- `apple-touch-icon.png` — 180×180 PNG

Update `app/layout.tsx`:
```tsx
export const metadata: Metadata = {
  title: {
    template: '%s | VaultStack',
    default: 'VaultStack',
  },
  description: 'Secure project credentials manager',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};
```

### 6b. Page titles

Every page must have a proper `<title>` tag via Next.js metadata. Examples:
- Dashboard → `Dashboard | VaultStack`
- Projects list → `Projects | VaultStack`
- Project detail → `XYZ Commerce | VaultStack`
- Settings profile → `My Profile — Settings | VaultStack`
- Login → `Sign in | VaultStack`

Add `export const metadata: Metadata = { title: '...' }` to every page file.

---

## Part 7 — Site-wide UX polish (from live site analysis)

Apply these fixes across the entire application based on patterns common in Next.js + Tailwind projects at this stage:

### 7a. Loading states

Every button that triggers an API call must show a loading spinner while in-flight and be disabled to prevent double-submit. The spinner replaces the button icon (not appended):

```tsx
<Button loading={isSubmitting} onClick={handleSubmit}>
  {isSubmitting ? 'Saving...' : 'Save changes'}
</Button>
```

### 7b. Empty states — consistent and contextual

Every list, table, and data panel must have a proper empty state:

- Projects list (empty org): icon + "No projects yet" + "Create your first project →" CTA
- Credentials tab (no creds): icon + "No credentials in this category" + "Add credential →" CTA (if permitted)
- Team table (no members): "No members yet"
- Notifications (none): bell icon + "All caught up — no notifications"
- Audit log (no results for filter): "No events match your filters" + "Clear filters →"

### 7c. 404 and error pages

`app/not-found.tsx`:
```
[404 illustration — simple geometric vault door]
Page not found
The page you are looking for does not exist or you don't have access to it.
[← Back to dashboard]
```

`app/error.tsx`:
```
[Error icon]
Something went wrong
[error.message — development only]
[Try again]  [← Back to dashboard]
```

### 7d. Confirm before navigation when forms are dirty

Any modal or settings form that has unsaved changes should warn before closing:

```tsx
// Use a custom hook: useUnsavedChanges(isDirty: boolean)
// Shows a browser confirm OR a custom "Unsaved changes" modal:
// "You have unsaved changes. Discard them?"  [Keep editing]  [Discard]
```

### 7e. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `N` (when not in input) | Open "New project" modal |
| `K` or `/` | Open global search (Phase 12 — stub the UI now) |
| `Escape` | Close any open modal or panel |
| `Cmd/Ctrl + Enter` | Submit the currently focused form |
| `Cmd/Ctrl + K` | Open command palette (stub for Phase 12) |

Add a `useKeyboardShortcut(key, handler)` hook in `hooks/useKeyboardShortcut.ts`.

Show a keyboard shortcut hint at the bottom of the app:
```
Press / to search  ·  N to create project  ·  ? for all shortcuts
```

### 7f. Responsive sidebar

On screens ≤ 768px:
- Sidebar hidden by default
- Hamburger button in topbar top-left (three horizontal lines icon)
- Sidebar slides in from left over the content (`position: fixed`, `z-index: 50`)
- Dark overlay behind the open sidebar, click to close
- No layout shift — sidebar is overlaid, not pushed

### 7g. Table column overflow

All data tables must handle long content without breaking layout:
- Long names: truncated with `text-overflow: ellipsis`, full name in `<Tooltip>`
- Long URLs (credentials): monospace, truncated, full value in tooltip + copy button
- Email addresses: truncated if the column is narrow

### 7h. Copy-to-clipboard feedback

Every copy button across the app (credential values, env variable values, invite links, reset links) must show consistent feedback:

1. Button icon changes from `⎘` (copy) to `✓` (checkmark)
2. Button text (if any) changes to "Copied!"
3. Returns to original after 1500ms
4. If clipboard API fails (non-HTTPS or permission denied): show a tooltip "Copy failed — select and copy manually" + the value briefly highlighted

### 7i. Relative timestamps

Every timestamp in the app (audit log, notification, credential added date, last login) must render as:
- `< 1 minute ago` → "Just now"
- `< 60 minutes` → "X minutes ago"
- `< 24 hours` → "X hours ago"
- `< 7 days` → "X days ago"
- `≥ 7 days` → formatted date "12 Apr 2025"
- Hover tooltip on every relative time shows the full ISO timestamp

Use a `useRelativeTime(date)` hook that re-renders every minute.

---

## Part 8 — Bug-fix catalogue (common patterns to check and fix)

While reviewing the live site, verify and fix each of these common issues:

1. **Flash of unauthenticated content** — dashboard momentarily visible before redirect on expired session. Fix: show a full-screen loading state during auth check.
2. **Modal scroll lock** — when a modal is open, `body` should not scroll. Add `overflow: hidden` to `<body>` when any modal is mounted. Remove on unmount.
3. **Z-index conflicts** — dropdowns appearing behind modals, tooltips clipped. Audit all z-index values. Use a z-index scale: `sidebar=10, topbar=20, dropdown=30, modal-backdrop=40, modal=50, toast=60`.
4. **SWR revalidation on tab focus** — when the user returns to the tab after being away, data should refresh automatically. Ensure `revalidateOnFocus: true` is set on all critical SWR calls.
5. **Form error clearing** — form validation errors should clear as soon as the user starts correcting the field, not only on submit.
6. **Button double-submit** — all submit buttons must be disabled while their request is in-flight (covered in 7a — verify it's applied everywhere).
7. **Missing aria labels** — icon-only buttons (copy, delete, eye toggle) must have `aria-label` attributes.
8. **Credential value wrapping** — long credential values in monospace should never cause horizontal scroll in the credential panel. Apply `overflow-x: hidden; text-overflow: ellipsis; white-space: nowrap` on the value cell.

---

## Deliverable checklist

**Part 1 — Custom components**
- [ ] `Select` with portal, keyboard nav, search, groups, clear
- [ ] `MultiSelect` with chip display
- [ ] `DatePicker` with calendar, keyboard, min/max date
- [ ] `UserSelect` with debounced search and avatar rendering
- [ ] `Combobox` free-text + options
- [ ] `ColorPicker` swatches + hex input
- [ ] `Toggle` animated switch
- [ ] `Tooltip` portal-rendered, 400ms delay
- [ ] All native `<select>` and `<input type="date">` replaced app-wide
- [ ] Form error + focus states consistent everywhere
- [ ] Required field asterisks present

**Part 2 — Notifications**
- [ ] `Notification` model with TTL index
- [ ] `lib/notifications.ts` service with all wired-up trigger points
- [ ] Notification bell in topbar with unread badge
- [ ] Notification panel dropdown with icon, title, body, time, dismiss
- [ ] Click on notification navigates to `notification.url` + marks read
- [ ] "Mark all read" works
- [ ] Full notifications page with filter tabs
- [ ] Notification preferences on profile settings

**Part 3 — Admin settings**
- [ ] Settings sidebar restructured with sections and second-level nav
- [ ] Teams management page with card grid, create/edit/delete
- [ ] Manage team members slide-over works (add/remove from team)
- [ ] Org general settings with timezone and date format selects

**Part 4 — Profile restrictions**
- [ ] Non-admin profile page shows read-only fields with admin notice
- [ ] API rejects non-admin attempts to update restricted fields
- [ ] Avatar upload still works for all users
- [ ] Notification preferences section added and saves correctly

**Part 5 — Forgot password**
- [ ] `/forgot-password` page matches login card style
- [ ] `POST /api/auth/forgot-password` generates token, logs URL to console
- [ ] `/reset-password` page validates token on mount
- [ ] Expired / invalid token shows error state
- [ ] Password strength meter renders correctly
- [ ] On success: countdown redirect to login
- [ ] "Forgot password?" link on login page

**Part 6 — Favicon and titles**
- [ ] SVG favicon created (shield + keyhole concept, #0052CC)
- [ ] PNG variants generated (16, 32, 180px)
- [ ] Metadata in `app/layout.tsx` references all icon variants
- [ ] Every page has a correct `<title>` tag

**Part 7 — UX polish**
- [ ] All submit buttons show loading spinner, disabled during in-flight
- [ ] All lists have proper empty states with CTAs
- [ ] 404 and error pages implemented
- [ ] Unsaved changes warning on dirty forms
- [ ] Keyboard shortcuts (N, Escape, Cmd+Enter) working
- [ ] Mobile sidebar slide-in with overlay
- [ ] Table column overflow handled with truncation + tooltip
- [ ] Copy feedback consistent everywhere (icon swap + 1500ms reset)
- [ ] Relative timestamps with hover full-date tooltip
- [ ] `useRelativeTime` hook updates every minute

**Part 8 — Bug fixes**
- [ ] No flash of unauthenticated content
- [ ] Body scroll locked when modal is open
- [ ] Z-index scale applied consistently
- [ ] SWR revalidates on tab focus
- [ ] Form errors clear on field change
- [ ] No double-submit possible on any form
- [ ] All icon-only buttons have `aria-label`
- [ ] Credential values never cause horizontal scroll

**General**
- [ ] ESLint clean
- [ ] `npm run build` zero TypeScript errors
- [ ] All existing tests pass
