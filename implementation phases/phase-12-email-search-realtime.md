# VaultStack — Phase 12: Email System, Global Search, Command Palette & Real-Time Updates

> Prerequisite: Phase 11 complete. Notifications exist in DB. Forgot-password logs to console.
> All custom UI components are in place.

---

## Overview

Four interconnected systems that make VaultStack feel like a production-grade SaaS product:

1. **Transactional email** — every console-logged link and every notification graduates to a real email
2. **Global search** — find any project, credential, person, or env variable from anywhere
3. **Command palette** — keyboard-first power-user navigation (the stub from Phase 11 becomes real)
4. **Real-time updates** — notification bell count and credential expiry banners update live without polling

---

## Part 1 — Transactional email system

### 1a. Email provider abstraction (`lib/email/index.ts`)

Build an **adapter pattern** — the application code calls one interface; the underlying provider is swappable via environment variable. Ship with two adapters: Resend (primary) and SMTP (fallback / self-hosted).

```ts
// lib/email/index.ts
export interface EmailAdapter {
  send(params: SendEmailParams): Promise<{ messageId: string }>;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;            // plain-text fallback — always required
  replyTo?: string;
  tags?: Record<string, string>;   // for provider-level analytics tagging
}

// Factory: reads NEXT_PUBLIC_EMAIL_PROVIDER env var
export function getEmailAdapter(): EmailAdapter
```

**Resend adapter (`lib/email/adapters/resend.ts`):**
```ts
// Uses the Resend SDK: npm install resend
// Env vars: RESEND_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME
```

**SMTP adapter (`lib/email/adapters/smtp.ts`):**
```ts
// Uses nodemailer: npm install nodemailer
// Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
```

**Dev adapter (`lib/email/adapters/console.ts`):**
```ts
// When NODE_ENV === 'development' AND no provider configured:
// Logs the full email (subject + HTML + text) to console
// Also writes to /tmp/vaultstack-emails/ as HTML files for browser preview
// Prints: [EMAIL] To: ... Subject: ... Preview: http://localhost:3000/dev/emails/latest
```

Add to `.env.local.example`:
```env
EMAIL_PROVIDER=resend          # resend | smtp | console
EMAIL_FROM_ADDRESS=noreply@yourcompany.com
EMAIL_FROM_NAME=VaultStack
RESEND_API_KEY=re_xxxxxxxxxxxx
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

---

### 1b. Email template engine (`lib/email/templates/`)

Build React-based email templates using `@react-email/components` (install: `npm install @react-email/components @react-email/render`).

All templates share a base layout (`templates/layout/BaseEmail.tsx`):

```
┌─────────────────────────────────────────┐
│  [VaultStack logo]                       │
│  ─────────────────────────────────────  │
│  [content slot]                          │
│  ─────────────────────────────────────  │
│  © 2025 VaultStack · Unsubscribe         │
│  This email was sent to {email}          │
└─────────────────────────────────────────┘
```

Styling: inline CSS only (email clients strip `<style>` tags). Primary blue `#0052CC`, dark navy `#172B4D`, background `#F4F5F7`, white card `#FFFFFF`. Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (no Google Fonts in email).

---

### 1c. Email templates to build

Each template exports a React component and a `renderToHtml(props)` + `renderToText(props)` function.

#### `templates/PasswordReset.tsx`
Props: `{ name, resetUrl, expiresInMinutes: 60 }`

```
Hi [name],

You requested a password reset for your VaultStack account.

[Reset password →]          ← large blue CTA button

This link expires in 60 minutes.
If you didn't request this, you can safely ignore this email.
```

#### `templates/ProjectInvite.tsx`
Props: `{ recipientName, actorName, actorRole, projectName, projectUrl, orgName }`

```
Hi [name],

[actorName] ([actorRole]) added you to [projectName] on VaultStack.

[Open project →]

You can now view and manage credentials for this project.
```

#### `templates/ProjectRemoved.tsx`
Props: `{ recipientName, actorName, projectName, dashboardUrl, hadResidualAccess: boolean }`

```
Hi [name],

You have been removed from [projectName] by [actorName].

[residual access notice if hadResidualAccess]

[Go to dashboard →]
```

