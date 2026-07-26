# M3 Vault Wedge

> **Status:** In progress
> **Last updated:** 2026-07-25
> **Owner:** Engineering
> **Milestone:** M3

M3 adds the parent-owned record vault, capture pipeline, search, and retrieval
behavior described in the implementation roadmap.

Gate 2 remains open. Founder direction on 24 July 2026 authorized the bounded
`VLT-01` record foundation, `VLT-02` manual record creation, and `VLT-03`
capture and import adapters. On 25 July 2026 the founder reviewed and accepted
the `VLT-04` plan and separately authorized its bounded implementation. Later
that day the founder accepted the `VLT-05` plan and separately authorized its
synthetic local-Aiven and Railway-staging implementation with previews and
production disabled. These directions do not close Gate 2, authorize `VLT-06`
or later M3 breadth, or broaden any real-data, physical-iOS, two-device,
low-end-Android, or pilot claim.

## Work Packages

| Package | Status | Plan | Evidence |
| --- | --- | --- | --- |
| `VLT-01` Record model, versions, provenance, and timeline projection | `COMPLETE` | [Plan](./vlt-01-record-model-versions-provenance-and-timeline-projection-plan.md) | [Implementation and bounded device acceptance complete](./vlt-01-implementation-evidence.md) |
| `VLT-02` Manual record creation | `COMPLETE` | [Plan](./vlt-02-manual-record-creation-plan.md) | [Implementation and bounded device acceptance complete](./vlt-02-implementation-evidence.md) |
| `VLT-03` Capture and import adapters | `COMPLETE` | [Plan](./vlt-03-capture-and-import-adapters-plan.md) | [Implementation, biometric repair, requested Pixel matrix, and applicable iOS-Simulator acceptance pass; physical-iPhone proof is deferred](./vlt-03-implementation-evidence.md) |
| `VLT-04` File encryption and resumable upload | `COMPLETE` | [Plan](./vlt-04-file-encryption-and-resumable-upload-plan.md) | [Implementation, staging-provider, physical-Pixel, iOS-Simulator, and repository acceptance complete](./vlt-04-implementation-evidence.md) |
| `VLT-05` Worker-side file validation | `COMPLETE` | [Plan](./vlt-05-worker-side-file-validation-plan.md) | [Synthetic local-Aiven and Railway-staging evidence complete; HEIC and previews fail closed](./vlt-05-implementation-evidence.md) |
| `VLT-06` through `VLT-09` | `BLOCKED` | [Roadmap](../roadmap.md) | Gate 2 or separate founder direction is required |
