# Backend Architecture

Two backend services: a REST API and an ML inference service. The API owns all
data and orchestrates inference; the ML service is stateless and internal-only.

```
apps/api  ASP.NET Core 10 (C#), EF Core, FirebaseAdmin, GCS   -> public (Cloud Run)
apps/ml   FastAPI + Ultralytics (YOLO / SAHI)                 -> private (Cloud Run)
```

---

## `apps/api` (ASP.NET Core 10)

### Layering

```
Program.cs                     Composition root: config, DI, middleware, endpoints
Controllers/                   Thin HTTP layer — bind, call service, map status codes
  UserController.cs              /api/user
  BoardsController.cs            /api/boards
  RoutesController.cs            /api/routes
Services/                      Business logic
  UserService.cs                 profile upsert, default board
  BoardService.cs                upload -> GCS -> detect -> persist
  RouteService.cs                route + route_holds CRUD, ownership checks
  GcsStorageService.cs           GCS upload/delete, signed URLs
  DetectorClient.cs              HTTP client to the ML service
  Mapping.cs                     entity -> DTO helpers
Data/
  AppDbContext.cs                DbContext (Todo: ApplyConfigurationsFromAssembly)
  AppDbContextFactory.cs         IDesignTimeDbContextFactory for `dotnet ef`
  ConnectionStringFactory.cs     builds Npgsql connection (unix socket / localhost)
  Configurations/*.cs            one IEntityTypeConfiguration per entity
Models/                        EF entities (one file each)
Dtos/Dtos.cs                   request/response shapes (serialized snake_case)
Auth/FirebaseAuthMiddleware.cs verifies Bearer ID tokens -> HttpContext.Items
```

### Conventions
- **C# style:** file-scoped namespaces, nullable enabled, one type per file for entities.
- **JSON:** `JsonNamingPolicy.SnakeCaseLower` on controllers, so C# `ImageUrl` serializes
  as `image_url` (matches the frontend contract and the old Supabase shape).
- **Docs/UI:** built-in OpenAPI (`AddOpenApi`/`MapOpenApi`) with the Scalar UI at `/scalar`
  (replaces Swashbuckle on .NET 9+).
- **Migrations:** EF Core migrations are the schema source of truth (generate with
  `dotnet ef migrations add`). The API applies them at startup only when
  `RUN_MIGRATIONS=true`, and logs a hint if none exist.

### Request lifecycle — `POST /api/boards` (upload + detect)
1. Firebase middleware resolves `uid` from the ID token.
2. `BoardsController.Upload` binds `name` + `image` (`IFormFile`).
3. `BoardService.CreateFromUploadAsync`:
   - streams the image to GCS at `boards/{guid}{ext}`,
   - calls the ML service `POST /detect` (IAM-authenticated),
   - on ML failure, deletes the uploaded object and rethrows,
   - inserts the `boards` row + bulk `holds` in one `SaveChanges` (EF transaction),
   - on DB failure, deletes the object and rethrows,
   - returns a `BoardDto` with a fresh signed image URL.
4. Response: `201` with `{ board..., holds: [...] }`.

### Authentication
`FirebaseAuthMiddleware` reads `Authorization: Bearer <idToken>`, verifies it with
`FirebaseAdmin`, and stores `uid`/`email` on `HttpContext.Items`. Controllers call
`HttpContext.GetUserId()`, which throws `UnauthorizedAccessException`; a middleware
maps that to **401**. No `[Authorize]` attributes — the token is optional at the pipeline
level and required wherever `GetUserId()` is called.

### Ownership (replaces RLS)
Every query is scoped: `WHERE user_id = @uid` (or `GetUserBoards`, `OwnsRouteAsync`, etc.).
There are no database RLS policies. A board/route that isn't yours returns `404`.

### Storage
- GCS bucket stores wall images. `boards.image_url` holds the **GCS object name**, not a URL.
- The API mints a short-lived **V4 signed URL** on read (TTL `SIGNED_URL_TTL_MINUTES`,
  default 60) since the bucket is private. Falls back to a public URL string only if
  signing is unavailable (that URL will 403 on a private bucket — a signal to check the
  `serviceAccountTokenCreator` grant).

### ML integration
`DetectorClient` POSTs the image as multipart to `{ML_SERVICE_URL}/detect`. On Cloud Run it
attaches an ID token fetched from the metadata server (audience = ML URL) so only the API
service account can reach the private ML service. Off-GCP (local dev) no token is sent.

### Data model (Cloud SQL / PostgreSQL)

