# ADR-0004: Fastify and Drizzle Modular Monolith

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2027-01-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [architecture](../core/littlearc-architecture-and-tech-stack.md), [FND-03 evidence](../impl-plan/m1-foundation/fnd-03-implementation-evidence.md), [FND-05 evidence](../impl-plan/m1-foundation/fnd-05-implementation-evidence.md)

---

## Context

The initial team needs low operational overhead while retaining clear domain,
contract, persistence, API, worker, and staff boundaries. Premature services
would add deployment and consistency failure modes.

## Decision

Use a modular monolith: Fastify hosts the API, Drizzle owns PostgreSQL schema and
query mapping, framework-independent domain/contracts remain shared packages,
and a separately deployed worker consumes database/queue primitives. Staff and
mobile surfaces call API contracts and never import the database package.

## Alternatives Considered

- Microservices: rejected for the pilot because team size and bounded load do
  not justify distributed transactions and multi-service ownership.
- Next.js route handlers as the main API: rejected to keep staff presentation
  isolated from consumer API lifecycle and security policy.
- A full ORM with implicit migrations: rejected in favor of typed SQL mapping
  plus reviewed migration artifacts.

## Consequences

Modules can change atomically and deploy with few moving parts. The codebase must
actively enforce boundaries so the monolith does not become tangled. Future
service extraction requires measured scaling, isolation, or ownership evidence.

## Validation

Workspace boundary tests, package manifests, TypeScript builds, API tests, and
the absence of database dependencies from mobile and staff verify the structure.

## Review Triggers

Review by 2027-01-19, or earlier when independent scaling, fault isolation,
regulatory separation, deployment cadence, or team ownership requires a service
boundary.
