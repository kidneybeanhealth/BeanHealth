-- ============================================================================
-- RULE ENGINE DATABASE SCHEMA
-- Step 1: Core tables for immutable storage and versioning
-- ============================================================================
-- Run this migration in Supabase SQL Editor or via psql
-- ============================================================================

-- 1. rule_versions
-- Stores version-controlled alert rules with governance fields
CREATE TABLE IF NOT EXISTS rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL,
  version INTEGER NOT NULL,
  rule_json JSONB NOT NULL,
  severity TEXT CHECK (severity IN ('info','review','high','critical')) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  display_priority INTEGER DEFAULT 100,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  change_reason TEXT,
  deprecated BOOLEAN DEFAULT FALSE,
  deprecated_at TIMESTAMPTZ,
  deprecated_by UUID,
  UNIQUE(alert_id, version)
);

-- Add comments for documentation
COMMENT ON TABLE rule_versions IS 'Version-controlled alert rules with governance tracking';
COMMENT ON COLUMN rule_versions.rule_json IS 'JSON rule definition with operator, field, value, etc.';
COMMENT ON COLUMN rule_versions.severity IS 'Alert severity: info, review, high, critical';
COMMENT ON COLUMN rule_versions.approved_by IS 'Required for high/critical severity rules';

-- 2. snapshot_rule_set
-- Links a snapshot evaluation to the exact rule versions used
CREATE TABLE IF NOT EXISTS snapshot_rule_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  rule_version_ids UUID[] NOT NULL
);

COMMENT ON TABLE snapshot_rule_set IS 'Immutable record of which rule versions were active during snapshot evaluation';

-- 3. patient_snapshot
-- Immutable snapshot history - never overwrite, always insert new row
CREATE TABLE IF NOT EXISTS patient_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now(),
  -- CKD Identity
  ckd_stage TEXT,
  etiology TEXT,
  -- Risk Assessment
  risk_tier TEXT CHECK (risk_tier IN ('Stable','Watch','High-risk')),
  abnormal_trends JSONB DEFAULT '[]'::jsonb,
  pending_lab_count INTEGER DEFAULT 0,
  unreviewed_high_messages INTEGER DEFAULT 0,
  -- Action State (THE MOST IMPORTANT)
  action_state TEXT CHECK (action_state IN ('no-action','review','immediate')),
  action_reason TEXT,
  -- Medico-legal
  last_doctor_reviewed_at TIMESTAMPTZ,
  -- Audit linkage
  rule_set_id UUID REFERENCES snapshot_rule_set(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup of patient's latest snapshot
CREATE INDEX IF NOT EXISTS idx_snapshot_patient ON patient_snapshot(patient_id, evaluated_at DESC);

COMMENT ON TABLE patient_snapshot IS 'Immutable snapshot history - each evaluation creates new row';
COMMENT ON COLUMN patient_snapshot.action_state IS 'HARD RULE: no-action NEVER coexists with abnormal data';

-- 4. alert_events
-- Immutable audit log for when alerts fire
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  rule_version_id UUID NOT NULL,
  fired_at TIMESTAMPTZ DEFAULT now(),
  matched_value JSONB,  -- The actual values that triggered the alert
  severity TEXT,
  -- Acknowledgment tracking
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT
);

-- Index for fast lookup of patient's alert history
CREATE INDEX IF NOT EXISTS idx_alert_events_patient ON alert_events(patient_id, fired_at DESC);
-- Index for finding unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alert_events_unack ON alert_events(patient_id) WHERE acknowledged_at IS NULL;

COMMENT ON TABLE alert_events IS 'Immutable audit log - every alert firing is recorded';
COMMENT ON COLUMN alert_events.matched_value IS 'JSON containing the actual values that triggered this alert';

-- 5. Materialized view for current snapshot (fast access)
-- This gives O(1) access to the latest snapshot per patient
CREATE MATERIALIZED VIEW IF NOT EXISTS current_patient_snapshot AS
SELECT DISTINCT ON (patient_id) *
FROM patient_snapshot
ORDER BY patient_id, evaluated_at DESC;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_current_snapshot_patient ON current_patient_snapshot(patient_id);

COMMENT ON MATERIALIZED VIEW current_patient_snapshot IS 'Latest snapshot per patient - refresh after each evaluation batch';

-- ============================================================================
-- RLS POLICIES (Optional - enable if using Supabase Auth)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_rule_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage rule_versions
CREATE POLICY "Admins can manage rule_versions" ON rule_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy: Doctors can read rule_versions
CREATE POLICY "Doctors can read rule_versions" ON rule_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('doctor', 'admin'))
  );

-- Policy: Admins can manage snapshot_rule_set
CREATE POLICY "Admins can manage snapshot_rule_set" ON snapshot_rule_set
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy: Service role can manage snapshots
CREATE POLICY "Service can manage snapshots" ON patient_snapshot
  FOR ALL USING (true);  -- Will be restricted by service role in application

-- Policy: Doctors can read patient snapshots (simplified - app-level filtering)
CREATE POLICY "Doctors can read patient snapshots" ON patient_snapshot
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('doctor', 'admin'))
  );

-- Policy: Doctors can read alert events (simplified - app-level filtering for their patients)
CREATE POLICY "Doctors can read alert events" ON alert_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('doctor', 'admin'))
  );

-- Policy: System can insert alert events
CREATE POLICY "System can insert alert events" ON alert_events
  FOR INSERT WITH CHECK (true);  -- Will be restricted by service role in application

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_current_snapshot()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY current_patient_snapshot;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_current_snapshot IS 'Call after batch snapshot evaluation to update the view';

-- Function to get active rule versions
CREATE OR REPLACE FUNCTION get_active_rule_versions()
RETURNS TABLE (
  id UUID,
  alert_id UUID,
  version INTEGER,
  rule_json JSONB,
  severity TEXT,
  display_priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rv.id,
    rv.alert_id,
    rv.version,
    rv.rule_json,
    rv.severity,
    rv.display_priority
  FROM rule_versions rv
  WHERE rv.enabled = TRUE
    AND rv.deprecated = FALSE
    AND rv.effective_from <= now()
    AND (rv.effective_to IS NULL OR rv.effective_to > now())
  ORDER BY rv.display_priority, rv.severity DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_rule_versions IS 'Returns all currently active rule versions for evaluation';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- 
-- 1. Check tables exist:
--    SELECT table_name FROM information_schema.tables 
--    WHERE table_schema = 'public' AND table_name IN 
--    ('rule_versions', 'snapshot_rule_set', 'patient_snapshot', 'alert_events');
--
-- 2. Check indexes:
--    SELECT indexname FROM pg_indexes WHERE tablename IN 
--    ('patient_snapshot', 'alert_events');
--
-- 3. Test insert into rule_versions:
--    INSERT INTO rule_versions (alert_id, version, rule_json, severity)
--    VALUES (gen_random_uuid(), 1, '{"operator":"gt","field":"labs.potassium","value":5.5}'::jsonb, 'high');
--
-- 4. Refresh materialized view:
--    SELECT refresh_current_snapshot();
-- ============================================================================
