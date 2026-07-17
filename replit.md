# HangBar — Hangover Members App

A members-only bar community app (Turkish UI) for staff to share cocktail posts, send messages, view announcements, manage tasks, and maintain social profiles.

## Run & Operate

- `pnpm --filter @workspace/hangbar run dev` — run the frontend (Vite, port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Required Secrets

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Database Migrations

Supabase is the primary database. Migrations live in `artifacts/hangbar/supabase/migrations/`.
Run them in order via **Supabase Dashboard → SQL Editor → New query → Run**:

1. `001_initial.sql` — Core tables (profiles, posts, messages, cocktails, etc.)
2. `002_social.sql` — Social profile tables (follows, post_likes) + profile columns (cover_url, points, pinned_post_id)

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Auth + DB**: Supabase (PostgreSQL, Storage, Realtime)
- **Routing**: wouter
- **State**: React context (auth), useCollection/useDocument hooks (Supabase-backed)
- **API Server**: Express 5 + Drizzle ORM (separate artifact, not yet wired to frontend)
- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9

## Where things live

- `artifacts/hangbar/src/pages/` — all page components
- `artifacts/hangbar/src/components/layout/` — AppShell (nav + sidebar), ProtectedRoute
- `artifacts/hangbar/src/components/profile/UserAvatar.tsx` — clickable avatar component (use everywhere)
- `artifacts/hangbar/src/lib/auth-context.tsx` — auth state, profile sync
- `artifacts/hangbar/src/lib/supabase.ts` — Supabase client
- `artifacts/hangbar/src/hooks/use-firestore.ts` — useCollection / useDocument (Supabase-backed)
- `artifacts/hangbar/supabase/migrations/` — SQL migration files
- `artifacts/api-server/` — Express backend (unused by frontend currently)

## Architecture decisions

- **Supabase-only frontend**: All data access goes through Supabase client directly; the Express API server exists but is not wired to the React app yet.
- **Admin emails hardcoded**: `ADMIN_EMAILS` in `auth-context.tsx` determines admin role on sign-in. Change this list to add admins.
- **UserAvatar component**: All avatar/username displays that should link to a profile must use `<UserAvatar userId={...} />` — this is the single source of truth for profile navigation.
- **Profile routing**: `/profile` = own profile, `/profile/:userId` = any user's public profile — both render the same `Profile` component which detects `isOwnProfile` from auth state.
- **Social tables**: `follows` and `post_likes` live in Supabase; counts are computed at query time (not denormalized) except `cocktail_count` and `points` which are columns on `profiles`.

## Product

- Members-only bar community (Turkish UI)
- Social feed (posts with images, cocktail tags, likes)
- Full social profiles with cover photo, bio, stats, follow/following, post pins
- Profile tabs: Posts · Cocktails · Likes
- Real-time private messaging between members
- Cocktail menu and submission workflow
- Announcements, table requests, staff tasks, admin panel

## Gotchas

- Run `002_social.sql` in Supabase before using follow/like/cover photo features — without it those columns and tables don't exist and queries will fail silently.
- `useCollection` and `useDocument` hooks set up Supabase Realtime channels — each usage adds a subscription, so avoid calling them inside loops.
- Vite requires `--host 0.0.0.0` for Replit preview to work (already set in `package.json`).
- `SESSION_SECRET` env var exists but is used by the API server, not the frontend.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
