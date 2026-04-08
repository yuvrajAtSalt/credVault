# VaultStack — Phase 03: Credentials Vault with RBAC Visibility

> Prerequisite: Phase 02 complete. Projects load. Members can be added.

---

## Goal

Build the core credential management system — the heart of VaultStack. Credentials are stored per project, organised by category, have per-field masking, and have a fine-grained visibility system controlled by managers and sysadmins.

---

## 1. Credential API Routes

### `GET /api/projects/:id/credentials`

Returns credentials for the project filtered by the caller's visibility rights.

**Visibility rules (evaluate in order):**

1. `isGod === true` → return all credentials, unfiltered
2. `canSeeAllCredentials === true` (ceo, coo, cfo) → return all credentials
3. User is project member AND has a `visibilityGrant` with `scope: 'all'` → return all
4. Default: return only credentials where `addedBy === currentUser._id`

For each credential returned, include:
```json
{
  "_id": "...",
  "category": "database",
  "label": "Production password",
  "value": "[MASKED]",          // always masked in list response
  "isSecret": true,
  "environment": "production",
  "addedBy": { "_id":"...", "name":"Rahul Mehta", "initials":"RM", "role":"developer" },
  "addedByRole": "developer",
  "createdAt": "..."
}
```

Write AuditLog `credential.view` for every fetch (with `meta: { count: N }`).

### `GET /api/projects/:id/credentials/:credId/reveal`

Returns the actual plaintext value for a single credential.

Permission: same visibility rules as above. If user cannot see this credential → 403.

Write AuditLog `credential.view` with `meta: { credentialId, label }`.

### `POST /api/projects/:id/credentials`

Who can call: any project member whose `canAddCredential === true` (all roles can add).

Body:
```json
{
  "category": "github",
  "label": "Deploy key",
  "value": "ghp_xxxxxxxxxxxx",
  "isSecret": true,
  "environment": "production"
}
```

- Snapshot `addedByRole` from the user's current role
- Write AuditLog `credential.create`

### `PATCH /api/projects/:id/credentials/:credId`

Who can call: the credential's `addedBy` user, OR a manager on the project, OR sysadmin.

Body: any subset of `{ label, value, isSecret, environment }`

### `DELETE /api/projects/:id/credentials/:credId`

Soft delete (set `isDeleted: true`).

Who can call: `addedBy` user, project manager, sysadmin.

Write AuditLog `credential.delete`.

---

## 2. Visibility Grant API Routes

### `GET /api/projects/:id/visibility`

Returns the current visibility grants for all project members.

Who can call: manager on project, sysadmin.

Response:
```json
[
  {
    "userId": { "_id":"...", "name":"Priya Sharma", "role":"developer" },
    "scope": "all",
    "grantedBy": { "name":"Arjun Rao" },
    "grantedAt": "..."
  }
]
```

### `POST /api/projects/:id/visibility`

Toggle or set a visibility grant.

Who can call: manager on project, sysadmin, coo, ceo, cfo (anyone with `canGrantVisibility` OR `canSeeAllCredentials`).

Body: `{ userId, scope: 'all' | 'own' }`

If a grant for this user already exists → update scope. Otherwise create.

Write AuditLog `visibility.grant` or `visibility.revoke`.

---

## 3. Credential Panel UI (`components/credentials/`)

### `CredentialPanel.tsx`

Mounted on the project detail page (`/projects/[id]`). Takes up the main content area.

**Tab bar** — one tab per category: GitHub · Storage · Database · SMTP · Deploy · Custom

Each tab badge shows count of credentials in that category visible to the current user.

**Within each tab:**

- List of `CredentialRow` components
- "Add credential" button at bottom — visible to anyone with `canAddCredential`
- If there are hidden credentials (user knows they exist but can't see them), show a locked notice:
  > "X credentials are hidden. Ask your manager to grant you visibility."

### `CredentialRow.tsx`

```
[Label]  [Environment pill]  [Added by avatar + role badge]  [Reveal ○]  [Copy ⎘]  [Delete ✕]
         [Masked value ••••••••]
```

- Masked by default. Click `○` → `GET /api/.../reveal` → display value inline. Click again to re-mask.
- Copy button: copies revealed value to clipboard. Shows `✓` for 1.2s.
- Delete: shown only to `addedBy` user, project manager, or sysadmin. Triggers `ConfirmDialog`.
- Row background `#F4F5F7`, border `1px solid #DFE1E6`, border-radius `4px`, font `font-mono` for value.

### `AddCredentialModal.tsx`

Fields:
- Category (Select — pre-filled to active tab)
- Label (Input, required)
- Value (Input with show/hide toggle, required)
- Mark as secret (Toggle, default on)
- Environment (Select: staging / production / development / all)

Submit → `POST`, close modal, refresh credential list via SWR mutate.

### `VisibilityControlPanel.tsx`

Rendered below the credential list, collapsible section titled "Visibility control".

Visible only to: manager, sysadmin, ceo, coo, cfo.

For each project member (excluding sysadmin and the current user):

```
[Avatar] [Name] [Role badge]    [Toggle: sees all / limited]
```

Toggle calls `POST /api/projects/:id/visibility`. Optimistic update.

---

## 4. Credential count on project cards

Update project cards to show a credential count badge.

Modify `GET /api/projects` to include `credentialCount: number` (count of non-deleted credentials the caller can see).

---

## 5. Lock notice for non-visible credentials

When fetching credentials, the API returns a `hiddenCount: number` alongside the visible array. If `hiddenCount > 0` and the user is not a manager/sysadmin, show the lock notice banner inside the tab content.

---

## Deliverable checklist

- [x] All credential API routes working with correct RBAC filtering
- [x] Reveal endpoint logs to AuditLog
- [x] `CredentialPanel` renders with tabs, correct badge counts
- [x] `CredentialRow` mask/reveal/copy cycle works
- [x] `AddCredentialModal` creates credentials, list refreshes without page reload
- [x] Delete with `ConfirmDialog` works, soft-deletes in DB
- [x] `VisibilityControlPanel` visible only to permitted roles
- [x] Toggling visibility updates grant in DB, other user's view changes on next fetch
- [x] Lock notice appears when hiddenCount > 0
- [x] Credential count visible on project cards
- [x] Route ordering fixed: /visibility before /:credId to prevent param collision
