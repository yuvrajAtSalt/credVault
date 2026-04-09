# VaultStack — Phase 07: Environment Variables & .env File Manager

> Prerequisite: Phase 06 complete. Credentials vault is working with encryption.

---

## Core concept

Credentials (Phase 03) are individual key-value secrets stored per category (DB password, S3 key, etc.).

**Environments are different.** A project can have multiple named environments — `staging`, `production`, `development`, `preview`, or any custom name the team defines. Each environment has its **own complete set of env variables** that may share the same key names but have entirely different values.

Example:
```
PROJECT: XYZ Commerce

ENV: staging
  DATABASE_URL = mongodb://staging-db.xyz.internal/xyz
  AWS_ACCESS_KEY_ID = AKIASTAGING123
  STRIPE_SECRET_KEY = sk_test_xxxx

ENV: production
  DATABASE_URL = mongodb://prod-db.xyz.internal/xyz
  AWS_ACCESS_KEY_ID = AKIAPROD456
  STRIPE_SECRET_KEY = sk_live_xxxx
```

The `.env` manager is a **separate feature** from the credential vault — it is a structured `.env` file builder that lets teams manage, compare, sync, and export environment variable sets per project per environment.

---

## 1. New Models

### `models/Environment.ts`

```ts
{
  projectId: ObjectId (ref: Project, required),
  organisationId: ObjectId (ref: Organisation, required),
  name: String (required),          // e.g. "staging", "production", "preview-pr-42"
  slug: String (required),          // lowercase, url-safe e.g. "staging", "prod", "preview-pr-42"
  description: String,
  color: String (hex),              // UI color tag for this env
  isBaseEnvironment: Boolean (default: false),   // one env can be the "template" — others inherit key names from it
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
}
// Indexes: projectId, organisationId
// Unique: [projectId, slug]
```

### `models/EnvVariable.ts`

```ts
{
  projectId: ObjectId (ref: Project, required),
  environmentId: ObjectId (ref: Environment, required),
  organisationId: ObjectId (ref: Organisation, required),

  key: String (required),           // e.g. "DATABASE_URL" — always uppercase, validated
  value: String (required),         // AES-256-GCM encrypted (reuse lib/crypto.ts from Phase 06)
  isSecret: Boolean (default: true),

  // Grouping for display organisation in the .env editor
  group: String (default: 'General'),   // e.g. "Database", "AWS", "Stripe", "App"

  // Inheritance: if this variable overrides a base env variable, track it
  inheritedFromEnvId: ObjectId (ref: Environment, nullable),
  isOverridden: Boolean (default: false),

  addedBy: ObjectId (ref: User, required),
  addedByRole: String (enum: ROLES, required),
  lastEditedBy: ObjectId (ref: User),
  lastEditedAt: Date,
  isDeleted: Boolean (default: false),

  createdAt: Date,
  updatedAt: Date,
}
// Indexes: projectId, environmentId, key, isDeleted
// Unique: [environmentId, key] (one value per key per environment)
```

---

## 2. API Routes

Base path: `/api/projects/:projectId/envs`

### Environments

#### `GET /api/projects/:projectId/envs`
Returns all environments for the project.
Includes `variableCount: number` per environment.

#### `POST /api/projects/:projectId/envs`
Body: `{ name, description?, color?, isBaseEnvironment?, cloneFromEnvId? }`

If `cloneFromEnvId` provided → copy all variables from that environment into the new one (same keys, same values, `isOverridden: false`). This is how you create a new environment pre-populated from an existing one.

Who can call: anyone with `canAddCredential` on the project (same rule as credentials — all roles that are members can contribute).

#### `PATCH /api/projects/:projectId/envs/:envId`
Body: `{ name?, description?, color?, isBaseEnvironment? }`

#### `DELETE /api/projects/:projectId/envs/:envId`
Hard delete the environment AND all its variables (with confirmation on the frontend).
Who can call: project manager, sysadmin.

---

### Variables within an environment

#### `GET /api/projects/:projectId/envs/:envId/variables`

Returns all non-deleted variables for this environment.
Values are always `[ENCRYPTED]` in list response — reveal requires a separate call.

Response shape:
```json
{
  "environment": { "_id":"...", "name":"staging", "color":"#36B37E" },
  "groups": [
    {
      "name": "Database",
      "variables": [
        {
          "_id": "...",
          "key": "DATABASE_URL",
          "value": "[ENCRYPTED]",
          "isSecret": true,
          "isOverridden": false,
          "addedBy": { "name":"Rahul Mehta", "initials":"RM", "role":"developer" },
          "addedByRole": "developer",
          "group": "Database",
          "createdAt": "..."
        }
      ]
    }
  ],
  "hiddenCount": 0   // same visibility model as credentials
}
```

Applies the same RBAC visibility rules as credentials (Phase 03):
- Creator always sees their own variable
- Executives see all
- Sysadmin sees all
- Others see only own unless visibility grant exists

