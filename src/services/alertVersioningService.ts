/**
 * Alert Versioning Service
 * 
 * Handles governance for alert rules:
 * - Version creation with change tracking
 * - Approval workflow (required for high/critical severity)
 * - Rollback to previous versions
 * - Deprecation
 */

import { supabase } from '../lib/supabase';
import { RuleJSON } from './ruleEvaluator';

// =============================================================================
// TYPES
// =============================================================================

export type AlertSeverity = 'info' | 'review' | 'high' | 'critical';

export interface RuleVersion {
    id: string;
    alert_id: string;
    version: number;
    rule_json: RuleJSON;
    severity: AlertSeverity;
    enabled: boolean;
    effective_from: string | null;
    effective_to: string | null;
    display_priority: number;
    created_by: string | null;
    created_at: string;
    approved_by: string | null;
    approved_at: string | null;
    change_reason: string | null;
    deprecated: boolean;
    deprecated_at: string | null;
    deprecated_by: string | null;
}

export interface CreateVersionInput {
    alertId: string;
    ruleJson: RuleJSON;
    severity: AlertSeverity;
    changeReason: string;
    createdBy: string;
    displayPriority?: number;
}

export interface ApprovalResult {
    success: boolean;
    message: string;
    versionId?: string;
    requiresApproval?: boolean;
}

// =============================================================================
// VERSION MANAGEMENT
// =============================================================================

/**
 * Get the next version number for an alert
 */
async function getNextVersion(alertId: string): Promise<number> {
    const { data, error } = await supabase
        .from('rule_versions')
        .select('version')
        .eq('alert_id', alertId)
        .order('version', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return 1;
    }
    return data[0].version + 1;
}

/**
 * Create a new rule version
 * Does NOT enable it - requires approval for high/critical
 */
