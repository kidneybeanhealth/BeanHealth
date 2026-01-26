import React, { useState, useEffect } from 'react';
import ClinicSetup from './ClinicSetup';
import PrescriptionForm from './PrescriptionForm';
import RoleSelection from './RoleSelection';
import DoctorPatientView from './DoctorPatientView';
import { ClinicService, ClinicDoctor } from '../services/clinicService';

type ClinicTab = 'reception' | 'doctor' | 'pharmacy';
type StaffRole = 'doctor' | 'receptionist' | 'pharmacy' | null;

interface ClinicSession {
    email: string;
    clinicName: string;
    role: string;
    loggedInAt: string;
    clinicId: string;
}

interface ClinicProfile {
    name: string;
    logo: string | null;
    location: string;
    address: string;
    numberOfDoctors: number;
    phone: string;
    emergencyContact: string;
    appointmentContact: string;
    email: string;
    setupComplete: boolean;
}

const ClinicDashboard: React.FC = () => {
    const [clinicSession, setClinicSession] = useState<ClinicSession | null>(null);
    const [clinicProfile, setClinicProfile] = useState<ClinicProfile | null>(null);
    const [staffRole, setStaffRole] = useState<StaffRole>(() => {
        return localStorage.getItem('staffRole') as StaffRole || null;
    });

    useEffect(() => {
        const loadSession = () => {
            const session = localStorage.getItem('clinicSession');
            const profile = localStorage.getItem('clinicProfile');
            if (session) setClinicSession(JSON.parse(session));
            if (profile) setClinicProfile(JSON.parse(profile));
        };
        loadSession();
    }, []);

    const handleSetupComplete = (data: any) => {
        setClinicSession(data.session);
        setClinicProfile(data.profile);
    };

    const handleLogout = () => {
        localStorage.removeItem('clinicSession');
        localStorage.removeItem('staffRole');
        setClinicSession(null);
        setStaffRole(null);
    };

    const handleRoleSelect = (role: StaffRole) => {
        setStaffRole(role);
        localStorage.setItem('staffRole', role || '');
    };

    const handleSwitchRole = () => {
        setStaffRole(null);
        localStorage.removeItem('staffRole');
    };

    if (!clinicSession) {
        return <ClinicSetup onComplete={handleSetupComplete} />;
    }

    if (!staffRole) {
        return (
            <RoleSelection
                clinicName={clinicSession.clinicName}
                onRoleSelect={handleRoleSelect}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-4">
                            {clinicProfile?.logo ? (
                                <img src={clinicProfile.logo} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                                <div className="h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-xl">
                                    {clinicProfile?.name?.charAt(0) || 'C'}
                                </div>
                            )}
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{clinicProfile?.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>{clinicProfile?.location}</span>
                                    {staffRole && (
                                        <>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className="font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                {staffRole === 'doctor' && '👨‍⚕️'}
                                                {staffRole === 'receptionist' && 'Receptionist'}
                                                {staffRole === 'pharmacy' && '💊 Pharmacy'}
                                                <span className="capitalize">{staffRole} Portal</span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {staffRole && (
                                <button
                                    onClick={handleSwitchRole}
                                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                                >
                                    Switch Role
                                </button>
                            )}
                            <div className="h-8 w-px bg-gray-200 mx-2"></div>
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-medium text-gray-900">{clinicSession.role}</p>
                                    <p className="text-xs text-gray-500">{clinicSession.email}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Logout"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {staffRole === 'receptionist' && <ReceptionTab />}
                {staffRole === 'doctor' && clinicSession && <DoctorTab clinicId={clinicSession.clinicId} />}
                {staffRole === 'pharmacy' && <PharmacyTab />}
            </main>
        </div>
    );
};

const ReceptionTab = () => (
    <div className="text-center p-12">
        <h2 className="text-2xl font-bold text-gray-900">Reception Dashboard</h2>
        <p className="text-gray-500 mt-2">Patient queue and registration features coming soon.</p>
    </div>
);

const PharmacyTab = () => (
    <div className="text-center p-12">
        <h2 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h2>
        <p className="text-gray-500 mt-2">Prescription fulfillment features coming soon.</p>
    </div>
);

// Doctor Tab Component - Backend Integrated & Multi-tenant
const DoctorTab: React.FC<{ clinicId: string }> = ({ clinicId }) => {
    const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState<string | null>(null);
    const [viewingDoctor, setViewingDoctor] = useState<ClinicDoctor | null>(null);
    const [showPrescription, setShowPrescription] = useState(false);

    // Patient Management
    const [treatedPatients, setTreatedPatients] = useState<any[]>([]);
    const [showPatientList, setShowPatientList] = useState(false);
    const [viewingPatient, setViewingPatient] = useState<any | null>(null);
    const [showAddPatient, setShowAddPatient] = useState(false);
    const [newPatient, setNewPatient] = useState({ name: '', email: '', phone: '', gender: 'M', age: '' });

    const [newDoctor, setNewDoctor] = useState({ name: '', email: '', specialty: '' });
    const [isLoading, setIsLoading] = useState(false);

    // Fetch Doctors on mount - SCOPED
    useEffect(() => {
        const fetchDoctors = async () => {
            if (!clinicId) {
                // If missing clinicId, session is stale or invalid
                console.warn("fetchDoctors skipped: No clinicId provided");
                return;
            };
            try {
                const data = await ClinicService.getDoctors(clinicId);
                setDoctors(data);
            } catch (error) {
                console.error("Failed to fetch doctors", error);
            }
        };
        fetchDoctors();
    }, [clinicId]);

    // Fetch Patients when viewing a doctor
    useEffect(() => {
        if (viewingDoctor && showPatientList) {
            const fetchPatients = async () => {
                setIsLoading(true);
                try {
                    const data = await ClinicService.getPatientsForDoctor(viewingDoctor.id);
                    setTreatedPatients(data);
                } catch (error) {
                    console.error("Failed to fetch patients", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchPatients();
        }
    }, [viewingDoctor, showPatientList]);

    const handleAddPatient = async () => {
        if (!newPatient.name || !newPatient.email || !viewingDoctor) return;

        setIsLoading(true);
        try {
            await ClinicService.addPatient({
                name: newPatient.name,
                email: newPatient.email,
                phone: newPatient.phone,
                gender: newPatient.gender,
                age: Number(newPatient.age)
            }, viewingDoctor.id, clinicId);

            // Refresh list
            const data = await ClinicService.getPatientsForDoctor(viewingDoctor.id);
            setTreatedPatients(data);

            setNewPatient({ name: '', email: '', phone: '', gender: 'M', age: '' });
            setShowAddPatient(false);
        } catch (error) {
            console.error("Failed to add patient", error);
            alert("Failed to add patient. See console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddDoctor = async () => {
        if (!newDoctor.name.trim()) {
            alert("Please enter a doctor name");
            return;
        }

        if (!clinicId) {
            alert("⚠️ Session Outdated: Please Logout and Setup your Clinic again to enable Database access.");
            return;
        }

        try {
            const doctor = await ClinicService.addDoctor({
                name: newDoctor.name,
                email: newDoctor.email,
                specialty: newDoctor.specialty
            }, clinicId);

            setDoctors([...doctors, doctor]);
            setNewDoctor({ name: '', email: '', specialty: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error("Failed to add doctor", error);
            alert("Failed to add doctor. Please check console logs.");
        }
    };

    const handleUpdateDoctor = (id: string, name: string, email: string, specialty: string) => {
        setDoctors(doctors.map(d => d.id === id ? { ...d, name, email, specialty } : d));
        setEditingDoctor(null);
    };

    const handleDeleteDoctor = async (id: string) => {
        if (confirm('Are you sure you want to remove this doctor?')) {
            try {
                await ClinicService.deleteDoctor(id);
                setDoctors(doctors.filter(d => d.id !== id));
            } catch (error) {
                console.error("Failed to delete doctor", error);
                alert("Failed to delete doctor.");
            }
        }
    };

    // Get clinic profile for prescription form
    const clinicProfile = JSON.parse(localStorage.getItem('clinicProfile') || '{}');

    // Show Patient Dashboard (full page using DoctorPatientView)
    if (viewingPatient && viewingDoctor) {
        // Create a patient-like object for DoctorPatientView
        const patientData = {
            id: viewingPatient.id,
            name: viewingPatient.name,
            email: viewingPatient.email, // Use the actual email added
            role: 'patient' as const,
            phone: viewingPatient.phone,
            dateOfBirth: '1980-01-01', // Default, should be calc from age
            gender: viewingPatient.gender === 'M' ? 'male' : 'female',
            created_at: viewingPatient.lastVisit,
            ckdStage: viewingPatient.diagnosis.includes('CKD') ? 3 : undefined,
            records: [],
            medications: [],
            vitals: {},
            appointments: []
        };

        return (
            <DoctorPatientView
                patient={patientData as any}
                onBack={() => setViewingPatient(null)}
            />
        );
    }

    // Show Patient List Page (full page)
    if (showPatientList && viewingDoctor) {
        return (
            <div className="space-y-6">
                {/* Header with back button */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowPatientList(false)}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </button>

                    <div className="flex flex-col items-end">
                        <h2 className="text-xl font-bold text-gray-900">நோயாளிகள் பட்டியல்</h2>
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Patient List</span>
                    </div>
                </div>

                {/* Add Patient Modal */}
                {showAddPatient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="text-lg font-bold text-gray-900">Add New Patient</h3>
                                <p className="text-xs text-gray-500">Enter patient details to register</p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name / பெயர் <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={newPatient.name}
                                        onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="Enter patient name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (For Dashboard) <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        value={newPatient.email}
                                        onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="patient@email.com"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Age</label>
                                        <input
                                            type="number"
                                            value={newPatient.age}
                                            onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                            placeholder="Eg. 45"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                                        <select
                                            value={newPatient.gender}
                                            onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                                        >
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                            <option value="O">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={newPatient.phone}
                                        onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder="+91..."
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAddPatient(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddPatient}
                                    disabled={!newPatient.name || !newPatient.email || isLoading}
                                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading && (
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isLoading ? 'Adding...' : 'Add Patient'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Patient List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">
                                Patients Treated by {viewingDoctor.name} ({treatedPatients.length})
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowAddPatient(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Patient
                                </button>
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {treatedPatients.map((patient) => (
                            <div key={patient.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                                            <span className="text-lg font-bold text-primary-600">
                                                {patient.name.split(' ').map((n: string) => n[0]).join('')}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{patient.name}</h4>
                                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                                <span>{patient.age} yrs, {patient.gender === 'M' ? 'Male' : 'Female'}</span>
                                                <span>•</span>
                                                <span>{patient.phone}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">Last Visit: {patient.lastVisit}</p>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                {patient.diagnosis}
                                            </span>
                                        </div>
                                        <button
                                            className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                                            onClick={() => setViewingPatient(patient)}
                                        >
                                            View Dashboard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {treatedPatients.length === 0 && (
                            <div className="px-6 py-12 text-center text-gray-500">
                                <p>No patients found. Add a new patient to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (showPrescription) {
        return (
            <PrescriptionForm
                clinicName={clinicProfile.name || 'Clinic'}
                clinicLogo={clinicProfile.logo}
                clinicLocation={clinicProfile.location || ''}
                clinicPhone={clinicProfile.phone || ''}
                clinicEmergency={clinicProfile.emergencyContact || ''}
                doctorName={viewingDoctor?.name || 'Doctor'}
                doctorSpecialty={viewingDoctor?.specialty || ''}
                onClose={() => setShowPrescription(false)}
                onSendToPharmacy={(data) => console.log('Pharmacy', data)}
                onSendToPatient={(data) => console.log('Patient', data)}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-primary-600">{doctors.length}</div>
                    <div className="text-sm text-gray-500">Total Doctors</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-secondary-600">0</div>
                    <div className="text-sm text-gray-500">Active Patients</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-green-600">0</div>
                    <div className="text-sm text-gray-500">Today's Appointments</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-rose-600">0</div>
                    <div className="text-sm text-gray-500">Critical Cases</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Doctor
                    </button>
                    <button
                        onClick={() => {
                            if (doctors.length > 0) {
                                setViewingDoctor(doctors[0]);
                                setShowPatientList(true);
                            } else {
                                alert("Add a doctor first to manage patients.");
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Patient List
                    </button>
                    <button
                        onClick={() => setShowPrescription(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Write Prescription
                    </button>
                </div>
            </div>

            {/* Doctors List */}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Registered Doctors</h2>
                    <span className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-xs font-medium">
                        {doctors.length} Active
                    </span>
                </div>

                {showAddForm && (
                    <div className="p-6 bg-gray-50 border-b border-gray-100 animate-fadeIn">
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name</label>
                                <input
                                    type="text"
                                    value={newDoctor.name}
                                    onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="Dr. Name"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                                <input
                                    type="text"
                                    value={newDoctor.specialty}
                                    onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="e.g. Cardiology"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={newDoctor.email}
                                    onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="email@clinic.com"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddDoctor}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="divide-y divide-gray-100">
                    {doctors.map((doctor) => (
                        <div key={doctor.id} className="p-6 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-lg">
                                        {doctor.name.charAt(0)}
                                    </div>
                                    <div>
                                        {editingDoctor === doctor.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    className="px-2 py-1 border rounded"
                                                    value={doctor.name}
                                                    onChange={(e) => handleUpdateDoctor(doctor.id, e.target.value, doctor.email, doctor.specialty)}
                                                />
                                            </div>
                                        ) : (
                                            <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                                        )}
                                        <p className="text-sm text-gray-500">{doctor.specialty} • {doctor.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setViewingDoctor(doctor);
                                            setShowPatientList(true);
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                                    >
                                        View Patients
                                    </button>
                                    <button
                                        onClick={() => handleDeleteDoctor(doctor.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {doctors.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            No doctors registered yet. Click "Add Doctor" to get started.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClinicDashboard;
