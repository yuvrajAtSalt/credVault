# VaultStack — Phase 00: Project Bootstrap & Standards Alignment

## Context

You are initialising a new Next.js + Node.js project called **VaultStack** inside a monorepo or workspace that already contains a project called **brand-store**. You must study brand-store's repository structure, coding conventions, naming patterns, import aliases, ESLint/Prettier config, Tailwind config, folder organisation, and component patterns **before writing a single line of code**. VaultStack must feel like a sibling project — a developer switching between the two should feel at home immediately.

---

## What to do first — read brand-store

Before scaffolding anything, read and internalize:

1. `package.json` — note scripts, dependency versions (Next.js version, Mongoose version, etc.)
2. `tsconfig.json` or `jsconfig.json` — path aliases (`@/`, `@components/`, etc.)
3. `.eslintrc.*` and `.prettierrc.*` — all rules must be mirrored exactly
4. `tailwind.config.*` — copy the full config as the base; do not start fresh
5. Any barrel `index.ts/js` patterns in `components/`, `lib/`, `utils/`
6. How environment variables are typed and validated (e.g. `env.ts`, `zod` schema, or raw `process.env`)
7. How API routes are structured (e.g. `pages/api/` vs `app/api/`, request/response helpers)
8. How Mongoose models are defined (schema file structure, naming, index declarations)
9. How errors are handled and returned from API routes
10. How auth middleware is applied (if it exists)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (match brand-store's version — App Router if brand-store uses it) |
| Styling | Tailwind CSS — mirror brand-store's config |
| Backend | Node.js via Next.js API routes (`/app/api/` or `/pages/api/`) |
| Database | MongoDB via Mongoose |
| Auth | JWT stored in httpOnly cookies (or mirror brand-store's auth mechanism) |
| State | React Context + `useReducer` for global state; SWR or React Query for server state (match brand-store) |
| Validation | Zod (or Joi — match brand-store) |

---

## Design System

- **Theme:** Clean, white and blue. Jira-like. Professional and functional.
- **Primary color:** `#0052CC` (Jira blue)
- **Primary hover:** `#0065FF`
- **Accent / sidebar:** `#172B4D` (dark navy)
- **Background:** `#F4F5F7`
- **Surface / card:** `#FFFFFF`
- **Border:** `#DFE1E6`
- **Text primary:** `#172B4D`
- **Text secondary:** `#5E6C84`
- **Success:** `#36B37E`
- **Warning:** `#FFAB00`
- **Danger:** `#DE350B`
- **Font:** Inter (or match brand-store's font)

Add these as Tailwind custom colors in `tailwind.config` under `theme.extend.colors.vault.*`.

---

## Scaffold tasks

1. Initialise the project using `create-next-app` with the **exact** same flags and Next.js version as brand-store.
2. Copy `.eslintrc`, `.prettierrc`, `tsconfig.json` paths/aliases from brand-store.
3. Install all dependencies matching brand-store's versions where they overlap. Add:
   - `mongoose`
   - `zod`
   - `jsonwebtoken`
   - `bcryptjs`
   - `swr` (or `@tanstack/react-query` — match brand-store)
   - `cookie` / `cookies-next`
   - `clsx`
   - `lucide-react`
4. Set up `tailwind.config` extending brand-store's config, adding the VaultStack color tokens above.
5. Create the following folder structure (mirroring brand-store's conventions):

```
vaultstack/
├── app/                        # or pages/ — match brand-store
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # sidebar + topbar shell
│   │   ├── dashboard/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── team/page.tsx
│   │   ├── directory/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   ├── projects/
│   │   ├── credentials/
│   │   ├── members/
│   │   └── roles/
│   └── layout.tsx
├── components/
│   ├── ui/                     # atoms: Button, Badge, Input, Modal, Avatar, Tooltip
│   ├── layout/                 # Sidebar, Topbar, PageWrapper
│   ├── projects/               # ProjectCard, ProjectList
│   ├── credentials/            # CredentialRow, CredentialPanel, AddCredentialModal
│   ├── team/                   # MemberRow, MemberCard
│   └── directory/              # OrgTree, MemberProfileCard
├── lib/
│   ├── db.ts                   # Mongoose connection singleton
│   ├── auth.ts                 # JWT sign/verify helpers
│   ├── api.ts                  # fetch wrapper (match brand-store's pattern)
│   └── constants.ts            # ROLES, PERMISSIONS, COLOR_MAP
├── models/
│   ├── User.ts
│   ├── Project.ts
│   ├── Credential.ts
│   └── Organisation.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useProjects.ts
│   └── usePermissions.ts
├── types/
│   └── index.ts                # all shared TypeScript types
├── middleware.ts                # Next.js edge middleware for auth guard
├── .env.local.example
└── README.md
```

6. Create `.env.local.example`:

```env
MONGODB_URI=mongodb://localhost:27017/vaultstack
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

7. Create `lib/constants.ts` defining the full RBAC role list:

```ts
export const ROLES = [
  'sysadmin',
  'ceo',
  'coo',
  'cfo',
  'cmo',
  'manager',
  'devops',
  'developer',
  'qa',
] as const;

export type Role = typeof ROLES[number];

export const ROLE_LABELS: Record<Role, string> = {
  sysadmin: 'System Admin',
  ceo: 'CEO',
  coo: 'COO',
  cfo: 'CFO',
  cmo: 'CMO',
  manager: 'Manager',
  devops: 'DevOps',
  developer: 'Developer',
  qa: 'QA Engineer',
};

// Base permissions — each role may have project-level overrides on top
export const BASE_PERMISSIONS: Record<Role, {
  canSeeAllProjects: boolean;
  canCreateProject: boolean;
  canAddCredential: boolean;
  canManageTeam: boolean;
  canManageRoles: boolean;
  canGrantVisibility: boolean;
  canSeeAllCredentials: boolean;
  isGod: boolean;
}> = {
  sysadmin: { canSeeAllProjects:true, canCreateProject:true, canAddCredential:true, canManageTeam:true, canManageRoles:true, canGrantVisibility:true, canSeeAllCredentials:true, isGod:true },
  ceo:      { canSeeAllProjects:true, canCreateProject:true, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true, isGod:false },
  coo:      { canSeeAllProjects:true, canCreateProject:true, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true, isGod:false },
  cfo:      { canSeeAllProjects:true, canCreateProject:true, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true, isGod:false },
  cmo:      { canSeeAllProjects:false, canCreateProject:true, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
  manager:  { canSeeAllProjects:false, canCreateProject:true, canAddCredential:true, canManageTeam:true, canManageRoles:false, canGrantVisibility:true, canSeeAllCredentials:false, isGod:false },
  devops:   { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
  developer:{ canSeeAllProjects:false, canCreateProject:false, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
  qa:       { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true, canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
};
```

8. Create a `types/index.ts` with all shared types (User, Project, Credential, etc.) — use the models below as the source of truth.

---

## Deliverable checklist

- [ ] Project boots with `npm run dev` without errors
- [ ] ESLint passes with zero warnings
- [ ] Tailwind compiles correctly with vault color tokens
- [ ] Folder structure matches the spec above
- [ ] `lib/constants.ts` exports ROLES, ROLE_LABELS, BASE_PERMISSIONS
- [ ] `.env.local.example` present
- [ ] `README.md` documents local setup steps
