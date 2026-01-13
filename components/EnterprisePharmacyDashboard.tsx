import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PharmacyDashboardProps {
    hospitalId: string;
}

interface Prescription {
    id: string;
    hospital_id: string;
    doctor_id: string;
    patient_id: string;
    medications: any[];
    notes: string;
    token_number: string;
    status: string;
    created_at: string;
    doctor: {
        name: string;
        specialty: string;
    };
    patient: {
        name: string;
        age: number;
    };
}

const EnterprisePharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ hospitalId }) => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

    useEffect(() => {
        fetchPrescriptions();
    }, [hospitalId]);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    doctor:hospital_doctors(name, specialty),
                    patient:hospital_patients(name, age)
                `)
                .eq('hospital_id', hospitalId)
                .in('status', ['pending', 'dispensed'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPrescriptions(data || []);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            toast.error('Failed to load prescriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePDF = (p: Prescription) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(0, 50, 150); // Navy Blue for Pharmacy View
        doc.text('BeanHealth Pharmacy', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Prescribed by: Dr. ${p.doctor?.name || 'Unknown'}`, 20, 35);
        doc.text(`Date: ${new Date(p.created_at).toLocaleDateString()}`, 150, 35);

        doc.line(20, 40, 190, 40);

        // Patient Info
        doc.setFontSize(12);
        doc.text(`Patient: ${p.patient?.name || 'Unknown'}`, 20, 50);
        doc.text(`Age: ${p.patient?.age || 'N/A'}`, 120, 50);
        doc.text(`Token: ${p.token_number || 'N/A'}`, 160, 50);

        // Medications Table
        doc.text('Rx Items', 20, 65);

        const tableData = (p.medications || []).map((m: any) => [m.name, m.dosage, m.frequency, m.duration, m.instruction]);

        autoTable(doc, {
            startY: 70,
            head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instruction']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] }, // Blue
        });

        // Notes
        const finalY = (doc as any).lastAutoTable.finalY || 150;
        if (p.notes) {
            doc.text('Doctor Notes:', 20, finalY + 10);
            doc.setFontSize(10);
            doc.text(p.notes, 20, finalY + 16);
        }

        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    };

    const handleMarkDispensed = async () => {
        if (!selectedPrescription) return;

        try {
            const { error } = await supabase
                .from('hospital_prescriptions' as any)
                .update({ status: 'dispensed' })
                .eq('id', selectedPrescription.id);

            if (error) throw error;
            toast.success('Medicine Delivered');
            setSelectedPrescription(null);
            fetchPrescriptions();
        } catch (error: any) {
            console.error('Dispense Error:', error);
            toast.error('Failed to update status: ' + (error.message || 'Unknown error'));
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Pharmacy Dashboard</h2>
                <p className="text-gray-500">Incoming prescriptions & fulfillment</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 bg-blue-50 border-b border-blue-100 font-medium text-blue-900 text-sm">
                    <div className="col-span-2">Token</div>
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-3">Doctor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading pharmacy queue...</div>
                ) : prescriptions.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No prescriptions found</div>
                ) : (
                    prescriptions.map((item) => (
                        <div
                            key={item.id}
                            className={`grid grid-cols-12 gap-4 p-4 border-b border-gray-100 items-center transition-colors
                                ${item.status === 'dispensed' ? 'bg-gray-50 opacity-60' : 'hover:bg-blue-50/50'}`}
                        >
                            <div className="col-span-2 font-mono font-bold text-blue-600">{item.token_number}</div>
                            <div className="col-span-3">
                                <div className="font-medium text-gray-900">{item.patient?.name}</div>
                                <div className="text-xs text-gray-500">{item.patient?.age} yrs</div>
                            </div>
                            <div className="col-span-3 text-gray-700">Dr. {item.doctor?.name}</div>
                            <div className="col-span-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                    ${item.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}>
                                    {item.status === 'pending' ? 'Pending' : 'Delivered'}
                                </span>
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                <button
                                    onClick={() => setSelectedPrescription(item)}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-600/20"
                                >
                                    Rx Prescription
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Prescription Detail Modal */}
            {selectedPrescription && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-scale-in">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Prescription Details
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">Token: {selectedPrescription.token_number}</p>
                            </div>
                            <button onClick={() => setSelectedPrescription(null)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto flex-1 font-serif">
                            <div className="text-center mb-8 border-b-2 border-gray-100 pb-6">
                                <h2 className="text-2xl font-bold text-blue-900 mb-1">BeanHealth Hospital</h2>
                                <p className="text-gray-600 text-sm">Excellence in Care</p>
                            </div>

                            <div className="flex justify-between mb-8 text-sm">
                                <div>
                                    <p className="text-gray-500">Patient</p>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPrescription.patient?.name}</p>
                                    <p className="text-gray-600">Age: {selectedPrescription.patient?.age}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-500">Doctor</p>
                                    <p className="font-bold text-gray-900 text-lg">Dr. {selectedPrescription.doctor?.name}</p>
                                    <p className="text-gray-600">{selectedPrescription.doctor?.specialty}</p>
                                    <p className="text-gray-400 text-xs mt-1">{new Date(selectedPrescription.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <span className="text-2xl text-blue-600 font-serif">Rx</span> Medications
                                </h4>
                                <div className="space-y-4">
                                    {(selectedPrescription.medications || []).map((med: any, i: number) => (
                                        <div key={i} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                                            <div>
                                                <p className="font-bold text-gray-800">{med.name} <span className="text-gray-400 font-normal text-sm ml-1">({med.dosage})</span></p>
                                                <p className="text-sm text-gray-600 italic mt-0.5">{med.instruction}</p>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="font-medium text-gray-900">{med.frequency}</p>
                                                <p className="text-gray-500">{med.duration}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedPrescription.notes && (
                                <div className="bg-blue-50 p-4 rounded-xl">
                                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Doctor's Notes</p>
                                    <p className="text-gray-700 text-sm">{selectedPrescription.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
                            <button
                                onClick={() => handleGeneratePDF(selectedPrescription)}
                                className="px-4 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 flex-1 transition-colors"
                            >
                                Print Official PDF
                            </button>

                            {selectedPrescription.status !== 'dispensed' && (
                                <button
                                    onClick={handleMarkDispensed}
                                    className="px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex-[2] shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-[1.02]"
                                >
                                    Medicine Delivered
                                </button>
                            )}
                            {selectedPrescription.status === 'dispensed' && (
                                <div className="flex-[2] flex items-center justify-center text-emerald-600 font-bold bg-emerald-50 rounded-xl">
                                    ✓ Delivered
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterprisePharmacyDashboard;
