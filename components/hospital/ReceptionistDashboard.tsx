import React, { useState, useEffect } from 'react';
import { Hospital, HospitalPatient, HospitalQueue } from '../../types';
import { HospitalService } from '../../services/hospitalService';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import Header from '../Header';

interface ReceptionistDashboardProps {
    hospital: Hospital;
    onBack: () => void;
}

const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({ hospital, onBack }) => {
    const [patients, setPatients] = useState<HospitalPatient[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [queues, setQueues] = useState<HospitalQueue[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [showAddPatient, setShowAddPatient] = useState(false);
    const [newPatient, setNewPatient] = useState({ name: '', age: '' });
    const [assigningPatient, setAssigningPatient] = useState<HospitalPatient | null>(null);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');

    useEffect(() => {
        fetchData();

        // Subscribe to queue changes
        const channel = supabase
            .channel('hospital_queues_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'hospital_queues',
                filter: `hospital_id=eq.${hospital.id}`
            }, () => {
                fetchQueues();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [hospital.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const docs = await HospitalService.getDoctors(hospital.id);
            setDoctors(docs);
            await fetchQueues();
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const fetchQueues = async () => {
        try {
            const q = await HospitalService.getQueueByHospital(hospital.id);
            setQueues(q);
        } catch (error) {
            console.error('Error fetching queues:', error);
        }
    };

    const handleAddPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPatient.name || !newPatient.age) return;

        try {
            const token = `T-${Date.now().toString().slice(-4)}`;
            const p = await HospitalService.addPatient(hospital.id, newPatient.name, parseInt(newPatient.age), token);
            setPatients([p, ...patients]);
            setNewPatient({ name: '', age: '' });
            setShowAddPatient(false);
            setAssigningPatient(p);
            toast.success('Patient added successfully');
        } catch (error) {
            toast.error('Failed to add patient');
        }
    };

    const handleAssign = async () => {
        if (!assigningPatient || !selectedDoctorId) return;

        try {
            const queueNumber = queues.length + 1;
            await HospitalService.assignPatientToDoctor(
                hospital.id,
                assigningPatient.id,
                selectedDoctorId,
                queueNumber
            );
            toast.success('Patient assigned to doctor');
            setAssigningPatient(null);
            setSelectedDoctorId('');
            fetchQueues();
        } catch (error) {
            toast.error('Failed to assign patient');
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-6 md:p-12 relative overflow-hidden">
            {/* Background Decorative Mesh */}
            <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-100/30 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-200/20 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <Header
                    user={{
                        id: 'receptionist',
                        name: 'Reception Desk',
                        email: hospital.name,
                        role: 'hospital' as any
                    }}
                    onLogout={onBack}
                    showMenu={false}
                    className="!mb-8 sm:!mb-12"
                />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">Management Console</h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium tracking-wide items-center flex gap-2">
                            <span className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
                            System Online • {hospital.name}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddPatient(true)}
                        className="w-full sm:w-auto px-8 py-4 bg-secondary-600 text-white rounded-2xl font-bold shadow-xl shadow-secondary-500/30 transition-all hover:bg-secondary-700 active:scale-95 flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        Register New Patient
                    </button>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                    {[
                        { label: 'Active Queue', value: queues.filter(q => q.status !== 'done').length, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'secondary' },
                        { label: 'Clinical Staff', value: doctors.length, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'emerald' },
                        { label: 'Total Walk-ins', value: queues.length, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'purple' }
                    ].map((stat, i) => (
                        <div key={i} className="group bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300">
                            <div className={`h-12 w-12 bg-${stat.color === 'secondary' ? 'secondary' : stat.color === 'emerald' ? 'emerald' : 'purple'}-100 dark:bg-${stat.color === 'secondary' ? 'secondary' : stat.color === 'emerald' ? 'emerald' : 'purple'}-900/30 rounded-xl flex items-center justify-center text-${stat.color === 'secondary' ? 'secondary' : stat.color === 'emerald' ? 'emerald' : 'purple'}-600 dark:text-${stat.color === 'secondary' ? 'secondary' : stat.color === 'emerald' ? 'emerald' : 'purple'}-400 mb-4 group-hover:scale-110 transition-transform`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon}></path></svg>
                            </div>
                            <p className="text-gray-400 dark:text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Patient List Redesign */}
                <div className="bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden animate-fade-in">
                    <div className="p-8 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Live Patient Tracker</h2>
                    </div>

                    <div className="p-8">
                        <div className="grid gap-4">
                            {queues.length === 0 ? (
                                <div className="text-center py-20 px-6">
                                    <div className="h-20 w-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-300 dark:border-white/10">
                                        <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Queue is Empty</h3>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">New patient registrations will appear here.</p>
                                </div>
                            ) : (
                                queues.map((q) => (
                                    <div key={q.id} className="group relative bg-white dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/5 hover:border-secondary-500/50 hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row items-center gap-6">
                                        <div className="h-16 w-16 bg-secondary-50 dark:bg-secondary-900/30 rounded-2xl flex items-center justify-center text-2xl font-black text-secondary-600 dark:text-secondary-400 shrink-0 border border-secondary-100 dark:border-secondary-500/20">
                                            #{q.queueNumber}
                                        </div>

                                        <div className="flex-1 text-center md:text-left min-w-0">
                                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                                                <h4 className="text-xl font-extrabold text-gray-900 dark:text-white truncate">{q.patientName}</h4>
                                                <span className="hidden md:block text-gray-300 dark:text-gray-700">•</span>
                                                <span className="text-sm font-bold text-gray-500 uppercase tracking-tight">{q.tokenNumber}</span>
                                            </div>
                                            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>{q.age} Years</span>
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>{q.doctorName || 'Not Assigned'}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center">
                                            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 ${q.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400' :
                                                q.status === 'working' ? 'bg-blue-50 text-blue-600 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-400' :
                                                    'bg-secondary-50 text-secondary-600 border-secondary-200/50 dark:bg-secondary-900/20 dark:text-secondary-400'
                                                }`}>
                                                {q.status}
                                            </span>
                                            {q.status === 'pending' && (
                                                <button onClick={() => setAssigningPatient({ id: q.patientId, hospitalId: hospital.id, name: q.patientName, age: q.age, tokenNumber: q.tokenNumber } as any)} className="p-2.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-all">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showAddPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full border border-gray-200 dark:border-white/10 animate-slide-up">
                        <div className="mb-8 flex items-center gap-4">
                            <div className="h-12 w-12 bg-secondary-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-secondary-500/30">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">New Admission</h3>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">Register a walk-in patient.</p>
                            </div>
                        </div>

                        <form onSubmit={handleAddPatient} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Full Identity Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-secondary-500 outline-none transition-all dark:text-white placeholder:text-gray-400"
                                    placeholder="e.g. Johnathan Smith"
                                    value={newPatient.name}
                                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Age</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-secondary-500 outline-none transition-all dark:text-white placeholder:text-gray-400"
                                    placeholder="Patient Age"
                                    value={newPatient.age}
                                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-3 mt-8">
                                <button type="submit" className="w-full py-4 rounded-2xl bg-secondary-500 text-white font-bold shadow-xl shadow-secondary-500/20 hover:bg-secondary-600 transition-all active:scale-95">Confirm & Proceed</button>
                                <button type="button" onClick={() => setShowAddPatient(false)} className="w-full py-4 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-white/10 transition-all">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {assigningPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full border border-gray-200 dark:border-white/10 animate-slide-up">
                        <div className="mb-8 text-left">
                            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">Route to Doctor</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Select a workstation for <strong>{assigningPatient.name}</strong></p>
                        </div>

                        <div className="space-y-4 max-h-72 overflow-y-auto pr-2 scrollbar-hide">
                            {doctors.map((doc) => (
                                <button
                                    key={doc.id}
                                    onClick={() => setSelectedDoctorId(doc.id)}
                                    className={`w-full p-5 rounded-3xl border-2 transition-all text-left ${selectedDoctorId === doc.id
                                        ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20'
                                        : 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:border-secondary-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-white ${selectedDoctorId === doc.id ? 'bg-secondary-500 shadow-lg shadow-secondary-500/40' : 'bg-gray-400'}`}>
                                            {doc.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-extrabold text-gray-900 dark:text-white">Dr. {doc.name}</div>
                                            <div className="text-sm font-medium text-gray-500">{doc.specialty || 'General Practitioner'}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 mt-10">
                            <button onClick={handleAssign} disabled={!selectedDoctorId} className="w-full py-4 rounded-2xl bg-secondary-500 text-white font-bold shadow-xl shadow-secondary-500/20 disabled:opacity-30">Dispatch Patient</button>
                            <button type="button" onClick={() => setAssigningPatient(null)} className="w-full py-4 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-500 font-bold">Skip Assignment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReceptionistDashboard;
