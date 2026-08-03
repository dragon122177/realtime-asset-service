# Security model

## Assets and trust boundaries

ForgeFlow protects tenant data, source files, delivery files, credentials, workflow decisions, and audit evidence. The public browser, API, database, object store, Redis, and processor runtime are separate trust zones even when Docker Compose runs them on one machine.

The main untrusted inputs are credentials, bearer tokens, multipart fields, filenames, glTF/GLB bytes, query filters, range headers, review text, and external processor output.

## Controls implemented

| Threat                        | Control                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| Cross-tenant reads/writes     | Workspace-scoped repository queries plus RLS policies               |
| Unauthorized workflow actions | `ADMIN`, `ARTIST`, `REVIEWER`, and `VIEWER` route authorization     |
| Credential disclosure         | bcrypt password hashes, JWT expiry, log redaction                   |
| Token leakage through SSE URL | Narrow-purpose live ticket with a 60-second default TTL             |
| Oversized/malformed upload    | Multipart limits, extension/media checks, byte cap, glTF/GLB parser |
| Object path traversal         | Sanitized segments and resolved-path boundary checks                |
| Silent file replacement       | Content-addressed immutable keys and collision verification         |
| Invalid lifecycle mutation    | TypeScript state machine and PostgreSQL transition trigger          |
| Audit tampering               | Append-only database trigger                                        |
| Runaway request volume        | Global and upload-specific rate limits                              |
| Sensitive error leakage       | Stable public error codes and sanitized job errors                  |
| Supply-chain regression       | Lockfile, Dependabot, CI audit, and CodeQL                          |

Helmet security headers are enabled. The nginx image runs as an unprivileged user, and Compose workloads use read-only roots, temporary writable mounts, and `no-new-privileges` where applicable.

## Authentication and sessions

The demo uses local email/password authentication to keep the repository runnable. Login returns a signed JWT containing user, workspace, and role claims. Every authenticated request also resolves an active user from the database, so disabling an account takes effect without waiting for token expiry.

Production deployments should replace local login with OIDC/OAuth authorization code flow, validate issuer/audience/key rotation, prefer secure same-site cookies for browser sessions, and add revocation/session management.

## File handling

Parsing a document does not make it safe. A production pipeline should add:

- malware scanning before processing;
- isolated transformation containers with resource and network limits;
- URI policy enforcement and dependency bundling for `.gltf` files;
- maximum decompressed geometry and texture dimensions;
- allowlists for supported glTF extensions;
- content-disposition and CSP rules appropriate to the delivery channel.

The current browser preview only fetches authenticated platform content. It does not resolve arbitrary remote asset URLs.

## Secrets

`.env` is ignored and `.env.example` contains only development placeholders. Kubernetes's `02-secret.example.yaml` is a shape example, not a deployable secret. Use a cloud secret manager or sealed/external secrets, rotate JWT and object-store credentials, and restrict database credentials by workload.

## Database roles

The migration account must not also be the long-lived application account in production. Use a restricted runtime role, set `forgeflow.workspace_id` within transactions before tenant access, and verify RLS with a non-owner test role. Keep PostgreSQL and Redis on private networks and require TLS.

## Reporting

See [SECURITY.md](../SECURITY.md) for responsible disclosure. Do not place vulnerability details in a public issue before a fix is available.
