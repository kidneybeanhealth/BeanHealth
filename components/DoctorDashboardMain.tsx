import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationProvider, useNotifications } from '../contexts/NotificationContext';
import { User, ChatMessage, Patient } from '../types';
import { PatientAdditionService } from '../services/patientInvitationService';
import { ChatService } from '../services/chatService';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { VitalsService, MedicationService } from '../services/dataService';
import { AlertService } from '../services/alertService';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import ThemeToggle from './ThemeToggle';
import { LogoutIcon } from './icons/LogoutIcon';
import { LogoIcon } from './icons/LogoIcon';
import Messages from './Messages';
import DoctorPatientView from './DoctorPatientView';
import AlertSummaryWidget from './AlertSummaryWidget';
import AlertsPage from './AlertsPage';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import DoctorReferralCard from './DoctorReferralCard';
import DoctorMobileBottomNav, { DoctorView } from './DoctorMobileBottomNav';
import type { AlertCounts } from '../types/alerts';

const DoctorDashboardMain: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [patients, setPatients] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DoctorView>('dashboard');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [alertCounts, setAlertCounts] = useState<AlertCounts>({ total: 0, urgent: 0, review: 0, info: 0, unacknowledged: 0 });

  // Fetch alert counts
  const fetchAlertCounts = async () => {
    if (!user?.id) return;
    try {
      const counts = await AlertService.getAlertCounts(user.id);
      setAlertCounts(counts);
    } catch (err) {
      console.error('Error fetching alert counts:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAlertCounts();
      // Refresh every 30 seconds
      const interval = setInterval(fetchAlertCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Fetch doctor's patients
  const fetchPatients = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const patientsData = await PatientAdditionService.getDoctorPatients(user.id);
      setPatients(patientsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for all patients
  const fetchMessages = async () => {
    if (!user?.id || patients.length === 0) return;

    try {
      const allMessages = await ChatService.getAllConversations(user.id);
      setMessages(allMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [user?.id]);

  useEffect(() => {
    fetchMessages();
  }, [patients, user?.id]);

  const handleSendMessage = async (message: Omit<ChatMessage, 'id' | 'timestamp' | 'isRead'>) => {
    try {
      await ChatService.sendMessage(
        message.senderId,
        message.recipientId,
        message.text,
        message.isUrgent
      );
      fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleMarkMessagesAsRead = async (patientId: string) => {
    console.log('Mark messages as read for patient:', patientId);
  };

  const handleViewPatient = async (patient: User) => {
    try {
      const [records, vitalsData, vitalsHistory, medicationsData] = await Promise.all([
        MedicalRecordsService.getMedicalRecordsByPatientId(patient.id).catch(() => []),
        VitalsService.getLatestVitals(patient.id).catch(() => null),
        VitalsService.getPatientVitals(patient.id).catch(() => []),
        MedicationService.getPatientMedications(patient.id).catch(() => [])
      ]);

      const patientData: Patient = {
        ...patient,
        role: 'patient' as const,
        patientId: patient.patientId || patient.patient_id, // User-friendly patient ID
        dateOfBirth: patient.dateOfBirth || patient.date_of_birth || '1990-01-01',
        condition: patient.condition || 'General Health',
        subscriptionTier: (patient.subscriptionTier || patient.subscription_tier || 'FreeTrial') as 'FreeTrial' | 'Paid',
        urgentCredits: patient.urgentCredits || patient.urgent_credits || 0,
        vitals: vitalsData || {
          bloodPressure: { value: 'N/A', unit: 'mmHg', trend: 'stable' as const },
          heartRate: { value: 'N/A', unit: 'bpm', trend: 'stable' as const },
          temperature: { value: 'N/A', unit: '°F', trend: 'stable' as const }
        },
        vitalsHistory: vitalsHistory || [],
        medications: medicationsData || [],
        records: records || [],
        doctors: [],
        chatMessages: messages.filter(m =>
          (m.senderId === patient.id && m.recipientId === user?.id) ||
          (m.senderId === user?.id && m.recipientId === patient.id)
        )
      };

      setSelectedPatient(patientData);
      setActiveView('patient-detail');
    } catch (err) {
      console.error('Error loading patient data:', err);
    }
  };

  const handleBackToDashboard = () => {
    setSelectedPatient(null);
    setActiveView('dashboard');
  };

  // Local calculation for fallback
  const localUnreadCount = messages.filter(m =>
    m.recipientId === user?.id && !m.isRead
  ).length;

  // Helper component to display notification badge with context
  const MessagesNotificationBadge: React.FC<{ localCount: number }> = ({ localCount }) => {
    const { unreadMessageCount, hasUrgentMessages } = useNotifications();
    const count = unreadMessageCount || localCount;

    if (count === 0) return null;

    return (
      <>
        <span className={`text-white text-[10px] px-1.5 py-0.5 rounded-full ${hasUrgentMessages ? 'bg-red-500 animate-pulse' : 'bg-[#8AC43C]'}`}>
          {count}
        </span>
        {hasUrgentMessages && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </>
    );
  };

  // Helper component for Messages stat card with context
  const MessagesStatCard: React.FC<{ localCount: number }> = ({ localCount }) => {
    const { unreadMessageCount } = useNotifications();
    const count = unreadMessageCount || localCount;

    return (
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-shadow duration-300 border border-transparent dark:border-gray-800">
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider">Messages</h3>
              <MessagesIcon className="w-6 h-6 text-[#8AC43C]" />
            </div>
            <span className="text-4xl font-extrabold text-[#222222] dark:text-[#f7f7f7] tracking-tight">{count}</span>
          </div>
          <p className="text-sm font-medium text-[#717171] dark:text-[#888888] mt-2">Awaiting response</p>
        </div>
      </div>
    );
  };

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-shadow duration-300 border border-transparent dark:border-gray-800">
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider">{title}</h3>
            <Icon className={`w-6 h-6 ${colorClass}`} />
          </div>
          <span className="text-4xl font-extrabold text-[#222222] dark:text-[#f7f7f7] tracking-tight">{value}</span>
        </div>
        <p className="text-sm font-medium text-[#717171] dark:text-[#888888] mt-2">{subtext}</p>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-10 pb-12 animate-fade-in">
      {/* Welcome & Date */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#222222] dark:text-white tracking-tight leading-tight">
            Welcome back, <br />
            <span className="text-[#8AC43C]">Dr. {profile?.name || user?.email?.split('@')[0] || ''}</span>
          </h1>
        </div>
        <div className="flex items-center">
          <div className="bg-white dark:bg-[#1e1e1e] px-5 py-2.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-none border border-gray-100 dark:border-gray-800">
            <span className="text-sm font-semibold text-[#222222] dark:text-[#e0e0e0]">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8">
        <StatCard
          title="Patients"
          value={loading ? '...' : patients.length}
          subtext="Currently active"
          icon={UserGroupIcon}
          colorClass="text-[#8AC43C]"
        />
        <MessagesStatCard localCount={localUnreadCount} />
        <StatCard
          title="Reviews"
          value="0"
          subtext="Pending tasks"
          icon={DocumentIcon}
          colorClass="text-[#8AC43C]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content: Recent Patients */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#222222] dark:text-white">Recent Patients</h2>
            <button className="text-sm font-semibold text-[#222222] dark:text-white underline decoration-2 underline-offset-4 hover:text-[#8AC43C] dark:hover:text-[#8AC43C] transition-colors">
              View all
            </button>
          </div>

          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[#8AC43C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[#717171]">Loading library...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-16 text-center">
                <div className="mx-auto w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <UserGroupIcon className="w-8 h-8 text-[#717171]" />
                </div>
                <h3 className="text-lg font-bold text-[#222222] dark:text-white mb-2">No patients yet</h3>
                <p className="text-[#717171] max-w-xs mx-auto">Share your referral code to start checking up on patients.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {patients.slice(0, 5).map((patient, idx) => (
                  <div
                    key={patient.id}
                    onClick={() => handleViewPatient(patient)}
                    className={`group flex items-center justify-between p-5 cursor-pointer hover:bg-[#F7F7F7] dark:hover:bg-[#2c2c2c] transition-colors ${idx !== patients.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full bg-[#222222] dark:bg-white flex items-center justify-center text-white dark:text-[#222222] font-bold text-sm shadow-sm scale-100 group-hover:scale-105 transition-transform`}>
                        {getInitials(patient.name, patient.email)}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#222222] dark:text-white text-base group-hover:text-[#8AC43C] transition-colors">
                          {patient.name || patient.email}
                        </h4>
                        <p className="text-sm text-[#717171] dark:text-[#a0a0a0] font-medium">
                          {patient.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewPatient(patient); }}
                        className="px-6 py-2.5 rounded-full bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-600 text-sm font-bold text-[#222222] dark:text-white hover:border-[#222222] dark:hover:border-white transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {user?.id && <DoctorReferralCard doctorId={user.id} />}
        </div>
      </div>
    </div>
  );

  const renderMessages = () => {
    const patientContacts = patients.map(patient => ({
      ...patient,
      role: 'patient' as const,
      dateOfBirth: patient.dateOfBirth || patient.date_of_birth || '1990-01-01',
      condition: patient.condition || 'General Health',
      subscriptionTier: (patient.subscriptionTier || patient.subscription_tier || 'FreeTrial') as 'FreeTrial' | 'Paid',
      urgentCredits: patient.urgentCredits || patient.urgent_credits || 0,
      vitals: {
        bloodPressure: { value: '', unit: 'mmHg', trend: 'stable' as const },
        heartRate: { value: '', unit: 'bpm', trend: 'stable' as const },
        temperature: { value: '', unit: '°F', trend: 'stable' as const }
      },
      vitalsHistory: [],
      medications: [],
      records: [],
      doctors: [],
      chatMessages: messages.filter(m =>
        (m.senderId === patient.id && m.recipientId === user?.id) ||
        (m.senderId === user?.id && m.recipientId === patient.id)
      ),
      aiSummary: ''
    }));

    const currentUserContact = user ? {
      ...user,
      name: profile?.name || user.email || 'Doctor',
      email: user.email!,
      role: 'doctor' as const,
      avatarUrl: null, avatar_url: null,
      specialty: profile?.specialty || null,
      dateOfBirth: profile?.date_of_birth || null, date_of_birth: profile?.date_of_birth || null,
      condition: null, subscriptionTier: null, subscription_tier: null,
      urgentCredits: null, urgent_credits: null,
      trialEndsAt: null, trial_ends_at: null,
      notes: null,
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null
    } : null;

    if (!currentUserContact) return null;

    return (
      <Messages
        currentUser={currentUserContact}
        contacts={patientContacts}
        messages={messages}
        onSendMessage={handleSendMessage}
        onMarkMessagesAsRead={handleMarkMessagesAsRead}
        preselectedContactId={null}
        clearPreselectedContact={() => { }}
        onNavigateToBilling={() => { }}
        onMenuClick={() => setActiveView('dashboard')}
      />
    );
  };

  // Determine patient status based on alerts and vitals
  const getPatientStatus = (patientId: string): 'critical' | 'attention' | 'stable' => {
    // For now, base on alert counts - in future, check individual patient alerts
    if (alertCounts.urgent > 0) return 'critical';
    if (alertCounts.review > 0) return 'attention';
    return 'stable';
  };

  const statusConfig = {
    critical: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: '🔴', label: 'Critical' },
    attention: { color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: '🟡', label: 'Attention' },
    stable: { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: '🟢', label: 'Stable' }
  };

  const renderMonitoring = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Patient Monitoring</h1>
          <p className="text-gray-600 dark:text-gray-400">Real-time patient status and alerts</p>
        </div>
        <div className="flex items-center gap-3">
          {alertCounts.urgent > 0 && (
            <button
              onClick={() => setActiveView('alerts')}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full font-bold animate-pulse"
            >
              <span>🔴</span>
              <span>{alertCounts.urgent} Urgent</span>
            </button>
          )}
          <button
            onClick={() => setActiveView('alerts')}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-[#222222] dark:text-white rounded-full font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <span>View All Alerts</span>
            {alertCounts.total > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">{alertCounts.total}</span>
            )}
          </button>
        </div>
      </div>

      {/* Alert Summary Widget */}
      <AlertSummaryWidget
        doctorId={user?.id || ''}
        onViewAll={() => setActiveView('alerts')}
        onAlertClick={(alert) => {
          const patient = patients.find(p => p.id === alert.patient_id);
          if (patient) handleViewPatient(patient);
        }}
      />

      {/* Patients Grid */}
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Patients ({patients.length})</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Loading patients...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No patients linked yet.</p>
            </div>
          ) : patients.map(patient => {
            const status = getPatientStatus(patient.id);
            const config = statusConfig[status];
            return (
              <div key={patient.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full bg-[#222222] dark:bg-white flex items-center justify-center text-white dark:text-[#222222] font-bold text-sm shadow-sm">
                    {getInitials(patient.name || '', patient.email)}
                  </div>
                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{patient.name || patient.email}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {patient.patientId || 'ID pending'} • {patient.condition || 'No condition set'}
                    </p>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveView('messages');
                      // Could pre-select patient in messages
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Send Message"
                  >
                    <MessagesIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleViewPatient(patient)}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                    title="View Patient"
                  >
                    <DocumentIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAlerts = () => (
    <AlertsPage
      doctorId={user?.id || ''}
      onBack={() => setActiveView('monitoring')}
      onViewPatient={(patientId) => {
        const patient = patients.find(p => p.id === patientId);
        if (patient) handleViewPatient(patient);
      }}
    />
  );

  return (
    <NotificationProvider userId={user?.id || ''} activeView={activeView} userRole="doctor">
      <div className="min-h-screen bg-[#F7F7F7] dark:bg-black font-sans text-[#222222] selection:bg-[#8AC43C] selection:text-white">

        {/* Sticky Header */}
        <div className={`sticky top-0 z-30 transition-all duration-300 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 ${activeView === 'messages' ? 'hidden md:block' : ''}`}>
          <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12">
            <div className="flex items-center justify-between h-20">
              {/* Logo / Brand Area */}
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                  <LogoIcon className="w-9 h-9 md:w-10 md:h-10" />
                </div>
                <div className="flex flex-col justify-center">
                  <h2 className="text-lg md:text-xl font-bold leading-none tracking-tight">
                    <span className="text-[#3A2524] dark:text-[#e6b8a3]">Bean</span>
                    <span className="text-[#8AC43C]">Health</span>
                  </h2>
                  <p className="text-[9px] md:text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5">DOCTOR PORTAL</p>
                </div>
              </div>

              {/* Center Tabs */}
              {/* Center Tabs - Desktop Only */}
              <nav className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 p-1 bg-gray-100 dark:bg-[#2c2c2c] rounded-full">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${activeView === 'dashboard'
                    ? 'bg-white dark:bg-black text-[#222222] dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                    : 'text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setActiveView('monitoring')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${activeView === 'monitoring' || activeView === 'alerts'
                    ? 'bg-white dark:bg-black text-[#222222] dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                    : 'text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <span>Monitoring</span>
                  {alertCounts.urgent > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                      {alertCounts.urgent}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveView('messages')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 relative ${activeView === 'messages'
                    ? 'bg-white dark:bg-black text-[#222222] dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                    : 'text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <span>Messages</span>
                  <MessagesNotificationBadge localCount={localUnreadCount} />
                </button>
              </nav>

              {/* Right User Actions */}
              <div className="flex items-center gap-5">
                <ThemeToggle />

                <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-1 sm:mx-2"></div>

                <button
                  onClick={signOut}
                  className="group flex items-center p-1 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-500 ease-out"
                  aria-label="Log out"
                >
                  {/* Info Text (Hidden on Mobile) */}
                  <div className="hidden md:block text-right pr-3 group-hover:opacity-50 transition-opacity">
                    <p className="text-sm font-bold text-[#222222] dark:text-white leading-none">
                      {profile?.name || user?.email?.split('@')[0] || 'Doctor'}
                    </p>
                    <p className="text-xs text-[#717171] dark:text-[#a0a0a0] font-medium mt-0.5">
                      {profile?.specialty || 'MD'}
                    </p>
                  </div>

                  <div className="relative z-10">
                    <div className="h-9 w-9 md:h-10 md:w-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold text-xs md:text-sm shadow-md ring-2 ring-white dark:ring-black transition-colors duration-300">
                      {getInitials(profile?.name || user?.email || 'Dr', user?.email || '')}
                    </div>
                    {/* Online indicator */}
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-black bg-green-500"></span>
                  </div>

                  <div className="max-w-0 group-hover:max-w-[100px] overflow-hidden transition-all duration-500 ease-out opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-2 pl-3 pr-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">
                      <span className="md:hidden">Log out</span>
                      <LogoutIcon className="h-4 w-4 text-red-500" />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className={`transition-all duration-500 ${activeView === 'messages' ? 'h-[calc(100vh-80px)] pb-24 md:pb-0' : 'py-10 pb-28 md:pb-10'}`}>
          <div className={`${activeView === 'messages' ? 'h-full' : 'max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12'}`}>
            {activeView === 'dashboard' && renderDashboard()}

            {activeView === 'monitoring' && renderMonitoring()}

            {activeView === 'alerts' && renderAlerts()}

            {activeView === 'messages' && (
              <div className="h-full px-4 pt-4">
                {renderMessages()}
              </div>
            )}

            {activeView === 'patient-detail' && selectedPatient && (
              <div className="animate-slide-up min-h-[80vh]">
                <DoctorPatientView
                  patient={selectedPatient}
                  onBack={handleBackToDashboard}
                />
              </div>
            )}
          </div>
        </main>
        <DoctorMobileNavWrapper activeView={activeView} setActiveView={setActiveView} />
      </div>
    </NotificationProvider>
  );
};

// Wrapper to use notification context
const DoctorMobileNavWrapper: React.FC<{
  activeView: DoctorView;
  setActiveView: (view: DoctorView) => void;
}> = ({ activeView, setActiveView }) => {
  const { unreadMessageCount, hasUrgentMessages } = useNotifications();
  return (
    <DoctorMobileBottomNav
      activeView={activeView}
      setActiveView={setActiveView}
      unreadMessageCount={unreadMessageCount}
      hasUrgentMessages={hasUrgentMessages}
    />
  );
};

export default DoctorDashboardMain;