#### `templates/PermissionGranted.tsx`
Props: `{ recipientName, permission, grantedBy, reason, expiresAt: Date | null, dashboardUrl }`

```
Hi [name],

[grantedBy] granted you the following permission on VaultStack:

  ✓ [permission label]

Reason: "[reason]"
[Expires: date] OR [This permission does not expire]

[Go to dashboard →]
```

#### `templates/PermissionRequestReceived.tsx`
Props: `{ adminName, requesterName, requesterRole, permission, reason, requestUrl }`

```
Hi [adminName],

[requesterName] ([requesterRole]) has requested additional permissions.

Permission: [permission label]
Reason: "[reason]"

[Review request →]
```

#### `templates/PermissionRequestApproved.tsx` / `PermissionRequestRejected.tsx`
Props: `{ recipientName, permission, reviewNote, dashboardUrl }`

#### `templates/CredentialExpiringSoon.tsx`
Props: `{ recipientName, credentials: Array<{ label, projectName, expiresAt, url }> }`

```
Hi [name],

The following credentials are expiring soon:

  ⚠ SendGrid API Key — XYZ Commerce — expires in 5 days   [View →]
  ⚠ AWS Access Key — Alpha Analytics — expires in 12 days  [View →]

Update these credentials before they expire to avoid service interruptions.
```

#### `templates/RoleChanged.tsx`
Props: `{ recipientName, oldRole, newRole, changedBy, dashboardUrl }`

#### `templates/ReportingChanged.tsx`
Props: `{ recipientName, newManagerName, newManagerRole, newManagerAvatar, dashboardUrl }`

#### `templates/WelcomeNewUser.tsx`
Props: `{ name, orgName, loginUrl, tempPassword: string | null, role }`

```
Hi [name],

Welcome to [orgName] on VaultStack!

Your account has been created with the role: [role badge]

[tempPassword block if provided — styled code block]

[Log in to VaultStack →]

If you received a temporary password, you will be asked to change it on first login.
```

---

### 1d. Email send points

Wire `getEmailAdapter().send()` into these existing API routes, replacing the console.log stubs:

| Route | Template | Recipients |
|---|---|---|
| `POST /api/auth/forgot-password` | `PasswordReset` | The user |
| `POST /api/admin/users` (new user) | `WelcomeNewUser` | The new user |
| `POST /api/projects/:id/members` | `ProjectInvite` | The added user |
| `DELETE /api/projects/:id/members/:userId` | `ProjectRemoved` | The removed user |
| `POST /api/admin/users/:id/permissions/grant` | `PermissionGranted` | The user |
| `POST /api/admin/permissions/requests` (submitted) | `PermissionRequestReceived` | All sysadmins |
| `POST /api/admin/permissions/requests/:id/approve` | `PermissionRequestApproved` | The requester |
| `POST /api/admin/permissions/requests/:id/reject` | `PermissionRequestRejected` | The requester |
| `PATCH /api/admin/users/:id` (role change) | `RoleChanged` | The affected user |
| `PATCH /api/org/members/:id/reporting` | `ReportingChanged` | The affected user |
| `GET /api/dashboard/expiring-credentials` (cron) | `CredentialExpiringSoon` | Managers + credential owners |

All email sends must be **non-blocking** — `await email.send(...)` should not delay the API response. Use `Promise.resolve().then(() => email.send(...))` to fire-and-forget, or push to a queue (see Part 1e).

Wrap every send in try/catch — a failed email must never cause the API route to return an error.

### 1e. Email queue (simple)

Rather than fire-and-forget, implement a lightweight DB-backed queue to handle retries and avoid losing emails on crashes.

New model: `models/EmailQueue.ts`

```ts
{
  to: String,
  subject: String,
  html: String,
  text: String,
  status: String (enum: ['pending','sent','failed'], default: 'pending'),
  attempts: Number (default: 0),
  maxAttempts: Number (default: 3),
  lastAttemptAt: Date,
  error: String,
  createdAt: Date,
}
// Index: status, createdAt
// TTL: auto-delete sent emails after 7 days
```

API routes enqueue by inserting into `EmailQueue`. A background processor runs every 30 seconds (use `setInterval` in a custom Next.js server setup, or trigger via a cron-like API route):

