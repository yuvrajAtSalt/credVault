# Cred Vault (VaultStack)

A secure, RBAC-driven credential management platform for engineering teams. Store, share, and audit API keys, tokens, database passwords, and secrets — all encrypted at rest with AES-256-GCM.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|------------------------------------------|
| Frontend    | Next.js 16 (App Router), TypeScript, Vanilla CSS |
| Backend     | Node.js, Express, TypeScript             |
| Database    | MongoDB (Mongoose ODM)                   |
| Auth        | JWT (access + refresh tokens), bcrypt    |
| Encryption  | AES-256-GCM (Node.js built-in `crypto`)  |
| Monorepo    | Turborepo + pnpm workspaces              |

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8 (`npm i -g pnpm`)
- A MongoDB connection string (Atlas free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/credvault.git
cd credvault
pnpm install
```

### 2. Configure Environment

**API** — copy and fill in `apps/api/.env`:

```env
PORT=5050
MONGO_URI=mongodb://localhost:27017/credvault
VAULT_JWT_SECRET=<min 32 chars random string>
VAULT_JWT_REFRESH_SECRET=<different min 32 chars random string>
ACCESS_TOKEN_EXPIRATION=30m
REFRESH_TOKEN_EXPIRATION=7d
NODE_ENV=development
CLIENT_URL=http://localhost:3050
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64 char hex string>
```

**Web** — copy and fill in `apps/web/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5050
```

### 3. Generate an Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `ENCRYPTION_KEY` in `apps/api/.env`.

> ⚠️ Keep this key safe. Losing it means all credentials in the database become unrecoverable.

### 4. Run Dev Server

```bash
pnpm run dev
```

- Frontend: http://localhost:3050
- API:      http://localhost:5050

---

## First-Run Setup

1. Open `http://localhost:3050` — you'll be redirected to `/login`.
2. Call the registration endpoint once to create your organisation and first SYSADMIN:

```bash
curl -X POST http://localhost:5050/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"orgName":"Acme Corp","name":"Admin User","email":"admin@acme.com","password":"SuperSecret123!"}'
```

3. Log in at `http://localhost:3050/login` with those credentials.
4. Invite team members from **Settings → Invite Member** or the **Team** page.

---

## Encrypting Existing Credentials (Migration)

If you have credentials stored as plain text (before encryption was added), run:

```bash
cd apps/api
npx ts-node scripts/migrate-encrypt-credentials.ts
```

Safe to run multiple times — already-encrypted values are automatically skipped.

---

## Folder Structure

```
credvault/
├── apps/
│   ├── api/                  Express API
│   │   ├── src/
│   │   │   ├── auth/         Auth routes + service
│   │   │   ├── credential/   Credential CRUD + encryption
│   │   │   ├── audit/        Audit log
│   │   │   ├── project/      Project management
│   │   │   ├── user/         User + member management
│   │   │   ├── organisation/ Org settings
│   │   │   └── utils/        Crypto, rate limiter, validators
│   │   └── scripts/          One-time migration scripts
│   └── web/                  Next.js frontend
│       └── src/
│           ├── app/          App Router pages
│           ├── components/   Shared UI components
│           ├── hooks/        Auth + permission hooks
│           └── lib/          Constants, API helpers
├── implementation phases/    Phase planning documents
└── turbo.json                Turborepo config
```

---

## Permissions Matrix

| Role       | All Projects | Create Project | Add Cred | Manage Team | Grant Vis. | Manage Roles | All Creds | God Mode |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| SYSADMIN   | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CEO        | ✓ | ✓ | ✓ | — | — | — | ✓ | — |
| COO        | ✓ | ✓ | ✓ | — | — | — | ✓ | — |
| CFO        | ✓ | ✓ | ✓ | — | — | — | ✓ | — |
| CMO        | — | ✓ | ✓ | — | — | — | — | — |
| MANAGER    | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| DEVOPS     | — | — | ✓ | — | — | — | — | — |
| DEVELOPER  | — | — | ✓ | — | — | — | — | — |
| QA         | — | — | ✓ | — | — | — | — | — |

For the full interactive permissions page, log in and navigate to **Settings → Permissions**.

---

## Production Build

```bash
pnpm run build
```

Both apps must pass TypeScript type-checking with zero errors before the build completes.

---

## Security Notes

- All credential `value` fields are AES-256-GCM encrypted before writing to MongoDB.
- JWT access tokens expire in 30 minutes; refresh tokens expire in 7 days.
- Login is rate-limited to 5 attempts per 15 minutes per IP.
- Credential reveal is rate-limited to 60 per hour per user.
- All actions are recorded to an immutable audit log.
- HTTP security headers (CSP, X-Frame-Options, HSTS, etc.) are applied to all responses.
