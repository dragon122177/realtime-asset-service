CREATE TABLE assets.status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES identity.workspaces(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets.asset_records(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  correlation_id uuid NOT NULL,
  changed_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX status_history_asset_idx ON assets.status_history (asset_id, changed_at DESC);

ALTER TABLE assets.status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_history_workspace_policy ON assets.status_history
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION assets.validate_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'UPLOADED' THEN NEW.status IN ('QUEUED', 'ARCHIVED')
    WHEN 'QUEUED' THEN NEW.status IN ('PROCESSING', 'FAILED', 'ARCHIVED')
    WHEN 'PROCESSING' THEN NEW.status IN ('READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'FAILED')
    WHEN 'READY_FOR_REVIEW' THEN NEW.status IN ('APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED')
    WHEN 'CHANGES_REQUESTED' THEN NEW.status IN ('QUEUED', 'ARCHIVED')
    WHEN 'APPROVED' THEN NEW.status IN ('PUBLISHED', 'QUEUED', 'ARCHIVED')
    WHEN 'PUBLISHED' THEN NEW.status IN ('QUEUED', 'ARCHIVED')
    WHEN 'FAILED' THEN NEW.status IN ('QUEUED', 'ARCHIVED')
    WHEN 'ARCHIVED' THEN false
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'invalid asset transition: % -> %', OLD.status, NEW.status;
  END IF;
  NEW.row_version = OLD.row_version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_transition_guard
  BEFORE UPDATE OF status ON assets.asset_records
  FOR EACH ROW EXECUTE FUNCTION assets.validate_status_transition();

CREATE OR REPLACE FUNCTION workflow.recover_stale_jobs(stale_after interval DEFAULT interval '10 minutes')
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  recovered integer;
BEGIN
  UPDATE workflow.jobs
  SET status = CASE WHEN attempt < max_attempts THEN 'RETRY_WAIT' ELSE 'FAILED' END,
      run_after = now() + interval '30 seconds',
      locked_at = NULL,
      locked_by = NULL,
      last_error = 'worker lease expired'
  WHERE status = 'RUNNING' AND locked_at < now() - stale_after;
  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;
