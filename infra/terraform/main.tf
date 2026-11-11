resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "identitytoolkit.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "app" {
  location      = var.default_region
  repository_id = "climbing-app"
  description   = "Climbing app container images"
  format        = "DOCKER"
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 6
    }
  }
}

resource "google_storage_bucket" "images" {
  name          = "cis437-project-514314-climbing-images"
  location      = var.default_region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "db_root" {
  length  = 24
  special = false
}

resource "google_sql_user" "app" {
  name     = "climbing_app"
  instance = google_sql_database_instance.db.name
  password = random_password.db.result
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "climbing-db-password"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db.result
}

resource "google_sql_database_instance" "db" {
  name             = "climbing-db"
  region           = var.default_region
  database_version = "POSTGRES_16"
  root_password    = random_password.db_root.result
  settings {
    tier      = "db-f1-micro"
    edition   = "ENTERPRISE"
    disk_size = 10
  }
  deletion_protection = false
}

resource "google_sql_database" "app" {
  name     = "climbing_db"
  instance = google_sql_database_instance.db.name
}

output "db_connection_name" {
  value = google_sql_database_instance.db.connection_name
}

resource "google_service_account" "api_sa" {
  account_id   = "api-service-account"
  display_name = "API Service Account"
}

resource "google_service_account" "ml_sa" {
  account_id   = "ml-service-account"
  display_name = "ML Service Account"
}

resource "google_project_iam_member" "app_api" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountTokenCreator"
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.api_sa.email}"
}

resource "google_cloud_run_v2_service" "ml" {
  name                = "climbing-ml"
  location            = var.default_region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  scaling {
    max_instance_count = 2
  }

  template {
    containers {
      image = "us-east1-docker.pkg.dev/${var.project_id}/climbing-app/ml:latest"
      env {
        name  = "INFERENCE_MODE"
        value = "yolo"
      }
      resources { limits = { cpu = "2", memory = "4Gi" } }
    }
    timeout         = "300s"
    service_account = google_service_account.ml_sa.email
  }
}

resource "google_cloud_run_v2_service" "api" {
  name                = "climbing-api"
  location            = var.default_region
  deletion_protection = false

  scaling {
    max_instance_count = 2
  }

  template {
    service_account = google_service_account.api_sa.email
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.db.connection_name]
      }
    }
    containers {
      image = "us-east1-docker.pkg.dev/${var.project_id}/climbing-app/api:latest"
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = "${var.project_id}-climbing-images" # matches the M2 bucket name
      }
      env {
        name  = "CLOUD_SQL_CONNECTION_NAME"
        value = google_sql_database_instance.db.connection_name # reference, not literal
      }
      env {
        name  = "CLOUD_SQL_DB"
        value = "climbing_db"
      }
      env {
        name  = "CLOUD_SQL_USER"
        value = "climbing_app"
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "AllowedOrigins"
        value = "*"
      }
      env {
        name  = "ML_SERVICE_URL"
        value = google_cloud_run_v2_service.ml.uri
      }
      env {
        name  = "ASPNETCORE_FORWARDEDHEADERS_ENABLED"
        value = "true"
      }

      env {
        name = "CLOUD_SQL_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "app_api" {
  name     = google_cloud_run_v2_service.ml.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.api_sa.email}"
  location = var.default_region
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.default_region
  role     = "roles/run.invoker"
  member   = "allUsers"
}


resource "google_project_iam_member" "cloudbuild_deploy" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:470057875092@cloudbuild.gserviceaccount.com"
}

resource "google_service_account_iam_member" "cloudbuild_actas_api" {
  service_account_id = google_service_account.api_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:470057875092@cloudbuild.gserviceaccount.com"
}

resource "google_service_account_iam_member" "cloudbuild_actas_ml" {
  service_account_id = google_service_account.ml_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:470057875092@cloudbuild.gserviceaccount.com"
}
