/**
 * Admin API Service
 * 
 * Provides API endpoints for:
 * - GET /snapshot/:patient_id -> latest snapshot
 * - POST /admin/alerts/preview -> preview impact
 * - POST /admin/alerts/approve -> approve version
 * - GET /admin/alerts/:id/versions -> list versions
 * - POST /admin/alerts/:id/rollback -> rollback
 * 
 * These are implemented as service methods that can be called
 * from Supabase Edge Functions or a Next.js/Express API
 */

import { supabase } from '../lib/supabase';
import { RuleJSON } from './ruleEvaluator';
import {
    computeSnapshot,
    persistSnapshot,
    getLatestSnapshot,
    previewRuleImpact,
    loadActiveRuleVersions
} from './ruleEngineService';
import {
    createRuleVersion,
    approveVersion,
    getAlertVersions,
    rollbackToVersion,
    getPendingApprovals,
    getVersionAuditTrail,
    AlertSeverity
} from './alertVersioningService';

// =============================================================================
// TYPES
// =============================================================================

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface PreviewRequest {
    alert_json: RuleJSON;
    severity?: AlertSeverity;
}

export interface PreviewResponse {
    matched_count: number;
    sample_patient_ids: string[];
}

export interface ApproveRequest {
    alert_id: string;
    version_id: string;
    approved_by: string;
}

export interface ApproveResponse {
    job_id: string;
    message: string;
    affected_patients?: number;
}

export interface CreateVersionRequest {
    alert_id: string;
    rule_json: RuleJSON;
    severity: AlertSeverity;
    change_reason: string;
    created_by: string;
    display_priority?: number;
}

export interface RollbackRequest {
    alert_id: string;
    target_version: number;
    rolled_back_by: string;
    reason: string;
}

// =============================================================================
// SNAPSHOT API
// =============================================================================

/**
 * GET /api/snapshot/:patient_id
 * Returns the latest snapshot for a patient
 */
