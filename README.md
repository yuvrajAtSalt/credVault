# VaultStack — Build Prompts Index

A Jira-style, white-and-blue themed **Project Credentials Manager** built with Next.js (frontend + API routes) and MongoDB/Mongoose. Designed to sit alongside an existing **brand-store** project, inheriting all its coding conventions, ESLint rules, Tailwind config, and component patterns.

---

## How to use these prompts

Feed each phase file to **Google Antigravity** (or any AI coding agent) in order. Do not skip phases — each phase depends on the previous one being complete and passing its deliverable checklist.

Before starting, give the agent access to your **brand-store** repository. Every phase prompt begins with an instruction to read brand-store's conventions before writing code.

---

## Phase overview

| Phase | File | Scope | Est. complexity |
|---|---|---|---|
| 00 | `phase-00-bootstrap.md` | Scaffold, standards, folder structure, constants | Low |
| 01 | `phase-01-models-auth.md` | Mongoose models, JWT auth, login UI | Medium |
| 02 | `phase-02-layout-projects.md` | App shell, sidebar, project CRUD | High |
| 03 | `phase-03-credentials-vault.md` | Credential system, RBAC visibility, masking | High |
| 04 | `phase-04-team-directory.md` | Team management, employee directory, org chart | High |
| 05 | `phase-05-permissions-audit-settings.md` | Permissions matrix, audit log, settings pages | Medium |
| 06 | `phase-06-security-polish.md` | Encryption, rate limiting, tests, polish | Medium |

---

## Key product decisions captured in these prompts

### Role system (9 roles)

All roles — including executives (CEO, COO, CFO, CMO) — can create projects, add credentials, and be assigned to projects. The distinction is visibility scope:

- **Executives (CEO, COO, CFO):** See all projects and all credentials org-wide by default. Can create projects and add credentials. Cannot manage team or grant visibility to others.
- **CMO:** Same as executives but scoped to assigned projects only (not org-wide).
- **Manager:** Manages assigned projects, invites members, controls per-member visibility grants.
- **DevOps / Developer / QA:** Add credentials to assigned projects. See only their own credentials unless a manager grants them visibility.
- **System Admin:** God mode. Sees and manages everything. The only role that can change other users' roles.

### Credential visibility model

1. Creator always sees their own credential.
2. Executives (CEO, COO, CFO) see all credentials on all projects.
3. Sysadmin sees everything.
4. All others see only their own, unless a manager or sysadmin grants `scope: 'all'` visibility on a per-project, per-user basis.
5. Hidden credentials are acknowledged with a count ("X credentials are hidden") so the user knows to request access.

### Design system

- Jira-like: white content areas, `#172B4D` dark navy sidebar, `#0052CC` primary blue
- Font: Inter (or brand-store's font)
- All Tailwind tokens scoped under `vault.*` namespace to avoid collisions with brand-store

---

## Recommended agent instructions (prepend to each phase prompt)

```
You will have to follow the same monorepo structure and repository patterns , coding standards , ESLint and Prettier configuration exactly , TypeScript path aliases , Mongoose model structure and pre-save hook patterns , API route error handling conventions , Form component and input field patterns as brand-store.
- here is the path to the brand-store project : C:\Users\user-09-12-2025\Yuvraj\BrandStore
Before writing any code for VaultStack, read the brand-store source code and mirror its:
- folder structure and barrel export patterns
- ESLint and Prettier configuration exactly
- Tailwind config (extend it, don't replace it)
- TypeScript path aliases
- Mongoose model structure and pre-save hook patterns
- API route error handling conventions
- Form component and input field patterns

Only then proceed with the phase instructions below.
Do not use any library that brand-store does not already use unless the phase prompt explicitly introduces a new one.
```
