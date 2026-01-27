import React, { useState, useEffect } from 'react';
import { AlertService } from '../services/alertService';
import type { AlertWithPatient, AlertCounts } from '../types/alerts';

interface AlertSummaryWidgetProps {
    doctorId: string;
    onViewAll?: () => void;
    onAlertClick?: (alert: AlertWithPatient) => void;
}

const severityConfig = {
    URGENT: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        icon: '🔴',
        text: 'text-red-700 dark:text-red-400',
        badge: 'bg-red-500'
    },
    REVIEW: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        icon: '🟡',
        text: 'text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-500'
    },
    INFO: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        icon: '🔵',
        text: 'text-blue-700 dark:text-blue-400',
        badge: 'bg-blue-500'
    }
};

const AlertSummaryWidget: React.FC<AlertSummaryWidgetProps> = ({
    doctorId,
    onViewAll,
    onAlertClick
}) => {
    const [alerts, setAlerts] = useState<AlertWithPatient[]>([]);
    const [counts, setCounts] = useState<AlertCounts>({ total: 0, urgent: 0, review: 0, info: 0, unacknowledged: 0 });
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        loadAlerts();

        // Subscribe to real-time updates
        const unsubscribe = AlertService.subscribeToAlerts(doctorId, (newAlert) => {
            setAlerts(prev => [newAlert as AlertWithPatient, ...prev].slice(0, 5));
            loadCounts();
        });

        return unsubscribe;
    }, [doctorId]);

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const [alertsData, countsData] = await Promise.all([
                AlertService.getAlertsForDoctor(doctorId, { limit: 5 }),
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

    const loadCounts = async () => {
        const countsData = await AlertService.getAlertCounts(doctorId);
        setCounts(countsData);
    };

    const handleAcknowledge = async (e: React.MouseEvent, alertId: string) => {
        e.stopPropagation();
        await AlertService.acknowledgeAlert(alertId, doctorId);
        loadAlerts();
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-primary-800 rounded-2xl border border-primary-200 dark:border-primary-700 p-6 animate-pulse">
                <div className="h-6 bg-primary-200 dark:bg-primary-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 bg-primary-100 dark:bg-primary-700 rounded-xl"></div>
                    <div className="h-16 bg-primary-100 dark:bg-primary-700 rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-primary-800 rounded-2xl border border-primary-200 dark:border-primary-700 overflow-hidden transition-all duration-300">
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-700/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <svg className="w-6 h-6 text-primary-600 dark:text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {counts.unacknowledged > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {counts.unacknowledged > 9 ? '9+' : counts.unacknowledged}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-100">
                        Clinical Alerts
                    </h3>
                    {/* Severity pills */}
                    <div className="flex gap-1.5 ml-2">
                        {counts.urgent > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                                {counts.urgent} Urgent
                            </span>
                        )}
                        {counts.review > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                                {counts.review} Review
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onViewAll && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewAll(); }}
                            className="text-sm font-medium text-secondary-600 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors"
                        >
                            View All
                        </button>
                    )}
                    <svg
                        className={`w-5 h-5 text-primary-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Alert List */}
            {expanded && (
                <div className="border-t border-primary-200 dark:border-primary-700">
                    {alerts.length === 0 ? (
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-primary-600 dark:text-primary-300 font-medium">No active alerts</p>
                            <p className="text-sm text-primary-400 dark:text-primary-500 mt-1">All patients are within normal parameters</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-primary-100 dark:divide-primary-700">
                            {alerts.map((alert) => {
                                const config = severityConfig[alert.severity];
                                return (
                                    <div
                                        key={alert.id}
                                        onClick={() => onAlertClick?.(alert)}
                                        className={`p-4 ${config.bg} hover:brightness-95 dark:hover:brightness-110 cursor-pointer transition-all`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-lg">{config.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold uppercase ${config.text}`}>
                                                        {alert.severity}
                                                    </span>
                                                    <span className="text-xs text-primary-400 dark:text-primary-500">
                                                        {formatTimeAgo(alert.fired_at)}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-primary-800 dark:text-primary-100 truncate">
                                                    {alert.alert_definition?.name || alert.rule_id}
                                                </p>
                                                <p className="text-sm text-primary-600 dark:text-primary-300 truncate">
                                                    {alert.patient_name}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => handleAcknowledge(e, alert.id)}
                                                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-primary-700 text-primary-700 dark:text-primary-200 rounded-lg border border-primary-200 dark:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-600 transition-colors"
                                            >
                                                Acknowledge
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AlertSummaryWidget;
