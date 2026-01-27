import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    apiGetPendingApprovals,
    apiGetAlertVersions,
    apiPreviewAlert,
    apiCreateVersion,
    apiApproveVersion,
    apiRollback,
    apiGetAuditTrail
} from '../services/adminApiService';
import { RuleJSON } from '../services/ruleEvaluator';
import RuleBuilder from './RuleBuilder';

// =============================================================================
// TYPES
// =============================================================================

interface RuleVersion {
    id: string;
    alert_id: string;
    version: number;
    rule_json: RuleJSON;
    severity: string;
    enabled: boolean;
    effective_from: string | null;
    created_by: string | null;
    created_at: string;
    approved_by: string | null;
    approved_at: string | null;
    change_reason: string | null;
    deprecated: boolean;
}

interface PreviewResult {
    matched_count: number;
    sample_patient_ids: string[];
}

type AdminTab = 'pending' | 'versions' | 'create' | 'audit';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const RuleEngineAdmin: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<AdminTab>('pending');
    const [pendingApprovals, setPendingApprovals] = useState<RuleVersion[]>([]);
    const [selectedAlertId, setSelectedAlertId] = useState<string>('');
    const [versions, setVersions] = useState<RuleVersion[]>([]);
    const [auditTrail, setAuditTrail] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Create form state
    const [createForm, setCreateForm] = useState({
        alertId: '',
        alertName: '',
        description: '',
        severity: 'review' as 'info' | 'review' | 'high' | 'critical',
        changeReason: '',
        ruleJson: '{\n  "operator": "gt",\n  "field": "labs.potassium",\n  "value": 5.5\n}'
    });

    // Visual builder state
    const [currentRule, setCurrentRule] = useState<RuleJSON>({ operator: 'gt', field: 'labs.potassium', value: 5.5 });
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Preview state
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // ==========================================================================
    // DATA FETCHING
    // ==========================================================================

    const fetchPendingApprovals = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiGetPendingApprovals();
            if (response.success) {
                setPendingApprovals(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchVersions = useCallback(async (alertId: string) => {
        if (!alertId) return;
        setIsLoading(true);
        try {
            const response = await apiGetAlertVersions(alertId);
            if (response.success) {
                setVersions(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching versions:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchAuditTrail = useCallback(async (alertId: string) => {
        if (!alertId) return;
        setIsLoading(true);
        try {
            const response = await apiGetAuditTrail(alertId);
            if (response.success) {
                setAuditTrail(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching audit trail:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'pending') {
            fetchPendingApprovals();
        }
    }, [activeTab, fetchPendingApprovals]);

    useEffect(() => {
        if (activeTab === 'versions' && selectedAlertId) {
            fetchVersions(selectedAlertId);
        }
        if (activeTab === 'audit' && selectedAlertId) {
            fetchAuditTrail(selectedAlertId);
        }
    }, [activeTab, selectedAlertId, fetchVersions, fetchAuditTrail]);

    // ==========================================================================
    // ACTIONS
    // ==========================================================================

    const handlePreview = async () => {
        setIsPreviewLoading(true);
        setPreviewResult(null);
        try {
            const ruleJson = showAdvanced ? JSON.parse(createForm.ruleJson) : currentRule;
            const response = await apiPreviewAlert({ alert_json: ruleJson });
            if (response.success && response.data) {
                setPreviewResult(response.data);
            } else {
                setMessage({ type: 'error', text: response.error || 'Preview failed' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Invalid JSON format' });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleCreateVersion = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const ruleJson = showAdvanced ? JSON.parse(createForm.ruleJson) : currentRule;
            const response = await apiCreateVersion({
                alert_id: createForm.alertId || crypto.randomUUID(),
                rule_json: ruleJson,
                severity: createForm.severity,
                change_reason: createForm.changeReason || `${createForm.alertName}: ${createForm.description}`,
                created_by: user.id
            });
            if (response.success) {
                setMessage({ type: 'success', text: response.data?.message || 'Version created!' });
                setCreateForm({ ...createForm, changeReason: '', alertName: '', description: '' });
                fetchPendingApprovals();
            } else {
                setMessage({ type: 'error', text: response.error || 'Failed to create version' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Invalid JSON format' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (versionId: string) => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiApproveVersion({
                alert_id: '',
                version_id: versionId,
                approved_by: user.id
            });
            if (response.success) {
                setMessage({ type: 'success', text: 'Version approved and activated!' });
                fetchPendingApprovals();
            } else {
                setMessage({ type: 'error', text: response.error || 'Failed to approve' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Approval failed' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRollback = async (alertId: string, targetVersion: number) => {
        if (!user?.id) return;
        const reason = window.prompt('Enter rollback reason:');
        if (!reason) return;

        setIsLoading(true);
        try {
            const response = await apiRollback({
                alert_id: alertId,
                target_version: targetVersion,
                rolled_back_by: user.id,
                reason
            });
            if (response.success) {
                setMessage({ type: 'success', text: response.data?.message || 'Rollback successful!' });
                fetchVersions(alertId);
            } else {
                setMessage({ type: 'error', text: response.error || 'Rollback failed' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Rollback failed' });
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================================================
    // RENDER HELPERS
    // ==========================================================================

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-600 text-white';
            case 'high': return 'bg-orange-500 text-white';
            case 'review': return 'bg-amber-500 text-white';
            case 'info': return 'bg-blue-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    };

    // ==========================================================================
    // RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                🔧 Rule Engine Admin
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Manage alert rules, approvals, and versioning
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Logged in as Admin
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${message.type === 'success'
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span>{message.type === 'success' ? '✅' : '❌'}</span>
                        <span>{message.text}</span>
                        <button onClick={() => setMessage(null)} className="ml-2 text-white/80 hover:text-white">×</button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex gap-2 mb-6">
                    {[
                        { id: 'pending', label: '⏳ Pending Approvals', count: pendingApprovals.length },
                        { id: 'create', label: '➕ Create Rule' },
                        { id: 'versions', label: '📋 Version History' },
                        { id: 'audit', label: '📜 Audit Trail' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AdminTab)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                )}

                {/* Tab Content */}
                {!isLoading && activeTab === 'pending' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Pending Approvals ({pendingApprovals.length})
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                High/Critical severity rules require approval before activation
                            </p>
                        </div>

                        {pendingApprovals.length === 0 ? (
                            <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                <span className="text-4xl mb-4 block">✅</span>
                                No pending approvals
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {pendingApprovals.map(version => (
                                    <div key={version.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityColor(version.severity)}`}>
                                                        {version.severity.toUpperCase()}
                                                    </span>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                                        Version {version.version}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                    Alert ID: {version.alert_id.slice(0, 8)}...
                                                </div>
                                                <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                                    {JSON.stringify(version.rule_json, null, 2)}
                                                </pre>
                                                {version.change_reason && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                                        <strong>Reason:</strong> {version.change_reason}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Created: {formatDate(version.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2 ml-4">
                                                <button
                                                    onClick={() => handleApprove(version.id)}
                                                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                                                >
                                                    ✅ Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedAlertId(version.alert_id);
                                                        setActiveTab('versions');
                                                    }}
                                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    View History
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!isLoading && activeTab === 'create' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Create Form */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Create New Rule Version
                            </h2>

                            <div className="space-y-4">
                                {/* Rule Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Rule Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.alertName}
                                        onChange={e => setCreateForm({ ...createForm, alertName: e.target.value })}
                                        placeholder="e.g., High Potassium Alert"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.description}
                                        onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                        placeholder="Brief description of when this rule triggers"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Severity */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Severity
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['info', 'review', 'high', 'critical'] as const).map(sev => (
                                            <button
                                                key={sev}
                                                type="button"
                                                onClick={() => setCreateForm({ ...createForm, severity: sev })}
                                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${createForm.severity === sev
                                                        ? sev === 'critical' ? 'bg-red-600 text-white'
                                                            : sev === 'high' ? 'bg-orange-500 text-white'
                                                                : sev === 'review' ? 'bg-amber-500 text-white'
                                                                    : 'bg-blue-500 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                {sev.charAt(0).toUpperCase() + sev.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    {(createForm.severity === 'high' || createForm.severity === 'critical') && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                            ⚠️ Requires approval before activation
                                        </p>
                                    )}
                                </div>

                                {/* Visual Builder / Advanced Toggle */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Rule Conditions
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!showAdvanced) {
                                                    setCreateForm({ ...createForm, ruleJson: JSON.stringify(currentRule, null, 2) });
                                                }
                                                setShowAdvanced(!showAdvanced);
                                            }}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            {showAdvanced ? '← Visual Builder' : 'Advanced JSON →'}
                                        </button>
                                    </div>

                                    {showAdvanced ? (
                                        <textarea
                                            value={createForm.ruleJson}
                                            onChange={e => setCreateForm({ ...createForm, ruleJson: e.target.value })}
                                            rows={10}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                                        />
                                    ) : (
                                        <RuleBuilder
                                            initialRule={currentRule}
                                            onChange={(rule) => setCurrentRule(rule)}
                                        />
                                    )}
                                </div>

                                {/* Change Reason (optional) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Change Reason (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.changeReason}
                                        onChange={e => setCreateForm({ ...createForm, changeReason: e.target.value })}
                                        placeholder="Additional notes for audit trail"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handlePreview}
                                        disabled={isPreviewLoading}
                                        className="flex-1 px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                                    >
                                        {isPreviewLoading ? '⏳ Loading...' : '👁️ Preview Impact'}
                                    </button>
                                    <button
                                        onClick={handleCreateVersion}
                                        disabled={!createForm.alertName}
                                        className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        ➕ Create Rule
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Preview Result */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Preview Impact
                            </h2>

                            {previewResult ? (
                                <div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                                            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                                {previewResult.matched_count}
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                Patients Affected
                                            </div>
                                        </div>
                                    </div>

                                    {previewResult.sample_patient_ids.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Sample Patient IDs:
                                            </h3>
                                            <div className="flex flex-wrap gap-1">
                                                {previewResult.sample_patient_ids.slice(0, 10).map(id => (
                                                    <span key={id} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded">
                                                        {id.slice(0, 8)}...
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <span className="text-4xl mb-4 block">👁️</span>
                                    Click "Preview Impact" to see how many patients would be affected
                                </div>
                            )}

                            {/* Example Rules */}
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Example Rules:
                                </h3>
                                <div className="space-y-2 text-xs">
                                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setCreateForm({ ...createForm, ruleJson: '{\n  "operator": "gt",\n  "field": "labs.potassium",\n  "value": 5.5\n}' })}>
                                        <strong>K+ &gt; 5.5:</strong> High potassium alert
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setCreateForm({ ...createForm, ruleJson: '{\n  "operator": "pct_drop",\n  "field": "labs.egfr",\n  "value": 20,\n  "within_days": 30\n}' })}>
                                        <strong>eGFR drop 20%:</strong> Rapid decline in kidney function
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setCreateForm({ ...createForm, ruleJson: '{\n  "operator": "med_in_list",\n  "field": "medications",\n  "value": ["ibuprofen", "naproxen", "aspirin"]\n}' })}>
                                        <strong>NSAID Alert:</strong> Patient on nephrotoxic medication
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setCreateForm({ ...createForm, ruleJson: '{\n  "operator": "no_recent_data",\n  "field": "labs.creatinine",\n  "within_days": 60\n}' })}>
                                        <strong>Missing Labs:</strong> No creatinine in 60 days
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === 'versions' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Version History
                            </h2>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    value={selectedAlertId}
                                    onChange={e => setSelectedAlertId(e.target.value)}
                                    onBlur={() => fetchVersions(selectedAlertId)}
                                    placeholder="Enter Alert ID to view versions..."
                                    className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                />
                            </div>
                        </div>

                        {versions.length === 0 ? (
                            <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                <span className="text-4xl mb-4 block">📋</span>
                                Enter an Alert ID to view version history
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {versions.map(version => (
                                    <div key={version.id} className={`px-6 py-4 ${version.enabled ? 'bg-green-50 dark:bg-green-900/20' : ''} ${version.deprecated ? 'opacity-50' : ''}`}>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                        Version {version.version}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityColor(version.severity)}`}>
                                                        {version.severity}
                                                    </span>
                                                    {version.enabled && (
                                                        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                    {version.deprecated && (
                                                        <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded">
                                                            DEPRECATED
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Created: {formatDate(version.created_at)}
                                                    {version.approved_at && ` • Approved: ${formatDate(version.approved_at)}`}
                                                </p>
                                                {version.change_reason && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                        {version.change_reason}
                                                    </p>
                                                )}
                                            </div>
                                            {!version.enabled && !version.deprecated && (
                                                <button
                                                    onClick={() => handleRollback(version.alert_id, version.version)}
                                                    className="px-3 py-1 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 transition-colors"
                                                >
                                                    🔄 Rollback
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!isLoading && activeTab === 'audit' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Audit Trail
                            </h2>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    value={selectedAlertId}
                                    onChange={e => setSelectedAlertId(e.target.value)}
                                    onBlur={() => fetchAuditTrail(selectedAlertId)}
                                    placeholder="Enter Alert ID to view audit trail..."
                                    className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                />
                            </div>
                        </div>

                        {auditTrail.length === 0 ? (
                            <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                <span className="text-4xl mb-4 block">📜</span>
                                Enter an Alert ID to view audit trail
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {auditTrail.map((event, idx) => (
                                    <div key={idx} className="px-6 py-3 flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${event.action === 'created' ? 'bg-blue-500' :
                                            event.action === 'approved' ? 'bg-green-500' :
                                                event.action === 'deprecated' ? 'bg-gray-500' : 'bg-gray-400'
                                            }`}>
                                            {event.action === 'created' ? '➕' :
                                                event.action === 'approved' ? '✅' :
                                                    event.action === 'deprecated' ? '🗑️' : '?'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                Version {event.version} {event.action}
                                            </div>
                                            {event.reason && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {event.reason}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {formatDate(event.at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RuleEngineAdmin;
