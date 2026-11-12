# TODO / Remaining Work

Living tracker for what's left after the Firebase + .NET rewrite and the
Terraform-provisioned deployment.

Legend: `[ ]` todo, `[~]` needs verification, `[x]` done.

---

## 1. Bring-up steps — all complete

- [x] Create the GCP project and attach class billing credits.
- [x] **Firebase Auth**: Firebase added to the GCP project, Email/Password enabled,
      web app config wired into Vercel env vars.
- [x] Generate the initial EF migration (`20261111210454_InitialCreate`), committed and
      applied to Cloud SQL by the CI migrate job.
- [x] Provision project resources via **Terraform** — M0–M7 applied and verified (see
      `docs/terraform.md`). The old `provision.sh` was deleted (git history retains it) —
      do not resurrect it: it would fight Terraform's state, e.g. by rotating the DB
      password the API is already using.
- [x] Cloud Build triggers created in the console (path-filtered):
      - API: `includeGlobs` = `apps/api/**`, `infra/cloudbuild-api.yaml`
      - ML:  `includeGlobs` = `apps/ml/**`, `infra/cloudbuild-ml.yaml`
      Both run as the dedicated `cloudbuild-trigger` SA (Terraform-managed:
      `cloudbuild.builds.builder` + `run.admin` + `serviceAccountUser` on both runtime
      SAs). Terraform-ifying the GitHub connection/triggers is a deferred exercise.
      Note: paths ending in `z` (e.g. `/healthz`) are reserved by Cloud Run's frontend
      and 404 before reaching the container — health endpoint is `/health`.
- [x] Deploy `apps/web` to Vercel with `VITE_FIREBASE_*` + `VITE_API_BASE_URL`.
- [x] API `AllowedOrigins` = `https://climbing-app-swart.vercel.app` (exact origin —
      no trailing slash; CORS origin matching is byte-exact).
- [x] GCS signed URLs verified in production (wall images load in the browser).

## 2. Local + CI verification — complete

- [x] `dotnet restore && dotnet build` — clean on .NET 10.
- [x] `dotnet ef migrations add InitialCreate` — generated + inspected
      (`route_holds.type` text, `fk_boards_users_user_id`/`fk_routes_users_user_id`
      Restrict constraints).
- [x] Migrations applied to Cloud SQL via the CI migrate job (`climbing-api-migrate`),
      verified: all five tables present. (`--migrate-only` exits 0/1 verified in CI.)
- [x] Scalar UI renders at `/scalar`; OpenAPI doc at `/openapi/v1.json` (snake_case).
- [x] EF Core 10 + Npgsql 10.0.3 + FirebaseAdmin 3.7.0 + GCS 4.16.0 on net10.

## 3. ML verification

- [x] YOLO mode verified **in production** (upload → detect flow returns normalized
      holds; boards render with detected holds).
- [ ] SAHI mode is still **entirely unverified** — either test it
      (`INFERENCE_MODE=sahi`) or pin `yolo` explicitly for the demo.
- [~] Large-box filter threshold (0.04) — real detections pass it; not yet tuned
      against a controlled sample.
- [ ] Keep `min-instances=0` for now; set **`min-instances=1` on the ML service just
      before the class demo** to avoid ~10-20s torch cold starts (small cost; revert
      after). Terraform: add `min_instance_count` to the ML scaling block.

## 4. Deployed-system verification — all verified 2026-11-12

- [x] **Full authed E2E flow**: signup → upload image → holds persisted → build route
      → view route, against the deployed API with a real Firebase user.
- [x] Signed image URLs load in the browser (bucket CORS + signing working).
- [x] Cloud SQL connectivity over the unix socket.
- [x] ML is not publicly reachable — unauthenticated `/health` → 403; API invokes it
      successfully via the metadata ID token.
- [x] CORS from the deployed Vercel origin (`AllowedOrigins` tightened from `*`).

## 5. Follow-ups / cleanups (not blocking)

