# LittleArc Environment Variable Catalog

> **Status:** FND-06 staging contract
> **Last updated:** 19 July 2026
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

## API

| Variable | Class | Owner | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | Public | `FND-03` | Runtime environment name |
| `HOST` | Public | `FND-03` | Local bind host |
| `PORT` | Public | `FND-03` | Local HTTP port |
| `DATABASE_URL` | Secret | `FND-05` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret | `OFF-01` | Consumer-auth signing secret |
| `S3_ENDPOINT` | Sensitive | `FND-06` | Private bucket endpoint |
| `S3_ACCESS_KEY_ID` | Secret | `FND-06` | Private bucket access identifier |
| `S3_SECRET_ACCESS_KEY` | Secret | `FND-06` | Private bucket access secret |
| `S3_BUCKET_NAME` | Sensitive | `FND-06` | Private document bucket name |
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
| `KEY_WRAPPING_SECRET_V1` | Secret | `FND-06` | Versioned initial key-wrapping secret |
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
