# Frontend Architecture

Single-page React app (Vite) that talks to the ASP.NET API with a Firebase ID token.
Migrated from a Supabase-backed app; no Supabase code remains.

---

## Stack

- **React 19** + **react-router-dom 7** (data router)
- **Vite 6** + **TypeScript 5.7** (strict), **Tailwind 4**
- **shadcn/ui** + Radix primitives
- **TanStack Query 5** — all server state (queries + mutations)
- **react-konva / konva** — the interactive wall canvas
- **Firebase 11** — auth only (client SDK)
- **sonner** — toasts; **lucide-react** — icons

## Directory structure

```
src/
  config.ts                  Firebase config + API base URL (from VITE_* env)
  main.tsx                   entry (RouterProvider)
  Providers.tsx              QueryClientProvider + SessionProvider + Toaster
  context/SessionContext.tsx Firebase auth state, defaultBoard, signOutUser
  lib/
    firebase.ts              initializeApp + getAuth
    api.ts                   typed fetch client (attaches Bearer token)
    db_types.ts              domain types (Board, Hold, Route, RouteHold, UserProfile)
    utils.ts                 cn()
  api/queries.ts             domain functions over `api` (getUserBoards, saveRoute, ...)
  router/
    index.tsx                route tree
    AuthProtectedRoute.tsx   redirects unauthenticated users + app shell
  pages/                     route components (see below)
  components/
    layout/                  sidebar, nav, mobile route builder
    ui/                      vendored shadcn primitives
```

## Data layer

Two thin layers; TanStack Query owns caching/loading/retries.

```
Page (useQuery / useMutation)
  -> api/queries.ts   named domain fns (getUserBoards, getBoardWithHolds, saveRoute, ...)
       -> lib/api.ts  api.get/post/put/patch/delete/postForm  (fetch + auth + error handling)
            -> fetch()
```

- `lib/api.ts` attaches the Firebase ID token (`getIdToken()`), parses errors into an
  `ApiError` with a `status`, and returns JSON (or `undefined` for `204`).
- `api/queries.ts` are the functions passed to TanStack Query — the pages never call
  `fetch` directly.
- **User identity is implicit:** functions like `getUserBoards()` take no user id; the API
  derives the user from the token. A client cannot request another user's data.

## Auth flow

`Providers.tsx` wraps the tree in `SessionProvider` (in `context/SessionContext.tsx`):
- `onAuthStateChanged` populates `session = { user: { id, email, user_metadata } }`.
- `getUserProfile()` (→ `GET /api/user`) returns the profile row the API upserts on first
  call; `default_board_id` populates `defaultBoard`.
- While auth/profile load, `LoadingPage` is shown.
- `signOutUser()` calls Firebase `signOut`.

`AuthPage` uses `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` +
`sendEmailVerification`, mapping Firebase `auth/*` error codes to friendly messages.

`AuthProtectedRoute` redirects to `/auth` when there's no session and renders the sidebar
shell for protected pages.

## Routing

| Path | Page | Purpose |
|------|------|---------|
| `/` | `HomePage` | public landing |
| `/auth` | `AuthPage` | login / register |
| `/protected` | `ProtectedPage` | dashboard: welcome, default-board selector, quick links |
| `/boards` | `BoardBuilderPage` | create board (upload + auto-detect) and list boards |
| `/routes` | `RoutePage` | list routes; pick a board to start a new route |
| `/routes/:boardId/:routeId` | `RouteBuilderPage` | build/edit a route (`routeId = new` to create) |
| `/climb` | `ClimbPage` | list routes sorted by grade |
| `/climb/:boardId/:routeId` | `ClimbDisplayPage` | view a route (read-only canvas) |

## Features

### Create a board — `BoardBuilderPage`
Pick a name + wall image and submit. A single mutation calls `uploadBoardAndDetect`
(`POST /api/boards`), which stores the image, runs detection, and persists holds. On
success the board list is invalidated. **No JSON file upload** — detection is automatic.

### Build a route — `RouteBuilderPage`
- Loads the board with holds (`getBoardWithHolds`) and, when editing, the route + its holds.
- Clicking a hold cycles its type: `unassigned -> start -> hand -> foot -> end`.
- Save: create (`saveRoute`) or update (`updateRoute` + `deleteRouteHolds` + `addRouteHolds`),
  then invalidate `routes` / `route` caches and navigate to `/routes`.

### View a route — `ClimbDisplayPage`
`getCompleteRoute` returns route holds joined with hold geometry; the canvas renders it in
view-only mode with a darkened mask and colored overlays.

### Canvas — `KonvaDisplay.tsx`
- Loads the image with `use-image`, scales the Konva `Stage` to fit the window.
- Holds are stored **normalized (0..1)**; `toPixels()` converts to natural-image pixels
  (`x = x_center * image.width - width / 2`, etc.). Because it uses the loaded image's
  natural size, it stays correct at any display scale.
- Active holds punch holes in a `destination-out` mask; colors: green=start, blue=hand,
  yellow=foot, red=end.

## Env vars (build-time, Vite)

| Var | Purpose |
|-----|---------|
| `VITE_FIREBASE_API_KEY` | Firebase web config (required) |
| `VITE_FIREBASE_AUTH_DOMAIN` | " |
| `VITE_FIREBASE_PROJECT_ID` | " |
| `VITE_FIREBASE_APP_ID` | optional |
| `VITE_API_BASE_URL` | API base URL (default `http://localhost:8080`) |

`config.ts` throws at startup if a required Firebase var is missing.

## Build / deploy

```bash
npm install
cp .env.example .env   # fill in VITE_*
npm run dev            # http://localhost:5173
npm run build          # tsc && vite build
npm run lint
```
Hosted on Vercel (`vercel.json` rewrites all routes to `index.html`). Set the same
`VITE_*` vars in the Vercel project; add the Vercel origin to the API's `AllowedOrigins`.

## Notes
- `getBoardById` in `api/queries.ts` is currently unused — removable.
- No test tooling is set up in this app yet (see `docs/TODO.md`).
