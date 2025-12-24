import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { AlertDefinition } from '../types/alerts';
import { supabase } from '../lib/supabase';
import ThemeToggle from './ThemeToggle';
import { LogoutIcon } from './icons/LogoutIcon';
import { LogoIcon } from './icons/LogoIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import AdminLabTypesPanel from './AdminLabTypesPanel';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Mock data for initial development - will be replaced with real service calls
const MOCK_USERS: User[] = [
    { id: '1', name: 'John Patient', email: 'john@example.com', role: 'patient', patientId: 'P-20231201-0001', condition: 'CKD Stage 3' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'patient', patientId: 'P-20231202-0002', condition: 'Hypertension' },
    { id: '3', name: 'Dr. Sarah Wilson', email: 'sarah@clinic.com', role: 'doctor', specialty: 'Nephrology' },
    { id: '4', name: 'Dr. Michael Chen', email: 'michael@clinic.com', role: 'doctor', specialty: 'Cardiology' },
];

type AdminView = 'dashboard' | 'users' | 'relationships' | 'alerts' | 'labtypes';

const AdminDashboardMain: React.FC = () => {
    const { user, profile, signOut } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');

    // Dynamic document title based on view
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Admin Dashboard';
            case 'users': return 'Manage Users';
            case 'relationships': return 'Maintain Connections';
            case 'alerts': return 'Clinical Alerts System';
            case 'labtypes': return 'Lab Record Types';
            default: return 'Admin Portal';
        }
    };

    useDocumentTitle(getViewTitle());
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'patient' | 'doctor'>('all');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Relationship management state
    const [relationships, setRelationships] = useState<any[]>([]);
    const [loadingRelationships, setLoadingRelationships] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');

    // Alert management state
    const [alertDefinitions, setAlertDefinitions] = useState<AlertDefinition[]>([]);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<AlertDefinition | null>(null);
    const [showAlertEditor, setShowAlertEditor] = useState(false);

    // Alert edit form state
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        severity: 'INFO' as 'INFO' | 'REVIEW' | 'URGENT',
        triggerValue: 0,
        triggerOperator: 'gte',
        triggerUnit: '',
        cooldownHours: 168,
        dedupWindowHours: 24,
    });

    // Initialize edit form when selecting an alert
    const openAlertEditor = (alertDef: AlertDefinition) => {
        const param = alertDef.trigger_conditions?.parameters?.[0];
        setEditForm({
            name: alertDef.name,
            description: alertDef.description || '',
            severity: alertDef.severity,
            triggerValue: typeof param?.value === 'number' ? param.value : Number(param?.value) || 0,
            triggerOperator: param?.operator || 'gte',
            triggerUnit: param?.unit || '',
            cooldownHours: alertDef.suppression_rules?.cooldown_hours || 168,
            dedupWindowHours: alertDef.suppression_rules?.deduplicate_window_hours || 24,
        });
        setSelectedAlert(alertDef);
        setShowAlertEditor(true);
    };

    // Fetch all users from database
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .neq('role', 'admin')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedUsers: User[] = (data || []).map((u: any) => ({
                id: u.id,
                name: u.name || u.email,
                email: u.email,
                role: u.role,
                patientId: u.patient_id,
                patient_id: u.patient_id,
                specialty: u.specialty,
                condition: u.condition,
                dateOfBirth: u.date_of_birth,
                date_of_birth: u.date_of_birth,
                created_at: u.created_at,
            }));

            setUsers(mappedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            // Fall back to mock data if database fetch fails
            setUsers(MOCK_USERS);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users based on search and role
    const filteredUsers = users.filter(u => {
        const matchesSearch =
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.patientId?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const patientCount = users.filter(u => u.role === 'patient').length;
    const doctorCount = users.filter(u => u.role === 'doctor').length;

    // Handle user impersonation (for debugging/support)
    const [isImpersonating, setIsImpersonating] = useState(false);

    const handleImpersonate = async (targetUser: User) => {
        if (!profile) {
            alert('Admin profile not loaded');
            return;
        }

        const confirmImpersonate = confirm(
            `Impersonate ${targetUser.name} (${targetUser.email})?\n\n` +
            `You will be logged in as this ${targetUser.role} and can view their dashboard.\n\n` +
            `A "Return to Admin" button will appear to restore your admin session.`
        );

        if (!confirmImpersonate) return;

        setIsImpersonating(true);

        try {
            // Dynamic import to avoid circular dependencies
            const { ImpersonationService } = await import('../services/impersonationService');

            const result = await ImpersonationService.startImpersonation(
                targetUser.id,
                profile.id,
                profile.email,
                profile.name
            );

            if (!result.success) {
                alert(`Impersonation failed: ${result.error}`);
                setIsImpersonating(false);
            }
            // If successful, the page will reload or redirect
        } catch (error) {
            console.error('Impersonation error:', error);
            alert('Failed to start impersonation. Please try again.');
            setIsImpersonating(false);
        }
    };

    // Handle user deletion
    // Handle user deletion
    const handleDeleteUser = async (targetUser: User) => {
        if (!confirm(`Are you sure you want to delete ${targetUser.name}?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            // Attempt to use the secure RPC function
            const { error: rpcError } = await (supabase as any).rpc('admin_delete_user_completely', {
                target_user_id: targetUser.id
            });

            if (rpcError) {
                console.warn('RPC deletion failed, checking fallback:', rpcError);
                // Fallback
                const { error: deleteError } = await supabase
                    .from('users')
                    .delete()
                    .eq('id', targetUser.id);

                if (deleteError) throw deleteError;

                alert(`User profile deleted (fallback). Run 'admin_full_delete_setup.sql' for full auth cleanup.`);
            } else {
                alert(`User ${targetUser.name} has been completely deleted.`);
            }

            setSelectedUser(null);
            fetchUsers();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            alert(`Failed to delete user: ${error.message || 'Unknown error'}`);
        }
    };

    // Fetch all relationships
    const fetchRelationships = async () => {
        setLoadingRelationships(true);
        try {
            const { data, error } = await supabase
                .from('patient_doctor_relationships')
                .select(`
                    id,
                    patient_id,
                    doctor_id,
                    created_at,
                    patient:patient_id(id, name, email, patient_id),
                    doctor:doctor_id(id, name, email, specialty)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRelationships(data || []);
        } catch (error) {
            console.error('Error fetching relationships:', error);
            setRelationships([]);
        } finally {
            setLoadingRelationships(false);
        }
    };

    // Create new patient-doctor relationship
    const createRelationship = async () => {
        if (!selectedPatientId || !selectedDoctorId) {
            alert('Please select both a patient and a doctor');
            return;
        }

        try {
            const { error } = await (supabase as any)
                .from('patient_doctor_relationships')
                .insert({
                    patient_id: selectedPatientId,
                    doctor_id: selectedDoctorId
                });

            if (error) {
                if (error.code === '23505') {
                    alert('This connection already exists!');
                } else {
                    throw error;
                }
            } else {
                alert('Connection created successfully!');
                setShowCreateModal(false);
                setSelectedPatientId('');
                setSelectedDoctorId('');
                fetchRelationships();
            }
        } catch (error) {
            console.error('Error creating relationship:', error);
            alert('Failed to create connection. Please try again.');
        }
    };

    // Delete relationship
    const deleteRelationship = async (relationshipId: string, patientName: string, doctorName: string) => {
        if (!confirm(`Are you sure you want to disconnect ${patientName} from ${doctorName}?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('patient_doctor_relationships')
                .delete()
                .eq('id', relationshipId);

            if (error) throw error;

            alert('Connection removed successfully!');
            fetchRelationships();
        } catch (error) {
            console.error('Error deleting relationship:', error);
            alert('Failed to remove connection. Please try again.');
        }
    };

    // Fetch relationships when viewing that tab
    useEffect(() => {
        if (activeView === 'relationships') {
            fetchRelationships();
        }
        if (activeView === 'alerts') {
            fetchAlertDefinitions();
        }
    }, [activeView]);

    // Fetch all alert definitions
    const fetchAlertDefinitions = async () => {
        setLoadingAlerts(true);
        try {
            const { data, error } = await (supabase as any)
                .from('cds_alert_definitions')
                .select('*')
                .order('category', { ascending: true });

            if (error) throw error;
            setAlertDefinitions(data || []);
        } catch (error) {
            console.error('Error fetching alert definitions:', error);
            setAlertDefinitions([]);
        } finally {
            setLoadingAlerts(false);
        }
    };

    // Toggle alert enabled/disabled
    const toggleAlertEnabled = async (alertId: string, enabled: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from('cds_alert_definitions')
                .update({ enabled, updated_at: new Date().toISOString() })
                .eq('id', alertId);

            if (error) throw error;

            // Update local state
            setAlertDefinitions(prev =>
                prev.map(a => a.id === alertId ? { ...a, enabled } : a)
            );
        } catch (error) {
            console.error('Error toggling alert:', error);
            alert('Failed to update alert. Please try again.');
        }
    };

    // Update alert definition
    const updateAlertDefinition = async (alertDef: Partial<AlertDefinition>) => {
        if (!selectedAlert) return;

        try {
            const { error } = await (supabase as any)
                .from('cds_alert_definitions')
                .update({
                    ...alertDef,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedAlert.id);

            if (error) throw error;

            alert('Alert updated successfully!');
            setShowAlertEditor(false);
            setSelectedAlert(null);
            fetchAlertDefinitions();
        } catch (error) {
            console.error('Error updating alert:', error);
            alert('Failed to update alert. Please try again.');
        }
    };

    // Save all form changes
    const saveAlertChanges = async () => {
        if (!selectedAlert) return;

        try {
            // Build updated trigger conditions
            const updatedTriggerConditions = {
                ...selectedAlert.trigger_conditions,
                parameters: selectedAlert.trigger_conditions?.parameters?.map((param, idx) =>
                    idx === 0 ? {
                        ...param,
                        value: editForm.triggerValue,
                        operator: editForm.triggerOperator,
                        unit: editForm.triggerUnit || param.unit
                    } : param
                ) || []
            };

            // Build updated suppression rules
            const updatedSuppressionRules = {
                ...selectedAlert.suppression_rules,
                cooldown_hours: editForm.cooldownHours,
                deduplicate_window_hours: editForm.dedupWindowHours
            };

            const { error } = await (supabase as any)
                .from('cds_alert_definitions')
                .update({
                    name: editForm.name,
                    description: editForm.description,
                    severity: editForm.severity,
                    trigger_conditions: updatedTriggerConditions,
                    suppression_rules: updatedSuppressionRules,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedAlert.id);

            if (error) throw error;

            alert('Alert saved successfully!');
            setShowAlertEditor(false);
            setSelectedAlert(null);
            fetchAlertDefinitions();
        } catch (error) {
            console.error('Error saving alert:', error);
            alert('Failed to save alert. Please try again.');
        }
    };

    // Stats Card Component
    const StatCard = ({ title, value, subtitle, icon, colorClass }: any) => (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    {icon}
                </div>
            </div>
        </div>
    );

    // User Detail Modal
    const UserDetailModal = () => {
        if (!selectedUser) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl ${getInitialsColor(selectedUser.name, selectedUser.email)} flex items-center justify-center text-white text-xl font-bold`}>
                                    {getInitials(selectedUser.name, selectedUser.email)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedUser.name}</h2>
                                    <p className="text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* User Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize mt-1">{selectedUser.role}</p>
                            </div>
                            {selectedUser.role === 'patient' && (
                                <>
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient ID</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white font-mono mt-1">{selectedUser.patientId || 'N/A'}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Condition</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{selectedUser.condition || 'N/A'}</p>
                                    </div>
                                </>
                            )}
                            {selectedUser.role === 'doctor' && (
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Specialty</p>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{selectedUser.specialty || 'General'}</p>
                                </div>
                            )}
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">User ID</p>
                                <p className="text-xs font-mono text-gray-900 dark:text-white mt-1 break-all">{selectedUser.id}</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => handleImpersonate(selectedUser)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                Impersonate
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedUser(null);
                                    handleDeleteUser(selectedUser);
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Delete User
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Dashboard View
    const renderDashboard = () => (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-amber-600 dark:text-amber-400 font-medium text-sm uppercase tracking-wider">Admin Portal</p>
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
                        Welcome back, <span className="text-amber-600 dark:text-amber-400">{profile?.name || 'Admin'}</span>
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Manage users, relationships, and monitor system health
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Total Patients"
                    value={patientCount}
                    subtitle="Active patient accounts"
                    icon={<svg className="w-6 h-6 text-rose-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>}
                    colorClass="bg-rose-100 dark:bg-rose-900/30"
                />
                <StatCard
                    title="Total Doctors"
                    value={doctorCount}
                    subtitle="Registered practitioners"
                    icon={<svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>}
                    colorClass="bg-blue-100 dark:bg-blue-900/30"
                />
                <StatCard
                    title="Total Users"
                    value={users.length}
                    subtitle="All registered users"
                    icon={<UserGroupIcon className="w-6 h-6 text-amber-600" />}
                    colorClass="bg-amber-100 dark:bg-amber-900/30"
                />
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={() => setActiveView('users')}
                        className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-rose-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">Manage Users</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">View all patients & doctors</p>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveView('relationships')}
                        className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">Connections</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Patient-Doctor links</p>
                        </div>
                    </button>
                    <button
                        onClick={() => fetchUsers()}
                        className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">Refresh Data</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Reload all users</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Recent Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Users</h2>
                        <button
                            onClick={() => setActiveView('users')}
                            className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
                        >
                            View all →
                        </button>
                    </div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">Loading users...</p>
                        </div>
                    ) : users.slice(0, 5).map(u => (
                        <div
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl ${getInitialsColor(u.name, u.email)} flex items-center justify-center text-white font-bold text-sm`}>
                                    {getInitials(u.name, u.email)}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${u.role === 'patient'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    }`}>
                                    {u.role}
                                </span>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // Users Management View
    const renderUsers = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage all patients and doctors</p>
                </div>
                <button
                    onClick={() => setActiveView('dashboard')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>
            </div>

            {/* Search & Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name, email, or patient ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['all', 'patient', 'doctor'] as const).map((role) => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                className={`px-4 py-2 rounded-xl font-medium transition-colors ${roleFilter === role
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1) + 's'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID / Specialty</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                                        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading users...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <p className="text-gray-500 dark:text-gray-400">No users found matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${getInitialsColor(u.name, u.email)} flex items-center justify-center text-white font-bold text-sm`}>
                                                {getInitials(u.name, u.email)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${u.role === 'patient'
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-900 dark:text-white font-mono">
                                            {u.role === 'patient' ? (u.patientId || 'N/A') : (u.specialty || 'General')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setSelectedUser(u)}
                                                className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleImpersonate(u)}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Impersonate"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    // Relationships Management View
    const patients = users.filter(u => u.role === 'patient');
    const doctors = users.filter(u => u.role === 'doctor');

    const renderRelationships = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Patient-Doctor Connections</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage relationships between patients and doctors</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        New Connection
                    </button>
                    <button
                        onClick={() => setActiveView('dashboard')}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Connections</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{relationships.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Available Patients</p>
                    <p className="text-2xl font-bold text-rose-600">{patients.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Available Doctors</p>
                    <p className="text-2xl font-bold text-blue-600">{doctors.length}</p>
                </div>
            </div>

            {/* Relationships Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Connections</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Patient</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Doctor</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Connected Since</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loadingRelationships ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                                        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading connections...</p>
                                    </td>
                                </tr>
                            ) : relationships.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400">No connections yet</p>
                                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Click "New Connection" to link a patient with a doctor</p>
                                    </td>
                                </tr>
                            ) : relationships.map((rel: any) => (
                                <tr key={rel.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${getInitialsColor(rel.patient?.name || '', rel.patient?.email || '')} flex items-center justify-center text-white font-bold text-sm`}>
                                                {getInitials(rel.patient?.name || 'P', rel.patient?.email || '')}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{rel.patient?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{rel.patient?.patient_id || rel.patient_id?.slice(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${getInitialsColor(rel.doctor?.name || '', rel.doctor?.email || '')} flex items-center justify-center text-white font-bold text-sm`}>
                                                {getInitials(rel.doctor?.name || 'D', rel.doctor?.email || '')}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{rel.doctor?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{rel.doctor?.specialty || 'General'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(rel.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => deleteRelationship(rel.id, rel.patient?.name || 'Patient', rel.doctor?.name || 'Doctor')}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Remove Connection"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Connection Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Connection</h2>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedPatientId('');
                                        setSelectedDoctorId('');
                                    }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select Patient
                                </label>
                                <select
                                    value={selectedPatientId}
                                    onChange={(e) => setSelectedPatientId(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">Choose a patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select Doctor
                                </label>
                                <select
                                    value={selectedDoctorId}
                                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">Choose a doctor...</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>Dr. {d.name} - {d.specialty || 'General'}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setSelectedPatientId('');
                                    setSelectedDoctorId('');
                                }}
                                className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createRelationship}
                                disabled={!selectedPatientId || !selectedDoctorId}
                                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Connection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Alerts Management View
    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            renal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
            electrolyte: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
            fluid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            adherence: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
            ops: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        };
        return colors[category] || colors.ops;
    };

    const getSeverityColor = (severity: string) => {
        const colors: Record<string, string> = {
            URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
            REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        };
        return colors[severity] || colors.INFO;
    };

    const renderAlerts = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alert Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Configure alert thresholds and notification rules</p>
                </div>
                <button
                    onClick={() => setActiveView('dashboard')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Rules</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{alertDefinitions.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                    <p className="text-2xl font-bold text-green-600">{alertDefinitions.filter(a => a.enabled).length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Urgent</p>
                    <p className="text-2xl font-bold text-red-600">{alertDefinitions.filter(a => a.severity === 'URGENT').length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Disabled</p>
                    <p className="text-2xl font-bold text-gray-500">{alertDefinitions.filter(a => !a.enabled).length}</p>
                </div>
            </div>

            {/* Alerts Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alert Rules</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Alert</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Severity</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Trigger</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loadingAlerts ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                                        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading alerts...</p>
                                    </td>
                                </tr>
                            ) : alertDefinitions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <p className="text-gray-500 dark:text-gray-400">No alert definitions found.</p>
                                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Run the CDS alerts SQL schema to add preset alerts.</p>
                                    </td>
                                </tr>
                            ) : alertDefinitions.map((alertDef: AlertDefinition) => (
                                <tr key={alertDef.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleAlertEnabled(alertDef.id, !alertDef.enabled)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${alertDef.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${alertDef.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{alertDef.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{alertDef.rule_id}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getCategoryColor(alertDef.category)}`}>
                                            {alertDef.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(alertDef.severity)}`}>
                                            {alertDef.severity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                        {alertDef.trigger_conditions?.type || 'N/A'}
                                        {alertDef.trigger_conditions?.parameters?.[0] && (
                                            <span className="ml-1 text-xs font-mono">
                                                ({alertDef.trigger_conditions.parameters[0].name} {alertDef.trigger_conditions.parameters[0].operator} {alertDef.trigger_conditions.parameters[0].value})
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openAlertEditor(alertDef)}
                                            className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                            title="Edit Alert"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Alert Editor Modal */}
            {showAlertEditor && selectedAlert && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Alert Rule</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{selectedAlert.rule_id}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAlertEditor(false);
                                        setSelectedAlert(null);
                                    }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alert Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                />
                            </div>

                            {/* Severity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity Level</label>
                                <div className="flex gap-2">
                                    {(['INFO', 'REVIEW', 'URGENT'] as const).map(sev => (
                                        <button
                                            key={sev}
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, severity: sev })}
                                            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${editForm.severity === sev
                                                ? getSeverityColor(sev)
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {sev}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Trigger Threshold */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Trigger Threshold
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        ({selectedAlert.trigger_conditions?.parameters?.[0]?.name || 'value'})
                                    </span>
                                </label>
                                <div className="flex gap-3">
                                    <select
                                        value={editForm.triggerOperator}
                                        onChange={(e) => setEditForm({ ...editForm, triggerOperator: e.target.value })}
                                        className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="gt">&gt; Greater than</option>
                                        <option value="gte">≥ Greater or equal</option>
                                        <option value="lt">&lt; Less than</option>
                                        <option value="lte">≤ Less or equal</option>
                                        <option value="eq">= Equal to</option>
                                        <option value="ne">≠ Not equal</option>
                                    </select>
                                    <input
                                        type="number"
                                        value={editForm.triggerValue}
                                        onChange={(e) => setEditForm({ ...editForm, triggerValue: parseFloat(e.target.value) || 0 })}
                                        className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-lg"
                                        step="0.1"
                                    />
                                    {editForm.triggerUnit && (
                                        <span className="px-4 py-3 bg-gray-100 dark:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 font-medium">
                                            {editForm.triggerUnit}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Suppression Rules */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suppression Rules</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cooldown (hours)</label>
                                        <input
                                            type="number"
                                            value={editForm.cooldownHours}
                                            onChange={(e) => setEditForm({ ...editForm, cooldownHours: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            min="0"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Time before alert can fire again</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dedup Window (hours)</label>
                                        <input
                                            type="number"
                                            value={editForm.dedupWindowHours}
                                            onChange={(e) => setEditForm({ ...editForm, dedupWindowHours: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            min="0"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Ignore duplicates within window</p>
                                    </div>
                                </div>
                            </div>

                            {/* Suggested Actions (read-only for now) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suggested Actions</label>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                    {selectedAlert.suggested_actions?.map((action, idx) => (
                                        <li key={idx}>{action}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAlertEditor(false);
                                    setSelectedAlert(null);
                                }}
                                className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => toggleAlertEnabled(selectedAlert.id, !selectedAlert.enabled)}
                                className={`px-6 py-3 font-medium rounded-xl transition-colors ${selectedAlert.enabled
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                                    }`}
                            >
                                {selectedAlert.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button
                                onClick={saveAlertChanges}
                                className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                                <LogoIcon className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 dark:text-white">BeanHealth</h1>
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Admin Portal</p>
                            </div>
                        </div>

                        {/* Nav Tabs */}
                        <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                            {(['dashboard', 'users', 'relationships', 'alerts', 'labtypes'] as AdminView[]).map((view) => (
                                <button
                                    key={view}
                                    onClick={() => setActiveView(view)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === view
                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                >
                                    {view === 'labtypes' ? 'Lab Types' : view.charAt(0).toUpperCase() + view.slice(1)}
                                </button>
                            ))}
                        </nav>

                        {/* Right Section */}
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile?.name || user?.email}</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">Administrator</p>
                                </div>
                                <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center text-white font-bold">
                                    {getInitials(profile?.name || user?.email || 'Admin', user?.email || '')}
                                </div>
                            </div>
                            <button
                                onClick={signOut}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Sign Out"
                            >
                                <LogoutIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeView === 'dashboard' && renderDashboard()}
                {activeView === 'users' && renderUsers()}
                {activeView === 'relationships' && renderRelationships()}
                {activeView === 'alerts' && renderAlerts()}
                {activeView === 'labtypes' && <AdminLabTypesPanel adminId={profile?.id || user?.id || ''} />}
            </main>

            {/* User Detail Modal */}
            <UserDetailModal />
        </div>
    );
};

export default AdminDashboardMain;
