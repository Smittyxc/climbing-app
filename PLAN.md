# Climbing App — Google Cloud Migration Plan

Migrates the Supabase-backed React SPA (`climbing_hold_ml`) and the local ML research
scripts (`climbing_hold_identification`) into a single cloud application.

## Architecture

```
[ React SPA (Vercel) ]
        │  Firebase Auth (client SDK)          ┌──────────────────────┐
        │  REST + Bearer ID token              │  Cloud Run: API      │
        ├─────────────────────────────────────►│  ASP.NET Core 10 (C#) │
        │                                      └──────┬───────┬───────┘
        │                             image bytes /       │ Cloud SQL client
        │                             POST /detect        ▼
        │                                      │   [ Cloud SQL: PostgreSQL ]
        │                                      ▼
        │                               ┌──────────────────────┐
        │                               │  Cloud Run: ML       │
        │                               │  Python FastAPI      │
        │                               │  YOLO / SAHI         │
        │                               │  (internal ingress)  │
        │                               └──────────────────────┘
        │  image URL
        │◄──── GCS signed/public URLs ──── [ Cloud Storage: board-images ]
```

## GCP Services (5)

| # | Service | Role |
|---|---------|------|
| 1 | Cloud Run (×2 services) | `api` — ASP.NET Core 10 REST API. `ml` — Python FastAPI inference (YOLO or SAHI, selected by `INFERENCE_MODE` env var). ML is internal-only, invoked by API via IAM. |
| 2 | Cloud SQL for PostgreSQL | Replaces Supabase DB. No RLS — ownership enforced in API queries (`WHERE user_id = @uid`). |
| 3 | Cloud Storage | Replaces Supabase Storage. `board-images` bucket, wall photos + image URLs. |
| 4 | Cloud Build | CI/CD. Path-filtered GitHub triggers: `apps/api/**`, `apps/ml/**`. |
| 5 | Artifact Registry | Docker images tagged with Git SHA. |

Plus **Firebase Auth** (email/password, free tier) replacing Supabase Auth.

## Repo Layout

```
apps/
  web/    React SPA (migrated from climbing_hold_ml)
  api/    ASP.NET Core 10 (C#) — controllers, FirebaseAdmin, GCS, Cloud SQL
  ml/     Python FastAPI — best4.pt, INFERENCE_MODE=yolo|sahi
infra/
  sql/schema.sql        Cloud SQL schema (ported from supabase/migrations)
  cloudbuild-api.yaml
  cloudbuild-ml.yaml
  provision.sh          gcloud provisioning script
```

## Schema Deltas from Supabase

- `users.id` / `boards.user_id`: Firebase UIDs (`text` PK) instead of `auth.users` FKs.
  Profile row created by the API after signup (replaces `handle_new_user()` trigger).
- `holds`: replaced absolute-pixel `coord_a..coord_d` with normalized
  `x_center, y_center, width, height` (0–1) + `confidence`.
- `boards` gains `image_width` / `image_height` (pixels, from detector) so normalized
  coordinates can be rendered at natural image size.
- All RLS policies dropped; ownership checks live in API SQL.
- `hold_type` enum and `route_holds` join table carried over unchanged.

## Data Flows

1. **Upload & detect:** `POST /api/boards` (multipart) → API streams image to GCS →
   API calls ML `POST /detect` (internal, IAM-authenticated) → ML returns normalized
   boxes + pixel dims → API inserts `boards` + bulk `holds` → returns board + holds +
   image URL in one round trip (rollback on failure).
2. **Route building:** same as before — Konva canvas, click holds to cycle
   `unassigned → start → hand → foot → end`, save as `routes` + `route_holds`.
3. **Auth:** Firebase client SDK → ID token → `Authorization: Bearer` → API verifies
   via `FirebaseAdmin`, resolves/creates `users` profile row.

## Frontend Changes

- `supabase-js` removed; `firebase` client SDK for auth; typed fetch client for API.
- `BoardBuilderPage`: JSON file upload removed; single upload mutation.
- `KonvaDisplay`: renders normalized coords × natural image size.
- Hosting stays on Vercel; CORS allowlist on the API (Vercel prod origin + localhost dev).

## Deployment

- `infra/provision.sh <PROJECT_ID> <REGION>` — enables APIs, creates bucket (+CORS),
  Cloud SQL instance + schema, Artifact Registry repos, service accounts + IAM,
  deploys both Cloud Run services (first deploy).
- Cloud Build triggers (path-filtered) handle subsequent deploys on push.
- Frontend: `apps/web` → Vercel (existing flow).

## Env Vars

| Service | Vars |
|---------|------|
| api | `FIREBASE_PROJECT_ID`, `GCP_PROJECT_ID`, `GCS_BUCKET_NAME`, `CLOUD_SQL_DB`, `CLOUD_SQL_USER`, `CLOUD_SQL_PASSWORD` (secret), `ML_SERVICE_URL`, `AllowedOrigins` |
| ml | `INFERENCE_MODE=yolo\|sahi` (default `yolo`), `YOLO_CONF`, `MODEL_PATH` |
| web | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_API_BASE_URL` |
