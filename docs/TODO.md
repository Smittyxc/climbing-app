# TODO / Remaining Work

Living tracker for what's left after the initial scaffold + migration.

Legend: `[ ]` todo, `[~]` needs verification, `[x]` done.

---

## 1. Manual steps (require GCP / a Firebase project)

- [x] Create the GCP project and attach class billing credits.
- [ ] **Firebase Auth**: add Firebase to the GCP project, enable **Email/Password**.
      Grab the web app config (`apiKey`, `authDomain`, `projectId`, `appId`).
- [ ] Generate the initial EF migration **before** deploying (see §2).
- [~] Provision project resources via Terraform (see `docs/terraform.md`) —
      M0–M6 applied and verified 2026-11-11 (APIs, registry, bucket, Cloud SQL +
      secret, SAs/IAM, both Cloud Run services + invoker grants). M7 (Cloud Build)
      remains.
- [ ] Create two Cloud Build triggers on the repo (path-filtered so web/doc commits
      don't rebuild images). Include each service's own build config in its filter —
      otherwise editing the yaml won't fire its own build:
      - API: `includeGlobs` = `apps/api/**`, `infra/cloudbuild-api.yaml`
        -> config `infra/cloudbuild-api.yaml`
      - ML:  `includeGlobs` = `apps/ml/**`, `infra/cloudbuild-ml.yaml`
        -> config `infra/cloudbuild-ml.yaml`
      `apps/web/**` deploys via Vercel and needs no trigger. Note: path filters only
      gate *whether* a build runs; Cloud Build still uploads the whole repo as the
      build source, but the docker build contexts (`apps/api/`, `apps/ml/`) keep the
      images properly separated. Path-filtered changes that bypass a filter
      (e.g. editing only a yaml) can be deployed manually with
      `gcloud builds submit --config infra/cloudbuild-<api|ml>.yaml`.
- [ ] Deploy `apps/web` to Vercel with `VITE_FIREBASE_*` + `VITE_API_BASE_URL=<API URL>`.
- [ ] Set the API `AllowedOrigins` to the Vercel origin (currently `*` from provisioning).
- [ ] Confirm the API service account can sign URLs (`roles/iam.serviceAccountTokenCreator`
      — granted by `provision.sh`); if images 403, that's the cause.

## 2. Verify locally (.NET SDK installed; build is green)

> `dotnet restore && dotnet build` now succeeds on **.NET 10** after: renaming the model
> `Route` -> `ClimbRoute` (CS0104: ambiguous with `Microsoft.AspNetCore.Routing.Route`
> from implicit web usings), fixing `app.Run()` return handling in Program.cs, and
> reading email from the JWT `email` claim (`FirebaseToken` has no `Email` property;
> use `Claims.TryGetValue`).

Local Postgres (server + psql client are both inside the image; removed on stop):
```bash
docker run -d --rm --name climbing-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

- [x] `cd apps/api && dotnet restore && dotnet build` — clean build, 0 warnings/errors.
- [~] `dotnet ef migrations add InitialCreate` — generates `Migrations/` + model snapshot.
      Inspect the generated `route_holds.type` column (text), the `holds` columns, and the
      new `fk_boards_users_user_id` / `fk_routes_users_user_id` constraints (Restrict).
- [~] `dotnet ef database update` against the Docker Postgres; run the API and hit
      `/health`, `/scalar`, `/openapi/v1.json` (no auth required on those routes).
- [~] `--migrate-only` mode: exits 0 with migrations applied, exits 1 when none exist
      (the Cloud Build migrate job depends on this behavior).
- [x] EF Core 10 + `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 resolve (build green).
- [x] `Google.Cloud.Storage.V1` **4.16.0** compiles on net10 (runtime behavior verified
      post-deploy in §4; 5.0.0 evaluation stays in §5).
- [~] Verify Scalar UI renders at `/scalar` and the OpenAPI doc lists snake_case schemas.

## 3. Verify once ML dependencies are installed

> `torch`/`ultralytics`/`sahi` were not installed here, so only `py_compile` was run.

- [ ] `pip install -r requirements.txt` (CPU torch from the PyTorch index).
- [~] `INFERENCE_MODE=yolo uvicorn app.main:app --port 8081`, POST a test image to
      `/detect`, verify response shape: `{ image_width, image_height, mode, holds[] }` with
      normalized `x_center/y_center/width/height`.
- [~] `INFERENCE_MODE=sahi ...` and confirm `sahi` slices correctly and `bbox.to_xywh()`
      normalization matches. (SAHI path is entirely unverified.)
- [~] Sanity-check the large-box filter threshold (0.04) against real detections.
- [ ] Keep `min-instances=0` for now; set **`min-instances=1` on the ML service just
      before the class demo** to avoid ~10-20s torch cold starts (small cost; revert after).

## 4. Deployed-system verification

- [ ] **Full authed E2E flow** (moved from §2): signup -> upload image -> holds persisted
      -> build route -> view route — exercised against the deployed API with a real
      Firebase user; this is the first run of the upload/detect path anywhere.
- [ ] Upload a real wall photo end-to-end; ensure the signed image URL loads in the browser
      (bucket CORS + signing both working).
- [ ] Cloud SQL connectivity over the unix socket (`/cloudsql/...`).
- [ ] Confirm ML is **not** publicly reachable (`--no-allow-unauthenticated`) and the API
      invokes it successfully via the metadata ID token.
- [ ] CORS from the deployed Vercel origin (not `*`) after you tighten `AllowedOrigins`.

## 5. Follow-ups / cleanups (not blocking)

- [ ] Remove unused `getBoardById` from `apps/web/src/api/queries.ts`.
- [ ] Decide on a native Postgres `hold_type` enum vs the current text column
      (text was chosen to avoid unverifiable Npgsql enum annotation codegen).
- [ ] Add tests:
      - API: xUnit + `WebApplicationFactory` for controller/service behavior.
      - ML: pytest for the detector (both modes) with a fixture image.
      - Web: Vitest for `api.ts`/`queries.ts`; Playwright for the upload -> route flow.
- [ ] Consider `openapi-typescript` + `openapi-fetch` to generate frontend types from the
      API's OpenAPI doc and catch contract drift at compile time (was offered, deferred).
- [ ] Evaluate `Google.Cloud.Storage.V1` 5.0.0 (major) — currently pinned to 4.16.0.
- [ ] Add request validation (FluentValidation) and a rate limit / max upload size guard
      beyond the `[RequestSizeLimit(25_000_000)]` on board upload.
- [ ] Structured logging / OpenTelemetry for Cloud Run.
- [ ] Consider hosting the SPA on GCS+CDN instead of Vercel (keeps everything in one cloud).
- [ ] Make route-hold saving atomic: add `PUT /api/routes/{id}/holds` that replaces holds in
      one EF transaction; update `RouteBuilderPage` to use it instead of update + delete + add.
- [x] Referential integrity for `user_id`: the auth middleware guarantees the `users` row
      exists (calls `GetOrCreateAsync` on every authenticated request), and
      `boards.user_id`/`routes.user_id` now FK to `users(id)` (`Restrict` delete).
      Verify the FK DDL when generating `InitialCreate` (see §2).
- [ ] Set explicit `--cpu`/`--memory` on the API Cloud Run deploy step (currently defaults).

---

## 6. Data migration & operations

- [ ] **Supabase data migration** (only if you want existing data). Blockers:
      - identity: Supabase UUIDs -> Firebase UIDs (create Firebase users, keep a mapping,
        rewrite `user_id`).
      - holds: absolute pixels -> normalized; requires each image's pixel dimensions.
        Old `app_data.json` stores `[x, y, w, h]` absolute; convert to
        `x_center = (x + w/2) / image_width`, etc.
      - the old `users` table has no email; it comes from Firebase.
      For a class project, **starting fresh** is the low-risk option.
- [ ] **Migrations in CI:** the Cloud Build pipeline now runs migrations via a one-off
      Cloud Run Job (`climbing-api-migrate`) before deploying (`infra/cloudbuild-api.yaml`).
      Verify the Cloud Build SA can create/execute Run Jobs (`roles/run.admin` or
      `run.jobs.*` + `iam.serviceAccountUser` on `api-service-account`).
- [ ] Note: `provision.sh` rotates the DB password on each run — redeploy the API after
      re-running it, or existing revisions fail DB auth.
- [ ] Disable OpenAPI + Scalar (`/openapi/v1.json`, `/scalar`) in production, or protect them.

---

## .NET 10 upgrade notes (already applied)

The API was moved to **.NET 10** (current LTS):

- `TargetFramework` -> `net10.0`; Docker base images -> `sdk:10.0` / `aspnet:10.0`.
- EF Core packages -> **10.0.13** (`Microsoft.EntityFrameworkCore.Design`).
- `Npgsql.EntityFrameworkCore.PostgreSQL` -> **10.0.3**.
- `FirebaseAdmin` -> **3.7.0**; `Google.Cloud.Storage.V1` -> **4.16.0**.
- **OpenAPI**: replaced `Swashbuckle.AspNetCore` with the built-in
  `Microsoft.AspNetCore.OpenApi` (**.NET 9+ standard**) plus `Scalar.AspNetCore` for the UI:
  - `AddSwaggerGen()` -> `AddOpenApi()`
  - `app.UseSwagger()/UseSwaggerUI()` -> `app.MapOpenApi()` + `app.MapScalarApiReference()`
  - UI now at `/scalar`, document at `/openapi/v1.json`.

No application-code changes were required beyond the OpenAPI swap; the EF Core, Npgsql,
FirebaseAdmin, and GCS usages are unchanged between 8 and 10 for this project.
