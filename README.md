# Climbing App

Automated climbing-hold detection and route-setting platform. Upload a photo of a
climbing wall, an ML model detects the holds, and you build routes on top. Migrated
from a Supabase-backed SPA + local ML scripts to a serverless Google Cloud stack.

## Architecture

```
[ React SPA (Vercel) ]  --Firebase Auth (client SDK) + Bearer ID token-->
        |
        v
[ Cloud Run: climbing-api ]  ASP.NET Core 10 (C#), EF Core
        |  \___ image bytes / POST /detect (IAM-authenticated) ___> [ Cloud Run: climbing-ml ]
        |                                                             Python FastAPI, YOLO or SAHI
        v
[ Cloud SQL: PostgreSQL ]        [ Cloud Storage: board-images ]
```

**GCP services:** Cloud Run (api + ml), Cloud SQL for PostgreSQL, Cloud Storage,
Cloud Build, Artifact Registry. **Plus Firebase Auth** for identity.

See [`PLAN.md`](./PLAN.md) for the full migration plan and design decisions.

## Documentation

- [`docs/backend.md`](./docs/backend.md) — API + ML architecture, data model, endpoints, env vars
- [`docs/frontend.md`](./docs/frontend.md) — SPA structure, data layer, auth, pages, features
- [`docs/TODO.md`](./docs/TODO.md) — remaining setup steps and what to verify with an SDK
- [`docs/security.md`](./docs/security.md) — ingress/port lockdown, firewalls, IAM, and hardening checklist

## Repo layout

```
apps/
  web/   React SPA (Vite, TanStack Query, Konva)
  api/   ASP.NET Core 10 REST API (EF Core, FirebaseAdmin, GCS)
  ml/    Python FastAPI detector (Ultralytics YOLO / SAHI)
infra/
  provision.sh         first-time GCP provisioning + deploy
  cloudbuild-api.yaml
  cloudbuild-ml.yaml
```

## How it works

1. The SPA authenticates with Firebase Auth and calls the API with the ID token.
2. `POST /api/boards` (multipart) streams the image to GCS, calls the ML service's
   `POST /detect`, then stores the board + detected holds in Cloud SQL and returns
   them with a signed image URL — one round trip.
3. Holds are stored **normalized** (`x_center, y_center, width, height` in 0..1) plus
   `confidence`; `boards` store the image's pixel dimensions. The canvas converts to
   pixels at render time.
4. Routes are `routes` + `route_holds` (hold `type`: `start | hand | foot | end | unassigned`).

## Local development

