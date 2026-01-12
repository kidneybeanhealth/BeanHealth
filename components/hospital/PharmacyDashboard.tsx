import React, { useState, useEffect } from 'react';
import { Hospital, HospitalQueue } from '../../types';
import { HospitalService } from '../../services/hospitalService';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import Header from '../Header';

interface PharmacyDashboardProps {
    hospital: Hospital;
    onBack: () => void;
}

const PharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ hospital, onBack }) => {
    const [completedQueues, setCompletedQueues] = useState<HospitalQueue[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCompleted();

        const channel = supabase
            .channel('pharmacy_queue_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'hospital_queues',
                filter: `hospital_id=eq.${hospital.id}`
            }, () => {
                fetchCompleted();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [hospital.id]);

    const fetchCompleted = async () => {
        try {
            const data = await HospitalService.getQueueByHospital(hospital.id, 'done');
            setCompletedQueues(data);
        } catch (error) {
            console.error('Error fetching completed patients:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-6 md:p-12 relative overflow-hidden">
            {/* Background Decorative Mesh */}
            <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-100/30 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-200/20 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <Header
                    user={{
                        id: 'pharmacy',
                        name: 'Pharmacy Hub',
                        email: 'Medication Dispensary',
                        role: 'hospital' as any
                    }}
                    onLogout={onBack}
                    showMenu={false}
                    className="!mb-8 sm:!mb-12"
                />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">Prescription Queue</h2>
                        <div className="flex items-center gap-3 text-left">
                            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-black uppercase tracking-widest">
                                Processing
                            </span>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">{completedQueues.length} Ready for collection</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <div className="h-12 w-12 bg-gray-200 dark:bg-white/10 rounded-2xl mb-4" />
                        <div className="h-4 w-48 bg-gray-100 dark:bg-white/5 rounded-full" />
                    </div>
                ) : completedQueues.length === 0 ? (
                    <div className="bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] p-16 text-center border border-gray-100 dark:border-white/10 shadow-xl animate-fade-in">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-300 dark:border-white/10">
                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">No Active Orders</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">When doctors finish consultations, prescriptions will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {completedQueues.map((q) => (
                            <div
                                key={q.id}
                                className="group relative bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/10 transition-all duration-300 hover-lift shadow-sm hover:shadow-2xl hover:border-purple-500/30"
                            >
                                <div className="absolute top-6 right-8">
                                    <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 font-black">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4 1.253"></path></svg>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2">Patient Name</p>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white truncate">{q.patientName}</h3>
                                </div>

                                <div className="flex flex-col gap-4 mb-8">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Consulted By</span>
                                        <span className="text-sm font-extrabold text-gray-900 dark:text-white">Dr. {q.doctorName}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Token ID</span>
                                        <span className="text-sm font-black text-secondary-600 dark:text-secondary-400">{q.tokenNumber}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => toast.success('Viewing Prescription')}
                                    className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-500/20 hover:bg-purple-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    Open Prescription
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PharmacyDashboard;
