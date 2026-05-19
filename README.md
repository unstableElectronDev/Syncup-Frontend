# Syncup Frontend

Next.js 14 frontend for the Syncup realtime coaching feed. Coaches publish posts that appear instantly on all connected clients via WebSocket, with an admin dashboard for content management.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Project Structure](#project-structure)
- [Pages & Components](#pages--components)
- [Realtime Strategy](#realtime-strategy)
- [Caching Behaviour](#caching-behaviour)
- [API Integration](#api-integration)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Key Assumptions](#key-assumptions)

---

## Overview

Syncup Frontend is a single-tab realtime feed viewer. Clients receive new posts the moment they are published without refreshing the page. An admin dashboard (token-gated) allows creating, editing, and deleting posts.

```
Browser (port 3000)  <──HTTP──>  Backend (port 4000)
                     <──WS────>  Socket.IO
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Node 18 compatibility — Next.js 16 requires Node >= 20.9.0 |
| Styling | Tailwind CSS v3 + PostCSS | Tailwind v4's native binding (`@tailwindcss/oxide`) requires Node >= 20 |
| Realtime | socket.io-client v4.8.3 | Matches server version exactly — avoids handshake mismatches |
| Language | JSX (`.jsx`) | TypeScript config kept for tooling; runtime files are plain JSX |
| React | v18.3.1 | Stable concurrent features; compatible with Next.js 14 |

> **Node 18 constraint.** The environment runs Node 18.20.4. Both Next.js 16 and Tailwind v4 were ruled out because they require Node 20+. All dependency choices flow from this constraint.

---

## Architecture & Design Decisions

### 1. App Router (`app/`) with `'use client'` components

All interactive pages are client components. There is no server-side data fetching — the backend is a separate Express service consumed via `fetch` and WebSocket. Next.js is used purely as a client-side SPA host with file-based routing.

### 2. Socket singleton (`lib/socket.js`)

A module-level `socket` variable is created once and reused for the lifetime of the browser tab. React component unmount (navigating to `/admin`) does **not** disconnect the socket. This is intentional — the socket must stay connected to receive `feed:new` events even when the home page is not rendered.

```
lib/socket.js
  └── getSocket()  →  returns the same io() instance every call
```

### 3. Module-level `lastSeenAt` (`app/page.jsx`)

A plain JS variable at module scope (outside the React component) survives component unmount/remount during SPA navigation. It tracks the `created_at` timestamp of the newest post the home page has seen.

When the user navigates away to `/admin` and back:
1. `loadFeed(1)` fires — Redis may serve a cached (stale) snapshot.
2. After `setFeed` resolves, the page emits `sync` with `lastSeenAt`.
3. The backend queries the DB directly and responds with `feed:catchup` containing any posts created during the navigation window.
4. The catchup handler deduplicates against the already-rendered list before prepending.

This pattern avoids a full cache-busting reload while still guaranteeing consistency.

### 4. Cache round-trip for admin mutations

The backend caches `GET /api/feed` responses in Redis (TTL set in backend `.env` as `CACHE_TTL_SECONDS`, default 300 s). Every write operation (POST, PUT, DELETE) on the backend invalidates all `feed:list:*` keys via a cursor-based `SCAN` before responding.

The admin dashboard always calls `loadPosts()` after a successful mutation. Because the cache was invalidated by the backend write handler before the response was sent, `loadPosts()` hits the database and returns the up-to-date list immediately — respecting the declared TTL contract without any artificial delays or client-side state patching.

### 5. JWT admin auth — client-side only

The JWT token is held in React state (`useState`). It is never written to `localStorage` or cookies. Refreshing the page requires re-authenticating. This is intentional for a dev/internal tool — no persistent session management is needed.

---

## Project Structure

```
feed_frontend_project/
├── app/
│   ├── layout.jsx          # Root layout: nav bar + centred max-w-3xl main
│   ├── page.jsx            # / — live feed with Socket.IO and pagination
│   ├── admin/
│   │   └── page.jsx        # /admin — token gate + full CRUD dashboard
│   └── globals.css         # Tailwind v3 directives (@tailwind base/components/utilities)
├── components/
│   ├── FeedCard.jsx        # Single post card; isNew prop adds ring + "New" badge
│   └── PostForm.jsx        # Reusable create/edit form with char counters
├── lib/
│   ├── api.js              # fetch wrappers for all backend endpoints
│   └── socket.js           # socket.io-client singleton
├── next.config.mjs         # Minimal Next.js config (no custom options needed)
├── tailwind.config.js      # Tailwind v3 content paths
├── postcss.config.mjs      # tailwindcss + autoprefixer (v3 plugin pattern)
├── package.json
└── .env.local              # NEXT_PUBLIC_API_URL (gitignored)
```

---

## Pages & Components

### `app/layout.jsx` — Root Layout

- Renders a fixed nav bar with the "Syncup" brand link (`/`) and an "Admin" link (`/admin`).
- Wraps `{children}` in a `max-w-3xl mx-auto` container.
- Imports `globals.css` (Tailwind base styles).

### `app/page.jsx` — Live Feed (`/`)

| Feature | Detail |
|---|---|
| Initial load | `getFeed(page, 20)` on mount and on page change |
| Realtime updates | `feed:new` socket event prepends the post and highlights it for 4 s |
| Missed-post recovery | `sync` + `feed:catchup` after navigation-away (see Realtime Strategy) |
| Connection indicator | Green "Live" / red "Disconnected" dot in the header |
| Cache source badge | Displays `db` or `cache` from `meta.source` |
| Deduplication | `seenEventIds` ref prevents double-rendering of the same `feed:new` event |
| Pagination | Previous / Next buttons; hidden when only one page |
| Skeleton loading | Pulse placeholders during `loadFeed` |

### `app/admin/page.jsx` — Admin Dashboard (`/admin`)

**Token gate** — rendered before the dashboard:
- "Get Dev Token" button hits `GET /dev/token` (localhost only).
- Manual paste field for production tokens.
- Token held in React state only; lost on refresh.

**Dashboard features:**

| Feature | Detail |
|---|---|
| Create post | Inline form toggled by "+ New Post" button; calls `POST /api/feed` |
| Edit post | Modal pre-filled with existing values; calls `PUT /api/feed/:id` |
| Delete post | Confirmation modal; calls `DELETE /api/feed/:id` |
| Edit/Delete buttons | Visible on card hover (`opacity-0 group-hover:opacity-100`) |
| Flash notifications | 3-second dismissing toast (top-right, emerald on success) |
| Validation errors | Inline red banners for 422 responses from the backend |
| Pagination | Same Previous / Next pattern as home page |
| Post list | Uses `FeedCard` (read-only display) |

After every successful mutation the dashboard calls `loadPosts(page)`. Because the backend invalidates the Redis cache before responding, this fetch always returns fresh data.

### `components/FeedCard.jsx`

Stateless display card. Props:

| Prop | Type | Description |
|---|---|---|
| `post` | object | `{ id, title, content, author, created_at }` |
| `isNew` | boolean | When `true`: indigo ring border + "New" badge for 4 s |

Date is formatted as `"May 19, 10:45 AM"` using `toLocaleString('en-US', ...)`.

### `components/PostForm.jsx`

Controlled form used for both create and edit. Props:

| Prop | Type | Description |
|---|---|---|
| `initial` | object | Pre-fills fields when editing (`{ title, content, author, id }`) |
| `onSubmit` | function | Called with `{ title, content, author }` on submit |
| `onCancel` | function | Optional; renders Cancel button when provided |
| `loading` | boolean | Disables submit button and shows "Saving..." |

Field constraints match backend validators: title <= 200 chars, content <= 5000 chars, author <= 100 chars. Character counters displayed below title and content fields.

---

## Realtime Strategy

```
Backend                              Frontend (app/page.jsx)
───────                              ───────────────────────
                                     mount → loadFeed(1)
                                             └─ GET /api/feed  (Redis or DB)
                                             └─ setFeed(res.data)
                                             └─ if lastSeenAt → emit('sync', { lastSeenAt })
                                             └─ lastSeenAt = res.data[0].created_at

POST /api/feed
  → DB insert
  → Redis invalidate all feed:list:* keys
  → io.emit('feed:new', { eventId, data })
                              <────────────── onFeedNew({ eventId, data })
                                               dedup via seenEventIds ref
                                               setFeed(prev => [data, ...prev])
                                               lastSeenAt = data.created_at
                                               highlight for 4 s

User navigates to /admin → component unmounts, socket listeners removed
User navigates back  to / → component remounts

                                     mount → loadFeed(1)
                                             └─ GET /api/feed  (may be cached)
                                             └─ setFeed(res.data)
                                             └─ emit('sync', { lastSeenAt })
                         ──────────────────>  DB query: created_at > lastSeenAt
                         <── feed:catchup ──  { data: [...missed posts] }
                                               deduplicate vs. existing feed
                                               prepend missed posts
```

**Why not just refetch from DB every time?** Bypassing Redis entirely on every remount would defeat the cache. The `sync`/`feed:catchup` path queries the DB directly (no cache) only for the delta — posts created since `lastSeenAt` — which is typically a small set. Everything older is served from cache as normal.

---

## Caching Behaviour

| Operation | Cache effect |
|---|---|
| `GET /api/feed` | Served from Redis if available; falls back to DB and re-caches |
| `POST /api/feed` | Backend invalidates all `feed:list:*` keys before responding |
| `PUT /api/feed/:id` | Same — full cache invalidation |
| `DELETE /api/feed/:id` | Same — full cache invalidation |

Cache TTL is declared in the backend's `.env` as `CACHE_TTL_SECONDS` (default 300 s). The frontend makes no assumptions about the TTL value — it simply calls `loadPosts()` after a write, relying on the backend to have already cleared the cache before sending the success response.

---

## API Integration

All calls go through `lib/api.js`. Base URL is read from `NEXT_PUBLIC_API_URL`.

| Function | Method | Auth | Description |
|---|---|---|---|
| `getFeed(page, limit)` | `GET /api/feed` | None | Paginated feed list |
| `createPost(token, body)` | `POST /api/feed` | Bearer | Create new post |
| `updatePost(token, id, body)` | `PUT /api/feed/:id` | Bearer | Partial update |
| `deletePost(token, id)` | `DELETE /api/feed/:id` | Bearer | Delete post |
| `getDevToken()` | `GET /dev/token` | None | Dev-only JWT shortcut |

Response shape from `GET /api/feed`:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Hip hinge mechanics",
      "content": "Keep a neutral spine...",
      "author": "Coach Ravi",
      "created_at": "2026-05-19T10:45:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "source": "cache"
  }
}
```

---

## Environment Variables

Create `.env.local` in the project root (already gitignored via `.gitignore`):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

In production replace with the deployed backend URL. The `NEXT_PUBLIC_` prefix makes the variable available in browser-side code.

---

## Getting Started

**Prerequisites:** Node 18+ (tested on 18.20.4), backend running on port 4000.

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:3000

# Production build
npm run build
npm start
```

**The backend must be running first.** The frontend has no fallback UI for a missing backend beyond an error banner on the feed page.

### Admin login (local dev)

1. Navigate to `http://localhost:3000/admin`.
2. Click **Get Dev Token (localhost only)** — hits `GET /dev/token` on the backend and auto-fills the token.
3. Alternatively paste a valid JWT into the manual input and click **Login**.

---

## Key Assumptions

1. **Single admin role.** There is no user login or role system. Anyone with a valid JWT token has full CRUD access. Token generation for production is out of scope for this frontend.

2. **No optimistic updates.** All mutations wait for the HTTP response before updating the UI. Given the expected low-latency local/intranet deployment, this is sufficient.

3. **Page size is fixed at 20.** The `LIMIT` constant in `app/page.jsx` is not user-configurable. It matches the backend's `defaultLimit`.

4. **Single-tab realtime.** The socket singleton lives at module scope in the browser. Opening the same app in two tabs creates two independent sockets — both receive broadcasts correctly, but `lastSeenAt` is not shared across tabs.

5. **Admin token is session-only.** The JWT is held in React state. Refreshing the admin page clears it and requires re-authentication. `localStorage` was deliberately not used to avoid token persistence in shared environments.

6. **Backend cache invalidation is authoritative.** The frontend never waits a fixed duration before refetching. It trusts that the backend has invalidated Redis before sending the success response, so `loadPosts()` immediately after a mutation always returns current data.

7. **No SSR / RSC.** All pages are `'use client'`. Server components were not used because the data source is a third-party Express API that requires `fetch` from the browser, and realtime updates require client-side socket state.
<img width="664" height="486" alt="Screenshot 2026-05-19 at 12 34 46 AM" src="https://github.com/user-attachments/assets/92fae1a2-d59c-4001-88bf-901cf2053c26" />
<img width="1512" height="909" alt="Screenshot 2026-05-19 at 12 34 37 AM" src="https://github.com/user-attachments/assets/95379041-8eea-4c39-ac01-663647612809" />
<img width="1512" height="910" alt="Screenshot 2026-05-19 at 12 34 24 AM" src="https://github.com/user-attachments/assets/905555e8-ba17-4807-a398-50a01441912b" />
<img width="1511" height="908" alt="Screenshot 2026-05-19 at 12 34 10 AM" src="https://github.com/user-attachments/assets/bbf50bfe-b550-403e-98eb-9bb6576ec189" />
<img width="1512" height="582" alt="Screenshot 2026-05-19 at 12 33 19 AM" src="https://github.com/user-attachments/assets/3370972b-b58d-4c81-8418-92e7802118d4" />

