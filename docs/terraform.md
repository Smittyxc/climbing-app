# Terraform (Option A — infra as code, Cloud Build for deploys)

`infra/terraform/` replaces `infra/provision.sh` as the owner of project resources.
The Cloud Build yamls (`infra/cloudbuild-*.yaml`) stay: they are the *pipeline*
(what runs on push), while Terraform owns the *infrastructure* (what exists).

Ownership split:

| Owner | Owns |
|-------|------|
| Terraform | APIs, Artifact Registry, GCS bucket, Cloud SQL, secrets, service accounts + IAM, Cloud Run services, Cloud Build triggers |
| Cloud Build yaml | image build → migrate job → deploy per push |
| Manual (console) | project creation + billing, GitHub App install, Firebase Auth |

---

## 0. One-time bootstrap (outside Terraform) — ✅ complete 2026-11-11

1. **Console:** create the GCP project, attach billing (class credits).
2. **Auth:**
   ```bash
   gcloud auth login
   gcloud config set project <PROJECT_ID>
   gcloud auth application-default login   # what the Terraform provider reads
   ```
3. **State bucket** (chicken-and-egg: Terraform state lives in GCS, so the bucket must
   pre-exist and is *not* managed by Terraform itself):
   ```bash
   gcloud storage buckets create gs://<PROJECT_ID>-tfstate --location=us-east1 \
     --uniform-bucket-level-access
   ```
   Referenced by `backend "gcs"` in `versions.tf`. Created as
   `cis437-project-514314-tfstate`. *Outstanding:* enable versioning for state
   rollback insurance:
   ```bash
   gcloud storage buckets update gs://cis437-project-514314-tfstate --versioning
   ```
4. **`.gitignore`** must cover: `.terraform/`, `*.tfstate*`, `*.tfvars` real values.

## 1. File layout

```
infra/terraform/
  versions.tf        # terraform >= 1.9, provider google (8.x) + random, backend "gcs"
  variables.tf       # project_id, region (default us-east1)
  main.tf            # grows per milestone below
  terraform.tfvars.example  # committed template; `cp` to terraform.tfvars (git-ignored)
```

## 2. Milestones (incremental build order)

Each milestone is one `plan` + `apply` + verification.

**Progress (2026-11-11): M0–M6 applied and verified.** M0–M3 via Terraform
(APIs, registry, bucket + CORS, Cloud SQL + secret); M4 SAs/IAM (4 project roles on
`api-service-account`, none on `ml-service-account`); M5 ML service (403 unauth / 200
authed on `/health`); M6 API service (`/health` → 200, `/scalar` renders) + both
invoker grants (`allUsers` on API, `api-service-account` on ML). The ~$10–15/mo
Cloud SQL floor is live. M7 (Cloud Build) is next.

| # | Milestone | Resources | Verify |
|---|-----------|-----------|--------|
| M0 ✅ | APIs | `google_project_service` × 8 (`disable_on_destroy = false`) | `terraform apply` clean; APIs listed in console |
| M1 ✅ | Artifact Registry | `google_artifact_registry_repository` | visible in console; optional docker push test |
| M2 ✅ | Image bucket | `google_storage_bucket` (native `cors` block) | `gcloud storage buckets describe ... --format="json(cors_config)"` (field is `cors_config`, not `cors`) |
| M3 ✅ | Cloud SQL + secret | `google_sql_database_instance` (db-f1-micro, PG16), `google_sql_database`, `random_password`, `google_secret_manager_secret`/`_version`, `google_sql_user` | Cloud SQL Auth Proxy connect; `\dt` in `climbing_db` (empty = correct until migrations) |
| M4 ✅ | SAs + IAM | 2× `google_service_account`; 4× `google_project_iam_member` (`cloudsql.client`, `storage.objectAdmin`, `secretmanager.secretAccessor`, `iam.serviceAccountTokenCreator`) | `gcloud projects get-iam-policy` shows bindings |
| M5 ✅ | ML service | `google_cloud_runv2_service` (2 vCPU/4Gi, port 8080, timeout 300, `INFERENCE_MODE=yolo`, `ml-service-account`, no public invocation) | unauthenticated `/health` → 403 (correct) |
| M6 ✅ | API service | `google_cloud_runv2_service` (env vars, secret binding, Cloud SQL socket, `api-service-account`, `ASPNETCORE_FORWARDEDHEADERS_ENABLED`) + `google_cloud_run_v2_service_iam_member` (`api-service-account` → `run.invoker` on ML, `allUsers` → invoker on API) | `/health` → ok, `/scalar` renders |
| M7 | Migrate job + triggers | migrate `google_cloud_runv2_job` + 2× `google_cloudbuild_trigger` (`include_globs` per TODO §1) | push touching `apps/api/**` → green build in History |
| M8 | Firebase | **not Terraform** — console only (Auth Email/Password + web config) | — |

Notes per milestone:

- **M5/M6 image prerequisite:** images must be pushed before the service can be created.
  Push directly with docker (build `-f apps/<api|ml>/Dockerfile apps/<api|ml>`, push to
  the M1 repo path), or use `gcloud builds submit --config infra/cloudbuild-<api|ml>.yaml`.
  Note the latter also deploys the service — if Terraform (M5/M6) owns the service, use
  the direct docker push for the *first* image, then let the pipeline own it afterwards
  (see rules below).
- **M6 nicety:** `ML_SERVICE_URL` references `google_cloud_runv2_service.ml.uri`
  directly — no two-phase "deploy, then update env vars" as in `provision.sh`.
- **M7 prerequisite:** the Cloud Build GitHub App must be installed on the repo once,
  interactively (console → Cloud Build → Triggers → Connect repository). Terraform then
  declares the connection/trigger resources. The migrate *job definition* is Terraform;
  *execution* stays in the yaml pipeline.
- **M8:** Firebase Auth enablement is console-only for a Spark-plan project; not worth
  the Identity Platform resource fiddliness.

## 3. Rules

1. **Never run `provision.sh` against this project.** One owner per resource; the
   script's DB-password rotation would fight Terraform's `random_password` state.
2. **`terraform plan` before every `apply`** — read it. Watch for unintended
   replaces on the Cloud Run services (a forced replacement = downtime + migration
   re-run logic).
3. **Never commit state or real tfvars.** State contains the DB password; tfstate is
   GCS-only.
4. **Cloud Run services have two writers by design (Terraform + CI deploys).** Terraform
   creates each service with `image = ...:latest`; the yaml pipeline then redeploys on
   every push. Both converge on the same config, but expect `terraform plan` to show
   little/no diff — if it ever tries to replace a service CI has updated, resolve with
   `lifecycle { ignore_changes = [template] }` on that resource, or move the service out
   of Terraform entirely. Decide which writer owns revisions *before* M5.
