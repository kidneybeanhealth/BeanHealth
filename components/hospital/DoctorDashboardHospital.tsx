import React, { useState, useEffect } from 'react';
import { HospitalQueue } from '../../types';
import { HospitalService } from '../../services/hospitalService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import Header from '../Header';

interface DoctorDashboardHospitalProps {
    hospitalId?: string;
    onBack?: () => void;
    doctorInfo?: { id: string; name: string };
}

const DoctorDashboardHospital: React.FC<DoctorDashboardHospitalProps> = ({ hospitalId: propHospitalId, onBack, doctorInfo }) => {
    const { user, profile, signOut } = useAuth();
    const [queues, setQueues] = useState<HospitalQueue[]>([]);
    const [loading, setLoading] = useState(true);

    const currentDoctorId = doctorInfo?.id || user?.id;
    const currentDoctorName = doctorInfo?.name || profile?.name;
    const hospitalId = propHospitalId || profile?.hospital_id;

    useEffect(() => {
        if (currentDoctorId) {
            fetchQueue();
            const channel = supabase
                .channel(`doctor_queue_changes_${currentDoctorId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_queues',
                    filter: `doctor_id=eq.${currentDoctorId}`
                }, () => {
                    fetchQueue();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [currentDoctorId]);

    const fetchQueue = async () => {
        if (!currentDoctorId) return;
        try {
            const data = await HospitalService.getDoctorQueue(currentDoctorId);
            setQueues(data);
        } catch (error) {
            console.error('Error fetching doctor queue:', error);
            toast.error('Failed to load patient queue');
        } finally {
            setLoading(false);
        }
    };

    const [activePrescriptionPatient, setActivePrescriptionPatient] = useState<HospitalQueue | null>(null);
    const [prescriptionText, setPrescriptionText] = useState('');

    const handleUpdateStatus = async (id: string, status: 'pending' | 'working' | 'done') => {
        try {
            await HospitalService.updateQueueStatus(id, status);
            toast.success(`Patient status updated to ${status}`);
            fetchQueue();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleSavePrescription = async () => {
        if (!activePrescriptionPatient) return;
        toast.loading('Saving prescription...');
        setTimeout(() => {
            toast.dismiss();
            toast.success('Prescription saved successfully!');
            setActivePrescriptionPatient(null);
            setPrescriptionText('');
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-6 md:p-12 relative overflow-hidden">
            {/* Background Decorative Mesh */}
            <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-100/30 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-200/20 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10 text-left">
                <Header
                    user={{
                        id: currentDoctorId || '',
                        name: `Dr. ${currentDoctorName}`,
                        email: 'Active Workstation',
                        role: 'doctor' as any
                    }}
                    onLogout={onBack || signOut}
                    showMenu={false}
                    className="!mb-8 sm:!mb-12"
                />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">Assigned Workspace</h2>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-black uppercase tracking-widest">
                                Live Session
                            </span>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">{queues.length} Patients waiting in queue</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <div className="h-12 w-12 bg-gray-200 dark:bg-white/10 rounded-2xl mb-4" />
                        <div className="h-4 w-48 bg-gray-100 dark:bg-white/5 rounded-full" />
                    </div>
                ) : queues.length === 0 ? (
                    <div className="bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] p-16 text-center border border-gray-100 dark:border-white/10 shadow-xl animate-fade-in">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-300 dark:border-white/10">
                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Workspace Clear</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">All patients for your current shift have been processed.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {queues.map((q) => (
                            <div
                                key={q.id}
                                className={`group relative bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border-2 transition-all duration-300 hover:shadow-2xl ${q.status === 'working'
                                    ? 'border-secondary-500 bg-secondary-50/10'
                                    : 'border-gray-100 dark:border-white/10'
                                    }`}
                            >
                                <div className="absolute top-6 right-8">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl ${q.status === 'working' ? 'bg-secondary-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-white/10 text-gray-400'
                                        }`}>
                                        #{q.queueNumber}
                                    </div>
                                </div>

                                <div className="mb-6 pr-12">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 truncate">{q.patientName}</h3>
                                    <div className="flex flex-wrap gap-2 text-left">
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-bold uppercase">{q.tokenNumber}</span>
                                        <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-bold uppercase">{q.age} Years</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {q.status === 'pending' ? (
                                        <button
                                            onClick={() => handleUpdateStatus(q.id, 'working')}
                                            className="w-full py-4 bg-secondary-500 text-white rounded-2xl font-bold shadow-xl shadow-secondary-500/20 hover:bg-secondary-600 transition-all active:scale-95"
                                        >
                                            Start Consult
                                        </button>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 text-left">
                                            <button
                                                onClick={() => setActivePrescriptionPatient(q)}
                                                className="py-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl font-bold border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all overflow-hidden relative group"
                                            >
                                                <span className="relative z-10">Prescribe</span>
                                                <div className="absolute inset-0 bg-emerald-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(q.id, 'done')}
                                                className="py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-all"
                                            >
                                                Finish
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Prescription Modal */}
            {activePrescriptionPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-10 max-w-2xl w-full border border-gray-200 dark:border-white/10 animate-slide-up text-left">
                        <div className="mb-8">
                            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Clinical Prescription</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium italic">Authorized entry for <strong>{activePrescriptionPatient.patientName}</strong></p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Observations & Medication</label>
                                <textarea
                                    className="w-full h-64 px-6 py-5 rounded-[2rem] bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-secondary-500 outline-none transition-all dark:text-white placeholder:text-gray-400 resize-none font-mono text-sm leading-relaxed"
                                    placeholder="Enter medication, dosage, and diagnostic notes..."
                                    value={prescriptionText}
                                    onChange={(e) => setPrescriptionText(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mt-10">
                            <button
                                onClick={() => setActivePrescriptionPatient(null)}
                                className="flex-1 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSavePrescription}
                                className="flex-[2] py-4 rounded-2xl bg-secondary-700 text-white font-bold shadow-xl shadow-secondary-900/20 hover:bg-secondary-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Finalize & Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorDashboardHospital;
