# LittleArc Repository Knowledge Index

> **Status:** Active context index
> **Last updated:** 2026-07-19
> **Owner:** Engineering

---

## Start Here

- Delivery status and next work: [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- Implementation roadmap: [impl-plan/roadmap.md](./impl-plan/roadmap.md)
- Product source: [core/littlearc-complete-product-plan.md](./core/littlearc-complete-product-plan.md)
- Architecture source: [core/littlearc-architecture-and-tech-stack.md](./core/littlearc-architecture-and-tech-stack.md)
- Design-system source: [core/design-system.md](./core/design-system.md)
- M0 readiness and retained evidence: [core/m0-readiness-and-evidence.md](./core/m0-readiness-and-evidence.md)

## Documentation Areas

| Area | Purpose | Index |
| --- | --- | --- |
| Core | Product, architecture, design, and readiness source documents | [core/README.md](./core/README.md) |
| Implementation plans | Roadmap, work-package plans, and acceptance evidence | [impl-plan/README.md](./impl-plan/README.md) |
| ADRs | Important durable decisions | [adr/README.md](./adr/README.md) |
| Reference | Local setup, environment, operations, and troubleshooting | [reference/README.md](./reference/README.md) |
| Templates | Reusable document skeletons | [templates/README.md](./templates/README.md) |

## Active Implementation Context

| Work | Status source | Detailed plan or evidence |
| --- | --- | --- |
| M1 foundation queue | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [impl-plan/roadmap.md](./impl-plan/roadmap.md) |
| `FND-01` monorepo and toolchain | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-01-monorepo-and-toolchain-plan.md), [evidence](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) |
| `FND-02` CI and supply-chain baseline | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-02-ci-and-supply-chain-plan.md), [evidence](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) |
| `FND-03` application skeletons | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-03-application-skeletons-plan.md), [evidence](./impl-plan/m1-foundation/fnd-03-implementation-evidence.md) |
| `FND-04` contracts and domain kernel | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-04-contracts-and-domain-kernel-plan.md), [evidence](./impl-plan/m1-foundation/fnd-04-implementation-evidence.md) |
| `FND-05` database and migration foundation | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-05-database-and-migration-foundation-plan.md), [evidence](./impl-plan/m1-foundation/fnd-05-implementation-evidence.md) |
| `FND-06` Railway environment skeleton | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-06-railway-environment-skeleton-plan.md), [evidence](./impl-plan/m1-foundation/fnd-06-implementation-evidence.md) |
| `FND-07` observability and privacy guards | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-07-observability-and-privacy-guards-plan.md), [evidence](./impl-plan/m1-foundation/fnd-07-implementation-evidence.md) |
| `FND-08` design-system prototype reconciliation | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | [plan](./impl-plan/m1-foundation/fnd-08-design-system-prototype-reconciliation-plan.md), [evidence](./impl-plan/m1-foundation/fnd-08-implementation-evidence.md) |

## Module Context

| Module | Local guide | Primary docs |
| --- | --- | --- |
| Mobile app | [apps/mobile/AGENTS.md](../apps/mobile/AGENTS.md) | Architecture, design system, M0 native evidence |
| API app | [apps/api/AGENTS.md](../apps/api/AGENTS.md) | Architecture, environment catalog, future contracts |
| Worker app | [apps/worker/AGENTS.md](../apps/worker/AGENTS.md) | Architecture, environment catalog, future queue plans |
| Staff operations web | [apps/ops-web/AGENTS.md](../apps/ops-web/AGENTS.md) | Architecture, product plan, design system |
| Shared packages | [packages/AGENTS.md](../packages/AGENTS.md) | Architecture, package-boundary policy, relevant package plans |
| Native compatibility harness | [spikes/native-compat/AGENTS.md](../spikes/native-compat/AGENTS.md) | M0 evidence, native harness README |

## Context Lookup

- Deterministic context map: [context-map.yaml](./context-map.yaml)
- Lookup command: `./scripts/context/find-context.sh "<feature or module query>"`
- Documentation validation: `./scripts/context/validate-docs.sh`

Use this index to choose a small set of documents. Do not scan or summarize the
complete `docs/` tree unless a task explicitly requires a repository-wide audit.
