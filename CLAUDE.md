# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start local dev server (Next.js)

# Build (generates Prisma client first, then builds Next.js)
npm run build

# Production
npm run start

# Lint
npm run lint
```

No test suite is configured. Manual testing is required.

## Architecture

This is an internal admin/ops dashboard built with **Next.js 16 App Router**, **React 19**, and **TypeScript**. It provides multiple developer tools through a unified interface.

### Authentication

Two separate auth systems coexist:
- **Clerk** — manages the user database and user-facing authentication (`/lib/authConfig.ts`, `AuthProvider.tsx`)
- **Azure AD (MSAL)** — used specifically for obtaining tokens to access Azure Managed Grafana (`/hooks/useGrafanaToken.ts`)

Access is email-allowlisted. `middleware.ts` also handles transparent proxying of Grafana API requests.

### Data Layer

- **Prisma v5** + **PostgreSQL** for the internal user/team/activity database (`/prisma/schema.prisma`, `/lib/prisma.ts`)
- **`pg` driver** used directly in `/app/api/query/` for ad-hoc SQL queries against arbitrary databases (the database browser feature)
- **Azure Data Tables** used for environment variable storage in the `envecl` feature

### Key Features and Their API Routes

| Feature | Page | API Route |
|---|---|---|
| DB browser (run SQL, view/edit tables) | `app/page.tsx` | `app/api/query/`, `app/api/delete/` |
| Clerk user search | `app/clerk-search/` | `app/api/clerk-search/` |
| MetaAPI broker lookup | `app/metaapi-lookup/` | `app/api/metaapi-lookup/` |
| Grafana monitoring | `app/monitoring/` | `app/api/grafana/` |
| Env var manager | `app/envecl/` | — (direct Azure Tables SDK calls) |
| JSON converter | `app/json-converter/` | — (client-side only) |

### Component Conventions

- Shared layout wrapper: `app/components/AppShell.tsx` (sidebar + auth gate)
- UI primitives: `components/ui/` (shadcn/ui pattern with Radix UI)
- Toast notifications: `app/components/ToastContext.tsx` (context + hook)
- Path alias `@/` maps to the repo root

### Grafana Proxy

`middleware.ts` intercepts requests matching `/grafana/*` and proxies them to the Azure Managed Grafana instance, injecting Azure AD bearer tokens. This allows the embedded `<iframe>` in `app/monitoring/` to work without CORS issues.

## Environment Variables

The app requires several env vars at runtime. Key ones:
- `DATABASE_URL` — PostgreSQL connection string (used by Prisma)
- Clerk public/secret keys (`NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`)
- Azure AD credentials (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, etc.)
- Grafana URL and connection details
- Azure Storage connection string (for `envecl`)