- [ ] Remove unused `getBoardById` from `apps/web/src/api/queries.ts`.
- [ ] Decide on a native Postgres `hold_type` enum vs the current text column.
- [ ] Add tests:
      - API: xUnit + `WebApplicationFactory` for controller/service behavior.
      - ML: pytest for the detector (both modes) with a fixture image.
      - Web: Vitest for `api.ts`/`queries.ts`; Playwright for the upload → route flow.
- [ ] `openapi-typescript` + `openapi-fetch` to generate frontend types from
      `/openapi/v1.json` (now live) and catch contract drift at compile time.
- [ ] Evaluate `Google.Cloud.Storage.V1` 5.0.0 (major) — currently pinned to 4.16.0.
- [ ] Add request validation (FluentValidation) and a rate limit / max upload size
      guard beyond the `[RequestSizeLimit(25_000_000)]` on board upload.
- [ ] Structured logging / OpenTelemetry for Cloud Run.
- [ ] Consider hosting the SPA on GCS+CDN instead of Vercel (keeps everything in one cloud).
- [ ] Make route-hold saving atomic: add `PUT /api/routes/{id}/holds` that replaces
      holds in one EF transaction; update `RouteBuilderPage` to use it instead of
      update + delete + add.
- [ ] Set explicit cpu/memory on the API service (currently provider defaults) —
      Terraform or the yaml deploy step.
- [ ] **Terraform/CI image drift policy** (rule 4, now concrete): after CI deploys,
      `terraform plan` shows an image-digest diff on both services. Either add
      `lifecycle { ignore_changes = [template] }` to both `google_cloud_run_v2_service`
      resources, or accept and never apply service diffs. Decide once, document here.
- [ ] Consider requiring verified email before writes (security.md §7).

## 6. Data migration & operations

- [x] **Supabase data migration** — resolved: **starting fresh** (no legacy data
      migration; the old Supabase stack is fully replaced).
- [x] **Migrations in CI** — verified: the Cloud Build pipeline runs the
      `climbing-api-migrate` Cloud Run Job before deploying, and `InitialCreate`
      applied successfully.
- [x] Password-rotation hazard — obsolete: Terraform owns the DB password
      (`random_password`, stable in state); rotations are explicit (new Secret Manager
      version + API redeploy).
- [ ] Disable OpenAPI + Scalar (`/openapi/v1.json`, `/scalar`) in production, or
      protect them (e.g. only map them outside `Production` environment).

---

## 7. Remaining work — suggested order

1. **Demo-day items** (cheap, high impact): ML `min-instances=1` just before the demo;
   settle the SAHI-vs-yolo question.
2. **Security checklist** — work through `docs/security.md` §12 in order:
   ML `--ingress=internal`, Cloud SQL private IP + VPC connector, bucket
   public-access-prevention + tightened bucket CORS, IAM scoping to specific
   resources, Firebase App Check, API rate limiting, upload content-type validation,
   **billing budget + alerts (still not created!)**.
3. **§5 cleanups** in any order — the two with real correctness value are the atomic
   route-hold save and the test suite.

---

## .NET 10 upgrade notes (already applied)

The API was moved to **.NET 10** (current LTS):

- `TargetFramework` -> `net10.0`; Docker base images -> `sdk:10.0` / `aspnet:10.0`.
- EF Core packages -> **10.0.13** (`Microsoft.EntityFrameworkCore.Design`).
- Npgsql.EntityFrameworkCore.PostgreSQL -> **10.0.3**.
- FirebaseAdmin -> **3.7.0**; Google.Cloud.Storage.V1 -> **4.16.0**.
- **OpenAPI**: replaced `Swashbuckle.AspNetCore` with the built-in
  `Microsoft.AspNetCore.OpenApi` (.NET 9+ standard) plus `Scalar.AspNetCore`:
  `AddOpenApi()`/`MapOpenApi()` + `MapScalarApiReference()`;
  UI at `/scalar`, document at `/openapi/v1.json`.

No application-code changes were required beyond the OpenAPI swap; the EF Core,
Npgsql, FirebaseAdmin, and GCS usages are unchanged between 8 and 10 for this project.
