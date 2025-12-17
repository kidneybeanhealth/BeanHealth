import React, { useState, useEffect } from 'react';
import { AlertService } from '../services/alertService';
import type { AlertWithPatient, AlertCounts, AlertDefinition } from '../types/alerts';

interface AlertsPageProps {
    doctorId: string;
    onBack?: () => void;
    onViewPatient?: (patientId: string) => void;
}

const severityConfig = {
    URGENT: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-300 dark:border-red-700',
        icon: '🔴',
        text: 'text-red-700 dark:text-red-400',
        badge: 'bg-red-500 text-white'
    },
    REVIEW: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-300 dark:border-amber-700',
        icon: '🟡',
        text: 'text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-500 text-white'
    },
    INFO: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-300 dark:border-blue-700',
        icon: '🔵',
        text: 'text-blue-700 dark:text-blue-400',
        badge: 'bg-blue-500 text-white'
    }
};

const categoryLabels: Record<string, string> = {
    renal: 'Renal Function',
    electrolyte: 'Electrolytes',
    fluid: 'Fluid Balance',
    adherence: 'Adherence',
    ops: 'Operational'
};

const AlertsPage: React.FC<AlertsPageProps> = ({ doctorId, onBack, onViewPatient }) => {
    const [alerts, setAlerts] = useState<AlertWithPatient[]>([]);
    const [counts, setCounts] = useState<AlertCounts>({ total: 0, urgent: 0, review: 0, info: 0, unacknowledged: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState<AlertWithPatient | null>(null);
    const [filter, setFilter] = useState<{ severity?: string; showAcknowledged: boolean }>({ showAcknowledged: false });
    const [acknowledgeNote, setAcknowledgeNote] = useState('');

    useEffect(() => {
        loadAlerts();

        const unsubscribe = AlertService.subscribeToAlerts(doctorId, () => {
            loadAlerts();
        });

        return unsubscribe;
    }, [doctorId, filter]);

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const [alertsData, countsData] = await Promise.all([
                AlertService.getAlertsForDoctor(doctorId, {
                    includeAcknowledged: filter.showAcknowledged,
                    severityFilter: filter.severity ? [filter.severity] : undefined
                }),
                AlertService.getAlertCounts(doctorId)
            ]);
            setAlerts(alertsData);
            setCounts(countsData);
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcknowledge = async (alertId: string) => {
        await AlertService.acknowledgeAlert(alertId, doctorId, acknowledgeNote);
        setAcknowledgeNote('');
        setSelectedAlert(null);
        loadAlerts();
    };

    const handleDismiss = async (alertId: string, reason: string) => {
        await AlertService.dismissAlert(alertId, doctorId, reason);
        setSelectedAlert(null);
        loadAlerts();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-primary-50 dark:bg-primary-900">
            {/* Header */}
            <div className="bg-white dark:bg-primary-800 border-b border-primary-200 dark:border-primary-700 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="p-2 hover:bg-primary-100 dark:hover:bg-primary-700 rounded-xl transition-colors"
                                >
                                    <svg className="w-5 h-5 text-primary-600 dark:text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-100">Clinical Alerts</h1>
                                <p className="text-sm text-primary-500 dark:text-primary-400">
                                    {counts.unacknowledged} unacknowledged alerts
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-3">
                            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.urgent}</span>
                                <span className="text-xs text-red-600 dark:text-red-400 ml-1">Urgent</span>
                            </div>
                            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.review}</span>
                                <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">Review</span>
                            </div>
                            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.info}</span>
                                <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">Info</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 mt-4">
                        <button
                            onClick={() => setFilter(f => ({ ...f, severity: undefined }))}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${!filter.severity
                                    ? 'bg-primary-800 dark:bg-primary-100 text-white dark:text-primary-900'
                                    : 'bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-200 hover:bg-primary-200'
                                }`}
                        >
                            All
                        </button>
                        {['URGENT', 'REVIEW', 'INFO'].map(sev => (
                            <button
                                key={sev}
                                onClick={() => setFilter(f => ({ ...f, severity: f.severity === sev ? undefined : sev }))}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter.severity === sev
                                        ? severityConfig[sev as keyof typeof severityConfig].badge
                                        : 'bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-200 hover:bg-primary-200'
                                    }`}
                            >
                                {sev}
                            </button>
                        ))}
                        <div className="flex-1" />
                        <label className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filter.showAcknowledged}
                                onChange={(e) => setFilter(f => ({ ...f, showAcknowledged: e.target.checked }))}
                                className="rounded border-primary-300 dark:border-primary-600 text-secondary-600 focus:ring-secondary-500"
                            />
                            Show acknowledged
                        </label>
                    </div>
                </div>
            </div>

            {/* Alert List */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-primary-800 rounded-2xl p-6 animate-pulse">
                                <div className="h-6 bg-primary-200 dark:bg-primary-700 rounded w-1/3 mb-3"></div>
                                <div className="h-4 bg-primary-100 dark:bg-primary-700 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 bg-secondary-100 dark:bg-secondary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-primary-800 dark:text-primary-100 mb-2">All Clear!</h3>
                        <p className="text-primary-500 dark:text-primary-400">No alerts matching your filters</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {alerts.map((alert) => {
                            const config = severityConfig[alert.severity];
                            return (
                                <div
                                    key={alert.id}
                                    className={`bg-white dark:bg-primary-800 rounded-2xl border-l-4 ${config.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
                                >
                                    <div className="p-5">
                                        <div className="flex items-start gap-4">
                                            <span className="text-2xl">{config.icon}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-full ${config.badge}`}>
                                                        {alert.severity}
                                                    </span>
                                                    <span className="text-xs text-primary-400 dark:text-primary-500 px-2 py-0.5 bg-primary-100 dark:bg-primary-700 rounded-full">
                                                        {categoryLabels[alert.alert_definition?.category || ''] || alert.alert_definition?.category}
                                                    </span>
                                                    <span className="text-xs text-primary-400 dark:text-primary-500">
                                                        {formatDate(alert.fired_at)}
                                                    </span>
                                                    {alert.acknowledged_at && (
                                                        <span className="text-xs text-secondary-600 dark:text-secondary-400 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            Acknowledged
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-100 mb-1">
                                                    {alert.alert_definition?.name || alert.rule_id}
                                                </h3>

                                                <button
                                                    onClick={() => onViewPatient?.(alert.patient_id)}
                                                    className="text-secondary-600 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 font-medium text-sm mb-3"
                                                >
                                                    {alert.patient_name} →
                                                </button>

                                                <p className="text-primary-600 dark:text-primary-300 text-sm leading-relaxed mb-4">
                                                    {alert.rationale}
                                                </p>

                                                {/* Suggested Actions */}
                                                {alert.suggested_actions?.length > 0 && (
                                                    <div className="mb-4">
                                                        <p className="text-xs font-semibold text-primary-500 dark:text-primary-400 uppercase tracking-wide mb-2">
                                                            Suggested Actions
                                                        </p>
                                                        <ul className="space-y-1">
                                                            {alert.suggested_actions.map((action, i) => (
                                                                <li key={i} className="flex items-start gap-2 text-sm text-primary-600 dark:text-primary-300">
                                                                    <svg className="w-4 h-4 text-secondary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                    {action}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                {!alert.acknowledged_at && (
                                                    <div className="flex items-center gap-3 pt-3 border-t border-primary-100 dark:border-primary-700">
                                                        <button
                                                            onClick={() => setSelectedAlert(alert)}
                                                            className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-medium rounded-xl transition-colors"
                                                        >
                                                            Acknowledge
                                                        </button>
                                                        <button
                                                            onClick={() => handleDismiss(alert.id, 'Dismissed by clinician')}
                                                            className="px-4 py-2 bg-primary-100 dark:bg-primary-700 hover:bg-primary-200 dark:hover:bg-primary-600 text-primary-700 dark:text-primary-200 text-sm font-medium rounded-xl transition-colors"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Acknowledge Modal */}
            {selectedAlert && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-primary-800 rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-100 mb-4">
                            Acknowledge Alert
                        </h3>
                        <p className="text-sm text-primary-600 dark:text-primary-300 mb-4">
                            {selectedAlert.alert_definition?.name} - {selectedAlert.patient_name}
                        </p>
                        <textarea
                            value={acknowledgeNote}
                            onChange={(e) => setAcknowledgeNote(e.target.value)}
                            placeholder="Add a note (optional)..."
                            className="w-full px-4 py-3 bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 rounded-xl text-primary-800 dark:text-primary-100 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-secondary-500 resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => { setSelectedAlert(null); setAcknowledgeNote(''); }}
                                className="px-4 py-2 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleAcknowledge(selectedAlert.id)}
                                className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-xl transition-colors"
                            >
                                Acknowledge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertsPage;
