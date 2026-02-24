// CDS Alert Service
// Handles alert fetching, acknowledgment, and evaluation

import { supabase } from '../lib/supabase';
import type {
    AlertInstance,
    AlertDefinition,
    AlertCounts,
    AlertWithPatient,
    AlertAuditEntry
} from '../types/alerts';

export class AlertService {

    // ==========================================
    // Fetch Alerts
    // ==========================================

    /**
     * Get all active alerts for a doctor
     */
    static async getAlertsForDoctor(
        doctorId: string,
        options?: {
            limit?: number;
            includeAcknowledged?: boolean;
            severityFilter?: string[];
            categoryFilter?: string[];
        }
    ): Promise<AlertWithPatient[]> {
        let query = supabase
            .from('cds_alert_instances')
            .select(`
        *,
        alert_definition:cds_alert_definitions(name, category, description)
      `)
            .eq('doctor_id', doctorId)
            .eq('suppressed', false)
            .order('fired_at', { ascending: false });

        if (!options?.includeAcknowledged) {
            query = query.is('acknowledged_at', null);
        }

        if (options?.severityFilter?.length) {
            query = query.in('severity', options.severityFilter);
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching alerts:', error);
            throw error;
        }

        // Fetch patient names
        if (data && data.length > 0) {
            const patientIds = [...new Set(data.map(a => a.patient_id))];
            const { data: patients } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', patientIds);

            const patientMap = new Map(patients?.map(p => [p.id, p]) || []);

            return data.map(alert => ({
                ...alert,
                patient_name: patientMap.get(alert.patient_id)?.name || 'Unknown Patient',
                patient_avatar: patientMap.get(alert.patient_id)?.avatar_url
            }));
        }

        return [];
    }

    /**
     * Get alert counts for badge display
     */
    static async getAlertCounts(doctorId: string): Promise<AlertCounts> {
        const { data, error } = await supabase
            .from('cds_alert_instances')
            .select('severity, acknowledged_at')
            .eq('doctor_id', doctorId)
            .eq('suppressed', false)
            .is('acknowledged_at', null);

        if (error) {
            console.error('Error fetching alert counts:', error);
            return { total: 0, urgent: 0, review: 0, info: 0, unacknowledged: 0 };
        }

        const counts: AlertCounts = {
            total: data?.length || 0,
            urgent: data?.filter(a => a.severity === 'URGENT').length || 0,
            review: data?.filter(a => a.severity === 'REVIEW').length || 0,
            info: data?.filter(a => a.severity === 'INFO').length || 0,
            unacknowledged: data?.length || 0
        };

        return counts;
    }

    /**
     * Get a single alert by ID
     */
    static async getAlertById(alertId: string): Promise<AlertInstance | null> {
        const { data, error } = await supabase
            .from('cds_alert_instances')
            .select(`
        *,
        alert_definition:cds_alert_definitions(*)
      `)
            .eq('id', alertId)
            .single();

        if (error) {
            console.error('Error fetching alert:', error);
            return null;
        }

        return data;
    }

    // ==========================================
    // Alert Actions
    // ==========================================

    /**
     * Acknowledge an alert
     */
    static async acknowledgeAlert(
        alertId: string,
        userId: string,
        note?: string
    ): Promise<boolean> {
        const { error } = await supabase
            .from('cds_alert_instances')
            .update({
                acknowledged_at: new Date().toISOString(),
                acknowledged_by: userId,
                acknowledgment_note: note
            })
            .eq('id', alertId);

        if (error) {
            console.error('Error acknowledging alert:', error);
            return false;
        }

        // Log to audit
        await this.logAuditEntry({
            alert_instance_id: alertId,
            action: 'acknowledged',
            actor_id: userId,
            actor_role: 'doctor',
            details: { note }
        });

        return true;
    }

    /**
     * Dismiss/suppress an alert
     */
    static async dismissAlert(
        alertId: string,
        userId: string,
        reason: string
    ): Promise<boolean> {
        const { error } = await supabase
            .from('cds_alert_instances')
            .update({
                suppressed: true,
                suppression_reason: reason
            })
            .eq('id', alertId);

        if (error) {
            console.error('Error dismissing alert:', error);
            return false;
        }

        await this.logAuditEntry({
            alert_instance_id: alertId,
            action: 'dismissed',
            actor_id: userId,
            actor_role: 'doctor',
            details: { reason }
        });

        return true;
    }

    // ==========================================
    // Alert Definitions
    // ==========================================

    /**
     * Get all enabled alert definitions
     */
    static async getAlertDefinitions(): Promise<AlertDefinition[]> {
        const { data, error } = await supabase
            .from('cds_alert_definitions')
            .select('*')
            .eq('enabled', true)
            .order('category', { ascending: true });

        if (error) {
            console.error('Error fetching alert definitions:', error);
            return [];
        }

        return data || [];
    }

    // ==========================================
    // Audit Logging
    // ==========================================

    /**
     * Log an audit entry
     */
    private static async logAuditEntry(
        entry: Omit<AlertAuditEntry, 'id' | 'created_at'>
    ): Promise<void> {
        const { error } = await supabase
            .from('cds_alert_audit_log')
            .insert(entry);

        if (error) {
            console.error('Error logging audit entry:', error);
        }
    }

    /**
     * Get audit history for an alert
     */
    static async getAlertAuditHistory(alertId: string): Promise<AlertAuditEntry[]> {
        const { data, error } = await supabase
            .from('cds_alert_audit_log')
            .select('*')
            .eq('alert_instance_id', alertId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching audit history:', error);
            return [];
        }

        return data || [];
    }

    // ==========================================
    // Real-time Subscriptions
    // ==========================================

    /**
     * Subscribe to new alerts for a doctor
     */
    static subscribeToAlerts(
        doctorId: string,
        callback: (alert: AlertInstance) => void
    ) {
        const subscription = supabase
            .channel(`alerts-${doctorId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'cds_alert_instances',
                    filter: `doctor_id=eq.${doctorId}`
                },
                (payload) => {
                    callback(payload.new as AlertInstance);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }
}

export default AlertService;