`GET /api/internal/process-email-queue` — protected by `INTERNAL_API_SECRET` header, not user auth. Fetches up to 10 `pending` or `failed` (attempts < maxAttempts) emails, attempts to send each, updates status.

### 1f. Dev email preview route

In development only, add:

`GET /api/dev/email-preview/[template]`

Returns rendered HTML for a template with mock data. Accessible at:
`http://localhost:3000/api/dev/email-preview/PasswordReset`
`http://localhost:3000/api/dev/email-preview/ProjectInvite`
etc.

This lets developers visually check templates in the browser without sending real emails.

---

## Part 2 — Global search

### 2a. Search index (`lib/search.ts`)

VaultStack does not need Elasticsearch at this scale. Use MongoDB's text indexes and a unified search endpoint.

Add text indexes to existing models:

```ts
// models/Project.ts
ProjectSchema.index({ name: 'text', description: 'text', tags: 'text' });

// models/User.ts
UserSchema.index({ name: 'text', email: 'text', jobTitle: 'text', department: 'text' });

// models/Credential.ts
CredentialSchema.index({ label: 'text', group: 'text' });

// models/Team.ts
TeamSchema.index({ name: 'text', description: 'text' });

// models/EnvVariable.ts
EnvVariableSchema.index({ key: 'text' });   // only key — never index values
```

### 2b. Search API (`GET /api/search`)

Query: `?q=database&types=projects,members,credentials&limit=5`

The endpoint fans out into parallel queries across all requested types, applying the caller's permission filters:

```ts
const [projects, members, credentials, envVars, teams] = await Promise.all([
  searchProjects(q, user, permissions),
  searchMembers(q, user, permissions),
  searchCredentials(q, user, permissions),   // respects visibility rules
  searchEnvVariables(q, user, permissions),  // key only, never values
  searchTeams(q, user, permissions),
]);
```

Response:
```json
{
  "results": [
    {
      "type": "project",
      "id": "...",
      "title": "XYZ Commerce",
      "subtitle": "E-commerce platform · 3 credentials",
      "url": "/projects/abc123",
      "meta": { "color": "#0052CC", "status": "active" }
    },
    {
      "type": "member",
      "id": "...",
      "title": "Rahul Mehta",
      "subtitle": "Developer · Engineering team",
      "url": "/directory?member=xyz",
      "meta": { "initials": "RM", "role": "developer" }
    },
    {
      "type": "credential",
      "id": "...",
      "title": "Production DB Password",
      "subtitle": "Database · XYZ Commerce",
      "url": "/projects/abc123?tab=database&cred=credId",
      "meta": { "category": "database", "isSecret": true }
    },
    {
      "type": "env_variable",
      "id": "...",
      "title": "DATABASE_URL",
      "subtitle": "staging · XYZ Commerce",
      "url": "/projects/abc123/environments?env=staging&var=varId",
      "meta": { "environment": "staging" }
    }
  ],
  "counts": { "project": 1, "member": 1, "credential": 1, "env_variable": 1 },
  "query": "database",
  "took": 12
}
```

Highlight matching text: return `highlight` field per result with the matched portion wrapped in `<mark>` tags. Strip HTML on render.

Security rules strictly applied:
- Credential results: only returned if user has visibility on that credential
- EnvVariable results: key only — value is never included or indexed
- Members: only visible members (same rule as `GET /api/members`)
- Credential/env labels that are `sensitivityLevel: critical` are omitted from search results for non-managers and non-sysadmin

Rate limit: 30 requests per minute per user.

---

### 2c. Search bar component (`components/search/GlobalSearchBar.tsx`)

Mounted in the topbar, center position. Width expands on focus from `200px` to `400px` (CSS transition).

```
[🔍 Search projects, people, credentials...]
```

On type (after 200ms debounce) → calls `GET /api/search?q=...&limit=5`.

Dropdown results panel (portal):
```
┌─────────────────────────────────────────┐
│ Projects                                 │
│  [● color]  XYZ Commerce                │
│             E-commerce platform          │
│ Members                                  │
│  [RM av]   Rahul Mehta                  │
│             Developer · Engineering      │
│ Credentials                              │
│  [🔑]      Production DB Password       │
│             Database · XYZ Commerce      │
├─────────────────────────────────────────┤
│  View all results for "database" →       │
└─────────────────────────────────────────┘
```

