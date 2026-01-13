import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
}

interface Patient {
    id: string;
    name: string;
    age: number;
    token_number: string;
}

interface QueueItem {
    id: string;
    patient_id: string;
    doctor_id: string;
    queue_number: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    patient: Patient;
}

interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instruction: string;
}

const EnterpriseDoctorDashboard: React.FC<{ doctor: DoctorProfile; onBack: () => void }> = ({ doctor, onBack }) => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRxModal, setShowRxModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [medications, setMedications] = useState<Medication[]>([
        { name: '', dosage: '', frequency: '', duration: '', instruction: '' }
    ]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchQueue();
    }, [doctor.id]);

    const fetchQueue = async () => {
        setLoading(true);
        try {
            console.log('Fetching queue for doctor:', doctor.id);
            const { data, error } = await supabase
                .from('hospital_queues' as any)
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*)
                `)
                .eq('doctor_id', doctor.id)
                .in('status', ['pending', 'in_progress'])
                .order('queue_number', { ascending: true });

            if (error) {
                console.error('Queue Fetch Error:', error);
                throw error;
            }
            console.log('Queue Data:', data);
            setQueue(data || []);
        } catch (error) {
            console.error('Error fetching queue:', error);
            toast.error('Failed to load patient list');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (queueId: string, status: string) => {
        try {
            const { error } = await supabase
                .from('hospital_queues' as any)
                .update({ status })
                .eq('id', queueId);

            if (error) throw error;
            toast.success(`Patient marked as ${status.replace('_', ' ')}`);
            fetchQueue();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleAddMedication = () => {
        setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '', instruction: '' }]);
    };

    const handleRemoveMedication = (index: number) => {
        const newMeds = [...medications];
        newMeds.splice(index, 1);
        setMedications(newMeds);
    };

    const handleMedChange = (index: number, field: keyof Medication, value: string) => {
        const newMeds = [...medications];
        newMeds[index][field] = value;
        setMedications(newMeds);
    };

    const generatePDF = () => {
        if (!selectedPatient) return;

        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(0, 100, 0); // Dark Green
        doc.text('BeanHealth Hospital', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Dr. ${doctor.name} (${doctor.specialty})`, 105, 30, { align: 'center' });
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 105, 36, { align: 'center' });

        doc.line(20, 40, 190, 40);

        // Patient Info
        doc.setFontSize(12);
        doc.text(`Patient Name: ${selectedPatient.name}`, 20, 50);
        doc.text(`Age: ${selectedPatient.age}`, 120, 50);
        doc.text(`Token: ${selectedPatient.token_number}`, 160, 50);

        // Medications Table
        doc.text('Rx - Prescription', 20, 65);

        const tableData = medications.map(m => [m.name, m.dosage, m.frequency, m.duration, m.instruction]);

        autoTable(doc, {
            startY: 70,
            head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instruction']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105] }, // Emerald Green
        });

        // Notes
        const finalY = (doc as any).lastAutoTable.finalY || 150;
        if (notes) {
            doc.text('Notes:', 20, finalY + 10);
            doc.setFontSize(10);
            doc.text(notes, 20, finalY + 16);
        }

        // Footer
        doc.setFontSize(10);
        doc.text('Signature: ___________________', 140, 280);

        return doc;
    };

    const handlePrint = () => {
        const doc = generatePDF();
        if (doc) doc.autoPrint(); // Opens print dialog
        if (doc) window.open(doc.output('bloburl'), '_blank');
    };

    const handleSendToPharmacy = async () => {
        if (!selectedPatient) return;
        const toastId = toast.loading('Sending to pharmacy...');

        try {
            const { error } = await supabase
                .from('hospital_prescriptions' as any)
                .insert({
                    hospital_id: doctor.hospital_id,
                    doctor_id: doctor.id,
                    patient_id: selectedPatient.id,
                    token_number: selectedPatient.token_number,
                    medications: medications,
                    notes: notes,
                    status: 'pending'
                });

            if (error) throw error;

            toast.success('Prescription sent to Pharmacy!', { id: toastId });
            setShowRxModal(false);
            // Optionally update queue status?
            handleUpdateStatus(queue.find(q => q.patient.id === selectedPatient.id)?.id || '', 'completed');
        } catch (error) {
            console.error(error);
            toast.error('Failed to send prescription', { id: toastId });
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <button
                        onClick={onBack}
                        className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-2 transition-colors"
                    >
                        ← Go Back
                    </button>
                    <h2 className="text-3xl font-bold text-gray-900">Dr. {doctor.name}</h2>
                    <p className="text-gray-500">Patient Queue & Prescriptions</p>
                </div>
                <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                    {doctor.specialty}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 font-medium text-gray-500 text-sm">
                    <div className="col-span-1 text-center">Queue</div>
                    <div className="col-span-2">Token</div>
                    <div className="col-span-3">Patient Name</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-4 text-right">Actions</div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading patients...</div>
                ) : queue.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No patients in queue</div>
                ) : (
                    queue.map((item) => (
                        <div key={item.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 items-center hover:bg-gray-50 transition-colors">
                            <div className="col-span-1 text-center font-bold text-gray-900 bg-gray-100 rounded-lg py-1">
                                {item.queue_number}
                            </div>
                            <div className="col-span-2 font-mono text-gray-600">{item.patient.token_number}</div>
                            <div className="col-span-3">
                                <div className="font-medium text-gray-900">{item.patient.name}</div>
                                <div className="text-xs text-gray-500">{item.patient.age} years old</div>
                            </div>
                            <div className="col-span-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                    ${item.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                        item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                    {item.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="col-span-4 flex justify-end gap-2">
                                {item.status === 'pending' && (
                                    <button
                                        onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                                    >
                                        Call In
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setSelectedPatient(item.patient);
                                        setShowRxModal(true);
                                        setMedications([{ name: '', dosage: '', frequency: '', duration: '', instruction: '' }]); // Reset
                                        setNotes('');
                                    }}
                                    className="px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Rx Prescribe
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(item.id, 'completed')}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100"
                                >
                                    Consulted
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Prescription Modal */}
            {showRxModal && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-8 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">Write Prescription</h3>
                                <p className="text-gray-500">Patient: {selectedPatient.name} ({selectedPatient.token_number})</p>
                            </div>
                            <button onClick={() => setShowRxModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Medicine List */}
                            <div className="space-y-3">
                                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 px-1">
                                    <div className="col-span-3">Medicine Name</div>
                                    <div className="col-span-2">Dosage</div>
                                    <div className="col-span-2">Frequency</div>
                                    <div className="col-span-2">Duration</div>
                                    <div className="col-span-3">Instructions</div>
                                </div>

                                {medications.map((med, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                                        <div className="col-span-3">
                                            <input type="text" placeholder="e.g. Paracetamol" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={med.name} onChange={(e) => handleMedChange(idx, 'name', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="text" placeholder="500mg" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={med.dosage} onChange={(e) => handleMedChange(idx, 'dosage', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="text" placeholder="1-0-1" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={med.frequency} onChange={(e) => handleMedChange(idx, 'frequency', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                            <input type="text" placeholder="5 days" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={med.duration} onChange={(e) => handleMedChange(idx, 'duration', e.target.value)} />
                                        </div>
                                        <div className="col-span-3 flex gap-2">
                                            <input type="text" placeholder="After food" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={med.instruction} onChange={(e) => handleMedChange(idx, 'instruction', e.target.value)} />
                                            {medications.length > 1 && (
                                                <button onClick={() => handleRemoveMedication(idx)} className="text-red-500 hover:text-red-700">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button onClick={handleAddMedication} className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1">
                                + Add Medicine
                            </button>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes / Advise</label>
                                <textarea
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                                    placeholder="e.g. Drink plenty of water, rest for 2 days..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-6 flex gap-4 border-t border-gray-100">
                                <button
                                    onClick={handlePrint}
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium flex-1 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    Print / PDF
                                </button>
                                <button
                                    onClick={handleSendToPharmacy}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium flex-1 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    Send to Pharmacy
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseDoctorDashboard;
