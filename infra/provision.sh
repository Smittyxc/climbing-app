#!/usr/bin/env bash
#
# Provisions the Google Cloud resources for the climbing app and performs the
# first deploy of both Cloud Run services.
#
# Prerequisites: gcloud CLI authenticated (`gcloud auth login`) against a project
# with billing enabled (e.g. your class credits), and this script run from the repo root.
#
# Usage: ./infra/provision.sh <PROJECT_ID> [REGION]
#
set -euo pipefail

PROJECT_ID="${1:?Usage: provision.sh <PROJECT_ID> [REGION]}"
REGION="${2:-us-east1}"

SQL_INSTANCE="climbing-db"
DB_NAME="climbing_db"
DB_USER="climbing_app"
BUCKET="${PROJECT_ID}-climbing-images"
REPO="climbing-app"
API_SERVICE="climbing-api"
ML_SERVICE="climbing-ml"
API_SA="api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
ML_SA="ml-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Using project ${PROJECT_ID} (region ${REGION})"
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "==> Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  identitytoolkit.googleapis.com

echo "==> Cloud Storage bucket"
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="${REGION}" --uniform-bucket-level-access
fi

CORS_FILE="$(mktemp)"
cat > "${CORS_FILE}" <<'JSON'
[{ "origin": ["*"], "method": ["GET"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600 }]
JSON
gcloud storage buckets update "gs://${BUCKET}" --cors-file="${CORS_FILE}"
rm -f "${CORS_FILE}"

echo "==> Cloud SQL (PostgreSQL)"
if ! gcloud sql instances describe "${SQL_INSTANCE}" >/dev/null 2>&1; then
  gcloud sql instances create "${SQL_INSTANCE}" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="${REGION}" \
    --storage-size=10GB
fi

gcloud sql databases describe "${DB_NAME}" --instance="${SQL_INSTANCE}" >/dev/null 2>&1 || \
  gcloud sql databases create "${DB_NAME}" --instance="${SQL_INSTANCE}"

DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-24)"
gcloud sql users create "${DB_USER}" --instance="${SQL_INSTANCE}" --password="${DB_PASSWORD}" 2>/dev/null || \
  gcloud sql users set-password "${DB_USER}" --instance="${SQL_INSTANCE}" --password="${DB_PASSWORD}"

echo "==> Secret Manager (DB password)"
if ! gcloud secrets describe "climbing-db-password" >/dev/null 2>&1; then
  printf '%s' "${DB_PASSWORD}" | gcloud secrets create "climbing-db-password" --data-file=-
else
  printf '%s' "${DB_PASSWORD}" | gcloud secrets versions add "climbing-db-password" --data-file=-
fi

echo "==> Artifact Registry"
gcloud artifacts repositories describe "${REPO}" --location="${REGION}" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker --location="${REGION}" \
    --description="Climbing app container images"

echo "==> Service accounts + IAM"
for sa in api ml; do
  gcloud iam service-accounts describe "${sa}-sa@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1 || \
    gcloud iam service-accounts create "${sa}-sa" --display-name="Climbing ${sa} service account"
done

for role in roles/cloudsql.client roles/storage.objectAdmin roles/secretmanager.secretAccessor roles/iam.serviceAccountTokenCreator; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${API_SA}" --role="${role}" --condition=None >/dev/null
done

echo "==> Deploying ML service"
gcloud builds submit --config infra/cloudbuild-ml.yaml \
  --substitutions="_REGION=${REGION},_REPO=${REPO},_SERVICE=${ML_SERVICE}" .

ML_URL="$(gcloud run services describe "${ML_SERVICE}" --region="${REGION}" --format='value(status.url)')"
echo "    ML URL: ${ML_URL}"

echo "==> Allowing API service account to invoke ML"
gcloud run services add-iam-policy-binding "${ML_SERVICE}" --region="${REGION}" \
  --member="serviceAccount:${API_SA}" --role="roles/run.invoker" >/dev/null

echo "==> Deploying API service"
gcloud builds submit --config infra/cloudbuild-api.yaml \
  --substitutions="_REGION=${REGION},_REPO=${REPO},_SERVICE=${API_SERVICE}" .

echo "==> Wiring ML URL into the API, enabling migrations + CORS"
gcloud run services update "${API_SERVICE}" --region="${REGION}" \
  --update-env-vars="ML_SERVICE_URL=${ML_URL},RUN_MIGRATIONS=true,AllowedOrigins=*" >/dev/null

API_URL="$(gcloud run services describe "${API_SERVICE}" --region="${REGION}" --format='value(status.url)')"

echo ""
echo "================================================================"
echo " Done."
echo "   API:      ${API_URL}"
echo "   ML:       ${ML_URL}"
echo "   Bucket:   gs://${BUCKET}"
echo "   Next: configure Firebase Auth in the console, then set"
echo "         VITE_FIREBASE_* and VITE_API_BASE_URL=${API_URL} for the web app."
echo "================================================================"
