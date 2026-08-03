# ADR 0001: Immutable source and delivery objects

- Status: Accepted
- Date: 2026-08-03

## Context

3D transformations are reproducibility-sensitive. Overwriting a file makes it impossible to prove what was reviewed, reproduce a delivery, compare processor behavior, or safely roll back.

## Decision

Store source and delivery bytes under content-addressed keys and represent each processing result as an immutable version row. Reprocessing increments the revision and never changes earlier object locations, hashes, metrics, or decisions.

## Consequences

Lineage, rollback, caching, and deduplication become straightforward. Storage use grows, so retention and orphan-cleanup policies are required. Any destructive retention job must prove that no published or governed version references an object.
