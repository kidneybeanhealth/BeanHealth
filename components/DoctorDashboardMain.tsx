import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, ChatMessage, Patient } from '../types';
import { PatientAdditionService } from '../services/patientInvitationService';
import { ChatService } from '../services/chatService';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { VitalsService, MedicationService } from '../services/dataService';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import SimpleHeader from './SimpleHeader';
import Messages from './Messages';
import DoctorPatientView from './DoctorPatientView';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { MessagesIcon } from './icons/MessagesIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import { AlertIcon } from './icons/AlertIcon';
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
      // Refresh messages
      fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleMarkMessagesAsRead = async (patientId: string) => {
    // Implementation for marking messages as read
    // This would need to be added to ChatService
    console.log('Mark messages as read for patient:', patientId);
  };

  const handleViewPatient = async (patient: User) => {
    try {
      // Fetch patient's medical records
      const records = await MedicalRecordsService.getMedicalRecordsByPatientId(patient.id);

      // Fetch patient's vitals - use getLatestVitals for current vitals
      let vitalsData;
      try {
        vitalsData = await VitalsService.getLatestVitals(patient.id);
        console.log('Fetched vitals for patient:', patient.id, vitalsData);
      } catch (err) {
        console.log('No vitals data available for patient:', err);
        vitalsData = null;
      }

      // Fetch patient's vitals history
      let vitalsHistory;
      try {
        vitalsHistory = await VitalsService.getPatientVitals(patient.id);
      } catch (err) {
        console.log('No vitals history available');
        vitalsHistory = [];
      }

      // Fetch patient's medications
      let medicationsData;
      try {
        medicationsData = await MedicationService.getPatientMedications(patient.id);
      } catch (err) {
        console.log('No medications data available for patient');
        medicationsData = [];
      }

      // Convert User to Patient format with real data
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

      console.log('Created patient data with vitals:', patientData.vitals);
      setSelectedPatient(patientData);
      setActiveView('patient-detail');
    } catch (err) {
      console.error('Error loading patient data:', err);
      // Show error notification or fallback to basic data
    }
  };

  const handleBackToDashboard = () => {
    setSelectedPatient(null);
    setActiveView('dashboard');
  };

  const unreadMessagesCount = messages.filter(m =>
    m.recipientId === user?.id && !m.isRead
  ).length;

  const renderDashboard = () => (
    <>
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8 animate-fadeIn">
        <div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Welcome, {profile?.name || user?.email}!
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                Your practice dashboard and patient overview
              </p>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                Your practice dashboard and patient overview
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="card group hover-lift">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 bg-gray-100 dark:bg-gray-700 rounded-2xl transition-all duration-300 group-hover:scale-110">
              <UserGroupIcon className="h-6 w-6 sm:h-7 sm:w-7 text-gray-700 dark:text-gray-300" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Patients</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-gray-900 dark:text-white">
                {loading ? '...' : patients.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card group hover-lift">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl transition-all duration-300 group-hover:scale-110">
              <MessagesIcon className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">New Messages</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-emerald-600 dark:text-emerald-400">
                {unreadMessagesCount}
              </p>
            </div>
          </div>
        </div>

        <div className="card group hover-lift sm:col-span-2 lg:col-span-1">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 bg-amber-100 dark:bg-amber-900/30 rounded-2xl transition-all duration-300 group-hover:scale-110">
              <DocumentIcon className="h-6 w-6 sm:h-7 sm:w-7 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Pending Reviews</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-amber-600 dark:text-amber-400">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Recent Patients */}
          <div className="card lg:col-span-2">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Recent Patients</h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Quick access to recently added patients</p>
            </div>
            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-4 border-sky-200 border-t-sky-600 dark:border-gray-700 dark:border-t-sky-400 mx-auto"></div>
                  <p className="mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Loading patients...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="bg-red-100 dark:bg-red-900/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl inline-block mb-4">
                    <AlertIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm sm:text-base text-red-600 dark:text-red-400 font-medium">{error}</p>
                  <button
                    onClick={fetchPatients}
                    className="mt-4 px-4 py-2 bg-secondary-700 dark:bg-secondary-600 text-white dark:text-white rounded-xl text-sm font-medium hover:bg-secondary-800 dark:hover:bg-secondary-700 transition-all duration-200"
                  >
                    Try again
                  </button>
                </div>
              ) : patients.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 sm:p-6 rounded-3xl inline-block mb-4">
                    <UserGroupIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">No patients yet</h3>
                  <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto px-4">
                    Share your referral code (below) with patients to link them to your practice.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {patients.slice(0, 5).map((patient, index) => (
                    <div key={patient.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/60 dark:border-gray-700/60 transition-all duration-200 animate-slideUp gap-3" style={{ animationDelay: `${index * 50}ms` }}>
                      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 cursor-pointer" onClick={() => handleViewPatient(patient)}>
                        <div className={`h-10 w-10 sm:h-12 sm:w-12 ${getInitialsColor(patient.name, patient.email)} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                          <span className="text-xs sm:text-sm font-bold text-white">
                            {getInitials(patient.name, patient.email)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {patient.name || patient.email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {patient.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 sm:ml-4">
                        <button
                          onClick={() => handleViewPatient(patient)}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-secondary-700 dark:bg-secondary-600 text-white dark:text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-secondary-800 dark:hover:bg-secondary-700 transition-all duration-200"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => setActiveView('messages')}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-emerald-600 dark:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-all duration-200"
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  ))}
                  {patients.length > 5 && (
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center pt-2 font-medium">
                      And {patients.length - 5} more patients...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Referral Code Card - Full Width if no patients, otherwise side */}
          <div className="card lg:col-span-1">
            {user?.id && <DoctorReferralCard doctorId={user.id} />}
          </div>
        </div>
      </div>
    </>
  );

  const renderMessages = () => {
    // Convert User objects to Patient-like contacts for Messages component
    const patientContacts = patients.map(patient => ({
      ...patient,
      role: 'patient' as const, // Force to patient role for Messages component
      dateOfBirth: patient.dateOfBirth || patient.date_of_birth || '1990-01-01', // Required for Patient
      condition: patient.condition || 'General Health', // Required for Patient
      subscriptionTier: (patient.subscriptionTier || patient.subscription_tier || 'FreeTrial') as 'FreeTrial' | 'Paid', // Required for Patient
      urgentCredits: patient.urgentCredits || patient.urgent_credits || 0, // Required for Patient
      vitals: {
        bloodPressure: { value: '', unit: 'mmHg', trend: 'stable' as const },
        heartRate: { value: '', unit: 'bpm', trend: 'stable' as const },
        temperature: { value: '', unit: '°F', trend: 'stable' as const }
      },
      vitalsHistory: [],
      medications: [],
      records: [],
      doctors: [], // Required for Patient type
      chatMessages: messages.filter(m =>
        (m.senderId === patient.id && m.recipientId === user?.id) ||
        (m.senderId === user?.id && m.recipientId === patient.id)
      ),
      aiSummary: ''
    }));

    const currentUserContact = user ? {
      ...user,
      name: profile?.name || user.email || 'Doctor',
      email: user.email!, // Required for User type
      role: 'doctor' as const,
      avatarUrl: null, // No longer use external avatar URLs
      avatar_url: null, // No longer use external avatar URLs
      specialty: profile?.specialty || null,
      dateOfBirth: profile?.date_of_birth || null,
      date_of_birth: profile?.date_of_birth || null,
      condition: null,
      subscriptionTier: null,
      subscription_tier: null,
      urgentCredits: null,
      urgent_credits: null,
      trialEndsAt: null,
      trial_ends_at: null,
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hide header on mobile when in messages view */}
      <div className={activeView === 'messages' ? 'hidden md:block' : ''}>
        <SimpleHeader
          userName={profile?.name || user?.email || 'Doctor'}
          userRole={profile?.role || 'doctor'}
          onSignOut={signOut}
        />
      </div>

      {/* Navigation - Hide on mobile when in messages view */}
      <div className={`glass-effect border-b border-gray-200/60 dark:border-gray-800 sticky top-0 z-10 ${activeView === 'messages' ? 'hidden md:flex' : ''}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <nav className="flex space-x-4 sm:space-x-8">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 ${activeView === 'dashboard'
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              <DashboardIcon className={`inline h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2`} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => setActiveView('messages')}
              className={`relative py-3 sm:py-4 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-all duration-200 ${activeView === 'messages'
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              <MessagesIcon className={`inline h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2`} />
              <span className="hidden sm:inline">Messages</span>
              {unreadMessagesCount > 0 && (
                <span className="ml-1 sm:ml-2 inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      <main className={activeView === 'messages' ? 'p-0' : 'py-4 sm:py-6 lg:py-8'}>
        <div className={activeView === 'messages' ? '' : 'max-w-7xl mx-auto px-3 sm:px-4 lg:px-8'}>
          {activeView === 'dashboard' && renderDashboard()}
          {activeView === 'messages' && renderMessages()}
          {activeView === 'patient-detail' && selectedPatient && (
            <DoctorPatientView
              patient={selectedPatient}
              onBack={handleBackToDashboard}
            />
          )}
        </div>
      </main>

      {/* Modal removed */}
    </div>
  );
};

export default DoctorDashboardMain;