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
        <div className="min-h-screen bg-[#F7F7F7] dark:bg-black font-sans">
            {/* Header */}
            <div className="bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="p-3 bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors group"
                                >
                                    <svg className="w-5 h-5 text-[#222222] dark:text-white group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <h1 className="text-3xl font-extrabold text-[#222222] dark:text-white tracking-tight">Clinical Alerts</h1>
                                <p className="text-[#717171] dark:text-[#a0a0a0] font-medium mt-1">
                                    {counts.unacknowledged} unacknowledged alerts
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4">
                            <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.urgent}</span>
                                <span className="text-sm font-bold text-red-600 dark:text-red-400">Urgent</span>
                            </div>
                            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center gap-2 border border-amber-100 dark:border-amber-900/30">
                                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.review}</span>
                                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Review</span>
                            </div>
                            <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center gap-2 border border-blue-100 dark:border-blue-900/30">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.info}</span>
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Info</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 mt-6 pb-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setFilter(f => ({ ...f, severity: undefined }))}
                            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${!filter.severity
                                ? 'bg-[#222222] dark:bg-white text-white dark:text-[#222222] shadow-md'
                                : 'bg-gray-100 dark:bg-gray-800 text-[#717171] dark:text-[#a0a0a0] hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            All
                        </button>
                        {['URGENT', 'REVIEW', 'INFO'].map(sev => (
                            <button
                                key={sev}
                                onClick={() => setFilter(f => ({ ...f, severity: f.severity === sev ? undefined : sev }))}
                                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${filter.severity === sev
                                    ? severityConfig[sev as keyof typeof severityConfig].badge
                                    : 'bg-gray-100 dark:bg-gray-800 text-[#717171] dark:text-[#a0a0a0] hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {sev}
                            </button>
                        ))}
                        <div className="flex-1" />
                        <label className="flex items-center gap-3 text-sm font-bold text-[#222222] dark:text-white cursor-pointer select-none bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={filter.showAcknowledged}
                                onChange={(e) => setFilter(f => ({ ...f, showAcknowledged: e.target.checked }))}
                                className="rounded border-gray-300 dark:border-gray-600 text-[#222222] focus:ring-[#222222]"
                            />
                            Show acknowledged
                        </label>
                    </div>
                </div>
            </div>

            {/* Alert List */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-8 animate-pulse shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
                                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3"></div>
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
                                    className={`bg-white dark:bg-[#1e1e1e] rounded-2xl border-l-4 ${config.border} overflow-hidden shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-lg transition-all duration-300`}
                                >
                                    <div className="p-8">
                                        <div className="flex items-start gap-6">
                                            <span className="text-3xl filter drop-shadow-sm">{config.icon}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center flex-wrap gap-3 mb-3">
                                                    <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wide shadow-sm ${config.badge}`}>
                                                        {alert.severity}
                                                    </span>
                                                    <span className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                                                        {categoryLabels[alert.alert_definition?.category || ''] || alert.alert_definition?.category}
                                                    </span>
                                                    <span className="text-xs font-medium text-[#717171] dark:text-[#a0a0a0]">
                                                        {formatDate(alert.fired_at)}
                                                    </span>
                                                    {alert.acknowledged_at && (
                                                        <span className="text-xs font-bold text-[#8AC43C] flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            Acknowledged
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="text-xl font-bold text-[#222222] dark:text-white mb-1">
                                                    {alert.alert_definition?.name || alert.rule_id}
                                                </h3>

                                                <button
                                                    onClick={() => onViewPatient?.(alert.patient_id)}
                                                    className="text-[#222222] dark:text-white hover:text-[#8AC43C] dark:hover:text-[#8AC43C] font-bold text-sm mb-4 transition-colors underline decoration-2 underline-offset-4"
                                                >
                                                    {alert.patient_name} →
                                                </button>

                                                <p className="text-[#717171] dark:text-[#a0a0a0] text-base leading-relaxed mb-6">
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
                                                    <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                                        <button
                                                            onClick={() => setSelectedAlert(alert)}
                                                            className="px-6 py-2.5 bg-[#222222] dark:bg-white text-white dark:text-[#222222] text-sm font-bold rounded-full hover:opacity-90 transition-opacity shadow-md"
                                                        >
                                                            Acknowledge
                                                        </button>
                                                        <button
                                                            onClick={() => handleDismiss(alert.id, 'Dismissed by clinician')}
                                                            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[#717171] dark:text-white text-sm font-bold rounded-full transition-colors"
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl max-w-md w-full p-8 shadow-2xl animate-scaleIn">
                        <h3 className="text-2xl font-bold text-[#222222] dark:text-white mb-2">
                            Acknowledge Alert
                        </h3>
                        <p className="text-sm font-medium text-[#717171] dark:text-[#a0a0a0] mb-6">
                            {selectedAlert.alert_definition?.name} - {selectedAlert.patient_name}
                        </p>
                        <textarea
                            value={acknowledgeNote}
                            onChange={(e) => setAcknowledgeNote(e.target.value)}
                            placeholder="Add a note (optional)..."
                            className="w-full px-5 py-4 bg-gray-50 dark:bg-[#2a2a2a] border-none rounded-2xl text-[#222222] dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[#222222] dark:focus:ring-white resize-none mb-6"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setSelectedAlert(null); setAcknowledgeNote(''); }}
                                className="px-6 py-2.5 text-[#717171] dark:text-[#a0a0a0] font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleAcknowledge(selectedAlert.id)}
                                className="px-6 py-2.5 bg-[#222222] dark:bg-white hover:opacity-90 text-white dark:text-[#222222] font-bold rounded-full transition-colors shadow-lg"
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
