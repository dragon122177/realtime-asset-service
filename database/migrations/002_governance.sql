CREATE OR REPLACE FUNCTION platform.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON identity.users
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();

CREATE TRIGGER projects_touch_updated_at
  BEFORE UPDATE ON assets.projects
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();

CREATE TRIGGER assets_touch_updated_at
  BEFORE UPDATE ON assets.asset_records
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();

CREATE TRIGGER jobs_touch_updated_at
  BEFORE UPDATE ON workflow.jobs
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();

CREATE OR REPLACE FUNCTION audit.prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_mutation();

CREATE OR REPLACE FUNCTION workflow.notify_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('forgeflow_events', json_build_object(
    'id', NEW.id,
    'workspaceId', NEW.workspace_id,
    'assetId', NEW.asset_id,
    'eventType', NEW.event_type
  )::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_events_notify
  AFTER INSERT ON workflow.events
  FOR EACH ROW EXECUTE FUNCTION workflow.notify_event();

ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.asset_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.asset_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_workspace_policy ON identity.users
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY projects_workspace_policy ON assets.projects
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY assets_workspace_policy ON assets.asset_records
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY versions_workspace_policy ON assets.asset_versions
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY metrics_workspace_policy ON assets.asset_metrics
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY jobs_workspace_policy ON workflow.jobs
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY reviews_workspace_policy ON workflow.reviews
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY workflow_events_workspace_policy ON workflow.events
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);
CREATE POLICY audit_workspace_policy ON audit.events
  USING (workspace_id = nullif(current_setting('forgeflow.workspace_id', true), '')::uuid);

CREATE VIEW assets.asset_overview AS
SELECT
  asset.id,
  asset.workspace_id,
  asset.project_id,
  project.name AS project_name,
  asset.name,
  asset.source_filename,
  asset.content_type,
  asset.source_bytes,
  asset.status,
  asset.tags,
  asset.processing_error,
  asset.current_version_id,
  asset.row_version,
  asset.created_at,
  asset.updated_at,
  metrics.quality_score,
  metrics.quality_decision,
  metrics.metrics,
  metrics.findings,
  creator.display_name AS created_by_name
FROM assets.asset_records asset
JOIN assets.projects project ON project.id = asset.project_id
JOIN identity.users creator ON creator.id = asset.created_by
LEFT JOIN assets.asset_metrics metrics ON metrics.asset_id = asset.id;

CREATE VIEW workflow.pending_review_overview AS
SELECT
  review.id,
  review.workspace_id,
  review.asset_id,
  review.version_id,
  review.status,
  review.summary,
  review.created_at,
  asset.name AS asset_name,
  asset.source_filename,
  asset.project_id,
  project.name AS project_name,
  metrics.quality_score,
  metrics.quality_decision,
  metrics.metrics,
  metrics.findings
FROM workflow.reviews review
JOIN assets.asset_records asset ON asset.id = review.asset_id
JOIN assets.projects project ON project.id = asset.project_id
LEFT JOIN assets.asset_metrics metrics ON metrics.asset_id = asset.id;
