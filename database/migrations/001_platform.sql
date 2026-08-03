CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS assets;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE identity.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug citext NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  email citext NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 120),
  role text NOT NULL CHECK (role IN ('ADMIN', 'ARTIST', 'REVIEWER', 'VIEWER')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE assets.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  project_key citext NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  quality_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, project_key)
);

CREATE TABLE assets.asset_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES assets.projects(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  source_filename text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('model/gltf+json', 'model/gltf-binary')),
  source_hash character(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_object_key text NOT NULL,
  source_bytes bigint NOT NULL CHECK (source_bytes > 0),
  status text NOT NULL CHECK (status IN (
    'UPLOADED', 'QUEUED', 'PROCESSING', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED',
    'APPROVED', 'PUBLISHED', 'FAILED', 'ARCHIVED'
  )),
  tags text[] NOT NULL DEFAULT '{}',
  processing_error text,
  current_version_id uuid,
  created_by uuid NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_hash)
);

CREATE TABLE assets.asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets.asset_records(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  kind text NOT NULL CHECK (kind IN ('SOURCE', 'DELIVERY')),
  object_key text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('model/gltf+json', 'model/gltf-binary')),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 character(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  processor_version text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, kind, version_number)
);

ALTER TABLE assets.asset_records
  ADD CONSTRAINT asset_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES assets.asset_versions(id) ON DELETE SET NULL;

CREATE TABLE assets.asset_metrics (
  asset_id uuid PRIMARY KEY REFERENCES assets.asset_records(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL REFERENCES assets.asset_versions(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL,
  quality_score integer NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  quality_decision text NOT NULL CHECK (quality_decision IN ('PASS', 'REVIEW', 'BLOCK')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets.asset_records(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('ANALYZE_AND_PACKAGE')),
  status text NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED')),
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 4 CHECK (max_attempts BETWEEN 1 AND 20),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE workflow.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets.asset_records(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES assets.asset_versions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'CHANGES_REQUESTED')),
  summary text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES identity.users(id) ON DELETE RESTRICT,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_pending_review_per_asset
  ON workflow.reviews (asset_id)
  WHERE status = 'PENDING';

CREATE TABLE workflow.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES assets.asset_records(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  correlation_id uuid NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_workspace_role_idx ON identity.users (workspace_id, role) WHERE is_active;
CREATE INDEX projects_workspace_idx ON assets.projects (workspace_id, updated_at DESC);
CREATE INDEX assets_project_status_idx ON assets.asset_records (project_id, status, updated_at DESC);
CREATE INDEX assets_workspace_created_idx ON assets.asset_records (workspace_id, created_at DESC);
CREATE INDEX versions_asset_created_idx ON assets.asset_versions (asset_id, created_at DESC);
CREATE INDEX jobs_claim_idx ON workflow.jobs (priority DESC, run_after, created_at)
  WHERE status IN ('QUEUED', 'RETRY_WAIT');
CREATE INDEX jobs_asset_idx ON workflow.jobs (asset_id, created_at DESC);
CREATE INDEX reviews_workspace_status_idx ON workflow.reviews (workspace_id, status, created_at);
CREATE INDEX workflow_events_workspace_idx ON workflow.events (workspace_id, created_at DESC);
CREATE INDEX audit_workspace_time_idx ON audit.events (workspace_id, occurred_at DESC);
