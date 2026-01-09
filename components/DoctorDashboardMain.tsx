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
import WhatsAppChatWindow from './WhatsAppChatWindow';
import DoctorPatientView from './DoctorPatientViewRedesign';
import AlertSummaryWidget from './AlertSummaryWidget';
import AlertsPage from './AlertsPage';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import DoctorReferralCard from './DoctorReferralCard';
import DoctorMobileBottomNav, { DoctorView } from './DoctorMobileBottomNav';
import type { AlertCounts } from '../types/alerts';
import ProfileModal from './ProfileModal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const DoctorDashboardMain: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [patients, setPatients] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DoctorView>('dashboard');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // State for fullscreen WhatsApp chat
  const [showFullScreenChat, setShowFullScreenChat] = useState(false);

  // Dynamic document title based on view
  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Doctor Portal';
      case 'monitoring': return 'Patient Monitoring';
      case 'alerts': return 'Clinical Alerts';
      case 'messages': return 'Messages';
      case 'patient-detail': return selectedPatient ? `Monitoring: ${selectedPatient.name}` : 'Patient Detail';
      default: return 'Doctor Portal';
    }
  };

  useDocumentTitle(getViewTitle());

  const [alertCounts, setAlertCounts] = useState<AlertCounts>({ total: 0, urgent: 0, review: 0, info: 0, unacknowledged: 0 });
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
        <span className={`text-white text-[10px] px-1.5 py-0.5 rounded-full ${hasUrgentMessages ? 'bg-red-500 animate-pulse' : 'bg-secondary-500'}`}>
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
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-5 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-shadow duration-300 border border-transparent dark:border-gray-800">
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider">Messages</h3>
              <MessagesIcon className="w-6 h-6 text-secondary-500" />
            </div>
            <span className="text-3xl font-extrabold text-[#222222] dark:text-[#f7f7f7] tracking-tight">{count}</span>
          </div>
          <p className="text-sm font-medium text-[#717171] dark:text-[#888888] mt-2">Awaiting response</p>
        </div>
      </div>
    );
  };

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-5 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-shadow duration-300 border border-transparent dark:border-gray-800">
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider">{title}</h3>
            <Icon className={`w-6 h-6 ${colorClass}`} />
          </div>
          <span className="text-3xl font-extrabold text-[#222222] dark:text-[#f7f7f7] tracking-tight">{value}</span>
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
            <span className="text-secondary-500">Dr. {profile?.name || user?.email?.split('@')[0] || ''}</span>
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
          colorClass="text-secondary-500"
        />
        <MessagesStatCard localCount={localUnreadCount} />
        <StatCard
          title="Reviews"
          value="0"
          subtext="Pending tasks"
          icon={DocumentIcon}
          colorClass="text-secondary-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content: Recent Patients */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#222222] dark:text-white">Recent Patients</h2>
            <button
              onClick={() => setActiveView('monitoring')}
              className="text-sm font-semibold text-[#222222] dark:text-white underline decoration-2 underline-offset-4 hover:text-secondary-500 dark:hover:text-secondary-500 transition-colors">
              View all
            </button>
          </div>

          <div className="bg-transparent rounded-2xl border-none overflow-visible">
            {loading ? (
              <div className="p-12 text-center bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-[#717171]">Loading library...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-16 text-center bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="mx-auto w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <UserGroupIcon className="w-8 h-8 text-[#717171]" />
                </div>
                <h3 className="text-lg font-bold text-[#222222] dark:text-white mb-2">No patients yet</h3>
                <p className="text-[#717171] max-w-xs mx-auto">Share your referral code to start checking up on patients.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {patients.slice(0, 4).map((patient, idx) => {
                  const status = getPatientStatus(patient.id);
                  const config = statusConfig[status];
                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleViewPatient(patient)}
                      className="group bg-white dark:bg-[#1e1e1e] rounded-3xl p-5 shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-800 hover:border-[#8AC43C]/30 dark:hover:border-[#8AC43C]/30 transition-all duration-200 ease-out flex flex-col justify-between relative overflow-hidden cursor-pointer h-full"
                    >
                      {/* Hover Accent */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8AC43C] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out" />

                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-900 dark:text-gray-100 font-bold text-sm shadow-inner group-hover:scale-105 transition-transform duration-300`}>
                            {getInitials(patient.name, patient.email)}
                          </div>
                          <div>
                            <h4 className="font-bold text-[#222222] dark:text-white text-base group-hover:text-[#8AC43C] transition-colors line-clamp-1">
                              {patient.name || patient.email}
                            </h4>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              {patient.patientId || 'ID Pending'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>

                      <div className="space-y-2 mt-2">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Condition</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[120px]">{patient.condition || 'General'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewPatient(patient); }}
                          className="w-full py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  );
                })}
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Patient Monitoring</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Real-time patient status and alerts</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {alertCounts.urgent > 0 && (
            <button
              onClick={() => setActiveView('alerts')}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs sm:text-sm font-bold animate-pulse flex-1 sm:flex-initial justify-center"
            >
              <span>🔴</span>
              <span>{alertCounts.urgent} Urgent</span>
            </button>
          )}
          <button
            onClick={() => setActiveView('alerts')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-gray-100 dark:bg-gray-800 text-[#222222] dark:text-white rounded-full text-xs sm:text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-1 sm:flex-initial justify-center"
          >
            <span className="hidden sm:inline">View All Alerts</span>
            <span className="sm:hidden">Alerts</span>
            {alertCounts.total > 0 && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-amber-500 text-white text-[10px] sm:text-xs rounded-full">{alertCounts.total}</span>
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
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white px-1">Your Patients ({patients.length})</h2>
        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8AC43C] mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Loading patients...</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
            <p className="text-gray-500 dark:text-gray-400">No patients linked yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {patients.map(patient => {
              const status = getPatientStatus(patient.id);
              const config = statusConfig[status];
              return (
                <div
                  key={patient.id}
                  className="group bg-white dark:bg-[#1e1e1e] rounded-3xl p-6 shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-800 hover:border-[#8AC43C]/30 dark:hover:border-[#8AC43C]/30 transition-all duration-200 ease-out flex flex-col justify-between relative overflow-hidden cursor-pointer"
                  onClick={() => handleViewPatient(patient)}
                >
                  {/* Hover Accent */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8AC43C] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out" />

                  <div>
                    {/* Header: Status & Avatar */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`h-14 w-14 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-900 dark:text-gray-100 font-bold text-lg shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                        {getInitials(patient.name || '', patient.email)}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm ${config.bg} ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 group-hover:text-[#8AC43C] dark:group-hover:text-[#8AC43C] transition-colors line-clamp-1" title={patient.name || patient.email}>
                        {patient.name || patient.email}
                      </h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        {patient.patientId || 'ID Pending'}
                      </p>

                      <div className="space-y-2 mb-6">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Primary Condition</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{patient.condition || 'General Checkup'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveView('messages');
                        // Could pre-select patient in messages
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                    >
                      <MessagesIcon className="w-4 h-4" /> Message
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPatient(patient);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-[#8AC43C] dark:text-[#8AC43C] bg-[#8AC43C]/10 dark:bg-[#8AC43C]/10 hover:bg-[#8AC43C]/20 dark:hover:bg-[#8AC43C]/20 transition-all"
                    >
                      <DocumentIcon className="w-4 h-4" /> View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
      <div className="min-h-screen bg-gray-100 dark:bg-black font-sans text-[#222222] selection:bg-secondary-500 selection:text-white relative flex flex-col">

        {/* Sticky Header with Rounded Edges */}
        <div className={`sticky top-2 sm:top-4 mx-2 sm:mx-4 mt-2 sm:mt-4 z-40 transition-all duration-300 bg-white dark:bg-black backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-md ${activeView === 'messages' ? 'hidden md:flex' : ''}`}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex items-center justify-between h-16 sm:h-20">
              {/* Logo / Brand Area */}
              <div
                onClick={() => setActiveView('dashboard')}
                className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0 group-hover:shadow-md transition-shadow">
                  <LogoIcon className="w-9 h-9 md:w-10 md:h-10" />
                </div>
                <div className="flex flex-col justify-center">
                  <h2 className="text-lg md:text-xl font-bold leading-none tracking-tight">
                    <span className="text-[#3A2524] dark:text-[#e6b8a3]">Bean</span>
                    <span className="text-secondary-500">Health</span>
                  </h2>
                  <p className="text-[9px] md:text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5">DOCTOR PORTAL</p>
                </div>
              </div>

              {/* Center Tabs */}
              {/* Center Tabs - Desktop Only with Enhanced Mobile-style Animation */}
              <nav className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 p-1 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl saturate-150 border border-white/20 dark:border-white/10 rounded-full ring-1 ring-white/20 dark:ring-white/5 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`group relative flex items-center justify-center h-10 rounded-[20px] overflow-hidden text-sm font-bold transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[width,transform,background-color] ${activeView === 'dashboard'
                    ? 'w-[130px] bg-black dark:bg-white text-white dark:text-black scale-105'
                    : 'w-[100px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95'
                    }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className={`transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${activeView === 'dashboard' ? 'scale-95 tracking-tight' : 'scale-100'}`}>Dashboard</span>
                  {activeView === 'dashboard' && (
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  )}
                </button>
                <button
                  onClick={() => setActiveView('monitoring')}
                  className={`group relative flex items-center justify-center h-10 rounded-[20px] overflow-hidden text-sm font-bold transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[width,transform,background-color] ${activeView === 'monitoring'
                    ? 'w-[140px] bg-black dark:bg-white text-white dark:text-black scale-105'
                    : 'w-[110px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95'
                    }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className={`transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${activeView === 'monitoring' ? 'scale-95 tracking-tight' : 'scale-100'}`}>Monitoring</span>
                  {alertCounts.urgent > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                      {alertCounts.urgent}
                    </span>
                  )}
                  {activeView === 'monitoring' && (
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  )}
                </button>
                <button
                  onClick={() => setActiveView('alerts')}
                  className={`group relative flex items-center justify-center h-10 rounded-[20px] overflow-hidden text-sm font-bold transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[width,transform,background-color] ${activeView === 'alerts'
                    ? 'w-[110px] bg-black dark:bg-white text-white dark:text-black scale-105'
                    : 'w-[90px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95'
                    }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className={`transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${activeView === 'alerts' ? 'scale-95 tracking-tight' : 'scale-100'}`}>Alerts</span>
                  {alertCounts.total > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {alertCounts.total}
                    </span>
                  )}
                  {activeView === 'alerts' && (
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  )}
                </button>
                <button
                  onClick={() => setActiveView('messages')}
                  className={`group relative flex items-center justify-center h-10 rounded-[20px] overflow-hidden text-sm font-bold transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[width,transform,background-color] ${activeView === 'messages'
                    ? 'w-[130px] bg-black dark:bg-white text-white dark:text-black scale-105'
                    : 'w-[100px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95'
                    }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className={`transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${activeView === 'messages' ? 'scale-95 tracking-tight' : 'scale-100'}`}>Messages</span>
                  <div className={`transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${activeView === 'messages' ? 'ml-1.5' : 'ml-0'}`}>
                    <MessagesNotificationBadge localCount={localUnreadCount} />
                  </div>
                  {activeView === 'messages' && (
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  )}
                </button>
              </nav>

              {/* Right User Actions */}
              <div className="flex items-center gap-5">
                <ThemeToggle />

                <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-1 sm:mx-2"></div>

                {/* Doctor's Name & Specialty (Plain text, not part of the interactive capsule) */}
                <div className="hidden md:block text-right pr-1">
                  <p className="text-sm font-bold text-[#222222] dark:text-white leading-none">
                    {profile?.name || user?.email?.split('@')[0] || 'Doctor'}
                  </p>
                  <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-wide mt-1 uppercase">
                    {profile?.specialty || 'MD'}
                  </p>
                </div>

                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="group flex items-center p-1 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-500 ease-out"
                  aria-label="View Profile"
                >
                  <div className="relative z-10">
                    <div className="h-9 w-9 md:h-10 md:w-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold text-xs md:text-sm shadow-md ring-2 ring-white dark:ring-black transition-colors duration-300 group-hover:ring-secondary-500">
                      {getInitials(profile?.name || user?.email || 'Dr', user?.email || '')}
                    </div>
                    {/* Online indicator */}
                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-black bg-secondary-500"></span>
                  </div>

                  <div className="max-w-0 group-hover:max-w-[100px] overflow-hidden transition-all duration-500 ease-out opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-2 pl-3 pr-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">
                      <span>My Profile</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <ProfileModal
          user={{
            ...user!,
            name: profile?.name || user?.email?.split('@')[0] || 'Doctor',
            role: 'doctor',
            specialty: profile?.specialty || 'General Practice'
          } as any}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onLogout={signOut}
        />

        {/* Main Content Area */}
        <main className={`transition-all duration-500 pt-12 sm:pt-16 ${activeView === 'messages' ? 'h-[calc(100vh-80px)] pb-24 md:pb-0' : activeView === 'alerts' ? 'pb-24 md:pb-0' : 'pb-28 md:pb-10'}`}>
          <div className={`${activeView === 'messages' ? 'h-full' : activeView === 'alerts' ? 'w-full' : 'max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12'}`}>
            {activeView === 'dashboard' && renderDashboard()}

            {activeView === 'monitoring' && renderMonitoring()}

            {activeView === 'alerts' && renderAlerts()}

            {activeView === 'messages' && !showFullScreenChat && (() => { setShowFullScreenChat(true); return null; })()}

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
        <DoctorMobileNavWrapper activeView={activeView} setActiveView={setActiveView} alertCounts={alertCounts} />

        {/* WhatsApp-style Full Screen Chat */}
        {showFullScreenChat && (() => {
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
            <WhatsAppChatWindow
              currentUser={currentUserContact}
              contacts={patientContacts}
              messages={messages}
              onSendMessage={handleSendMessage}
              onMarkMessagesAsRead={handleMarkMessagesAsRead}
              preselectedContactId={null}
              clearPreselectedContact={() => { }}
              onNavigateToBilling={() => { }}
              onClose={() => {
                setShowFullScreenChat(false);
                setActiveView('dashboard');
              }}
              isFullScreen={true}
            />
          );
        })()}

        {/* Strong blur fade mask for scrolling content - UI/UX optimized */}
        <div className="pointer-events-none fixed top-2 sm:top-4 left-0 right-0 h-28 bg-gradient-to-b from-gray-100 from-0% via-gray-100/80 via-40% to-transparent to-100% dark:from-black dark:from-0% dark:via-black/80 dark:via-40% dark:to-transparent z-30"></div>
      </div>
    </NotificationProvider>
  );
};

// Wrapper to use notification context
const DoctorMobileNavWrapper: React.FC<{
  activeView: DoctorView;
  setActiveView: (view: DoctorView) => void;
  alertCounts: { total: number; urgent: number };
}> = ({ activeView, setActiveView, alertCounts }) => {
  const { unreadMessageCount, hasUrgentMessages } = useNotifications();
  return (
    <DoctorMobileBottomNav
      activeView={activeView}
      setActiveView={setActiveView}
      unreadMessageCount={unreadMessageCount}
      hasUrgentMessages={hasUrgentMessages}
      alertCount={alertCounts.total}
      hasUrgentAlerts={alertCounts.urgent > 0}
    />
  );
};

export default DoctorDashboardMain;