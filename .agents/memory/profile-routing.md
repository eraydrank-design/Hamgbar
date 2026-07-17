---
name: Profile routing pattern
description: How own-profile vs. other-user profile routing works in HangBar.
---

Both `/profile` and `/profile/:userId` render the same `Profile` component (`artifacts/hangbar/src/pages/profile.tsx`).

**Detection logic:**
```ts
const params = useParams<{ userId?: string }>();
const profileId = params?.userId ?? user?.id ?? '';
const isOwnProfile = profileId === user?.id;
```

- Own profile: edit button shown, pin/unpin posts enabled, no follow button
- Other profile: follow/unfollow + message buttons shown, no edit

**UserAvatar component** (`src/components/profile/UserAvatar.tsx`) is the canonical way to render a clickable avatar that navigates to `/profile/:userId`. Use it everywhere author photos appear.

**Why:** Single component avoids divergence between own/other profile views. wouter's useParams returns `{}` on `/profile` (no param), so the fallback to `user?.id` kicks in cleanly.