export async function createRuleVersion(input: CreateVersionInput): Promise<ApprovalResult> {
    try {
        const nextVersion = await getNextVersion(input.alertId);

        // Check if approval is required (high/critical severity)
        const requiresApproval = ['high', 'critical'].includes(input.severity);

        const { data, error } = await supabase
            .from('rule_versions')
            .insert({
                alert_id: input.alertId,
                version: nextVersion,
                rule_json: input.ruleJson,
                severity: input.severity,
                enabled: false, // Never auto-enable
                effective_from: null, // Set on approval
                display_priority: input.displayPriority || 100,
                created_by: input.createdBy,
                change_reason: input.changeReason,
                deprecated: false
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error creating rule version:', error);
            return { success: false, message: error.message };
        }

        return {
            success: true,
            message: requiresApproval
                ? 'Version created. Requires approval before activation.'
                : 'Version created. Ready for activation.',
            versionId: data.id,
            requiresApproval
        };
    } catch (error) {
        console.error('Error in createRuleVersion:', error);
        return { success: false, message: 'Failed to create version' };
    }
}

/**
 * Get all versions for an alert
 */
export async function getAlertVersions(alertId: string): Promise<RuleVersion[]> {
    const { data, error } = await supabase
        .from('rule_versions')
        .select('*')
        .eq('alert_id', alertId)
        .order('version', { ascending: false });

    if (error) {
        console.error('Error fetching versions:', error);
        return [];
    }

    return data || [];
}

/**
 * Get a specific version
 */
export async function getVersion(versionId: string): Promise<RuleVersion | null> {
    const { data, error } = await supabase
        .from('rule_versions')
        .select('*')
        .eq('id', versionId)
        .single();

    if (error) {
        console.error('Error fetching version:', error);
        return null;
    }

    return data;
}

// =============================================================================
// APPROVAL WORKFLOW
// =============================================================================

/**
 * Approve a rule version
 * - Sets approved_by and approved_at
 * - Enables the version
 * - Sets effective_from to now
 * - Deprecates previous active version
 */
export async function approveVersion(
    versionId: string,
    approvedBy: string
): Promise<ApprovalResult> {
    try {
        // Get the version
        const version = await getVersion(versionId);
        if (!version) {
            return { success: false, message: 'Version not found' };
        }

        // Check if already approved
        if (version.approved_at) {
            return { success: false, message: 'Version already approved' };
        }

        // Check if approval is required
        const requiresApproval = ['high', 'critical'].includes(version.severity);
        if (requiresApproval && !approvedBy) {
            return {
                success: false,
                message: 'Approval required for high/critical severity rules',
                requiresApproval: true
            };
        }

        // Deprecate previous active version for same alert
        await supabase
            .from('rule_versions')
            .update({
                enabled: false,
                deprecated: true,
                deprecated_at: new Date().toISOString(),
                deprecated_by: approvedBy,
                effective_to: new Date().toISOString()
            })
            .eq('alert_id', version.alert_id)
            .eq('enabled', true)
            .neq('id', versionId);

        // Approve and enable this version
        const { error } = await supabase
            .from('rule_versions')
            .update({
                approved_by: approvedBy,
                approved_at: new Date().toISOString(),
                enabled: true,
                effective_from: new Date().toISOString()
            })
            .eq('id', versionId);

        if (error) {
            console.error('Error approving version:', error);
            return { success: false, message: error.message };
        }

        return {
            success: true,
            message: 'Version approved and activated',
            versionId
        };
    } catch (error) {
        console.error('Error in approveVersion:', error);
        return { success: false, message: 'Failed to approve version' };
    }
}

/**
 * Activate a version without approval (only for info/review severity)
 */
export async function activateVersion(
    versionId: string,
    activatedBy: string
): Promise<ApprovalResult> {
    try {
        const version = await getVersion(versionId);
        if (!version) {
            return { success: false, message: 'Version not found' };
        }

        // Block activation without approval for high/critical
        if (['high', 'critical'].includes(version.severity) && !version.approved_at) {
            return {
                success: false,
                message: 'High/critical rules require approval first',
                requiresApproval: true
            };
        }

        // Deprecate previous active version
        await supabase
            .from('rule_versions')
            .update({
                enabled: false,
                effective_to: new Date().toISOString()
            })
            .eq('alert_id', version.alert_id)
            .eq('enabled', true)
            .neq('id', versionId);

        // Enable this version
        const { error } = await supabase
            .from('rule_versions')
            .update({
                enabled: true,
                effective_from: new Date().toISOString()
            })
            .eq('id', versionId);

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Version activated', versionId };
    } catch (error) {
        console.error('Error in activateVersion:', error);
        return { success: false, message: 'Failed to activate version' };
    }
}

// =============================================================================
// ROLLBACK
// =============================================================================

/**
 * Rollback to a previous version
 * - Deprecates current version
 * - Activates target version
 */
export async function rollbackToVersion(
    alertId: string,
    targetVersion: number,
    rolledBackBy: string,
    reason: string
): Promise<ApprovalResult> {
    try {
        // Find the target version
        const { data: targetData, error: findError } = await supabase
            .from('rule_versions')
            .select('id, severity, deprecated')
            .eq('alert_id', alertId)
            .eq('version', targetVersion)
            .single();

        if (findError || !targetData) {
            return { success: false, message: 'Target version not found' };
        }

        if (targetData.deprecated) {
            // Un-deprecate the target version
            await supabase
                .from('rule_versions')
                .update({
                    deprecated: false,
                    deprecated_at: null,
                    deprecated_by: null
                })
                .eq('id', targetData.id);
        }

        // Deprecate current active version
        await supabase
            .from('rule_versions')
            .update({
                enabled: false,
                deprecated: true,
                deprecated_at: new Date().toISOString(),
                deprecated_by: rolledBackBy,
                effective_to: new Date().toISOString()
            })
            .eq('alert_id', alertId)
            .eq('enabled', true);

        // Activate target version
        const { error } = await supabase
            .from('rule_versions')
            .update({
                enabled: true,
                effective_from: new Date().toISOString(),
                change_reason: `Rollback: ${reason}`
            })
            .eq('id', targetData.id);

        if (error) {
            return { success: false, message: error.message };
        }

        return {
            success: true,
            message: `Rolled back to version ${targetVersion}`,
            versionId: targetData.id
        };
    } catch (error) {
        console.error('Error in rollbackToVersion:', error);
        return { success: false, message: 'Failed to rollback' };
    }
}

// =============================================================================
// DEPRECATION
// =============================================================================

/**
 * Deprecate a version (soft delete)
 */
export async function deprecateVersion(
    versionId: string,
    deprecatedBy: string,
    reason: string
): Promise<ApprovalResult> {
    try {
        const { error } = await supabase
            .from('rule_versions')
            .update({
                enabled: false,
                deprecated: true,
                deprecated_at: new Date().toISOString(),
                deprecated_by: deprecatedBy,
                effective_to: new Date().toISOString(),
                change_reason: `Deprecated: ${reason}`
            })
            .eq('id', versionId);

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Version deprecated', versionId };
    } catch (error) {
        console.error('Error in deprecateVersion:', error);
        return { success: false, message: 'Failed to deprecate' };
    }
}

// =============================================================================
// PENDING APPROVALS
// =============================================================================

/**
 * Get all versions pending approval
 */
export async function getPendingApprovals(): Promise<RuleVersion[]> {
    const { data, error } = await supabase
        .from('rule_versions')
        .select('*')
        .in('severity', ['high', 'critical'])
        .is('approved_at', null)
        .eq('deprecated', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching pending approvals:', error);
        return [];
    }

    return data || [];
}

// =============================================================================
// AUDIT TRAIL
// =============================================================================

/**
 * Get version history with changes
 */
export async function getVersionAuditTrail(alertId: string): Promise<{
    version: number;
    action: string;
    by: string | null;
    at: string;
    reason: string | null;
}[]> {
    const versions = await getAlertVersions(alertId);

    const trail: { version: number; action: string; by: string | null; at: string; reason: string | null }[] = [];

    for (const v of versions) {
        // Creation event
        trail.push({
            version: v.version,
            action: 'created',
            by: v.created_by,
            at: v.created_at,
            reason: v.change_reason
        });

        // Approval event
        if (v.approved_at) {
            trail.push({
                version: v.version,
                action: 'approved',
                by: v.approved_by,
                at: v.approved_at,
                reason: null
            });
        }

        // Deprecation event
        if (v.deprecated_at) {
            trail.push({
                version: v.version,
                action: 'deprecated',
                by: v.deprecated_by,
                at: v.deprecated_at,
                reason: v.change_reason
            });
        }
    }

    // Sort by date descending
    trail.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return trail;
}