#### `GET /api/projects/:projectId/envs/:envId/variables/:varId/reveal`
Returns `{ key, value: "<plaintext>" }`.
Writes AuditLog `envvar.reveal`.

#### `POST /api/projects/:projectId/envs/:envId/variables`
Body: `{ key, value, isSecret?, group? }`

Validation:
- `key` must match `^[A-Z][A-Z0-9_]*$` (uppercase, no spaces, underscores only)
- `key` must be unique within this environment (return 409 if duplicate)
- Encrypt value before saving

Who can call: project member with `canAddCredential`.

AuditLog: `envvar.create`

#### `PATCH /api/projects/:projectId/envs/:envId/variables/:varId`
Body: `{ value?, isSecret?, group? }` — key is immutable after creation.
Only `addedBy` user, project manager, or sysadmin can edit.

AuditLog: `envvar.edit`

#### `DELETE /api/projects/:projectId/envs/:envId/variables/:varId`
Soft delete.
Same permission as edit.

AuditLog: `envvar.delete`

#### `POST /api/projects/:projectId/envs/:envId/variables/bulk`
Bulk upsert — used when pasting a `.env` file.

Body: `{ variables: Array<{ key, value, isSecret?, group? }>, overwriteExisting: boolean }`

- Parse each line, validate keys
- If `overwriteExisting: true` → update existing keys, insert new ones
- If `overwriteExisting: false` → skip keys that already exist
- Returns `{ inserted: N, updated: N, skipped: N, errors: [...] }`

#### `GET /api/projects/:projectId/envs/:envId/export`
Exports the environment as a `.env` file download.

Query param: `?format=dotenv|json|yaml`

For `dotenv`:
```
# Generated by VaultStack — XYZ Commerce / staging
# Generated at: 2025-04-08T10:00:00Z
# Do not commit this file to version control.

# Database
DATABASE_URL=mongodb://staging-db.xyz.internal/xyz
DB_NAME=xyz_staging

# AWS
AWS_ACCESS_KEY_ID=AKIASTAGING123
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxx
```

For `json`: `{ "DATABASE_URL": "...", ... }`
For `yaml`: `DATABASE_URL: "..."` etc.

Response headers:
```
Content-Type: text/plain (dotenv) | application/json | text/yaml
Content-Disposition: attachment; filename="xyz-commerce.staging.env"
```

AuditLog: `envvar.export` with `meta: { format, envName, keyCount }`

#### `GET /api/projects/:projectId/envs/compare`
Query: `?envA=<envId>&envB=<envId>`

Compares two environments and returns a diff:
```json
{
  "onlyInA": ["FEATURE_FLAG_X"],
  "onlyInB": ["SENTRY_DSN"],
  "inBoth": ["DATABASE_URL", "AWS_ACCESS_KEY_ID"],
  "mismatched": ["DATABASE_URL"]   // same key, different value (values not revealed — just flags mismatch)
}
```

---

## 3. Extend AuditLog actions

Add to the action enum in `models/AuditLog.ts`:
```
'envvar.create', 'envvar.edit', 'envvar.delete', 'envvar.reveal', 'envvar.export',
'environment.create', 'environment.delete', 'environment.clone'
```

---

## 4. UI — Env Manager page

Mount at: `/projects/[id]/environments`

Add "Environments" as a new tab on the project detail page (alongside the existing credential category tabs).

### 4a. Environment selector bar

Horizontal pill tabs, one per environment. Each pill has the environment's color dot.

```
[ staging ]  [ production ]  [ preview-pr-42 ]  [ + Add environment ]
```

Active environment highlighted with blue bottom border (same style as credential category tabs).

### 4b. Variable editor (`components/envs/EnvVariableEditor.tsx`)

The main content area when an environment is selected.

**Top actions bar:**
```
[Search variables]  [Filter by group ▾]  [+ Add variable]  [Paste .env ▾]  [Export ▾]  [Compare ▾]
```

**Variable list — grouped by `group`:**

Each group is a collapsible section with a group name header and a count badge.

Each variable row:
```
[KEY_NAME]   [group chip]   [added-by avatar + role badge]   [••••••••]  [○ reveal]  [⎘ copy]  [✎ edit]  [✕ delete]
```

- Key in `font-mono font-semibold`, value masked by default
- Click `○` → reveal call → show value inline, click again to re-mask
- Click `⎘` → copy revealed value (if not yet revealed, auto-reveals then copies)
- Click `✎` → inline edit mode: value field becomes editable input, save/cancel buttons appear
- Click `✕` → ConfirmDialog → soft delete

**Inline edit mode:**
```
[KEY_NAME (readonly)]   [_____________new value____________]  [Save]  [Cancel]
```

