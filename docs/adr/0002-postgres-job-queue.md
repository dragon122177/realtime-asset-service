# ADR 0002: PostgreSQL-backed durable jobs

- Status: Accepted
- Date: 2026-08-03

## Context

Asset state and processing work must be accepted atomically. Introducing a separate broker creates a dual-write problem before workload scale justifies the extra component.

## Decision

Use PostgreSQL as the durable job queue. Workers atomically claim due rows with `FOR UPDATE SKIP LOCKED`, store leases and attempts, and recover expired leases. Redis remains optional pub/sub for browser invalidation only.

## Consequences

Acceptance, lifecycle state, and jobs share one transaction and local operation is simple. PostgreSQL absorbs polling and queue writes, so indexes, connection limits, and queue-age monitoring matter. At sustained high volume, a transactional outbox can feed a dedicated broker without changing the domain contract.
