# LittleArc Railway Skeleton

> **Status:** FND-06 staging skeleton
> **Last updated:** 2026-07-19
> **Owner:** Engineering

This directory contains source-controlled Railway deployment descriptors and
safe environment manifests. It contains no Railway project IDs, service IDs,
domains, tokens, credentials, database URLs, bucket keys, or key-wrapping
material.

The current accepted scope is staging only. Production Railway provisioning is
deferred until the founder explicitly reopens it and the pre-real-data gates
are ready.

## Staging

- [Staging skeleton](./staging/README.md)
- [API service config](./staging/api.railway.json)
- [Worker service config](./staging/worker.railway.json)
- [Staff web service config](./staging/ops-web.railway.json)
- [Variable manifest](./staging/variables.manifest.json)

Validate this directory from the repository root:

```sh
pnpm check:railway
```