Each result row: click navigates to `result.url` and closes the dropdown.

Keyboard: `↑↓` navigate results, `Enter` navigates to the highlighted result, `Escape` closes.

Empty state: "No results for '[query]'"

Loading state: skeleton rows (3 per visible category) while in-flight.

---

### 2d. Full search results page (`/search`)

Activated by pressing Enter in the search bar or clicking "View all results".

Left sidebar: type filter checkboxes (Projects / Members / Credentials / Env Variables / Teams).

Main area: grouped results by type, each group collapsible. Pagination per type (load more).

Result cards are larger than the dropdown rows — show more context:
- Project card: same as the project grid card
- Member card: same as the directory member card
- Credential card: label + category + project name + added-by + last modified
- Env variable card: key + environment + project name (value never shown)

Highlight matched text within titles and subtitles.

URL updates as the user types: `/search?q=database&types=credentials` — shareable and back-button navigable.

---

## Part 3 — Command palette

### 3a. `components/command/CommandPalette.tsx`

A full-screen modal overlay triggered by `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) or the `/` shortcut from Phase 11.

**Visual design:**
```
┌──────────────────────────────────────────────────────┐  ← modal, centered
│  [🔍  Type a command or search...]                    │
├──────────────────────────────────────────────────────┤
│  Quick actions                                        │
│  ────────────────────────────────────────────────    │
│  [+]  New project                          N         │
│  [+]  Add credential             (select project first)│
│  [👤] Invite team member                             │
│  [🔒] Lock screen / log out                          │
│                                                       │
│  Navigate to                                          │
│  ────────────────────────────────────────────────    │
│  [▦]  Dashboard                                      │
│  [📁] Projects                                       │
│  [👥] Team                                           │
│  [📖] Employee directory                             │
│  [🔔] Notifications                                  │
│  [⚙]  Settings                                      │
└──────────────────────────────────────────────────────┘
```

When the user types, the static lists are replaced by live search results (same API as global search) interleaved with matching commands.

**Commands are defined in `lib/commands.ts`:**

```ts
export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon: ReactNode;
  keywords: string[];           // for fuzzy matching
  action: (router: AppRouter) => void;
  condition?: (permissions: EffectivePermissions) => boolean;  // show only if condition met
}

