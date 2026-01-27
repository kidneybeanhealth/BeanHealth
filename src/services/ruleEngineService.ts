/**
 * Rule Engine Service
 * 
 * Computes patient snapshots using the Rule Evaluator and persists them
 * to the database. Implements the HARD RULE for action state.
 * 
 * NO ML, NO INFERENCE - Pure deterministic logic
 */

import { supabase } from '../lib/supabase';
import {
    evaluateRule,
    getMatchedRules,
    sortBySeverity,
    RuleJSON,
    PatientDataContext,
    SEVERITY_ORDER
} from './ruleEvaluator';
import { LabResultsService } from './labResultsService';
import { ChatService } from './chatService';
import { MedicationService } from './medicationService';
import { CaseDetailsService } from './caseDetailsService';
import { VitalsService } from './dataService';
import { LabTestType } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export type RiskTier = 'Stable' | 'Watch' | 'High-risk';
export type ActionState = 'no-action' | 'review' | 'immediate';

export interface ActiveRuleVersion {
    id: string;
    alert_id: string;
    version: number;
    rule_json: RuleJSON;
    severity: string;
    display_priority: number;
}

export interface SnapshotResult {
    patient_id: string;
    evaluated_at: string;
    ckd_stage: string;
    etiology: string;
    risk_tier: RiskTier;
    abnormal_trends: string[];
    pending_lab_count: number;
    unreviewed_high_messages: number;
    action_state: ActionState;
    action_reason: string;
    last_doctor_reviewed_at: string | null;
    rule_set_id: string | null;
    matched_rules: { ruleId: string; severity: string; reason: string }[];
}

// =============================================================================
// RULE LOADING
// =============================================================================

/**
 * Load all active rule versions from database
 * Active = enabled, not deprecated, effective_from <= now
 */
export async function loadActiveRuleVersions(): Promise<ActiveRuleVersion[]> {
    const { data, error } = await supabase
        .rpc('get_active_rule_versions');

    if (error) {
        console.error('Error loading active rule versions:', error);
        // Fallback: direct query
        const { data: directData, error: directError } = await supabase
            .from('rule_versions')
            .select('id, alert_id, version, rule_json, severity, display_priority')
            .eq('enabled', true)
            .eq('deprecated', false)
            .lte('effective_from', new Date().toISOString())
            .order('display_priority', { ascending: true });

        if (directError) {
            console.error('Direct query also failed:', directError);
            return [];
        }
        return directData || [];
    }

    return data || [];
}

// =============================================================================
// CKD STAGE LOGIC
// =============================================================================

/**
 * Determine CKD Stage from eGFR (KDIGO guidelines)
 */
function getCKDStage(egfr: number | undefined | null): string {
    if (egfr === undefined || egfr === null) return 'Unknown';
    if (egfr >= 90) return 'Stage 1';
    if (egfr >= 60) return 'Stage 2';
    if (egfr >= 45) return 'Stage 3a';
    if (egfr >= 30) return 'Stage 3b';
    if (egfr >= 15) return 'Stage 4';
    return 'Stage 5';
}

/**
 * Get etiology from case details - ONLY doctor-tagged, no inference
 */
function getEtiology(medicalHistory: string[] | null): string {
    if (!medicalHistory || medicalHistory.length === 0) return 'Unknown';

    const historyLower = medicalHistory.map(h => h.toLowerCase()).join(' ');

    if (historyLower.includes('diabetic nephropathy') ||
        historyLower.includes('diabetes mellitus') ||
        historyLower.includes('dm ckd') ||
        historyLower.includes('type 2 diabetes') ||
        historyLower.includes('type 1 diabetes')) {
        return 'Diabetes';
    }

    if (historyLower.includes('hypertensive nephropathy') ||
        historyLower.includes('hypertension ckd') ||
        historyLower.includes('htn ckd')) {
        return 'Hypertension';
    }

    return 'Unknown';
}

// =============================================================================
// RISK TIER LOGIC
// =============================================================================

/**
 * Calculate Risk Tier
 * 
 * - High-risk: any unresolved alert OR any unreviewed high-risk message
 * - Watch: no unresolved alerts but pending labs >= 1
 * - Stable: otherwise
 */
function calculateRiskTier(
    unresolvedAlertCount: number,
    unreviewedHighMessages: number,
    pendingLabCount: number
): { tier: RiskTier; reason: string } {
    // High-risk: unresolved alerts or unreviewed urgent messages
    if (unresolvedAlertCount > 0) {
        return { tier: 'High-risk', reason: `${unresolvedAlertCount} unresolved alert(s)` };
    }
    if (unreviewedHighMessages > 0) {
        return { tier: 'High-risk', reason: `${unreviewedHighMessages} unreviewed urgent message(s)` };
    }

    // Watch: pending labs
    if (pendingLabCount > 0) {
        return { tier: 'Watch', reason: `${pendingLabCount} pending lab(s)` };
    }

    // Stable
    return { tier: 'Stable', reason: 'No pending items' };
}