### Prerequisites
- .NET SDK 10, Node 20+, Python 3.11+, [Docker](https://www.docker.com/) (optional)
- A Firebase project with **Email/Password** auth enabled
- `gcloud` CLI authenticated (for Cloud SQL / GCS access) — or run with local stand-ins

### 1. ML service
```bash
cd apps/ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
INFERENCE_MODE=yolo uvicorn app.main:app --port 8081
# SAHI:  INFERENCE_MODE=sahi uvicorn app.main:app --port 8081
```
`INFERENCE_MODE` selects the inference path: `yolo` (default, direct Ultralytics
predict) or `sahi` (sliced inference). Both emit identical normalized output.

### 2. API service
```bash
cd apps/api
dotnet restore
dotnet tool install --global dotnet-ef   # once
dotnet ef migrations add InitialCreate   # generates Migrations/ + the model snapshot
# Point CLOUD_SQL_* at a local Postgres (see appsettings.Development.json for defaults)
RUN_MIGRATIONS=true dotnet run
```
Environment (see `appsettings.Development.json` for local defaults):
`GCS_BUCKET_NAME`, `CLOUD_SQL_*` (or `DATABASE_CONNECTION_STRING`), `ML_SERVICE_URL`,
`FIREBASE_PROJECT_ID`, `AllowedOrigins`, `RUN_MIGRATIONS`, `SIGNED_URL_TTL_MINUTES`.
Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key for GCS/Firebase locally.

### 3. Web app
```bash
cd apps/web
npm install
cp .env.example .env   # fill in VITE_FIREBASE_* and VITE_API_BASE_URL
npm run dev
```

## Deploying to GCP

```bash
gcloud auth login
./infra/provision.sh <PROJECT_ID> [REGION]   # REGION defaults to us-east1
```

This enables APIs, creates the bucket (+CORS), Cloud SQL instance, DB user + Secret
Manager secret, Artifact Registry repo, and service accounts; builds and deploys both
Cloud Run services; then wires the ML URL into the API.

Notes:
- **Firebase Auth** must be set up in the Firebase console (add Firebase to the GCP
  project, enable Email/Password). The API verifies tokens with `FirebaseAdmin` via
  Application Default Credentials, so no key file is needed on Cloud Run.
- The API service account is granted `roles/iam.serviceAccountTokenCreator` so GCS
  **signed URLs** can be generated on Cloud Run.
- **Migrations** run in the Cloud Build pipeline: each `apps/api/**` deploy applies EF
  migrations via a one-off **Cloud Run Job** (`climbing-api-migrate`, same image/SA/socket
  as the API) before the new revision serves traffic. Generate migrations locally
  (`dotnet ef migrations add ...`) and commit them first. `RUN_MIGRATIONS=true` remains
  for local dev only.
- Wire the frontend: build `apps/web` on Vercel with `VITE_API_BASE_URL=<API URL>` and
  add your Vercel origin to the API's `AllowedOrigins`.

### CI/CD
Create Cloud Build triggers (path-filtered) pointing at:
- `apps/api/**` → `infra/cloudbuild-api.yaml`
- `apps/ml/**`  → `infra/cloudbuild-ml.yaml`

## Env vars

| Service | Vars |
|---------|------|
| api | `FIREBASE_PROJECT_ID`, `GCS_BUCKET_NAME`, `CLOUD_SQL_CONNECTION_NAME`/`DATABASE_CONNECTION_STRING`, `CLOUD_SQL_DB`, `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD` (secret), `ML_SERVICE_URL`, `AllowedOrigins`, `RUN_MIGRATIONS`, `SIGNED_URL_TTL_MINUTES` |
| ml  | `INFERENCE_MODE` (`yolo`/`sahi`), `YOLO_CONF`, `SAHI_CONF`, `IMGSZ`, `MAX_BOX_AREA_FRACTION`, `MODEL_PATH` |
| web | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_API_BASE_URL` |

## Known gaps & caveats

Things worth knowing before you deploy. (Actionable items are tracked in `docs/TODO.md`.)

- **No data migration from Supabase.** Existing users, boards, routes, and holds are *not*
  carried over. Two blockers: identity changes from Supabase UUIDs → Firebase UIDs, and
  holds change from absolute pixels → **normalized** coordinates (which requires each
  image's pixel dimensions). Either start fresh or write a one-off backfill. Importing old
  `app_data.json` (`[x, y, w, h]` absolute) needs a conversion to normalized centers.
- **Migrations run in CI, not at startup.** The Cloud Build pipeline deploys a one-off
  Cloud Run Job (`climbing-api-migrate`) and waits for it before deploying the new API
  revision. `RUN_MIGRATIONS` stays available for local dev.
- **`provision.sh` rotates the DB password on every run** (new secret version + new DB user
  password). A running API revision keeps the *old* password until it redeploys, so re-runs
  can cause transient DB connection failures. Re-run it intentionally.
- **`users.default_board_id` FK** is `ON DELETE SET NULL` (matches the original schema).
  This is an *active-board preference*, not a one-board limit — users own many boards.
- **OpenAPI + Scalar UI (`/openapi/v1.json`, `/scalar`) are publicly reachable** and
  unauthenticated — minor info disclosure. Consider disabling them in production.
- **CORS `*`** (set by provisioning) is safe with Bearer-token auth but would break if you
  switch to cookie-based sessions. Tighten it to the Vercel origin (`docs/security.md` §8).
- **Model weights are committed to git** (`apps/ml/best4.pt`, ~5 MB) and baked into the ML
  image. Fine at this size; move to a weights store if it grows.
- **`SAHI` inference mode is unverified** here (torch/sahi not installed). Validate before
  demoing that mode.
- **Untested:** no automated tests yet for any service (see `docs/TODO.md` §5). The API was
  also not compiled in this environment (no .NET SDK).
- **Frontend bundle** is >500 kB (Vite warning, mostly Konva/shadcn/recharts); not blocking.
- **Uploads aren't content-type validated** beyond size — see `docs/security.md` §9.
- **Saving a route is non-transactional.** `RouteBuilderPage` updates the route, deletes its
  holds, then re-inserts them as **three separate HTTP calls**. If the last call fails, the
  route is left with no holds. Prefer a single `PUT /api/routes/{id}/holds` that replaces
  holds inside one EF transaction.
- **Referential integrity on `user_id` is enforced.** `boards.user_id` / `routes.user_id`
   FK to `users(id)` (EF `Restrict` delete). The auth middleware guarantees the `users`
   row exists on every authenticated request, so inserts can't reference a missing profile.
- **API Cloud Run resources are defaults** (no `--cpu`/`--memory` set in the API deploy
  step), unlike the ML service (2 vCPU / 4 GiB). Bump if upload/inference proxying is heavy.

## Differences from the original Supabase app

- Auth: Supabase email/password → **Firebase Auth**; profile row created by the API
  (replaces the `handle_new_user()` trigger). `users.id`/`*.user_id` are Firebase UIDs.
- Storage: Supabase Storage → **GCS**, served via signed URLs.
- DB: Supabase Postgres → **Cloud SQL**. RLS removed; ownership enforced in the API.
- Holds: absolute pixels (`coord_a..d`) → **normalized** `x_center/y_center/width/height`
  + `confidence`, with `boards.image_width/image_height`.
- Hold uploads: manual JSON file upload → **automatic detection** on image upload.
