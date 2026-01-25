// CDS Alert System Types
// Clinical Decision Support for CKD Monitoring

export type AlertCategory = 'renal' | 'electrolyte' | 'fluid' | 'adherence' | 'ops';
export type AlertSeverity = 'INFO' | 'REVIEW' | 'URGENT';
export type AlertVisibility = 'clinician' | 'patient' | 'both';
export type TriggerType = 'threshold' | 'trend' | 'composite' | 'persistence' | 'absence' | 'behavioral' | 'predictive';
export type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'between' | 'not_between' | 'missing_days';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'volatile';

export interface TriggerParameter {
    name: string;
    operator: Operator;
    value: number | string | boolean | number[];
    unit?: string;
}

export interface TrendCondition {
    direction: TrendDirection;
    rate: number;
    time_window_days: number;
    min_datapoints: number;
}

export interface PersistenceCondition {
    duration_days?: number;
    consecutive_readings?: number;
}

export interface TriggerConditions {
    type: TriggerType;
    parameters: TriggerParameter[];
    trend?: TrendCondition;
    persistence?: PersistenceCondition;
    composite_logic?: 'AND' | 'OR';
}

export interface ContextModifiers {
    ckd_stages?: string[];
    comorbidities?: string[];
    medications?: string[];
    age_range?: { min?: number; max?: number };
    symptoms?: string[];
}

export interface SuppressionRules {
    cooldown_hours: number;
    deduplicate_window_hours: number;
    suppress_if_acknowledged?: boolean;
    refire_on_severity_increase?: boolean;
}

export interface EscalationRules {
    escalate_after_hours: number;
    escalate_to_severity: AlertSeverity;
    notify_roles: string[];
}

// Alert Definition (stored in database)
export interface AlertDefinition {
    id: string;
    rule_id: string;
    name: string;
    description?: string;
    category: AlertCategory;
    severity: AlertSeverity;
    enabled: boolean;
    editable: boolean;
    trigger_conditions: TriggerConditions;
    context_modifiers?: ContextModifiers;
    suppression_rules: SuppressionRules;
    escalation_rules?: EscalationRules;
    rationale_template: string;
    suggested_actions: string[];
    patient_safe_copy?: string;
    visibility: AlertVisibility;
    version: string;
    is_preset: boolean;
    created_at: string;
    updated_at: string;
    updated_by?: string;
}

// Alert Instance (fired alert for a patient)
export interface AlertInstance {
    id: string;
    rule_id: string;
    patient_id: string;
    doctor_id: string;
    severity: AlertSeverity;
    rationale: string;
    supporting_data?: Record<string, any>;
    suggested_actions: string[];
    patient_safe_copy?: string;
    visibility: AlertVisibility;
    fired_at: string;
    acknowledged_at?: string;
    acknowledged_by?: string;
    acknowledgment_note?: string;
    suppressed: boolean;
    suppression_reason?: string;
    escalated: boolean;
    escalated_at?: string;
    cooldown_expiry?: string;
    created_at: string;
    // Joined data
    alert_definition?: AlertDefinition;
    patient_name?: string;
}

// Alert with patient info for display
export interface AlertWithPatient extends AlertInstance {
    patient_name: string;
    patient_avatar?: string;
}

// Audit log entry
export interface AlertAuditEntry {
    id: string;
    alert_instance_id: string;
    rule_id?: string;
    patient_id?: string;
    action: 'fired' | 'acknowledged' | 'suppressed' | 'escalated' | 'dismissed' | 'modified' | 'created' | 'disabled';
    actor_id?: string;
    actor_role?: string;
    details?: Record<string, any>;
    created_at: string;
}

// Patient alert override
export interface PatientAlertOverride {
    id: string;
    patient_id: string;
    rule_id: string;
    enabled: boolean;
    threshold_overrides?: Record<string, any>;
    reason?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// Alert counts for badge display
export interface AlertCounts {
    total: number;
    urgent: number;
    review: number;
    info: number;
    unacknowledged: number;
}

// Evaluation result from alert engine
export interface AlertEvaluationResult {
    rule_id: string;
    alert_name: string;
    severity: AlertSeverity;
    triggered: boolean;
    rationale: string;
    supporting_datapoints: Array<{ name: string; value: any; timestamp: string }>;
    suggested_actions: string[];
    patient_safe_copy?: string;
    visibility: AlertVisibility;
    cooldown_expiry?: Date;
    suppressed: boolean;
    suppression_reason?: string;
}

// Props for alert components
export interface AlertSummaryWidgetProps {
    doctorId: string;
    maxAlerts?: number;
    onViewAll?: () => void;
    onAlertClick?: (alert: AlertInstance) => void;
}

export interface AlertsPageProps {
    doctorId: string;
}

export interface AlertCardProps {
    alert: AlertInstance;
    onAcknowledge?: (alertId: string, note?: string) => void;
    onDismiss?: (alertId: string) => void;
    onViewPatient?: (patientId: string) => void;
    compact?: boolean;
}