// =============================================================================
// ACTION STATE LOGIC (HARD RULE)
// =============================================================================

/**
 * Calculate Action State with HARD RULE
 * 
 * 🚫 "No action needed" can NEVER coexist with abnormal data
 */
function calculateActionState(
    riskTier: RiskTier,
    abnormalTrends: string[],
    unreviewedHighMessages: number
): { state: ActionState; reason: string } {
    // IMMEDIATE ATTENTION (Red)
    if (unreviewedHighMessages > 0) {
        return { state: 'immediate', reason: 'Unreviewed high-risk message' };
    }
    if (abnormalTrends.length > 0) {
        return { state: 'immediate', reason: `Abnormal: ${abnormalTrends.join(', ')}` };
    }
    if (riskTier === 'High-risk') {
        return { state: 'immediate', reason: 'High-risk status' };
    }

    // REVIEW REQUIRED (Amber)
    if (riskTier === 'Watch') {
        return { state: 'review', reason: 'Pending follow-up items' };
    }

    // NO ACTION NEEDED (Green) - ONLY if truly stable
    return { state: 'no-action', reason: 'All metrics stable' };
}

// =============================================================================
// DATA CONTEXT BUILDER
// =============================================================================

/**
 * Build PatientDataContext from database for a given patient
 */
async function buildPatientContext(patientId: string): Promise<PatientDataContext | null> {
    try {
        // Fetch lab data
        const [creatinineData, egfrData, potassiumData, latestLabs] = await Promise.all([
            LabResultsService.getTrendData(patientId, 'creatinine' as LabTestType, 10),
            LabResultsService.getTrendData(patientId, 'egfr' as LabTestType, 10),
            LabResultsService.getTrendData(patientId, 'potassium' as LabTestType, 10),
            LabResultsService.getLatestResults(patientId)
        ]);

        // Fetch vitals
        let vitals: PatientDataContext['vitals'] = {};
        try {
            const vitalsData = await VitalsService.getLatestVitals(patientId);
            if (vitalsData?.bloodPressure?.value) {
                const match = vitalsData.bloodPressure.value.match(/(\d+)\/(\d+)/);
                if (match) {
                    vitals.bp_systolic = parseInt(match[1]);
                    vitals.bp_diastolic = parseInt(match[2]);
                }
            }
            if (vitalsData?.heartRate?.value) {
                vitals.heart_rate = parseInt(vitalsData.heartRate.value);
            }
        } catch (e) {
            console.warn('Error fetching vitals:', e);
        }

        // Fetch medications
        let medications: string[] = [];
        try {
            const meds = await MedicationService.getPatientMedications(patientId);
            medications = meds.map(m => m.name.toLowerCase());
        } catch (e) {
            console.warn('Error fetching medications:', e);
        }

        // Fetch messages (need to get doctor ID somehow - using service role for now)
        let messages: PatientDataContext['messages'] = [];
        // Note: Messages require doctor context, will be passed in for real evaluation

        // Build context
        const context: PatientDataContext = {
            labs: {
                creatinine: {
                    values: creatinineData,
                    latest: latestLabs['creatinine']?.value,
                    latestDate: latestLabs['creatinine']?.testDate
                },
                egfr: {
                    values: egfrData,
                    latest: latestLabs['egfr']?.value,
                    latestDate: latestLabs['egfr']?.testDate
                },
                potassium: {
                    values: potassiumData,
                    latest: latestLabs['potassium']?.value,
                    latestDate: latestLabs['potassium']?.testDate
                }
            },
            vitals,
            medications,
            messages,
            now: new Date()
        };

        return context;
    } catch (error) {
        console.error('Error building patient context:', error);
        return null;
    }
}

// =============================================================================
// PENDING LABS CALCULATION
// =============================================================================

/**
 * Calculate pending labs based on CKD stage and last lab date
 */
function calculatePendingLabCount(ckdStage: string, lastLabDate: string | null): number {
    if (!lastLabDate) return 1; // No labs = pending

    // Expected frequency based on CKD stage
    let expectedDays: number;
    if (ckdStage === 'Stage 5') expectedDays = 15;
    else if (ckdStage === 'Stage 4') expectedDays = 30;
    else if (ckdStage.includes('Stage 3')) expectedDays = 45;
    else if (ckdStage === 'Stage 2') expectedDays = 90;
    else expectedDays = 180;

    const lastDate = new Date(lastLabDate);
    const expectedDate = new Date(lastDate);
    expectedDate.setDate(expectedDate.getDate() + expectedDays);

    return expectedDate < new Date() ? 1 : 0;
}

