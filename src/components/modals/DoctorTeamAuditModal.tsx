import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface AssistantRow {
    assistant_id: string;
    assistant_name: string;
    assistant_code: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

interface AuditRow {
    audit_id: number;
    created_at: string;
    actor_type: 'chief' | 'assistant';
    assistant_id: string | null;
    actor_display_name: string;
    event_type: string;
    event_category: 'auth' | 'view' | 'write' | 'print';
    audit_patient_id: string | null;
    patient_name: string | null;
    patient_mr_number: string | null;
    audit_queue_id: string | null;
    audit_prescription_id: string | null;
    route: string | null;
    metadata: Record<string, any> | null;
    total_count: number;
}

interface DoctorTeamAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    hospitalId: string;
    chiefDoctorId: string;
    sessionToken: string;
}

const EVENT_TYPES = [
    'auth.login.success',
    'auth.login.failed',
    'auth.logout',
    'view.queue.open',
    'view.patient.open',
    'view.prescription.open',
    'print.preview.open',
    'write.prescription.save_send',
    'write.queue.mark_done',
];

const EVENT_CATEGORIES = ['auth', 'view', 'write', 'print'];

const DoctorTeamAuditModal: React.FC<DoctorTeamAuditModalProps> = ({
    isOpen,
    onClose,
    hospitalId,
    chiefDoctorId,
    sessionToken,
}) => {
    const [activeTab, setActiveTab] = useState<'team' | 'audit'>('team');
    const [loadingAssistants, setLoadingAssistants] = useState(false);
    const [assistants, setAssistants] = useState<AssistantRow[]>([]);
    const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCode, setEditCode] = useState('');
    const [resetAssistantId, setResetAssistantId] = useState<string | null>(null);
    const [newPasscode, setNewPasscode] = useState('');

    const [newAssistantName, setNewAssistantName] = useState('');
    const [newAssistantCode, setNewAssistantCode] = useState('');
    const [newAssistantPasscode, setNewAssistantPasscode] = useState('');
    const [creatingAssistant, setCreatingAssistant] = useState(false);

    const [loadingAudit, setLoadingAudit] = useState(false);
    const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
    const [auditPage, setAuditPage] = useState(0);
    const [auditLimit] = useState(25);
    const [auditStartDate, setAuditStartDate] = useState('');
    const [auditEndDate, setAuditEndDate] = useState('');
    const [auditAssistantId, setAuditAssistantId] = useState('');
    const [auditEventType, setAuditEventType] = useState('');
    const [auditEventCategory, setAuditEventCategory] = useState('');

    const totalAuditRows = useMemo(() => {
        if (auditRows.length === 0) return 0;
        return Number(auditRows[0].total_count || 0);
    }, [auditRows]);

    const hasPrevPage = auditPage > 0;
    const hasNextPage = (auditPage + 1) * auditLimit < totalAuditRows;

    const fetchAssistants = async () => {
        setLoadingAssistants(true);
        try {
            const { data, error } = await (supabase as any).rpc('doctor_list_assistants', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
            });
            if (error) throw error;
            setAssistants(Array.isArray(data) ? data : []);
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] fetchAssistants failed:', error);
            toast.error(error?.message || 'Failed to load assistants');
        } finally {
            setLoadingAssistants(false);
        }
    };

    const fetchAuditLogs = async (page = auditPage) => {
        setLoadingAudit(true);
        try {
            const { data, error } = await (supabase as any).rpc('doctor_get_audit_logs', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
                p_page: page,
                p_limit: auditLimit,
                p_start_at: auditStartDate ? `${auditStartDate}T00:00:00+05:30` : null,
                p_end_at: auditEndDate ? `${auditEndDate}T23:59:59+05:30` : null,
                p_assistant_id: auditAssistantId || null,
                p_patient_id: null,
                p_event_type: auditEventType || null,
                p_event_category: auditEventCategory || null,
            });
            if (error) throw error;
            setAuditRows(Array.isArray(data) ? data : []);
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] fetchAuditLogs failed:', error);
            toast.error(error?.message || 'Failed to load audit logs');
        } finally {
            setLoadingAudit(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchAssistants();
        fetchAuditLogs(0);
        setAuditPage(0);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === 'audit') {
            fetchAuditLogs(auditPage);
        }
    }, [activeTab, auditPage]);

    const handleCreateAssistant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAssistantName.trim() || !newAssistantCode.trim() || !newAssistantPasscode.trim()) {
            toast.error('Assistant name, code, and passcode are required');
            return;
        }
        setCreatingAssistant(true);
        try {
            const { error } = await (supabase as any).rpc('doctor_create_assistant', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
                p_assistant_name: newAssistantName.trim(),
                p_assistant_code: newAssistantCode.trim().toUpperCase(),
                p_passcode: newAssistantPasscode,
            });
            if (error) throw error;
            toast.success('Assistant created');
            setNewAssistantName('');
            setNewAssistantCode('');
            setNewAssistantPasscode('');
            fetchAssistants();
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] create assistant failed:', error);
            toast.error(error?.message || 'Failed to create assistant');
        } finally {
            setCreatingAssistant(false);
        }
    };

    const handleToggleAssistantActive = async (assistant: AssistantRow) => {
        try {
            const { error } = await (supabase as any).rpc('doctor_set_assistant_active', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
                p_assistant_id: assistant.assistant_id,
                p_is_active: !assistant.is_active,
            });
            if (error) throw error;
            toast.success(assistant.is_active ? 'Assistant deactivated' : 'Assistant activated');
            fetchAssistants();
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] toggle assistant failed:', error);
            toast.error(error?.message || 'Failed to update assistant');
        }
    };

    const openEditAssistant = (assistant: AssistantRow) => {
        setEditingAssistantId(assistant.assistant_id);
        setEditName(assistant.assistant_name);
        setEditCode(assistant.assistant_code);
    };

    const handleSaveAssistant = async () => {
        if (!editingAssistantId) return;
        try {
            const { error } = await (supabase as any).rpc('doctor_update_assistant', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
                p_assistant_id: editingAssistantId,
                p_assistant_name: editName.trim(),
                p_assistant_code: editCode.trim().toUpperCase(),
            });
            if (error) throw error;
            toast.success('Assistant updated');
            setEditingAssistantId(null);
            setEditName('');
            setEditCode('');
            fetchAssistants();
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] update assistant failed:', error);
            toast.error(error?.message || 'Failed to update assistant');
        }
    };

    const handleResetAssistantPasscode = async () => {
        if (!resetAssistantId || !newPasscode.trim()) {
            toast.error('New passcode is required');
            return;
        }
        try {
            const { error } = await (supabase as any).rpc('doctor_reset_assistant_passcode', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
                p_assistant_id: resetAssistantId,
                p_new_passcode: newPasscode,
            });
            if (error) throw error;
            toast.success('Assistant passcode reset');
            setResetAssistantId(null);
            setNewPasscode('');
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] reset passcode failed:', error);
            toast.error(error?.message || 'Failed to reset passcode');
        }
    };

    const handleExportCsv = async () => {
        try {
            const { data, error } = await (supabase as any).rpc('doctor_get_audit_logs', {
                p_hospital_id: hospitalId,
                p_chief_doctor_id: chiefDoctorId,
                p_session_token: sessionToken,
                p_page: 0,
                p_limit: 5000,
                p_start_at: auditStartDate ? `${auditStartDate}T00:00:00+05:30` : null,
                p_end_at: auditEndDate ? `${auditEndDate}T23:59:59+05:30` : null,
                p_assistant_id: auditAssistantId || null,
                p_patient_id: null,
                p_event_type: auditEventType || null,
                p_event_category: auditEventCategory || null,
            });
            if (error) throw error;

            const rows: AuditRow[] = Array.isArray(data) ? data : [];
            const header = [
                'timestamp',
                'actor_type',
                'actor_name',
                'event_type',
                'event_category',
                'patient_name',
                'patient_mr',
                'patient_id',
                'queue_id',
                'prescription_id',
                'route',
            ];
            const lines = rows.map((row) => ([
                row.created_at,
                row.actor_type,
                row.actor_display_name,
                row.event_type,
                row.event_category,
                row.patient_name || '',
                row.patient_mr_number || '',
                row.audit_patient_id || '',
                row.audit_queue_id || '',
                row.audit_prescription_id || '',
                row.route || '',
                row.audit_id,
            ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')));

            const csv = [header.join(','), ...lines].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('CSV export started');
        } catch (error: any) {
            console.error('[DoctorTeamAuditModal] export csv failed:', error);
            toast.error(error?.message || 'Failed to export CSV');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Team & Audit</h2>
                        <p className="text-sm text-gray-500">Chief-only PA management and activity logs</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 pt-4">
                    <div className="inline-flex p-1 rounded-xl bg-gray-100 border border-gray-200">
                        <button
                            type="button"
                            onClick={() => setActiveTab('team')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'team' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                        >
                            PA Management
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('audit')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg ${activeTab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                        >
                            Audit Logs
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'team' ? (
                        <div className="space-y-5">
                            <form onSubmit={handleCreateAssistant} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <input
                                    type="text"
                                    value={newAssistantName}
                                    onChange={(e) => setNewAssistantName(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                    placeholder="Assistant name"
                                />
                                <input
                                    type="text"
                                    value={newAssistantCode}
                                    onChange={(e) => setNewAssistantCode(e.target.value.toUpperCase())}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm uppercase"
                                    placeholder="Assistant code"
                                />
                                <input
                                    type="password"
                                    value={newAssistantPasscode}
                                    onChange={(e) => setNewAssistantPasscode(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                    placeholder="Initial passcode"
                                />
                                <button
                                    type="submit"
                                    disabled={creatingAssistant}
                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                                >
                                    {creatingAssistant ? 'Creating...' : 'Create PA'}
                                </button>
                            </form>

                            <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500">
                                    <span>Name</span>
                                    <span>Code</span>
                                    <span>Status</span>
                                    <span>Last Login</span>
                                    <span>Actions</span>
                                </div>
                                {loadingAssistants ? (
                                    <div className="p-8 text-sm text-gray-500">Loading assistants...</div>
                                ) : assistants.length === 0 ? (
                                    <div className="p-8 text-sm text-gray-500">No assistants configured.</div>
                                ) : (
                                    assistants.map((assistant) => (
                                        <div key={assistant.assistant_id} className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-3 px-4 py-3 border-b border-gray-100 last:border-0 items-center text-sm">
                                            <div>
                                                {editingAssistantId === assistant.assistant_id ? (
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded"
                                                    />
                                                ) : assistant.assistant_name}
                                            </div>
                                            <div>
                                                {editingAssistantId === assistant.assistant_id ? (
                                                    <input
                                                        type="text"
                                                        value={editCode}
                                                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded uppercase"
                                                    />
                                                ) : assistant.assistant_code}
                                            </div>
                                            <div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${assistant.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {assistant.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                {assistant.last_login_at ? new Date(assistant.last_login_at).toLocaleString('en-IN') : 'Never'}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {editingAssistantId === assistant.assistant_id ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveAssistant}
                                                            className="px-2.5 py-1.5 text-xs font-bold rounded bg-blue-600 text-white"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingAssistantId(null);
                                                                setEditName('');
                                                                setEditCode('');
                                                            }}
                                                            className="px-2.5 py-1.5 text-xs font-bold rounded bg-gray-100 text-gray-700"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditAssistant(assistant)}
                                                            className="px-2.5 py-1.5 text-xs font-bold rounded bg-gray-100 text-gray-700"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setResetAssistantId(assistant.assistant_id);
                                                                setNewPasscode('');
                                                            }}
                                                            className="px-2.5 py-1.5 text-xs font-bold rounded bg-amber-100 text-amber-700"
                                                        >
                                                            Reset Passcode
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleAssistantActive(assistant)}
                                                            className={`px-2.5 py-1.5 text-xs font-bold rounded ${assistant.is_active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                                                        >
                                                            {assistant.is_active ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {resetAssistantId && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <input
                                        type="password"
                                        value={newPasscode}
                                        onChange={(e) => setNewPasscode(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-amber-200 rounded-lg text-sm"
                                        placeholder="Enter new passcode"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleResetAssistantPasscode}
                                            className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold"
                                        >
                                            Confirm Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setResetAssistantId(null);
                                                setNewPasscode('');
                                            }}
                                            className="px-3 py-2 bg-white border border-amber-200 text-amber-700 rounded-lg text-sm font-bold"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                <input
                                    type="date"
                                    value={auditStartDate}
                                    onChange={(e) => setAuditStartDate(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                />
                                <input
                                    type="date"
                                    value={auditEndDate}
                                    onChange={(e) => setAuditEndDate(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                />
                                <select
                                    value={auditAssistantId}
                                    onChange={(e) => setAuditAssistantId(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                >
                                    <option value="">All Assistants</option>
                                    {assistants.map((assistant) => (
                                        <option key={assistant.assistant_id} value={assistant.assistant_id}>
                                            {assistant.assistant_name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={auditEventType}
                                    onChange={(e) => setAuditEventType(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                >
                                    <option value="">All Event Types</option>
                                    {EVENT_TYPES.map((eventType) => (
                                        <option key={eventType} value={eventType}>{eventType}</option>
                                    ))}
                                </select>
                                <select
                                    value={auditEventCategory}
                                    onChange={(e) => setAuditEventCategory(e.target.value)}
                                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                                >
                                    <option value="">All Categories</option>
                                    {EVENT_CATEGORIES.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuditPage(0);
                                            fetchAuditLogs(0);
                                        }}
                                        className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportCsv}
                                        className="flex-1 px-3 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold"
                                    >
                                        Export CSV
                                    </button>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-[1.5fr_1.2fr_2fr_2fr_2fr] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500">
                                    <span>Time</span>
                                    <span>Actor</span>
                                    <span>Event</span>
                                    <span>Patient</span>
                                    <span>Context</span>
                                </div>
                                {loadingAudit ? (
                                    <div className="p-8 text-sm text-gray-500">Loading audit logs...</div>
                                ) : auditRows.length === 0 ? (
                                    <div className="p-8 text-sm text-gray-500">No logs for current filters.</div>
                                ) : (
                                    auditRows.map((row) => (
                                        <div key={row.audit_id} className="grid grid-cols-[1.5fr_1.2fr_2fr_2fr_2fr] gap-3 px-4 py-3 border-b border-gray-100 last:border-0 text-sm">
                                            <div className="text-gray-700">{new Date(row.created_at).toLocaleString('en-IN')}</div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{row.actor_display_name}</div>
                                                <div className="text-xs text-gray-500 uppercase">{row.actor_type}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{row.event_type}</div>
                                                <div className="text-xs text-gray-500">{row.event_category}</div>
                                            </div>
                                            <div className="text-gray-700">
                                                <div>{row.patient_name || '-'}</div>
                                                <div className="text-xs text-gray-500">
                                                    {row.patient_mr_number ? `MR: ${row.patient_mr_number}` : row.audit_patient_id || ''}
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                <div className="truncate">{row.route || '-'}</div>
                                                {row.audit_queue_id && <div>Q: {row.audit_queue_id.slice(0, 8)}...</div>}
                                                {row.audit_prescription_id && <div>Rx: {row.audit_prescription_id.slice(0, 8)}...</div>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    Showing {Math.min(totalAuditRows, auditPage * auditLimit + 1)}-
                                    {Math.min(totalAuditRows, (auditPage + 1) * auditLimit)} of {totalAuditRows}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => hasPrevPage && setAuditPage((page) => page - 1)}
                                        disabled={!hasPrevPage}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => hasNextPage && setAuditPage((page) => page + 1)}
                                        disabled={!hasNextPage}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoctorTeamAuditModal;
