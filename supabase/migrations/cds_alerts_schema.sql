-- =====================================================
-- CDS Alert System Database Schema
-- Clinical Decision Support for CKD Monitoring
-- =====================================================

-- Alert definitions table (stores configurable alert rules)
CREATE TABLE IF NOT EXISTS cds_alert_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('renal', 'electrolyte', 'fluid', 'adherence', 'ops')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'REVIEW', 'URGENT')),
  enabled BOOLEAN DEFAULT true,
  editable BOOLEAN DEFAULT true,
  trigger_conditions JSONB NOT NULL,
  context_modifiers JSONB,
  suppression_rules JSONB DEFAULT '{"cooldown_hours": 168, "deduplicate_window_hours": 24}',
  escalation_rules JSONB,
  rationale_template TEXT NOT NULL,
  suggested_actions TEXT[] NOT NULL DEFAULT '{}',
  patient_safe_copy TEXT,
  visibility TEXT DEFAULT 'clinician' CHECK (visibility IN ('clinician', 'patient', 'both')),
  version TEXT NOT NULL DEFAULT '1.0',
  is_preset BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Alert instances table (fired alerts for patients)
CREATE TABLE IF NOT EXISTS cds_alert_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT REFERENCES cds_alert_definitions(rule_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'REVIEW', 'URGENT')),
  rationale TEXT NOT NULL,
  supporting_data JSONB,
  suggested_actions TEXT[] DEFAULT '{}',
  patient_safe_copy TEXT,
  visibility TEXT DEFAULT 'clinician',
  fired_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledgment_note TEXT,
  suppressed BOOLEAN DEFAULT false,
  suppression_reason TEXT,
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  cooldown_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log for all alert actions
CREATE TABLE IF NOT EXISTS cds_alert_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_instance_id UUID REFERENCES cds_alert_instances(id) ON DELETE CASCADE,
  rule_id TEXT,
  patient_id UUID,
  action TEXT NOT NULL CHECK (action IN ('fired', 'acknowledged', 'suppressed', 'escalated', 'dismissed', 'modified', 'created', 'disabled')),
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-patient alert overrides
CREATE TABLE IF NOT EXISTS cds_patient_alert_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  rule_id TEXT REFERENCES cds_alert_definitions(rule_id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  threshold_overrides JSONB,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, rule_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_instances_patient ON cds_alert_instances(patient_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_doctor ON cds_alert_instances(doctor_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_rule ON cds_alert_instances(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_fired_at ON cds_alert_instances(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_instances_unacknowledged ON cds_alert_instances(doctor_id, acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alert_audit_instance ON cds_alert_audit_log(alert_instance_id);
CREATE INDEX IF NOT EXISTS idx_alert_definitions_enabled ON cds_alert_definitions(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE cds_alert_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cds_alert_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cds_alert_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cds_patient_alert_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_definitions (doctors can read, admins can write)
CREATE POLICY "Doctors can view enabled alert definitions"
  ON cds_alert_definitions FOR SELECT
  TO authenticated
  USING (enabled = true);

-- RLS Policies for alert_instances (doctors see their own patients' alerts)
CREATE POLICY "Doctors can view their patients alerts"
  ON cds_alert_instances FOR SELECT
  TO authenticated
  USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can update their patients alerts"
  ON cds_alert_instances FOR UPDATE
  TO authenticated
  USING (doctor_id = auth.uid());

CREATE POLICY "System can insert alerts"
  ON cds_alert_instances FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for audit log
CREATE POLICY "Doctors can view audit log for their alerts"
  ON cds_alert_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cds_alert_instances ai 
      WHERE ai.id = alert_instance_id AND ai.doctor_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit entries"
  ON cds_alert_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for patient overrides
CREATE POLICY "Doctors can manage overrides for their patients"
  ON cds_patient_alert_overrides FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_cds_alert_definitions_updated_at ON cds_alert_definitions;
CREATE TRIGGER update_cds_alert_definitions_updated_at
  BEFORE UPDATE ON cds_alert_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cds_patient_alert_overrides_updated_at ON cds_patient_alert_overrides;
CREATE TRIGGER update_cds_patient_alert_overrides_updated_at
  BEFORE UPDATE ON cds_patient_alert_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Insert Preset Alert Definitions
-- =====================================================

INSERT INTO cds_alert_definitions (rule_id, name, description, category, severity, trigger_conditions, context_modifiers, suppression_rules, escalation_rules, rationale_template, suggested_actions, patient_safe_copy, visibility, is_preset)
VALUES 
-- 1. Rapid eGFR Decline
(
  'REN-EGF-001',
  'Rapid eGFR Decline',
  'Detects significant decline in kidney function over 90 days',
  'renal',
  'URGENT',
  '{"type": "trend", "parameters": [{"name": "eGFR", "operator": "lt", "value": 60, "unit": "mL/min/1.73m²"}], "trend": {"direction": "decreasing", "rate": 5, "time_window_days": 90, "min_datapoints": 2}}',
  '{"ckd_stages": ["3a", "3b", "4"], "comorbidities": ["diabetes", "hypertension"]}',
  '{"cooldown_hours": 336, "deduplicate_window_hours": 72, "refire_on_severity_increase": true}',
  '{"escalate_after_hours": 48, "escalate_to_severity": "URGENT", "notify_roles": ["nephrologist"]}',
  'eGFR declined from {{eGFR_baseline}} to {{eGFR_current}} mL/min/1.73m² ({{eGFR_change_percent}}% drop) over {{days_elapsed}} days.',
  ARRAY['Review recent medications (NSAIDs, contrast agents)', 'Check for acute illness or dehydration', 'Consider nephrology referral', 'Repeat labs in 2-4 weeks'],
  'Your kidney function has decreased recently. Please contact your care team to discuss next steps.',
  'both',
  true
),
-- 2. Hyperkalemia Risk
(
  'ELE-POT-001',
  'Hyperkalemia Risk',
  'Elevated potassium levels requiring attention',
  'electrolyte',
  'URGENT',
  '{"type": "threshold", "parameters": [{"name": "potassium", "operator": "gte", "value": 5.5, "unit": "mEq/L"}]}',
  '{"ckd_stages": ["3b", "4", "5"], "medications": ["ACEi", "ARB", "MRA"]}',
  '{"cooldown_hours": 72, "deduplicate_window_hours": 24, "refire_on_severity_increase": true}',
  '{"escalate_after_hours": 24, "escalate_to_severity": "URGENT", "notify_roles": ["nephrologist", "pharmacist"]}',
  'Potassium level: {{potassium}} mEq/L (threshold: 5.5). CKD Stage {{ckd_stage}}.',
  ARRAY['Obtain ECG if K+ > 6.0', 'Review potassium-elevating medications', 'Dietary potassium counseling', 'Consider potassium binder therapy'],
  'Your potassium level is elevated. Avoid high-potassium foods and contact your doctor.',
  'both',
  true
),
-- 3. Fluid Overload Warning
(
  'FLU-OVL-001',
  'Fluid Overload Warning',
  'Weight gain with elevated BP suggesting fluid retention',
  'fluid',
  'REVIEW',
  '{"type": "composite", "parameters": [{"name": "weight_change_percent", "operator": "gte", "value": 3}, {"name": "systolic_bp", "operator": "gte", "value": 150}], "composite_logic": "AND", "persistence": {"duration_days": 3}}',
  '{"comorbidities": ["heart_failure", "hypertension"]}',
  '{"cooldown_hours": 168, "deduplicate_window_hours": 48}',
  '{"escalate_after_hours": 72, "escalate_to_severity": "URGENT", "notify_roles": ["cardiologist"]}',
  'Weight increased by {{weight_change_kg}} kg ({{weight_change_percent}}%) over {{days}} days. BP: {{systolic}}/{{diastolic}} mmHg.',
  ARRAY['Review fluid intake compliance', 'Assess diuretic therapy', 'Check medication adherence'],
  'You may be retaining fluid. Please limit salt and fluid intake and contact your care team.',
  'both',
  true
),
-- 4. Medication Non-Adherence
(
  'ADH-MED-001',
  'Medication Non-Adherence',
  'Patient medication adherence below threshold',
  'adherence',
  'REVIEW',
  '{"type": "threshold", "parameters": [{"name": "medication_adherence_percent", "operator": "lt", "value": 80}], "persistence": {"duration_days": 14}}',
  '{"medications": ["ACEi", "ARB", "antihypertensives"]}',
  '{"cooldown_hours": 336, "deduplicate_window_hours": 168}',
  '{"escalate_after_hours": 168, "notify_roles": ["pharmacist", "care_coordinator"]}',
  'Medication adherence: {{adherence_percent}}% over past {{days}} days. Missed doses: {{missed_doses}}.',
  ARRAY['Discuss barriers to adherence', 'Simplify medication regimen', 'Consider pill organizer or reminders'],
  'It looks like some medications may have been missed. Taking medications as prescribed helps protect your kidneys.',
  'both',
  true
),
-- 5. Missing Lab Data
(
  'OPS-GAP-001',
  'Missing Lab Data',
  'Required labs not performed within monitoring window',
  'ops',
  'INFO',
  '{"type": "absence", "parameters": [{"name": "serum_creatinine", "operator": "missing_days", "value": 90}]}',
  '{"ckd_stages": ["3a", "3b", "4", "5"]}',
  '{"cooldown_hours": 168, "deduplicate_window_hours": 72}',
  null,
  'No {{missing_parameter}} result in {{days_since_last}} days. Last value: {{last_value}} on {{last_date}}.',
  ARRAY['Order routine CKD labs', 'Contact patient to schedule lab visit', 'Review monitoring protocol'],
  'It''s time for your routine kidney function tests. Please schedule a lab visit.',
  'both',
  true
),
-- 6. CKD Stage Progression
(
  'REN-STG-001',
  'CKD Stage Progression',
  'Patient CKD stage has advanced',
  'renal',
  'REVIEW',
  '{"type": "threshold", "parameters": [{"name": "ckd_stage_changed", "operator": "eq", "value": true}], "persistence": {"consecutive_readings": 2, "duration_days": 90}}',
  null,
  '{"cooldown_hours": 720, "suppress_if_acknowledged": true}',
  '{"escalate_after_hours": 168, "notify_roles": ["nephrologist"]}',
  'CKD stage progressed from {{previous_stage}} to {{current_stage}} based on eGFR {{eGFR_current}} mL/min/1.73m².',
  ARRAY['Update care plan for new CKD stage', 'Review medication dosing', 'Consider nephrology referral', 'Educate patient on stage-specific management'],
  'Your kidney disease stage has changed. Your care team will discuss what this means for your treatment.',
  'both',
  true
)
ON CONFLICT (rule_id) DO NOTHING;
