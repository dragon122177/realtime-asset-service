# ADR 0003: Keep transformation behind a processor boundary

- Status: Accepted
- Date: 2026-08-03

## Context

3D processing varies by product: some teams use Blender, some use glTF-Transform, and others call GPU or managed services. Embedding one tool's command model in asset lifecycle code makes both hard to test and replace.

## Decision

Keep claiming, storage, lineage, quality evidence, and workflow in the control plane. Treat transformation as a versioned adapter with explicit input/output, timeouts, metrics, hashes, and failure semantics. Ship a portable analyzer/packager as the default adapter.

## Consequences

The reference project remains runnable without native 3D tooling, and production optimizers can evolve independently. Adapters must satisfy idempotency and security requirements; their processor version becomes part of permanent lineage.
