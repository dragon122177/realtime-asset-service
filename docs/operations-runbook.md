# Operations runbook

## Service objectives

Suggested initial objectives for a production adaptation:

- API availability: 99.9% monthly.
- Successful accepted-upload response: p95 under 750 ms excluding object transfer time.
- Queue age: 95% of standard assets begin processing within 60 seconds.
- Processing success: at least 99% excluding policy blocks and invalid user content.
- Review-to-publish traceability: 100% of publications have actor and audit evidence.

These are starting targets, not measured claims about this reference deployment.

## Dashboards and signals

The `/metrics` endpoint exposes HTTP duration, uploads by result/format, jobs by outcome, processing duration, queue depth, and active jobs. The included Grafana dashboard covers request rate/errors, queue health, throughput, and latency.

Alert candidates:

- readiness failing for more than five minutes;
- 5xx ratio above 2% for ten minutes;
- oldest queued job above ten minutes;
- failed processing ratio above 5%;
- stale jobs recovered repeatedly;
- PostgreSQL connection saturation or disk pressure;
- object-store error rate or latency spike.

## Common incidents

### Queue age is growing

1. Confirm API readiness and PostgreSQL/object-store health.
2. Compare queued, running, retry-wait, and failed counts.
3. Inspect worker logs by correlation/job ID and processing-duration percentiles.
4. Check CPU/memory throttling and object-store latency.
5. Scale workers only if PostgreSQL and storage have capacity.
6. If one asset class dominates, isolate it into a processor-specific queue.

### Jobs remain RUNNING after a worker failure

Run the recovery function through an authorized operational path:

```sql
SELECT workflow.recover_stale_jobs(interval '10 minutes');
```

Investigate the worker termination before lowering the threshold. For long legitimate transforms, implement lease heartbeats rather than extending leases blindly.

### Uploads fail

Check the public error code first: `UPLOAD_TOO_LARGE`, `UNSUPPORTED_ASSET`, and `INVALID_GLTF` are client/content problems. For 5xx responses, correlate API logs, database availability, and object-store writes. Content-addressed writes allow a safe retry with identical bytes.

### Realtime updates stop

Verify Redis and SSE connections. Realtime is an optimization: API commands and durable processing continue. Users can refresh; the console also refetches on normal navigation. Restore Redis without replaying jobs.

### A release introduces bad processing output

1. Stop or scale down the affected processor version.
2. Preserve source and delivery objects and identify assets by processor version.
3. Deploy a corrected, newly versioned processor.
4. Requeue affected assets in controlled batches.
5. Never rewrite already-published version records or hashes.

## Backup and recovery

- Back up PostgreSQL with point-in-time recovery appropriate to the desired RPO.
- Enable object-store versioning/replication and lifecycle policies.
- Redis data is not required for business-state recovery.
- Test restores, including the mapping from version rows to object hashes.
- Retain migration checksums and the exact processor/container version used for each delivery.

## Deployments

Run migrations as a single pre-deployment job. The migrator takes an advisory lock and refuses checksum drift. Roll API and workers independently; keep the previous processor image available during a rollback. Use readiness probes so traffic only reaches instances with database and storage connectivity.

## Local reset

For local development only:

```bash
docker compose down --volumes
docker compose up --build
```

This deletes local PostgreSQL, Redis, MinIO, Prometheus, and Grafana volumes. It must not be used against shared or production environments.
