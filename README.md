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

## Repo layout

```
apps/
  web/   React SPA (Vite, TanStack Query, Konva)
  api/   ASP.NET Core 10 REST API (EF Core, FirebaseAdmin, GCS)
  ml/    Python FastAPI detector (Ultralytics YOLO / SAHI)
infra/
  terraform/           Terraform config (project resources, milestones in docs/terraform.md)
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

## Deploying to GCP

Infrastructure is provisioned with **Terraform** (`infra/terraform/` — milestone-by-
milestone guide in `docs/terraform.md`), and pushes to `main` deploy automatically via
Cloud Build triggers (`infra/cloudbuild-*.yaml`). First-time setup steps live in
`docs/terraform.md` §0–§2.

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
