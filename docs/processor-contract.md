# Processor contract

The control plane treats 3D transformation as an adapter boundary. The included processor is intentionally deterministic and portable: it validates, analyzes, applies quality policy, and packages an immutable delivery object without claiming proprietary geometry optimization.

## Input

A claimed job provides:

- workspace, project, asset, source-version, and revision identifiers;
- source object key, media type, original filename, byte size, and SHA-256;
- processor name/version and quality-policy snapshot;
- correlation ID and attempt metadata.

The adapter reads bytes from the configured object store. Source objects are immutable and must never be edited in place.

## Output

A successful processor returns:

- deterministic delivery bytes and SHA-256;
- delivery media type and object key;
- normalized geometry and scene metrics;
- quality result (`PASS`, `REVIEW`, or `BLOCK`);
- structured findings with stable codes and measured context;
- processor name/version and duration.

The repository persists output and state changes transactionally. The object should be written before the database points at it; orphan cleanup can safely remove unreferenced content-addressed objects later.

## Idempotency

The delivery key includes workspace, asset, revision, processor version, and content hash. Repeating the same job therefore targets identical bytes. Completion code must detect an already-recorded version rather than creating conflicting lineage.

## External adapter example

A production adapter can execute glTF-Transform, Blender, a GPU service, or a managed optimization API behind the same boundary:

```text
claim job
  -> download immutable source
  -> scan and validate
  -> run isolated transformer with CPU/memory/time limits
  -> validate transformed output
  -> calculate metrics and hashes
  -> upload delivery
  -> complete job transaction
```

Do not shell-interpolate filenames or user fields. Run native tools in an isolated container, pin image and plugin versions, enforce timeouts and output caps, disable unneeded network access, and retain sanitized stderr for operations.

## Compatibility policy

Processor versions are explicit lineage fields. Changing geometry behavior, texture policy, compression configuration, or metric interpretation requires a new version. Existing published delivery versions remain addressable; assets can be queued for controlled reprocessing.

## Future work

- dedicated processor queues for CPU, GPU, and third-party workloads;
- lease heartbeats for transformations longer than the stale threshold;
- cancellation tokens and resource quotas;
- sandboxed malware/content scanning before transformation;
- Draco/Meshopt/KTX2 adapters with browser compatibility validation;
- an outbox relay for guaranteed event publication.