| Table | Columns | Notes |
|-------|---------|-------|
| `boards` | `id uuid PK`, `name`, `image_url` (GCS object), `user_id` (Firebase UID), `image_width`, `image_height`, `created_at` | image dims enable normalized rendering |
| `holds` | `id uuid PK`, `board_id FK`, `x_center`, `y_center`, `width`, `height` (all 0..1), `confidence`, `created_at` | **normalized** bounding boxes |
| `routes` | `id uuid PK`, `board_id FK`, `user_id`, `name`, `grade`, `created_at` | |
| `route_holds` | `route_id FK`, `hold_id FK`, `type` (text: `hand/foot/start/end/unassigned`), PK(`route_id`,`hold_id`) | join with per-route hold role |
| `users` | `id` (Firebase UID, text PK), `email`, `first_name`, `last_name`, `default_board_id FK` | profile upserted by the API |

`holds.type` is stored as **text** with a C# `HoldType` value converter (not a native
Postgres enum) — a deliberate simplification; see `docs/TODO.md`.

### Endpoints

All require a Firebase ID token. `{id}` is a UUID.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/user` | — | `UserProfile` (creates the row on first call) |
| PATCH | `/api/user` | `{ default_board_id }` | updated `UserProfile` |
| GET | `/api/boards` | — | `Board[]` (no holds, signed URLs) |
| GET | `/api/boards/{id}` | — | `Board` **with** `holds` |
| POST | `/api/boards` | multipart: `name`, `image` | `201` `Board` with `holds` |
| DELETE | `/api/boards/{id}` | — | `204` |
| GET | `/api/routes` | — | `Route[]` (newest first) |
| GET | `/api/routes/{id}` | — | `Route` |
| GET | `/api/routes/{id}/holds` | — | `RouteHold[]` (`{route_id, hold_id, type}`) |
| GET | `/api/routes/{id}/complete` | — | `CompleteRouteHold[]` (`{..., hold}`) |
| POST | `/api/routes` | `{ board_id, name, grade }` | `201` `Route` |
| PUT | `/api/routes/{id}` | `{ name, grade }` | `Route` |
| DELETE | `/api/routes/{id}` | — | `204` |
| POST | `/api/routes/{id}/holds` | `{ holds: [{ hold_id, type }] }` | `204` |
| DELETE | `/api/routes/{id}/holds` | — | `204` |

Non-API endpoints: `GET /healthz` (Cloud Run probe), `/openapi/v1.json` (OpenAPI doc),
`/scalar` (Scalar API UI).

### Configuration (env vars)

| Var | Purpose |
|-----|---------|
| `FIREBASE_PROJECT_ID` | Firebase project for token verification |
| `GCS_BUCKET_NAME` | image bucket |
| `CLOUD_SQL_CONNECTION_NAME` | `project:region:instance` (Cloud Run unix socket) |
| `CLOUD_SQL_DB` / `CLOUD_SQL_USER` / `CLOUD_SQL_PASSWORD` | DB credentials (password via Secret Manager) |
| `DATABASE_CONNECTION_STRING` | overrides all `CLOUD_SQL_*` (handy locally) |
| `ML_SERVICE_URL` | base URL of the ML service |
| `AllowedOrigins` | comma-separated CORS allowlist; `*` = any origin |
| `RUN_MIGRATIONS` | `true` to apply EF migrations at startup |
| `SIGNED_URL_TTL_MINUTES` | signed URL lifetime (default 60) |

---

## `apps/ml` (FastAPI)

Wraps `best4.pt` (YOLOv26 nano, ~5 MB, baked into the image). Loaded once at import so
the model stays warm across requests.

```
app/detector.py   HoldDetector: INFERENCE_MODE switch + large-box filter
app/main.py       FastAPI app: GET /healthz, POST /detect
```

### Inference modes (`INFERENCE_MODE`)
- `yolo` (default): direct `model.predict(conf, iou, imgsz=1280)`.
- `sahi`: sliced inference (`get_sliced_prediction`, half-image slices, 0.2 overlap).

Both paths emit **normalized** boxes `{x_center, y_center, width, height, confidence}` and
apply the ported large-box filter (drop boxes whose normalized area exceeds
`MAX_BOX_AREA_FRACTION`, default 0.04 ≈ 1/25).

### `POST /detect`
Multipart `image` -> `{ image_width, image_height, mode, holds: [...] }`. Bad images or
model errors return `400`.

### Env vars
`INFERENCE_MODE`, `MODEL_PATH`, `YOLO_CONF`, `YOLO_IOU`, `IMGSZ`, `SAHI_CONF`,
`SAHI_OVERLAP`, `MAX_BOX_AREA_FRACTION`.
