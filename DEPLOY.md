# Acumen — Deployment Guide

GCP project: **`middleware-348515`**
Region: **`us-central1`**
Container registry: **Artifact Registry** (`us-central1-docker.pkg.dev/middleware-348515/acumen`)
Runtime: **Cloud Run** — three services per env (marketing · app-client · app-server)

## Branches → Environments

| Branch | Cloud Build config | Cloud Run services | Public URLs |
|--------|--------------------|--------------------|-------------|
| `staging` | `cloudbuild-staging.yaml` | `acumen-marketing-staging`, `acumen-app-client-staging`, `acumen-app-server-staging` | `staging.acumen.app`, `app-staging.acumen.app`, `api-staging.acumen.app` |
| `main` | `cloudbuild-prod.yaml` | `acumen-marketing-prod`, `acumen-app-client-prod`, `acumen-app-server-prod` | `acumen.app`, `app.acumen.app`, `api.acumen.app` |

## One-time GCP setup

```bash
PROJECT=middleware-348515
REGION=us-central1

# 1. Enable APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project=$PROJECT

# 2. Create Artifact Registry repo
gcloud artifacts repositories create acumen \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT

# 3. Grant Cloud Build SA the runtime/secrets roles
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${CB_SA}" --role="${ROLE}"
done
```

## Secret Manager — create secrets

All secrets use the prefix `ACUMEN_` and the suffix `_STAGING` / `_PROD`.

```bash
PROJECT=middleware-348515

create_secret() {
  echo -n "$2" | gcloud secrets create "$1" --data-file=- --project=$PROJECT 2>/dev/null \
    || echo -n "$2" | gcloud secrets versions add "$1" --data-file=- --project=$PROJECT
}

# DATABASE — copy from Neon dashboard or your secure password manager
create_secret ACUMEN_DATABASE_URL_STAGING "<paste staging Neon URL>"
create_secret ACUMEN_DATABASE_URL_PROD    "<paste prod Neon URL>"

# Better Auth
create_secret ACUMEN_BETTER_AUTH_SECRET_STAGING "$(openssl rand -hex 32)"
create_secret ACUMEN_BETTER_AUTH_SECRET_PROD    "$(openssl rand -hex 32)"

# Google OAuth (console.cloud.google.com → APIs → OAuth 2.0 Client IDs)
create_secret ACUMEN_GOOGLE_CLIENT_ID_STAGING     "REPLACE_ME"
create_secret ACUMEN_GOOGLE_CLIENT_SECRET_STAGING "REPLACE_ME"
create_secret ACUMEN_GOOGLE_CLIENT_ID_PROD        "REPLACE_ME"
create_secret ACUMEN_GOOGLE_CLIENT_SECRET_PROD    "REPLACE_ME"

# Resend (resend.com)
create_secret ACUMEN_RESEND_API_KEY_STAGING "REPLACE_ME"
create_secret ACUMEN_RESEND_API_KEY_PROD    "REPLACE_ME"

# Paystack (paystack.com → Settings → API Keys)
create_secret ACUMEN_PAYSTACK_SECRET_KEY_STAGING "sk_test_xxx"
create_secret ACUMEN_PAYSTACK_PUBLIC_KEY_STAGING "pk_test_xxx"
create_secret ACUMEN_PAYSTACK_SECRET_KEY_PROD    "sk_live_xxx"
create_secret ACUMEN_PAYSTACK_PUBLIC_KEY_PROD    "pk_live_xxx"
```

## Cloud Build triggers

Connect the GitHub repo `40analytics/acumen` to Cloud Build, then create two triggers:

```bash
gcloud builds triggers create github \
  --name=acumen-staging \
  --repo-name=acumen --repo-owner=40analytics \
  --branch-pattern='^staging$' \
  --build-config=cloudbuild-staging.yaml \
  --project=middleware-348515

gcloud builds triggers create github \
  --name=acumen-prod \
  --repo-name=acumen --repo-owner=40analytics \
  --branch-pattern='^main$' \
  --build-config=cloudbuild-prod.yaml \
  --project=middleware-348515
```

## First deploy & DB migrations

1. Push to `staging` branch → builds + deploys all 3 services
2. Run schema migration once per env:
   ```bash
   cd apps/app/server
   DATABASE_URL="<staging-url>" npm run db:push
   ```
3. Map custom domains in Cloud Run console (or `gcloud run domain-mappings create`):
   - `acumen.app` → `acumen-marketing-prod`
   - `app.acumen.app` → `acumen-app-client-prod`
   - `api.acumen.app` → `acumen-app-server-prod`
   - and the `staging.*` equivalents
4. Update Paystack webhook URL → `https://api.acumen.app/api/paystack/webhook`
5. Update Google OAuth → add `https://api.acumen.app/api/auth/callback/google` (and the staging equivalent) to authorized redirect URIs

## Local dev

```bash
# From the monorepo root
npm install
cp apps/app/server/.env.example apps/app/server/.env
cp apps/app/client/.env.example apps/app/client/.env
cp apps/marketing/.env.example  apps/marketing/.env

npm run db:push   # pushes Drizzle schema to whichever DATABASE_URL is in .env
npm run dev       # marketing :4322 · app-client :5173 · app-server :8787
```