export const COMMANDS: Command[] = [
  {
    id: 'new-project',
    label: 'New project',
    shortcut: 'N',
    keywords: ['create project', 'add project'],
    icon: <FolderPlus />,
    condition: (p) => p.canCreateProject,
    action: (router) => router.push('/projects?action=new'),
  },
  {
    id: 'invite-member',
    label: 'Invite team member',
    keywords: ['add user', 'invite', 'onboard'],
    icon: <UserPlus />,
    condition: (p) => p.canManageMembers,
    action: (router) => router.push('/settings/users?action=invite'),
  },
  // navigate commands
  { id: 'go-dashboard', label: 'Dashboard', keywords: ['home'], icon: <LayoutDashboard />, action: (r) => r.push('/dashboard') },
  { id: 'go-projects', label: 'Projects', keywords: ['vault'], icon: <FolderOpen />, action: (r) => r.push('/projects') },
  { id: 'go-team', label: 'Team', keywords: ['members'], icon: <Users />, action: (r) => r.push('/team') },
  { id: 'go-directory', label: 'Employee directory', keywords: ['org', 'chart', 'people'], icon: <Network />, action: (r) => r.push('/directory') },
  { id: 'go-notifications', label: 'Notifications', keywords: ['alerts'], icon: <Bell />, action: (r) => r.push('/notifications') },
  { id: 'go-settings', label: 'Settings', keywords: ['profile', 'account'], icon: <Settings />, action: (r) => r.push('/settings/profile') },
  { id: 'go-audit', label: 'Audit log', keywords: ['history', 'activity'], icon: <ScrollText />, condition: (p) => p.canViewAuditLog, action: (r) => r.push('/settings/audit-log') },
  { id: 'logout', label: 'Log out', keywords: ['sign out'], icon: <LogOut />, action: () => fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/login') },
];
```

**Fuzzy matching:** Use a simple fuzzy scorer on `label` + `keywords` — no library needed. Score = character match ratio. Sort by score descending.

**Keyboard navigation:**
- `↑↓` move between items
- `Enter` executes the highlighted command or navigates to the search result
- `Escape` closes
- Section headers ("Quick actions", "Navigate to", "Projects", "Members") are non-focusable

**Recent items:** Store last 5 navigated items in `localStorage` under `vault_recent_items`. Show them in the palette when the input is empty:
```
Recent
  [●]  XYZ Commerce  (project)
  [RM] Rahul Mehta   (member)
```

---

## Part 4 — Real-time updates (Server-Sent Events)

Replace the 30-second polling of `GET /api/notifications/unread-count` with a persistent Server-Sent Events (SSE) connection. SSE is unidirectional (server → client), works with Next.js API routes, and requires no WebSocket server.

### 4a. SSE endpoint (`GET /api/realtime/events`)

```ts
// Returns a stream of server-sent events
// Headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive

// Event types:
// notification_count: { count: number }
// new_notification: { id, type, title, body, url, createdAt }
// credential_expiry_warning: { credentialId, label, projectName, expiresAt }
// project_updated: { projectId, field: 'status' | 'members' }    — triggers SWR revalidation on client
```

The server holds the connection open. When any of the following happen (triggered from API routes), the relevant event is pushed to connected clients:

- A notification is created for user X → push `new_notification` to user X's SSE connection
- An expiry-check cron runs → push `credential_expiry_warning` to relevant users
- A project's member list changes → push `project_updated` to all affected users

**Connection registry** — since API routes are stateless, maintain an in-memory map of `userId → Response` objects. This works for single-instance deployments. Add a comment noting that for multi-instance deployments, this should be replaced with Redis pub/sub.

```ts
// lib/sse.ts
const connections = new Map<string, Response>();

export function registerSSEConnection(userId: string, res: Response): void
export function removeSSEConnection(userId: string): void
export function pushToUser(userId: string, event: SSEEvent): void
export function pushToMultipleUsers(userIds: string[], event: SSEEvent): void
```

### 4b. Client hook (`hooks/useRealtimeEvents.ts`)

```ts
export function useRealtimeEvents() {
  // Opens an EventSource to /api/realtime/events
  // Reconnects automatically on disconnect (EventSource does this natively)
  // On 'new_notification': updates the notification unread count in SWR cache
  // On 'new_notification': shows a toast with the notification title and a "View" link
  // On 'credential_expiry_warning': shows a dismissible banner on the dashboard
  // On 'project_updated': calls mutate() on the affected project's SWR key

  // Returns: { isConnected, lastEvent }
}
```

Mount `useRealtimeEvents()` once in the dashboard layout — not per page.

### 4c. Notification toast (real-time)

When a `new_notification` event arrives, show a toast in the bottom-right corner:

```
┌──────────────────────────────────┐
│ [🔑] Credential expiring soon    │
│      SendGrid API Key · XYZ      │
│      [View →]         [Dismiss]  │
└──────────────────────────────────┘
```

This is separate from the existing success/error toast system. It's a notification-specific toast that auto-dismisses after 8 seconds (longer than the 3.5s action toasts).

---

## Part 5 — Credential expiry cron job

The expiry warning system from Phase 10 needs a scheduled trigger. In Next.js App Router without an external cron service, use a **self-scheduling API route** triggered by Vercel Cron (or equivalent).

### `app/api/cron/check-expiry/route.ts`

```ts
// Protected by CRON_SECRET header: Authorization: Bearer <CRON_SECRET>
// Finds all credentials and env variables where:
//   expiresAt is not null
//   isDeleted is false
//   expiresAt <= now + rotationReminderDays
//   AND a warning has not already been sent today

// For each expiring item:
//   1. Create a Notification for the credential's addedBy user and the project manager(s)
//   2. Push SSE event `credential_expiry_warning` to connected users
//   3. Enqueue an expiry warning email (CredentialExpiringSoon template)
//      — batch: one email per user containing ALL their expiring items, not one per credential

// Track "warning sent" to avoid duplicate sends:
// Add field to Credential: lastExpirySentAt: Date
// Only re-send if lastExpirySentAt is null OR lastExpirySentAt < today
```

Add to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/check-expiry", "schedule": "0 9 * * *" }
  ]
}
```

Also add the process-email-queue cron:
```json
{ "path": "/api/cron/process-email-queue", "schedule": "*/2 * * * *" }
```

Add `CRON_SECRET` to `.env.local.example`.

---

## Part 6 — Additional UX items driven by Phase 11 findings

### 6a. Onboarding flow for first-time users

When a user logs in for the first time (`lastLoginAt === null` before this login) AND `forcePasswordChange === false`, show a lightweight onboarding overlay:

```
Welcome to VaultStack, [name]!

Here's what you can do:

[●] View your projects  → /projects
[●] Add credentials     → /projects (select a project)
[●] Meet your team      → /directory

[Get started →]   [Skip]
```

Store `hasSeenOnboarding: true` on the User model. Never show again after dismissed.

### 6b. Dashboard activity feed

Add a "Recent activity" section to the dashboard. Shows the last 10 AuditLog entries scoped to projects the current user is involved in. Uses `GET /api/audit-log?scope=mine&limit=10`.

```
Recent activity
  [RM]  Rahul Mehta added a credential to XYZ Commerce  · 2h ago
  [PS]  Priya Sharma invited you to Beta Mobile          · 1d ago
  [AR]  Arjun Rao granted you visibility on Gamma CRM   · 3d ago
```

Each row is clickable (navigates to the relevant project).

### 6c. Breadcrumb navigation

Add breadcrumbs to all second-level pages:

```
Settings > Organisation > Teams
Projects > XYZ Commerce > Credentials
Settings > Users > Rahul Mehta
```

Use a `<Breadcrumb>` component (`components/ui/Breadcrumb.tsx`) that reads from a `useBreadcrumbs()` context set by each page. The last item is plain text (current page), all previous items are links.

### 6d. Session expiry handling

When the JWT expires mid-session (the user has had the tab open for longer than `JWT_EXPIRES_IN`), the next API call will return 401. Currently this might cause a silent failure or a broken UI state.

Implement a global response interceptor in `lib/api.ts`:

```ts
// If any API response returns 401:
//   1. Show a modal: "Your session has expired. Please log in again."
//   2. On modal confirm → navigate to /login?from=<current path>
//   3. After login, redirect back to <from> path
```

### 6e. Print / export project summary

Add a "Export summary" option to the project action menu (three-dot menu on the project detail page):

`GET /api/projects/:id/export-summary`

Returns a PDF or HTML summary of the project:
- Project name, description, status, members
- Credential categories with counts (no values — this is a summary, not a dump)
- Environment names with variable counts
- Recent activity (last 10 events)

Use `@react-pdf/renderer` if the app doesn't already have a PDF library, or output HTML with a print stylesheet.

---

## Part 7 — Security additions

### 7a. Session management

Show the user's active sessions on the Security settings page:

```
Active sessions
  [💻]  Chrome on Mac OS X  · Current session  · 192.168.1.1  · Just now
  [📱]  Safari on iPhone    · Last active 2d ago · 203.0.113.4

                                                [Revoke all other sessions]
```

Implementation:
- On login, create a `Session` document: `{ userId, tokenHash, userAgent, ipAddress, lastActiveAt, createdAt }`
- JWT includes a `sessionId` claim
- Auth middleware verifies the session exists and is not revoked
- `DELETE /api/auth/sessions/:sessionId` — revoke a specific session
- `DELETE /api/auth/sessions` — revoke all except current

New model: `models/Session.ts`

### 7b. Brute-force lockout

Extend the rate limiting from Phase 06:

After 10 failed login attempts for the same email within 1 hour, **lock the account** for 15 minutes:

Add to User model:
```ts
loginAttempts: Number (default: 0),
lockedUntil: Date (nullable),
```

On failed login: increment `loginAttempts`. If `>= 10` → set `lockedUntil = now + 15min` + send `AccountLocked` notification email.

On successful login: reset `loginAttempts = 0`, clear `lockedUntil`.

On login attempt when locked: return `423 Locked` with `{ lockedUntil, message: "Account locked due to too many failed attempts. Try again after [time]." }`.

Show the lock reason on the login page when a `423` is received.

New email template: `templates/AccountLocked.tsx` — notifies the user their account was locked and provides the forgot-password link.

---

## Updated `.env.local.example`

```env
# Core
MONGODB_URI=mongodb://localhost:27017/vaultstack
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=generate_with_node_crypto_32_bytes_hex
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email
EMAIL_PROVIDER=console                  # console | resend | smtp
EMAIL_FROM_ADDRESS=noreply@yourcompany.com
EMAIL_FROM_NAME=VaultStack
RESEND_API_KEY=                         # if EMAIL_PROVIDER=resend
SMTP_HOST=                              # if EMAIL_PROVIDER=smtp
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# Internal jobs
CRON_SECRET=generate_random_secret_here
INTERNAL_API_SECRET=generate_random_secret_here

# Feature flags
NEXT_PUBLIC_DEV_ROLE_SWITCHER=false
NEXT_PUBLIC_ENABLE_SSE=true
```

---

## Deliverable checklist

**Part 1 — Email**
- [ ] Email adapter abstraction with Resend, SMTP, and console adapters
- [ ] `console` adapter writes HTML to `/tmp/vaultstack-emails/` for browser preview
- [ ] Dev preview route at `/api/dev/email-preview/[template]` (dev only)
- [ ] All 11 email templates built with `@react-email/components`
- [ ] Base layout used consistently across all templates
- [ ] `EmailQueue` model with TTL and retry logic
- [ ] Cron route `process-email-queue` implemented and protected
- [ ] All existing console.log stubs replaced with real email sends
- [ ] Email sends are non-blocking and wrapped in try/catch
- [ ] `vercel.json` cron jobs configured

**Part 2 — Search**
- [ ] Text indexes added to all 5 models
- [ ] `GET /api/search` fans out to all types with permission filtering
- [ ] Values and critical credential labels excluded from results
- [ ] Text highlighting (`<mark>`) returned in results
- [ ] Rate limiting: 30 req/min per user
- [ ] Search bar in topbar with expand animation and debounced calls
- [ ] Dropdown results grouped by type with keyboard navigation
- [ ] Full search results page at `/search` with type filter and load more
- [ ] URL updates as user types (shareable links)

**Part 3 — Command palette**
- [ ] `Cmd+K` / `Ctrl+K` opens palette from anywhere
- [ ] Static commands with fuzzy matching on label + keywords
- [ ] Permission-gated commands (condition function applied)
- [ ] Live search results interleaved with commands
- [ ] Recent items from localStorage
- [ ] All keyboard navigation working
- [ ] `COMMANDS` array fully defined in `lib/commands.ts`

**Part 4 — Real-time SSE**
- [ ] `GET /api/realtime/events` SSE endpoint streams events
- [ ] In-memory connection registry in `lib/sse.ts`
- [ ] `pushToUser` called from relevant API routes
- [ ] `useRealtimeEvents` hook mounted in dashboard layout
- [ ] New notification triggers a real-time toast with View link
- [ ] Notification bell count updates in real time (no polling)
- [ ] SWR cache invalidated on `project_updated` event

**Part 5 — Expiry cron**
- [ ] `GET /api/cron/check-expiry` protected by CRON_SECRET
- [ ] Batches expiry warnings per user (one email, multiple items)
- [ ] `lastExpirySentAt` prevents duplicate emails
- [ ] SSE event pushed to connected users
- [ ] Notifications created for affected users

**Part 6 — UX additions**
- [ ] First-login onboarding overlay (once only, `hasSeenOnboarding`)
- [ ] Dashboard activity feed shows last 10 relevant audit events
- [ ] Breadcrumb navigation on all second-level pages
- [ ] Session expiry modal with redirect-back behaviour
- [ ] Project export summary (PDF or print-ready HTML)

**Part 7 — Security**
- [ ] `Session` model and session creation on login
- [ ] Active sessions list on security settings page
- [ ] Revoke single session and revoke all others
- [ ] Brute-force lockout after 10 failed attempts
- [ ] `AccountLocked` email template and send
- [ ] Lock status shown on login page with retry time

**General**
- [ ] All existing tests pass
- [ ] New critical paths covered by integration tests (search auth, SSE auth, email queue)
- [ ] ESLint clean
- [ ] `npm run build` zero TypeScript errors
