import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, ChatMessage, Patient } from '../types';
import { PatientAdditionService } from '../services/patientInvitationService';
import { ChatService } from '../services/chatService';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { VitalsService, MedicationService } from '../services/dataService';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import ThemeToggle from './ThemeToggle';
import { LogoutIcon } from './icons/LogoutIcon';
import Messages from './Messages';
import DoctorPatientView from './DoctorPatientView';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import DoctorReferralCard from './DoctorReferralCard';

const DoctorDashboardMain: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [patients, setPatients] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'messages' | 'patient-detail'>('dashboard');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

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

  const unreadMessagesCount = messages.filter(m =>
    m.recipientId === user?.id && !m.isRead
  ).length;

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#222222] dark:text-white tracking-tight leading-tight">
            Welcome back, <br />
            <span className="text-[#FF385C]">Dr. {profile?.name || user?.email?.split('@')[0] || ''}</span>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Patients"
          value={loading ? '...' : patients.length}
          subtext="Currently active"
          icon={UserGroupIcon}
          colorClass="text-[#FF385C]"
        />
        <StatCard
          title="Messages"
          value={unreadMessagesCount}
          subtext="Awaiting response"
          icon={MessagesIcon}
          colorClass="text-[#FF385C]"
        />
        <StatCard
          title="Reviews"
          value="0"
          subtext="Pending tasks"
          icon={DocumentIcon}
          colorClass="text-[#FF385C]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content: Recent Patients */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-2xl font-bold text-[#222222] dark:text-white">Recent Patients</h2>
            <button className="text-sm font-semibold text-[#222222] dark:text-white underline decoration-2 underline-offset-4 hover:text-[#FF385C] dark:hover:text-[#FF385C] transition-colors">
              View all
            </button>
          </div>

          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[#FF385C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
                      <div className={`h-12 w-12 rounded-full ${getInitialsColor(patient.name, patient.email)} flex items-center justify-center text-white font-bold text-sm shadow-sm scale-100 group-hover:scale-105 transition-transform`}>
                        {getInitials(patient.name, patient.email)}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#222222] dark:text-white text-base group-hover:text-[#FF385C] transition-colors">
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
                        className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-600 text-sm font-semibold text-[#222222] dark:text-white hover:border-black dark:hover:border-white transition-colors"
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

  return (
    <div className="min-h-screen bg-[#F7F7F7] dark:bg-black font-sans text-[#222222] selection:bg-[#FF385C] selection:text-white">

      {/* Sticky Header */}
      <div className={`sticky top-0 z-30 transition-all duration-300 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 ${activeView === 'messages' ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo / Brand Area */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-[#FF385C] rounded-full flex items-center justify-center text-white font-bold text-xl shadow-sm">
                B
              </div>
              <div className="hidden md:block">
                <h2 className="text-xl font-bold text-[#FF385C] leading-none tracking-tight">BeanHealth</h2>
                <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-1">DOCTOR PORTAL</p>
              </div>
            </div>

            {/* Center Tabs */}
            <nav className="absolute left-1/2 transform -translate-x-1/2 flex p-1 bg-gray-100 dark:bg-[#2c2c2c] rounded-full">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${activeView === 'dashboard'
                  ? 'bg-white dark:bg-black text-[#222222] dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                  : 'text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveView('messages')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${activeView === 'messages'
                  ? 'bg-white dark:bg-black text-[#222222] dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                  : 'text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <span>Messages</span>
                {unreadMessagesCount > 0 && (
                  <span className="bg-[#FF385C] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
            </nav>

            {/* Right User Actions */}
            <div className="flex items-center gap-5">
              <ThemeToggle />

              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#222222] dark:text-white leading-none">
                    {profile?.name || user?.email?.split('@')[0] || 'Doctor'}
                  </p>
                  <p className="text-xs text-[#717171] dark:text-[#a0a0a0] font-medium mt-0.5">
                    {profile?.specialty || 'MD'}
                  </p>
                </div>
                <div className="h-10 w-10 bg-gradient-to-br from-gray-800 to-black dark:from-white dark:to-gray-200 rounded-full flex items-center justify-center text-white dark:text-black font-bold text-sm shadow-md">
                  {getInitials(profile?.name || user?.email || 'Dr')}
                </div>
              </div>

              <div className="hidden md:block">
                <button
                  onClick={signOut}
                  className="p-2.5 text-[#717171] hover:text-[#FF385C] hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <LogoutIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className={`transition-all duration-500 ${activeView === 'messages' ? 'h-[calc(100vh-80px)]' : 'py-10'}`}>
        <div className={`${activeView === 'messages' ? 'h-full' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          {activeView === 'dashboard' && renderDashboard()}

          {activeView === 'messages' && (
            <div className="h-full border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
              {renderMessages()}
            </div>
          )}

          {activeView === 'patient-detail' && selectedPatient && (
            <div className="animate-slide-up bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] min-h-[80vh]">
              <DoctorPatientView
                patient={selectedPatient}
                onBack={handleBackToDashboard}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DoctorDashboardMain;