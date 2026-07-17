---
name: Social profile migration
description: What the 002_social.sql migration adds and why it must be run manually in Supabase before social features work.
---

The social profile system (follows, likes, cover photo, pinned posts) requires `artifacts/hangbar/supabase/migrations/002_social.sql` to be run in the Supabase Dashboard SQL Editor.

**What it adds:**
- `profiles.cover_url TEXT` — cover photo URL
- `profiles.points INT` — used for ranking
- `profiles.pinned_post_id UUID` — references posts(id)
- `follows` table — follower_id / following_id with UNIQUE constraint
- `post_likes` table — post_id / user_id with UNIQUE constraint
- RLS policies for both tables
- Realtime enabled for both tables

**Why:** Supabase migrations aren't auto-applied; they must be run manually via the dashboard or CLI. Without this migration, follow/like/cover queries fail silently (RLS blocks or column missing).

**How to apply:** Supabase Dashboard → SQL Editor → New query → paste 002_social.sql → Run.
