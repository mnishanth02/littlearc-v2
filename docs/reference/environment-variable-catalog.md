# LittleArc Environment Variable Catalog

> **Status:** Active runtime contract
> **Last updated:** 25 July 2026
> **Machine-readable source:** `tooling/environment/variables.mjs`

## Rules

- Environment examples document names and safe local defaults, never credentials.
- `public` values may be visible to a client or local user.
- `sensitive` values reveal infrastructure details and must not be logged or bundled.
- `secret` values grant access or cryptographic capability and remain blank in the repository.
- `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` values are client-visible by design.
- Staging and production values belong in their environment-specific secret/configuration stores.

## Mobile

| Variable | Class | Owner | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | Public | `FND-03` | Client-visible environment label |
| `EXPO_PUBLIC_API_BASE_URL` | Public | `FND-03` | Client-visible API origin |
| `LITTLEARC_IOS_SIGNING_MODE` | Public | `VLT-03` | Build-time `registered` or opt-in `personal` iOS identity |
| `ENABLE_IOS_SHARE_EXTENSION` | Public | `VLT-03` | Build-time iOS incoming-share target toggle |
| `LITTLEARC_IOS_PERSONAL_BUNDLE_IDENTIFIER` | Public | `VLT-03` | Override for the temporary Personal Team bundle ID |

## API

| Variable | Class | Owner | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | Public | `FND-03` | Runtime environment name |
| `HOST` | Public | `FND-03` | Local bind host |
| `PORT` | Public | `FND-03` | Local HTTP port |
| `DATABASE_URL` | Secret | `FND-05` | PostgreSQL connection string |
| `AUTH_BASE_URL` | Public | `OFF-01` | Public API origin used by the consumer-auth handler |
| `AUTH_TRUSTED_ORIGINS` | Public | `OFF-01` | Comma-separated exact web and app origins allowed at the auth boundary |
| `AUTH_EMAIL_FROM` | Sensitive | `OFF-01` | Verified sender identity for consumer OTP delivery |
| `BETTER_AUTH_SECRET` | Secret | `OFF-01` | Consumer-auth signing secret |
| `RESEND_API_KEY` | Secret | `OFF-01` | Consumer email-OTP delivery credential |
| `APPLE_CLIENT_ID` | Public | `OFF-01` | Optional Apple consumer-auth client identifier |
| `APPLE_CLIENT_SECRET` | Secret | `OFF-01` | Optional Apple consumer-auth client secret |
| `GOOGLE_CLIENT_ID` | Public | `OFF-01` | Optional Google consumer-auth client identifier |
| `GOOGLE_CLIENT_SECRET` | Secret | `OFF-01` | Optional Google consumer-auth client secret |
| `OFF02_ADULT_VERIFICATION_MODE` | Public | `OFF-02` | Local-only synthetic verification selector; staging and production reject it |
| `S3_ENDPOINT` | Sensitive | `FND-06` | Private bucket endpoint |
| `S3_ACCESS_KEY_ID` | Secret | `FND-06` | Private bucket access identifier |
| `S3_SECRET_ACCESS_KEY` | Secret | `FND-06` | Private bucket access secret |
| `S3_BUCKET_NAME` | Sensitive | `FND-06` | Private document bucket name |
| `S3_REGION` | Public | `VLT-04` | S3-compatible signing region, normally `auto` for Railway buckets |
| `UPLOADS_ENABLED` | Public | `VLT-04` | Fail-closed encrypted upload feature switch; false by default |
| `KEY_WRAPPING_SECRET_V1` | Secret | `FND-06` | Versioned initial key-wrapping secret |

## Worker

| Variable | Class | Owner | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | Public | `FND-03` | Runtime environment name |
| `DATABASE_URL` | Secret | `FND-05` | PostgreSQL and `pg-boss` connection string |
| `S3_ENDPOINT` | Sensitive | `FND-06` | Private bucket endpoint |
| `S3_ACCESS_KEY_ID` | Secret | `FND-06` | Private bucket access identifier |
| `S3_SECRET_ACCESS_KEY` | Secret | `FND-06` | Private bucket access secret |
| `S3_BUCKET_NAME` | Sensitive | `FND-06` | Private document bucket name |
| `S3_REGION` | Public | `VLT-04` | S3-compatible signing region, normally `auto` for Railway buckets |
| `KEY_WRAPPING_SECRET_V1` | Secret | `FND-06` | Versioned initial key-wrapping secret |
| `FILE_VALIDATION_ENABLED` | Public | `VLT-05` | Staging/local worker validation switch; production enablement is rejected |
| `FILE_PREVIEWS_ENABLED` | Public | `VLT-05-F3` | Independent preview-processing switch; true only in authorized staging and rejected in production |
| `FILE_VALIDATION_STAGING_PROBE` | Public | `VLT-05` | One-shot staging-only parser/scanner/cleanup startup probe; false in steady state |
| `FILE_VALIDATION_CONCURRENCY` | Public | `VLT-05` | Bounded validation worker concurrency |
| `FILE_VALIDATION_TMP_DIR` | Sensitive | `VLT-05` | Opaque private plaintext workspace root |
| `FILE_VALIDATION_SANDBOX_EXECUTABLE` | Sensitive | `VLT-05` | No-new-privileges process sandbox executable |
| `QPDF_EXECUTABLE` | Sensitive | `VLT-05` | Verified QPDF executable path |
| `PDFTOPPM_EXECUTABLE` | Sensitive | `VLT-05-F3` | Exact standalone Poppler page-rasterizer path |
| `CLAMD_HOST` | Sensitive | `VLT-05` | Private ClamAV service host |
| `CLAMD_PORT` | Sensitive | `VLT-05` | Private ClamAV TCP port |
| `CLAMD_SIGNATURE_MIN_VERSION` | Public | `VLT-05` | Minimum FreshClam-confirmed signature serial |
| `CLAMD_SIGNATURE_OBSERVED_AT` | Public | `VLT-05` | FreshClam-confirmed signature observation time |
| `CLAMD_SIGNATURE_MAX_AGE_HOURS` | Public | `VLT-05` | Maximum accepted observation age before intake fails closed |
| `EMAIL_PROVIDER_API_KEY` | Secret | `FND-07` | Email adapter credential placeholder |
| `PUSH_PROVIDER_CREDENTIALS` | Secret | `FND-07` | Push adapter credential placeholder |
| `AI_PROVIDER_CREDENTIALS` | Secret | `FND-07` | Disabled-by-default AI adapter credential placeholder |

## Operations Web

| Variable | Class | Owner | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | Public | `FND-03` | Runtime environment name |
| `NEXT_PUBLIC_APP_URL` | Public | `FND-03` | Client-visible staff application origin |
| `STAFF_API_BASE_URL` | Sensitive | `FND-03` | Server-side staff API origin |
| `BETTER_AUTH_SECRET` | Secret | `FND-03` | Isolated staff-auth signing secret |

Runtime schema validation, required/optional behavior, and provider wiring belong
to the package listed in the Owner column.

## Railway Staging

The staging-only Railway service and resource manifest lives at
`infra/railway/staging/variables.manifest.json`. It records variable ownership,
classification, service/resource placement, and source type without committing
values. Production Railway variables are intentionally absent from FND-06 and
must be planned separately before real-data gates.