// =============================================================================
// SNAPSHOT COMPUTATION
// =============================================================================

/**
 * Compute a full snapshot for a patient
 */
export async function computeSnapshot(
    patientId: string,
    doctorId: string,
    rules?: ActiveRuleVersion[]
): Promise<SnapshotResult | null> {
    try {
        // Load rules if not provided
        const activeRules = rules || await loadActiveRuleVersions();

        // Build patient context
        const context = await buildPatientContext(patientId);
        if (!context) {
            console.error('Failed to build patient context');
            return null;
        }

        // Fetch messages for this patient-doctor pair
        try {
            const messages = await ChatService.getConversation(doctorId, patientId);
            context.messages = messages
                .filter(m => m.senderId === patientId)
                .map(m => ({
                    text: m.text || '',
                    isUrgent: m.isUrgent || false,
                    isRead: m.isRead || false,
                    timestamp: m.timestamp
                }));
        } catch (e) {
            console.warn('Error fetching messages:', e);
        }

        // Evaluate all rules against patient context
        const matchedResults = getMatchedRules(
            activeRules.map(r => ({ id: r.id, rule_json: r.rule_json, severity: r.severity })),
            context
        );

        // Sort by severity
        const sortedMatched = sortBySeverity(matchedResults);

        // Count unreviewed high-risk messages
        const unreviewedHighMessages = context.messages.filter(
            m => m.isUrgent && !m.isRead
        ).length;

        // Get CKD stage and etiology
        const ckdStage = getCKDStage(context.labs.egfr?.latest);

        // Fetch case details for etiology
        let etiology = 'Unknown';
        try {
            const caseDetails = await CaseDetailsService.getCaseDetails(patientId);
            etiology = getEtiology(caseDetails?.medicalHistory || null);
        } catch (e) {
            console.warn('Error fetching case details:', e);
        }

        // Calculate pending labs
        const lastLabDate = context.labs.creatinine?.latestDate || null;
        const pendingLabCount = calculatePendingLabCount(ckdStage, lastLabDate);

        // Identify abnormal trends from matched rules
        const abnormalTrends = sortedMatched
            .filter(r => ['high', 'critical'].includes(r.severity))
            .map(r => r.result.field || r.result.reason)
            .slice(0, 5); // Limit to top 5

        // Calculate risk tier
        const { tier: riskTier, reason: riskReason } = calculateRiskTier(
            sortedMatched.length,
            unreviewedHighMessages,
            pendingLabCount
        );

        // Calculate action state (HARD RULE)
        const { state: actionState, reason: actionReason } = calculateActionState(
            riskTier,
            abnormalTrends,
            unreviewedHighMessages
        );

        // Build snapshot result
        const snapshot: SnapshotResult = {
            patient_id: patientId,
            evaluated_at: new Date().toISOString(),
            ckd_stage: ckdStage,
            etiology,
            risk_tier: riskTier,
            abnormal_trends: abnormalTrends,
            pending_lab_count: pendingLabCount,
            unreviewed_high_messages: unreviewedHighMessages,
            action_state: actionState,
            action_reason: actionReason,
            last_doctor_reviewed_at: null, // Will be set when doctor reviews
            rule_set_id: null, // Will be set after persisting rule set
            matched_rules: sortedMatched.map(r => ({
                ruleId: r.ruleId,
                severity: r.severity,
                reason: r.result.reason
            }))
        };

        return snapshot;
    } catch (error) {
        console.error('Error computing snapshot:', error);
        return null;
    }
}

// =============================================================================
// SNAPSHOT PERSISTENCE
// =============================================================================

/**
 * Create a rule set record and persist snapshot
 * Snapshots are IMMUTABLE - always insert new row
 */
