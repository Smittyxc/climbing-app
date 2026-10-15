# TODO / Remaining Work

Living tracker for what's left after the initial scaffold + migration.

Legend: `[ ]` todo, `[~]` needs verification, `[x]` done.

---

## 1. Manual steps (require GCP / a Firebase project)

- [ ] Create the GCP project and attach class billing credits.
- [ ] **Firebase Auth**: add Firebase to the GCP project, enable **Email/Password**.
      Grab the web app config (`apiKey`, `authDomain`, `projectId`, `appId`).
- [ ] Generate the initial EF migration **before** deploying (see §2).
- [ ] Run `./infra/provision.sh <PROJECT_ID> us-east1`.
- [ ] Create Cloud Build triggers (path-filtered):
      `apps/api/**` -> `infra/cloudbuild-api.yaml`, `apps/ml/**` -> `infra/cloudbuild-ml.yaml`.
- [ ] Deploy `apps/web` to Vercel with `VITE_FIREBASE_*` + `VITE_API_BASE_URL=<API URL>`.
- [ ] Set the API `AllowedOrigins` to the Vercel origin (currently `*` from provisioning).
- [ ] Confirm the API service account can sign URLs (`roles/iam.serviceAccountTokenCreator`
      — granted by `provision.sh`); if images 403, that's the cause.

## 2. Verify once the .NET SDK is available

> The API could **not** be compiled in this environment (no .NET SDK). Type-correctness was
> reviewed by hand only. Run these first.

- [~] `cd apps/api && dotnet restore && dotnet build` — expect a clean build on **.NET 10**.
- [~] `dotnet ef migrations add InitialCreate` — generates `Migrations/` + model snapshot.
      Inspect the generated `route_holds.type` column (text) and the `holds` columns.
- [~] `dotnet ef database update` against a local Postgres; run the API and hit `/healthz`,
      `/scalar`, `/openapi/v1.json`.
- [~] Confirm the `RouteHoldConfiguration` enum `HasConversion` compiles under EF Core 10
      (nullable enum <-> string). If the two-expression overload is ambiguous, switch to an
      explicit `ValueConverter<HoldType?, string?>`.
- [~] Confirm EF Core 10 + `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 resolve together.
- [~] Verify `Google.Cloud.Storage.V1` **4.16.0** works on net10 (5.0.0 exists — decide
      whether to bump; see §5).
- [~] Verify Scalar UI renders at `/scalar` and the OpenAPI doc lists snake_case schemas.
- [~] Confirm `FirebaseAuthMiddleware` behaves with ADC locally
      (`GOOGLE_APPLICATION_CREDENTIALS` set) and returns 401 without a token.
- [~] End-to-end smoke test against a local ML service:
      signup -> upload image -> holds persisted -> build route -> view route.

## 3. Verify once ML dependencies are installed

> `torch`/`ultralytics`/`sahi` were not installed here, so only `py_compile` was run.

- [ ] `pip install -r requirements.txt` (CPU torch from the PyTorch index).
- [~] `INFERENCE_MODE=yolo uvicorn app.main:app --port 8081`, POST a test image to
      `/detect`, verify response shape: `{ image_width, image_height, mode, holds[] }` with
      normalized `x_center/y_center/width/height`.
- [~] `INFERENCE_MODE=sahi ...` and confirm `sahi` slices correctly and `bbox.to_xywh()`
      normalization matches. (SAHI path is entirely unverified.)
- [~] Sanity-check the large-box filter threshold (0.04) against real detections.
- [ ] Consider `min-instances=1` on the ML service to avoid ~10-20s torch cold starts during
      the demo (costs a small amount; see §5).

## 4. Deployed-system verification

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