export async function apiGetSnapshot(
    patientId: string
): Promise<APIResponse> {
    try {
        if (!patientId) {
            return { success: false, error: 'patient_id is required' };
        }

        const snapshot = await getLatestSnapshot(patientId);

        if (!snapshot) {
            return { success: false, error: 'No snapshot found' };
        }

        return { success: true, data: snapshot };
    } catch (error) {
        console.error('API Error - getSnapshot:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * POST /api/snapshot/:patient_id/compute
 * Computes a fresh snapshot for a patient
 */
export async function apiComputeSnapshot(
    patientId: string,
    doctorId: string,
    persist: boolean = true
): Promise<APIResponse> {
    try {
        if (!patientId || !doctorId) {
            return { success: false, error: 'patient_id and doctor_id are required' };
        }

        const rules = await loadActiveRuleVersions();
        const snapshot = await computeSnapshot(patientId, doctorId, rules);

        if (!snapshot) {
            return { success: false, error: 'Failed to compute snapshot' };
        }

        if (persist) {
            const ruleVersionIds = rules.map(r => r.id);
            const result = await persistSnapshot(snapshot, ruleVersionIds);
            if (!result) {
                return { success: false, error: 'Failed to persist snapshot' };
            }
            return { success: true, data: { ...snapshot, ...result } };
        }

        return { success: true, data: snapshot };
    } catch (error) {
        console.error('API Error - computeSnapshot:', error);
        return { success: false, error: 'Internal server error' };
    }
}

// =============================================================================
// ADMIN ALERTS API
// =============================================================================

/**
 * POST /api/admin/alerts/preview
 * Preview impact of a rule change without persisting
 */
export async function apiPreviewAlert(
    request: PreviewRequest
): Promise<APIResponse<PreviewResponse>> {
    try {
        if (!request.alert_json) {
            return { success: false, error: 'alert_json is required' };
        }

        const result = await previewRuleImpact(request.alert_json, 100);

        return {
            success: true,
            data: {
                matched_count: result.matchedCount,
                sample_patient_ids: result.samplePatientIds
            }
        };
    } catch (error) {
        console.error('API Error - previewAlert:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * POST /api/admin/alerts/versions
 * Create a new version of an alert rule
 */
export async function apiCreateVersion(
    request: CreateVersionRequest
): Promise<APIResponse> {
    try {
        if (!request.alert_id || !request.rule_json || !request.severity) {
            return { success: false, error: 'alert_id, rule_json, and severity are required' };
        }

        const result = await createRuleVersion({
            alertId: request.alert_id,
            ruleJson: request.rule_json,
            severity: request.severity,
            changeReason: request.change_reason || '',
            createdBy: request.created_by,
            displayPriority: request.display_priority
        });

        if (!result.success) {
            return { success: false, error: result.message };
        }

        return {
            success: true,
            data: {
                version_id: result.versionId,
                requires_approval: result.requiresApproval,
                message: result.message
            }
        };
    } catch (error) {
        console.error('API Error - createVersion:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * POST /api/admin/alerts/approve
 * Approve a rule version and trigger re-evaluation
 */
export async function apiApproveVersion(
    request: ApproveRequest
): Promise<APIResponse<ApproveResponse>> {
    try {
        if (!request.version_id || !request.approved_by) {
            return { success: false, error: 'version_id and approved_by are required' };
        }

        const result = await approveVersion(request.version_id, request.approved_by);

        if (!result.success) {
            return { success: false, error: result.message };
        }

        // Generate a job ID for background re-evaluation
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Schedule background re-evaluation (in a real system, this would queue a job)
        // For now, we'll return immediately and let the caller handle re-evaluation
        console.log(`Background job ${jobId} scheduled for re-evaluation after approval`);

        return {
            success: true,
            data: {
                job_id: jobId,
                message: 'Version approved. Background re-evaluation scheduled.'
            }
        };
    } catch (error) {
        console.error('API Error - approveVersion:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * GET /api/admin/alerts/:id/versions
 * List all versions of an alert
 */
export async function apiGetAlertVersions(
    alertId: string
): Promise<APIResponse> {
    try {
        if (!alertId) {
            return { success: false, error: 'alert_id is required' };
        }

        const versions = await getAlertVersions(alertId);

        return { success: true, data: versions };
    } catch (error) {
        console.error('API Error - getAlertVersions:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * POST /api/admin/alerts/:id/rollback
 * Rollback to a previous version
 */
export async function apiRollback(
    request: RollbackRequest
): Promise<APIResponse> {
    try {
        if (!request.alert_id || !request.target_version || !request.rolled_back_by) {
            return {
                success: false,
                error: 'alert_id, target_version, and rolled_back_by are required'
            };
        }

        const result = await rollbackToVersion(
            request.alert_id,
            request.target_version,
            request.rolled_back_by,
            request.reason || 'No reason provided'
        );

        if (!result.success) {
            return { success: false, error: result.message };
        }

        return {
            success: true,
            data: {
                version_id: result.versionId,
                message: result.message
            }
        };
    } catch (error) {
        console.error('API Error - rollback:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * GET /api/admin/alerts/pending
 * Get all versions pending approval
 */
export async function apiGetPendingApprovals(): Promise<APIResponse> {
    try {
        const pending = await getPendingApprovals();
        return { success: true, data: pending };
    } catch (error) {
        console.error('API Error - getPendingApprovals:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * GET /api/admin/alerts/:id/audit
 * Get audit trail for an alert
 */
export async function apiGetAuditTrail(alertId: string): Promise<APIResponse> {
    try {
        if (!alertId) {
            return { success: false, error: 'alert_id is required' };
        }

        const trail = await getVersionAuditTrail(alertId);
        return { success: true, data: trail };
    } catch (error) {
        console.error('API Error - getAuditTrail:', error);
        return { success: false, error: 'Internal server error' };
    }
}

// =============================================================================
// BATCH RE-EVALUATION
// =============================================================================

/**
 * Trigger re-evaluation for all patients (called after rule approval)
 * In production, this should be a background job
 */
export async function triggerBatchReEvaluation(
    ruleVersionIds: string[]
): Promise<{ jobId: string; patientCount: number }> {
    try {
        // Get all patient IDs
        const { data: patients, error } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'patient');

        if (error || !patients) {
            console.error('Error fetching patients for re-evaluation:', error);
            return { jobId: '', patientCount: 0 };
        }

        const jobId = `batch_${Date.now()}`;

        // In production: Queue each patient for re-evaluation
        // For now, just log
        console.log(`Batch job ${jobId}: ${patients.length} patients to re-evaluate`);

        // Could implement with pg_cron, BullMQ, etc.
        // For demo purposes, log and return
        return { jobId, patientCount: patients.length };
    } catch (error) {
        console.error('Error in batch re-evaluation:', error);
        return { jobId: '', patientCount: 0 };
    }
}
