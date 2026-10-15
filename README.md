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
- **Migrations:** generate `Migrations/InitialCreate` before deploying (the API applies
  migrations at startup when `RUN_MIGRATIONS=true`). The first deploy sets that flag.
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

## Differences from the original Supabase app

- Auth: Supabase email/password → **Firebase Auth**; profile row created by the API
  (replaces the `handle_new_user()` trigger). `users.id`/`*.user_id` are Firebase UIDs.
- Storage: Supabase Storage → **GCS**, served via signed URLs.
- DB: Supabase Postgres → **Cloud SQL**. RLS removed; ownership enforced in the API.
- Holds: absolute pixels (`coord_a..d`) → **normalized** `x_center/y_center/width/height`
  + `confidence`, with `boards.image_width/image_height`.
- Hold uploads: manual JSON file upload → **automatic detection** on image upload.
