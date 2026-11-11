# Security Hardening Guide

Where to lock things down: network exposure, ports, firewalls, IAM, and app-level
controls. Each section notes the **current state** in this repo and the **recommended
hardening** with the concrete command/flag.

Recommended reading order: §1 (what's exposed) drives everything else.

---

## 1. Exposure map — what can reach what

| Component | Port | Reachable by | Current ingress |
|-----------|------|--------------|-----------------|
| `climbing-api` (Cloud Run) | 8080 | public internet (browser/Vercel) | `--allow-unauthenticated`, ingress `all` |
| `climbing-ml` (Cloud Run) | 8080 | API only | `--no-allow-unauthenticated` (IAM) |
| Cloud SQL (PostgreSQL) | 5432 | Cloud Run api via unix socket | **public IP enabled by default** |
| Cloud Storage `board-images` | n/a (HTTPS API) | signed URLs | private bucket, uniform access |
| Firebase Auth | n/a (HTTPS) | browser | public (managed) |

Key point about ports: on Cloud Run **you do not expose container ports to the internet**.
The service is only reachable via Cloud Run's HTTPS proxy on 443; the container's `:8080`
is internal to the platform. "Locking down a port" here means controlling *ingress* to the
service, and *not* publishing Cloud SQL's 5432. There is no host firewall to manage.

---

## 2. Cloud Run ingress + firewalls

### ML service — restrict ingress to the project
Currently private via IAM (`--no-allow-unauthenticated`), but still accepts *any*
authenticated caller over the public path. Tighten to internal-only so the internet can't
even route to it:

```bash
gcloud run services update climbing-ml --region=us-east1 --ingress=internal
```
`internal` allows traffic from other workloads in the same project (our API) and the VPC.
Use `internal-and-cloud-load-balancing` if you later front it with a load balancer.
In `infra/cloudbuild-ml.yaml`, add `- --ingress=internal` to the deploy step.

### API service — keep public, put a WAF in front
The API must be reachable by Vercel, so it stays public. For defense-in-depth, front it
with an external HTTPS Load Balancer + **Cloud Armor** (rate limiting, IP allowlists, OWASP
rules), then set the API to `--ingress=internal-and-cloud-load-balancing`.

```bash
gcloud compute security-policies create climbing-api-policy --description="WAF + rate limit"
gcloud compute security-policies rules create 1000 \
  --security-policy=climbing-api-policy --action=rate-based-ban \
  --src-ip-ranges='*' --rate-limit-threshold-count=100 --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=600 --conform-action=allow --exceed-action=deny-403
```

### No VPC firewall needed for Cloud Run
Cloud Run is serverless (no VMs). Firewall rules only matter if you introduce a
**Serverless VPC connector** for private Cloud SQL access (§3) or a load balancer backend —
apply rules to those (e.g., allow only the connector's `/28` to reach the DB port).

---

## 3. Cloud SQL (PostgreSQL)

**Current state:** the instance is created with a public IP (Cloud SQL default). Cloud Run
connects over the **Cloud SQL unix socket** (built-in Auth Proxy), so traffic is
authenticated and encrypted — but the DB still has a public endpoint reachable from the
internet (relying on credentials + Google's network for protection).

**Harden — remove the public endpoint:**

```bash
# 1. Give the instance a private IP
gcloud sql instances patch climbing-db --network=default --no-assign-ip
# 2. Let Cloud Run reach the private network
gcloud compute networks vpc-access connectors create climbing-connector \
  --region=us-east1 --range=10.8.0.0/28 --network=default
# 3. Attach the connector to the API service
gcloud run services update climbing-api --region=us-east1 \
  --vpc-connector=climbing-connector --vpc-egress=private-ranges-only
```
Then set `CLOUD_SQL_HOST` to the private IP (instead of the unix socket) **or** keep the
unix socket (it still works with a private-IP instance). Update
`- --add-cloudsql-instances=...` stays the same.

**Other DB hardening:**
- **Encrypt only:** `gcloud sql instances patch climbing-db --ssl-mode=ENCRYPTED_ONLY`
  (or `TRUSTED_CLIENT_CERTIFICATE_REQUIRED`).
- **Authorized networks:** with a private IP, none are needed; with public IP, do *not*
  add `0.0.0.0/0`.
- **Least-privilege DB user:** `climbing_app` should own only `climbing_db`, not be a
  superuser (it isn't by default). Avoid the `postgres` superuser in app config.
- **Backups:** enable automated backups + PITR
  (`gcloud sql instances patch climbing-db --backup-start-time=03:00 --enable-point-in-time-recovery`).
- **Rotate the password** periodically; it lives in Secret Manager (see §6).

---

## 4. Cloud Storage bucket

**Current state:** `gs://<project>-climbing-images`, uniform bucket-level access, private,
served via signed URLs; CORS is `origin: ["*"]`, `GET`.

**Harden:**
- **Block public access defensively:**
  ```bash
  gcloud storage buckets update gs://PROJECT-climbing-images --public-access-prevention
  ```
- **Restrict CORS** to your real origins (`infra/provision.sh` currently writes `*`):
  ```json
  [{ "origin": ["https://your-app.vercel.app"], "method": ["GET"],
     "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600 }]
  ```
- **IAM:** grant only `api-service-account` `roles/storage.objectAdmin` on *this bucket* (not
  project-wide `storage.objectAdmin` as `provision.sh` does now) — scope the binding to the
  bucket resource.
- **Lifecycle:** add a rule to delete orphaned objects, and consider object versioning off.
- **Signed URL TTL:** kept short (`SIGNED_URL_TTL_MINUTES`, default 60). Don't raise it much.

---

## 5. IAM / service accounts (least privilege)

**Current grants** (from `provision.sh`), all project-level for `api-service-account`:

| Role | Why | Narrow it to |
|------|-----|--------------|
| `roles/cloudsql.client` | connect to Cloud SQL | project-level is fine |
| `roles/storage.objectAdmin` | read/write images | **this bucket only** |
| `roles/secretmanager.secretAccessor` | read DB password | **this secret only** |
| `roles/iam.serviceAccountTokenCreator` | sign GCS URLs | **self** (api-service-account) only |
| `roles/run.invoker` (on ML) | call ML | already scoped to the ML service |

Recommended: bind the bucket and secret roles on the specific resource:
```bash
gcloud storage buckets add-iam-policy-binding gs://PROJECT-climbing-images \
  --member="serviceAccount:api-service-account@PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
gcloud secrets add-iam-policy-binding climbing-db-password \
  --member="serviceAccount:api-service-account@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```
`ml-service-account` needs no project roles (only Cloud Run logging). Never use the default compute
service account for deployments; keep `api-service-account`/`ml-service-account` dedicated.

---

## 6. Secrets

- DB password is generated in `provision.sh` and stored in **Secret Manager**
  (`climbing-db-password`), injected into Cloud Run via `--set-secrets`. Good.
- **Rotate** it on a schedule and after any exposure; add a new secret **version**
  (Cloud Run picks up `:latest` on next revision).
- Never put secrets in env vars as plaintext, in `appsettings*.json`, or in the repo.
  `GOOGLE_APPLICATION_CREDENTIALS` keys used for local dev must stay out of git
  (`.gitignore` covers `.env*`; ensure key files are ignored too).

---

## 7. Authentication & authorization

- **Token verification:** every API request verifies the Firebase ID token
  (`FirebaseAuthMiddleware`); `GetUserId()` throws → 401. Keep it as the single gate.
- **Ownership:** all queries are scoped by `user_id`; no RLS. Never add an endpoint that
  takes a user id from the client without an ownership check.
- **Firebase App Check:** enable it to reject requests from non-app clients (bots, curl).
  Server-side, verify App Check tokens in `FirebaseAuthMiddleware` (add
  `VerifyAppCheckTokenAsync`). Strongly recommended since the API is public.
- **Restrict the Firebase web API key** to your HTTP referrers (Firebase console / Google
  Cloud Console API key restrictions).
- **Email verification:** consider requiring verified email before allowing writes.

---

## 8. CORS (already handled, tighten for prod)

- Wildcard `*` is set by provisioning for bring-up. Before the demo, set the API's
  `AllowedOrigins` to the exact Vercel origin(s) and remove `*`:
  ```bash
  gcloud run services update climbing-api --region=us-east1 \
    --update-env-vars=AllowedOrigins=https://your-app.vercel.app
  ```
- CORS is not an auth control (curl can spoof it) — it only protects browsers. Auth is in §7.

---

## 9. Application-level

- **Input validation:** add FluentValidation (or DataAnnotations) to request DTOs
  (`CreateRouteRequest`, `UpdateUserRequest`, route holds). Currently minimal.
- **Upload limits:** `BoardsController` has `[RequestSizeLimit(25_000_000)]`. Also validate
  **content type** (accept only `image/*`) and reject non-images before sending to ML.
- **Rate limiting:** add ASP.NET Core rate limiting (`AddRateLimiter`) per user/IP on
  `POST /api/boards` (expensive: ML inference) and auth-adjacent endpoints. Complementary to
  Cloud Armor.
- **Error leakage:** `ASPNETCORE_ENVIRONMENT=Production` (set in Dockerfile) avoids stack
  traces in responses. Keep it that way.
- **Dependencies:** `dotnet list package --vulnerable`, `npm audit`, and keep base images
  current (`sdk:10.0`/`aspnet:10.0`, `python:3.11-slim`). Rebuild regularly to pick up CVEs.

---

## 10. Transport

- **HTTPS is automatic** on Cloud Run (Google terminates TLS); no certs to manage.
- Consider **HSTS** (`app.UseHsts()` under `UseExceptionHandler`) if you want to force
  HTTPS on the browser — but do not add `UseHttpsRedirection` without forwarded-headers
  config on Cloud Run (can cause redirect loops).
- **Egress:** if you later add `--vpc-egress=all-traffic`, route only through the connector;
  use `private-ranges-only` to keep Google API traffic off the VPC.

---

## 11. Monitoring, logging, alerting

- Cloud Run ships logs to **Cloud Logging**; enable **Error Reporting**.
- Set a **billing budget + alerts** (important with class credits) and a Cloud Monitoring
  alert on 5xx rate / latency.
- Enable **Cloud SQL audit logs** if you need query-level auditing.
- Optionally enable **VPC Service Controls** around Cloud SQL + Storage to prevent data
  exfiltration (larger effort; note it in a future hardening pass).

---

## 12. Hardening checklist (quick wins, in order)

- [ ] `climbing-ml --ingress=internal` (§2)
- [ ] Cloud SQL: disable public IP + serverless VPC connector (§3)
- [ ] Cloud SQL: `--ssl-mode=ENCRYPTED_ONLY` (§3)
- [ ] Bucket: `--public-access-prevention` + CORS to real origin (§4)
- [ ] IAM: scope `storage.objectAdmin` and `secretAccessor` to the specific resource (§5)
- [ ] API `AllowedOrigins` = real Vercel origin, not `*` (§8)
- [ ] Firebase **App Check** enabled + verified server-side (§7)
- [ ] API rate limiting on upload (§9)
- [ ] Upload content-type validation (§9)
- [ ] Budget + 5xx alerts (§11)

Of these, the highest impact for least effort are the first five.