**Locked variables** (user can't see due to visibility rules): show as:
```
[KEY_NAME]   ████████   [🔒 hidden]
```

**Empty group / empty environment:**
Clean empty state with "No variables yet" + "Add variable" CTA.

### 4c. Add variable modal (`components/envs/AddVariableModal.tsx`)

Fields:
- Key (Input, uppercase-enforced — auto-capitalize on type, validate pattern `^[A-Z][A-Z0-9_]*$`, show error if invalid)
- Value (Textarea with show/hide toggle)
- Mark as secret (Toggle, default on)
- Group (Select with existing groups + "New group..." option that shows a text input)

On submit → `POST .../variables`, refresh list.

### 4d. Paste .env modal (`components/envs/PasteEnvModal.tsx`)

A large textarea where the user pastes a raw `.env` file content.

Preview section below textarea: parsed key-value pairs shown in a table (keys on left, value length indicator on right — never show actual values in preview).

Options:
- "Overwrite existing keys" toggle
- Group assignment: assign all pasted variables to a group (optional select)

Submit → `POST .../variables/bulk` → show results toast: "12 inserted, 3 updated, 1 skipped".

### 4e. Export dropdown (`components/envs/ExportMenu.tsx`)

Dropdown with options:
- Download as `.env` file
- Download as `.json`
- Download as `.yaml`
- Copy all to clipboard (dotenv format)

Each triggers `GET .../export?format=...`. For download, use `<a download>` with blob URL. For clipboard, fetch then write to clipboard.

Show a warning banner before export: "This file will contain plaintext secrets. Do not commit to version control."

### 4f. Compare modal (`components/envs/CompareEnvsModal.tsx`)

Two dropdowns: "Compare" [env A] "with" [env B].

On select → `GET .../compare?envA=...&envB=...` → render a diff table:

| Key | Staging | Production |
|---|---|---|
| DATABASE_URL | ✓ present | ✓ present (different value) |
| FEATURE_FLAG_X | ✓ present | — missing |
| SENTRY_DSN | — missing | ✓ present |

Color coding:
- Same key, same value count → green row
- Same key, different value → amber row with a `≠` icon
- Only in A → blue row
- Only in B → purple row

Values are never shown in the diff — only presence and mismatch status.

### 4g. Add environment modal (`components/envs/AddEnvironmentModal.tsx`)

Fields:
- Environment name (Input) — auto-generates slug (lowercase, spaces → hyphens)
- Description
- Color (6 swatches + custom hex)
- Clone from (Select, optional): "Start empty" or pick an existing environment to copy all variables from

Submit → `POST .../envs` (with `cloneFromEnvId` if clone selected) → switch to new environment tab.

---

## 5. Base environment & key sync indicator

If `isBaseEnvironment: true` on one environment (e.g. "staging" is the base), other environments show a sync indicator per variable:

```
DATABASE_URL   [⚠ missing in production]
```

This is computed client-side by comparing the base env's keys against the selected env's keys.

On variables that are present in base but missing in the current env, show:
```
[DATABASE_URL]   [⚠ Not set — present in staging]   [+ Add value for this env]
```

Clicking "+ Add value for this env" opens `AddVariableModal` pre-filled with the key.

---

## 6. Project nav update

Update the project detail page tabs:

```
[Credentials]  [Environments]  [Access control]  [Settings]
```

"Environments" is the new tab added in this phase.

---

## 7. Sidebar nav update

Under each project in the sidebar (if project is selected/expanded), show:

```
XYZ Commerce
  ├── Credentials
  ├── Environments       ← new
  └── Members
```

Or if the sidebar doesn't expand per-project, just ensure "Environments" is reachable from the project detail page tabs.

---

## Deliverable checklist

- [x] `Environment` and `EnvVariable` models created with correct indexes and unique constraints
- [x] All environment CRUD routes functional
- [x] All variable CRUD routes functional including bulk upsert
- [x] Key validation (`^[A-Z][A-Z0-9_]*$`) enforced on API and UI
- [x] Values encrypted at rest using `lib/crypto.ts` from Phase 06
- [x] Reveal endpoint decrypts and logs to AuditLog
- [x] Export endpoint returns correct file format with correct headers for all 3 formats
- [x] Compare endpoint returns correct diff (no values leaked)
- [x] UI: environment pill tabs render, switch environments correctly
- [x] UI: variable list grouped by group, collapsible
- [x] UI: inline edit works (edit value in-place, save/cancel)
- [x] UI: reveal / mask / copy cycle works
- [x] UI: Add variable modal enforces uppercase key validation
- [x] UI: Paste .env modal parses correctly and shows preview
- [x] UI: Export dropdown triggers correct format download
- [x] UI: Compare modal shows diff table with correct color coding
- [x] UI: Add environment modal clones variables when selected
- [x] Base environment key sync indicators appear for missing keys
- [x] AuditLog entries written for all env variable actions
- [x] RBAC visibility rules apply (same as credentials)
- [x] ESLint clean, `npm run build` passes
