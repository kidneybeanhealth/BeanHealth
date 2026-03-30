import React, { useState, useEffect } from 'react';
import { AlertService } from '../services/alertService';
import type { AlertWithPatient, AlertCounts, AlertDefinition } from '../types/alerts';
import { AlertIcon } from './icons/AlertIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XIcon } from './icons/XIcon';

interface AlertsPageProps {
    doctorId: string;
    onBack?: () => void;
    onViewPatient?: (patientId: string) => void;
}

const severityConfig = {
    URGENT: {
        border: 'border-l-4 border-l-red-500',
        text: 'text-red-600 dark:text-red-400',
        badge: 'bg-red-500 text-white',
        dot: 'bg-red-500'
    },
    REVIEW: {
        border: 'border-l-4 border-l-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500 text-white',
        dot: 'bg-amber-500'
    },
    INFO: {
        border: 'border-l-4 border-l-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-500 text-white',
        dot: 'bg-blue-500'
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
        <div className="min-h-screen bg-white dark:bg-black font-sans pb-24 md:pb-8">
            {/* Clean Minimal Header */}
            <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="flex items-center justify-center w-9 h-9 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors shrink-0"
                                    aria-label="Go back"
                                >
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                                    Alerts
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    {counts.unacknowledged} pending
                                </p>
                            </div>
                        </div>

                        {/* Clean Count Badges */}
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg">
                                <span className="text-sm font-semibold text-red-600 dark:text-red-400">{counts.urgent}</span>
                                <span className="text-xs text-red-600/70 dark:text-red-400/70">Urgent</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg">
                                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{counts.review}</span>
                                <span className="text-xs text-amber-600/70 dark:text-amber-400/70">Review</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{counts.info}</span>
                                <span className="text-xs text-blue-600/70 dark:text-blue-400/70">Info</span>
                            </span>
                        </div>
                    </div>

                    {/* Clean Filter Tabs */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                            <button
                                onClick={() => setFilter(f => ({ ...f, severity: undefined }))}
                                className={`px-4 py-2 text-sm font-medium transition-all duration-300 whitespace-nowrap rounded-md ${
                                    !filter.severity
                                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-black scale-105 shadow-md'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-900 hover:scale-105 active:scale-95'
                                }`}
                            >
                                All
                            </button>
                            {['URGENT', 'REVIEW', 'INFO'].map(sev => (
                                <button
                                    key={sev}
                                    onClick={() => setFilter(f => ({ ...f, severity: f.severity === sev ? undefined : sev }))}
                                    className={`px-4 py-2 text-sm font-medium transition-all duration-300 whitespace-nowrap rounded-md ${
                                        filter.severity === sev
                                            ? `${severityConfig[sev as keyof typeof severityConfig].badge} scale-105 shadow-md`
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-900 hover:scale-105 active:scale-95'
                                    }`}
                                >
                                    {sev.charAt(0) + sev.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={filter.showAcknowledged}
                                    onChange={(e) => setFilter(f => ({ ...f, showAcknowledged: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer-checked:bg-gray-900 dark:peer-checked:bg-gray-100 transition-all duration-300 shadow-inner"></div>
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white dark:bg-gray-900 rounded-full shadow-md transition-all duration-300 peer-checked:translate-x-4 peer-checked:bg-white dark:peer-checked:bg-black"></div>
                            </div>
                            <span className="group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Acknowledged</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Alert List */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-gray-950 rounded-lg p-4 animate-pulse border border-gray-200 dark:border-gray-800">
                                <div className="flex gap-3">
                                    <div className="w-1 h-16 bg-gray-200 dark:bg-gray-800 rounded shrink-0"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
                                        <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded w-2/3"></div>
                                        <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded w-1/2"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-full mb-4">
                            <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">All clear</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {filter.severity || filter.showAcknowledged 
                                ? 'No alerts match your filters' 
                                : 'No active alerts'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => {
                            const config = severityConfig[alert.severity];
                            return (
                                <div
                                    key={alert.id}
                                    className={`bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 ${config.border} hover:border-gray-300 dark:hover:border-gray-700 transition-colors`}
                                >
                                    <div className="p-4">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                                                        {alert.severity}
                                                    </span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {categoryLabels[alert.alert_definition?.category || ''] || alert.alert_definition?.category}
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                                                    {alert.alert_definition?.name || alert.rule_id}
                                                </h3>
                                                <button
                                                    onClick={() => onViewPatient?.(alert.patient_id)}
                                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                                >
                                                    {alert.patient_name}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {alert.acknowledged_at && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-xs font-medium rounded-md">
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                        <span className="hidden sm:inline">Acknowledged</span>
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-400 dark:text-gray-600">
                                                    {formatDate(alert.fired_at)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Rationale */}
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                                            {alert.rationale}
                                        </p>

                                        {/* Suggested Actions */}
                                        {alert.suggested_actions?.length > 0 && (
                                            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                                    Recommended actions
                                                </p>
                                                <ul className="space-y-1.5">
                                                    {alert.suggested_actions.map((action, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                            <span className="text-gray-400 dark:text-gray-600 shrink-0">{i + 1}.</span>
                                                            <span>{action}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        {!alert.acknowledged_at && (
                                            <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                <button
                                                    onClick={() => setSelectedAlert(alert)}
                                                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-black text-sm font-medium rounded-md hover:opacity-80 transition-opacity"
                                                >
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                    Acknowledge
                                                </button>
                                                <button
                                                    onClick={() => handleDismiss(alert.id, 'Dismissed by clinician')}
                                                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium rounded-md hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Clean Acknowledge Modal */}
            {selectedAlert && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedAlert(null); setAcknowledgeNote(''); }}>
                    <div className="bg-white dark:bg-black rounded-lg max-w-md w-full border border-gray-200 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                        Acknowledge Alert
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {selectedAlert.alert_definition?.name}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {selectedAlert.patient_name}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setSelectedAlert(null); setAcknowledgeNote(''); }}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Note (optional)
                            </label>
                            <textarea
                                value={acknowledgeNote}
                                onChange={(e) => setAcknowledgeNote(e.target.value)}
                                placeholder="Add notes about your review..."
                                className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 focus:border-gray-400 dark:focus:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white placeholder:text-gray-400 resize-none focus:outline-none focus:ring-0"
                                rows={4}
                                autoFocus
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2 p-6 pt-0">
                            <button
                                onClick={() => { setSelectedAlert(null); setAcknowledgeNote(''); }}
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleAcknowledge(selectedAlert.id)}
                                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-black text-sm font-medium rounded-md hover:opacity-80 transition-opacity"
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