export async function persistSnapshot(
    snapshot: SnapshotResult,
    ruleVersionIds: string[]
): Promise<{ snapshotId: string; ruleSetId: string } | null> {
    try {
        // 1. Create rule set
        const { data: ruleSetData, error: ruleSetError } = await supabase
            .from('snapshot_rule_set')
            .insert({ rule_version_ids: ruleVersionIds })
            .select('id')
            .single();

        if (ruleSetError) {
            console.error('Error creating rule set:', ruleSetError);
            return null;
        }

        const ruleSetId = ruleSetData.id;

        // 2. Insert snapshot (immutable - new row every time)
        const { data: snapshotData, error: snapshotError } = await supabase
            .from('patient_snapshot')
            .insert({
                patient_id: snapshot.patient_id,
                evaluated_at: snapshot.evaluated_at,
                ckd_stage: snapshot.ckd_stage,
                etiology: snapshot.etiology,
                risk_tier: snapshot.risk_tier,
                abnormal_trends: snapshot.abnormal_trends,
                pending_lab_count: snapshot.pending_lab_count,
                unreviewed_high_messages: snapshot.unreviewed_high_messages,
                action_state: snapshot.action_state,
                action_reason: snapshot.action_reason,
                last_doctor_reviewed_at: snapshot.last_doctor_reviewed_at,
                rule_set_id: ruleSetId
            })
            .select('id')
            .single();

        if (snapshotError) {
            console.error('Error persisting snapshot:', snapshotError);
            return null;
        }

        // 3. Emit alert events for matched rules
        for (const matched of snapshot.matched_rules) {
            await supabase.from('alert_events').insert({
                patient_id: snapshot.patient_id,
                rule_version_id: matched.ruleId,
                fired_at: snapshot.evaluated_at,
                matched_value: { reason: matched.reason },
                severity: matched.severity
            });
        }

        // 4. Refresh materialized view (if available)
        try {
            await supabase.rpc('refresh_current_snapshot');
        } catch (e) {
            console.warn('Could not refresh materialized view:', e);
        }

        return { snapshotId: snapshotData.id, ruleSetId };
    } catch (error) {
        console.error('Error in persistSnapshot:', error);
        return null;
    }
}

// =============================================================================
// SNAPSHOT RETRIEVAL
// =============================================================================

/**
 * Get latest snapshot for a patient
 */
export async function getLatestSnapshot(patientId: string): Promise<SnapshotResult | null> {
    try {
        // Try materialized view first
        const { data, error } = await supabase
            .from('current_patient_snapshot')
            .select('*')
            .eq('patient_id', patientId)
            .single();

        if (!error && data) {
            return data as SnapshotResult;
        }

        // Fallback to regular query
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('patient_snapshot')
            .select('*')
            .eq('patient_id', patientId)
            .order('evaluated_at', { ascending: false })
            .limit(1)
            .single();

        if (fallbackError) {
            console.error('Error fetching snapshot:', fallbackError);
            return null;
        }

        return fallbackData as SnapshotResult;
    } catch (error) {
        console.error('Error in getLatestSnapshot:', error);
        return null;
    }
}

/**
 * Get snapshot history for a patient
 */
export async function getSnapshotHistory(
    patientId: string,
    limit: number = 10
): Promise<SnapshotResult[]> {
    try {
        const { data, error } = await supabase
            .from('patient_snapshot')
            .select('*')
            .eq('patient_id', patientId)
            .order('evaluated_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching snapshot history:', error);
            return [];
        }

        return (data || []) as SnapshotResult[];
    } catch (error) {
        console.error('Error in getSnapshotHistory:', error);
        return [];
    }
}

// =============================================================================
// PREVIEW IMPACT (DRY RUN)
// =============================================================================

/**
 * Preview impact of a rule change without persisting
 * Returns sample patient IDs and count that would be affected
 */
export async function previewRuleImpact(
    ruleJson: RuleJSON,
    maxSamples: number = 100
): Promise<{ matchedCount: number; samplePatientIds: string[] }> {
    try {
        // Get all patient IDs
        const { data: patients, error } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'patient')
            .limit(500); // Limit for performance

        if (error || !patients) {
            console.error('Error fetching patients:', error);
            return { matchedCount: 0, samplePatientIds: [] };
        }

        const matchedPatientIds: string[] = [];

        // Evaluate rule against each patient
        for (const patient of patients) {
            const context = await buildPatientContext(patient.id);
            if (!context) continue;

            const result = evaluateRule(ruleJson, context);
            if (result.matched) {
                matchedPatientIds.push(patient.id);
                if (matchedPatientIds.length >= maxSamples) break;
            }
        }

        return {
            matchedCount: matchedPatientIds.length,
            samplePatientIds: matchedPatientIds.slice(0, maxSamples)
        };
    } catch (error) {
        console.error('Error in previewRuleImpact:', error);
        return { matchedCount: 0, samplePatientIds: [] };
    }
}

// =============================================================================
// MARK DOCTOR REVIEW
// =============================================================================

/**
 * Mark that a doctor has reviewed the snapshot
 */
export async function markDoctorReview(
    patientId: string,
    doctorId: string
): Promise<boolean> {
    try {
        // Get latest snapshot
        const { data: snapshot, error: fetchError } = await supabase
            .from('patient_snapshot')
            .select('id')
            .eq('patient_id', patientId)
            .order('evaluated_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !snapshot) {
            console.error('Error fetching snapshot for review:', fetchError);
            return false;
        }

        // Update the review timestamp
        const { error: updateError } = await supabase
            .from('patient_snapshot')
            .update({ last_doctor_reviewed_at: new Date().toISOString() })
            .eq('id', snapshot.id);

        if (updateError) {
            console.error('Error marking review:', updateError);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in markDoctorReview:', error);
        return false;
    }
}
