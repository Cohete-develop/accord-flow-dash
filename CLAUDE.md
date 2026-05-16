# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server on port 8080
npm run build      # Production build
npm run lint       # ESLint validation
npm run test       # Run Vitest (single run)
npm run test:watch # Run Vitest in watch mode
npm run preview    # Preview production build
```

## Architecture Overview

**InfluXpert** is a multi-tenant SaaS platform for influencer marketing management. Stack: React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui (Radix), TanStack React Query, React Router v6, React Hook Form + Zod, Supabase (PostgreSQL + PostgREST + Auth + RLS).

### Key directories

- `src/pages/` — Route-level page components
- `src/components/` — Reusable components; sub-folders `admin/`, `campaign-monitor/`, `ui/` (shadcn)
- `src/hooks/` — Custom hooks (`useAuth`, `useCrmData`, `useCampaignMonitor`, `useImpersonation`, …)
- `src/integrations/supabase/` — Supabase client + auto-generated TypeScript types
- `src/types/crm.ts` — Domain model types (camelCase app layer)
- `src/lib/` — Utilities (export-utils, friendly-errors, …)

### Routing (`src/App.tsx`)

All authenticated routes are wrapped in `Layout`. The root `/` hits `RoleBasedRedirect`, which sends users to the appropriate page based on `app_role`. Key routes: `/dashboard`, `/acuerdos`, `/pagos`, `/entregables`, `/kpis`, `/campaign-monitor`, `/admin`, `/super-admin`.

### Data fetching pattern

Use `useCrmData` for the four core CRM modules (Acuerdos, Pagos, Entregables, KPIs). It injects `company_id` filtering automatically via `useCompanyContext()`. For other tables, rely on RLS — do not hardcode `company_id` in client queries. Field mapping: DB uses `snake_case`, the app layer uses `camelCase`.

### Auth & roles

Supabase Auth (email/password). Roles live in `user_roles` table as `app_role` enum: `gerencia` (owner), `coordinador_mercadeo` (admin), `analista`/`admin_contabilidad` (member), `super_admin` (Cohete platform admin, no `company_id`). Super admin can impersonate any tenant via `useImpersonation`.

## Multi-Tenant Rules (mandatory — read `TENANT_GUIDELINES.md`)

Tenant isolation is **domain-based**: each company is identified by its email domain. RLS is the security boundary — never the client.

### Every new business table must have

1. `company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE`
2. `CREATE INDEX idx_<table>_company_id ON public.<table>(company_id);`
3. `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
4. The four standard isolation policies (SELECT/INSERT/UPDATE/DELETE using `public.get_user_company_id(auth.uid())`)
5. A `super_admin` full-access policy using `public.has_role(auth.uid(), 'super_admin')`

### Non-negotiable rules

- Never disable RLS on tenant tables.
- Never do `supabase.from('table').select('*')` without trusting RLS or an explicit filter.
- In `INSERT`, set `user_id = auth.uid()` and let RLS validate `company_id`.
- In Edge Functions using service role, explicitly validate `company_id` ownership before operating.
- User email domain must match the company domain (validated by trigger + Edge Function logic).
- Companies cannot be created with domains in `blocked_domains`.
- Never expose cross-tenant data outside explicit `super_admin` flows.

### DB helper functions

| Function | Purpose |
|---|---|
| `public.get_user_company_id(uid)` | Returns the user's `company_id` |
| `public.get_user_email_domain()` | Returns current user's email domain |
| `public.has_role(uid, role)` | Checks if user has an `app_role` |
| `public.is_protected_user(uid)` | True if user is super_admin (undeletable) |

## Ad Platform Integrations

Campaign Monitor supports OAuth connections to Google Ads, Meta Ads, TikTok Ads, and LinkedIn Ads. OAuth callback route: `/campaign-monitor/oauth/callback`. Connection state lives in `ad_platform_connections`; metrics in `campaign_metrics`; sync jobs in `campaign_syncs`.
