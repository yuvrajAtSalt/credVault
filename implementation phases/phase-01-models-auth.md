# VaultStack — Phase 01: Database Models & Authentication

> Prerequisite: Phase 00 must be complete. The project must boot without errors.

---

## Goal

Build the complete data layer (Mongoose models) and a working authentication system with JWT-based login, registration (invite-only flow), session handling, and route protection middleware.

Follow brand-store's Mongoose model patterns exactly — same schema structure, same index declarations, same pre-save hooks style.

---

## 1. Mongoose Models

### `models/Organisation.ts`

```ts
// One organisation per VaultStack deployment.
// Stores org-wide settings and the role hierarchy display order.
{
  name: String (required),
  slug: String (required, unique, lowercase),
  logoUrl: String,
  hierarchy: [String],   // ordered array of role keys e.g. ['ceo','coo','cfo','cmo','manager','devops','developer','qa']
  createdAt: Date,
  updatedAt: Date,
}
```

### `models/User.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  name: String (required),
  email: String (required, unique, lowercase),
  passwordHash: String (required),
  role: String (enum: ROLES, required),
  jobTitle: String,          // e.g. "Senior Backend Engineer"
  department: String,        // e.g. "Engineering"
  avatarUrl: String,
  reportingTo: ObjectId (ref: User, nullable),  // for org hierarchy
  isActive: Boolean (default: true),
  invitedBy: ObjectId (ref: User, nullable),
  lastLoginAt: Date,
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: email (unique), organisationId, role, reportingTo
// Pre-save: hash password with bcryptjs (cost 12) if modified
// Method: comparePassword(plain: string): Promise<boolean>
// Virtual: initials (first letter of first + last name)
```

### `models/Project.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation, required),
  name: String (required),
  description: String,
  color: String (hex, default '#0052CC'),
  tags: [String],
  status: String (enum: ['active','archived','planning'], default: 'active'),
  createdBy: ObjectId (ref: User),
  members: [{
    userId: ObjectId (ref: User),
    addedBy: ObjectId (ref: User),
    addedAt: Date,
  }],
  // Per-member visibility grants (manager/sysadmin can flip these)
  visibilityGrants: [{
    grantedTo: ObjectId (ref: User),
    grantedBy: ObjectId (ref: User),
    scope: String (enum: ['all','own']),  // 'all' = see everyone's creds; 'own' = default
    grantedAt: Date,
  }],
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: organisationId, 'members.userId', status
```

### `models/Credential.ts`

```ts
{
  projectId: ObjectId (ref: Project, required),
  organisationId: ObjectId (ref: Organisation, required),
  category: String (enum: ['github','storage','database','smtp','deploy','custom'], required),
  label: String (required),          // e.g. "Production DB Password"
  value: String (required),          // AES-256 encrypted at rest (Phase 03 adds encryption)
  isSecret: Boolean (default: true), // if true, masked in UI by default
  environment: String (enum: ['staging','production','development','all'], default: 'all'),
  addedBy: ObjectId (ref: User, required),
  addedByRole: String (enum: ROLES, required),  // snapshot of role at time of creation
  lastEditedBy: ObjectId (ref: User),
  lastEditedAt: Date,
  isDeleted: Boolean (default: false),  // soft delete
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: projectId, organisationId, category, addedBy, isDeleted
```

### `models/AuditLog.ts`

```ts
{
  organisationId: ObjectId (ref: Organisation),
  actorId: ObjectId (ref: User),
  action: String (enum: ['credential.view','credential.create','credential.delete','project.create','member.invite','member.remove','visibility.grant','visibility.revoke','login','logout']),
  targetType: String,   // 'Credential' | 'Project' | 'User'
  targetId: ObjectId,
  meta: Mixed,          // any extra context as plain object
  ipAddress: String,
  createdAt: Date,
}
// Indexes: organisationId, actorId, action, createdAt
```

---

## 2. Database Connection

Create `lib/db.ts` as a singleton connection (match brand-store's pattern). Must handle hot reload in development without creating multiple connections.

```ts
// Pattern: cache the promise on global object in dev
let cached = global.mongoose ?? { conn: null, promise: null };
```

---

## 3. Authentication API Routes

All routes under `/app/api/auth/` (or `/pages/api/auth/` — match brand-store).

### `POST /api/auth/register`
- First-user flow only (when no users exist in the org). Creates the org + first sysadmin.
- Body: `{ orgName, name, email, password }`
- Returns: `{ user, token }`, sets httpOnly cookie `vault_token`

### `POST /api/auth/login`
- Body: `{ email, password }`
- Verifies password, returns JWT, sets httpOnly cookie `vault_token`
- Updates `lastLoginAt`
- Writes an AuditLog entry for `login`

### `POST /api/auth/logout`
- Clears `vault_token` cookie
- Writes AuditLog `logout`

### `GET /api/auth/me`
- Returns the current user from JWT (no DB call on this endpoint — decode only)

### `POST /api/auth/invite`
- Protected (manager, sysadmin only)
- Body: `{ name, email, role, reportingTo? }`
- Creates a User with a temporary random password and `isActive: false`
- Returns invite link (in Phase 04 this sends an email; for now just return the token)
- Writes AuditLog `member.invite`

---

## 4. Auth Middleware (`lib/auth.ts`)

```ts
// verifyToken(req): User | null — decode JWT from cookie or Authorization header
// requireAuth(handler) — HOC for API route handlers
// requireRole(...roles)(handler) — role-gated HOC
```

### `middleware.ts` (Next.js Edge)

Protect all routes under `/(dashboard)` — redirect to `/login` if no valid token.

---

## 5. Permission Hook (`hooks/usePermissions.ts`)

```ts
// Returns an object of boolean helpers derived from BASE_PERMISSIONS + any project-level overrides:
// canCreateProject(), canAddCredential(projectId?), canSeeAllCredentials(projectId?),
// canManageTeam(), canGrantVisibility(projectId?), isGod(), canManageRoles()
```

---

## 6. Login UI (`app/(auth)/login/page.tsx`)

Clean, centered card layout. White card on `#F4F5F7` background. Blue primary button. Logo / app name at top. Email + password fields. No register link (invite-only).

Match brand-store's form field component patterns for inputs.

---

## Deliverable checklist

- [ ] All 5 models created with correct indexes and pre-save hooks
- [ ] `lib/db.ts` singleton works without duplicate connection warnings in dev
- [ ] Login, logout, me, invite routes functional
- [ ] `middleware.ts` redirects unauthenticated users from dashboard routes
- [ ] `hooks/usePermissions.ts` returns correct booleans for each role
- [ ] Login page renders correctly, no Tailwind errors
- [ ] ESLint passes
