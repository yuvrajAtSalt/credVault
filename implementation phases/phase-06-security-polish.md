# VaultStack — Phase 06: Security Hardening, Credential Encryption & Final Polish

> Prerequisite: Phase 05 complete. All pages functional.

---

## Goal

Harden the application for production use. Encrypt stored credentials, add rate limiting, finalise responsive behaviour, write API integration tests, and deliver a production-ready build.

---

## 1. Credential Encryption at Rest

All credential `value` fields must be AES-256-GCM encrypted before writing to MongoDB and decrypted on read.

### `lib/crypto.ts`

```ts
// Uses Node.js built-in `crypto` module — no external library needed
const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32-byte key, hex-encoded in env

export function encrypt(plaintext: string): string {
  // Generate random 12-byte IV
  // Encrypt → returns `iv:authTag:ciphertext` as a single base64 string
}

export function decrypt(ciphertext: string): string {
  // Parse iv:authTag:ciphertext
  // Decrypt and return plaintext
}
```

Add `ENCRYPTION_KEY` to `.env.local.example` with instructions:
```
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_32_byte_hex_key_here
```

### Migration

Write a one-time migration script `scripts/migrate-encrypt-credentials.ts`:
- Fetch all credentials where `value` does not match encrypted format
- Encrypt and save
- Log count of migrated records

### Update models

In `models/Credential.ts` add Mongoose pre-save hook that encrypts `value` if modified. Add a model method `getDecryptedValue()` that returns the plaintext.

Update reveal endpoint to call `credential.getDecryptedValue()`.

---

## 2. Rate Limiting

### `lib/rateLimit.ts`

Implement a lightweight in-memory rate limiter (or use `upstash/ratelimit` if brand-store uses Redis — match brand-store's choice).

Apply to:
- `POST /api/auth/login` → 5 attempts per 15 minutes per IP
- `GET /api/.../credentials/:id/reveal` → 60 reveals per hour per user
- `POST /api/auth/invite` → 20 invites per hour per user

Return `429 Too Many Requests` with `Retry-After` header.

---

## 3. Input Sanitisation & Validation

All API route bodies must be validated with Zod schemas (or match brand-store's validation library).

Create `lib/validators/` with one file per resource:

```ts
// lib/validators/credential.ts
export const createCredentialSchema = z.object({
  category: z.enum(['github','storage','database','smtp','deploy','custom']),
  label: z.string().min(1).max(200),
  value: z.string().min(1).max(10000),
  isSecret: z.boolean().default(true),
  environment: z.enum(['staging','production','development','all']).default('all'),
});
```

Use a shared `validateBody(schema)(req)` helper that returns parsed data or throws a 400 with Zod error messages.

---

## 4. Security Headers

In `next.config.js`, add security headers:

```js
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ..." },
]
```

---

## 5. Responsive Polish Pass

Do a full viewport sweep across all pages at 375px (mobile), 768px (tablet), 1280px (desktop), and 1920px (large desktop).

Fix list for common issues:
- Sidebar: collapse to hamburger on mobile (already stubbed in Phase 02 — complete it)
- Project cards: 1 col on mobile, 2 on tablet, 2-3 on desktop
- Credential rows: stack label + value vertically on mobile
- Org chart: allow horizontal scroll on mobile (don't try to reflow the tree)
- Team table: horizontally scrollable on mobile
- Modals: full-screen on mobile (width 100%, border-radius 0 on bottom)

---

## 6. Loading & Skeleton States

Replace any raw `null` / blank flashes with skeleton loaders.

Build `components/ui/Skeleton.tsx`:

```tsx
// Variants: text (lines), card, avatar, row
<Skeleton variant="card" />
<Skeleton variant="text" lines={3} />
```

Apply skeletons to:
- Project card grid while loading
- Credential rows while fetching
- Team table while loading
- Org chart while fetching

---

## 7. Error Boundary

Wrap the dashboard layout in an `ErrorBoundary` component. On unhandled render errors show a clean error card with:
- "Something went wrong" heading
- Error message (in dev only)
- "Reload page" button

---

## 8. API Integration Tests

Using Jest + Supertest (or match brand-store's test setup):

Write tests for the critical paths:

```
auth/
  ✓ POST /login returns token with valid credentials
  ✓ POST /login returns 401 with wrong password
  ✓ POST /login rate limits after 5 attempts

credentials/
  ✓ Developer can add credential to assigned project
  ✓ Developer cannot see another dev's credential without visibility grant
  ✓ Manager visibility grant allows developer to see all credentials
  ✓ Reveal endpoint returns 403 for unauthorized user
  ✓ Sysadmin can see all credentials on any project

projects/
  ✓ All roles can create a project
  ✓ Developer cannot see project they are not a member of
  ✓ CEO can see all projects
```

Run: `npm run test`

---

## 9. Final `.env.local.example`

```env
MONGODB_URI=mongodb://localhost:27017/vaultstack
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=generate_with_node_crypto_32_bytes_hex
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEV_ROLE_SWITCHER=false
```

---

## 10. README completion

Update `README.md` with:
- Project overview
- Local setup (clone → `.env.local` → `npm install` → `npm run dev`)
- First-run setup (hit `/api/auth/register` to create org + sysadmin)
- How to generate the encryption key
- Folder structure overview
- Tech stack table
- Link to the permission matrix (can reference Phase 05's permissions page)

---

## Deliverable checklist

- [ ] All credentials encrypted in DB (AES-256-GCM)
- [ ] Decrypt on reveal endpoint works correctly
- [ ] Migration script runs without errors on existing data
- [ ] Rate limiting active on login + reveal routes
- [ ] All API bodies validated with Zod schemas
- [ ] Security headers present in `next.config.js`
- [ ] App is fully usable at 375px mobile width
- [ ] Skeleton loaders on all major data-fetch areas
- [ ] Error boundary catches render errors gracefully
- [ ] Test suite passes (`npm run test`)
- [ ] `README.md` complete with setup instructions
- [ ] `npm run build` completes with zero TypeScript errors
- [ ] ESLint zero warnings
