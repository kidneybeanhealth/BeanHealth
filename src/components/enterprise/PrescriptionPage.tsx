import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface SavedDrug {
    id: string;
    name: string;
}

interface ReferenceDrug {
    id: string;
    brand_name: string;
    generic_name: string;
    category: string;
}

interface DrugOption {
    id: string;
    name: string;
    genericName?: string;
    category?: string;
    isReference?: boolean;
}

// Dose mappings for auto-populate
const DOSE_MAPPINGS: Record<string, { morning: string; noon: string; night: string }> = {
    'OD': { morning: '1', noon: '0', night: '0' },
    'TD': { morning: '1', noon: '0', night: '1' },
    'TDS': { morning: '1', noon: '1', night: '1' },
    'HS': { morning: '0', noon: '0', night: '1' },
    'QID': { morning: '1', noon: '1', night: '2' },
    '1/2 OD': { morning: '1/2', noon: '0', night: '0' },
    '1/2 TD': { morning: '1/2', noon: '0', night: '1/2' },
    '1/2 TDS': { morning: '1/2', noon: '1/2', night: '1/2' },
    '1/2 HS': { morning: '0', noon: '0', night: '1/2' },
};

const DOSE_OPTIONS = Object.keys(DOSE_MAPPINGS);

const FOOD_TIMING_OPTIONS = ['nil', 'A/F', 'B/F', 'SC', 'SC A/F'];

const TIMING_VALUE_OPTIONS = ['0', '1/2', '1', '1 + 1/2', '2'];

const PrescriptionPage: React.FC = () => {
    const { doctorId, patientId, prescriptionId } = useParams<{
        doctorId: string;
        patientId?: string;
        prescriptionId?: string
    }>();
    const navigate = useNavigate();
    const location = useLocation();

    const [doctor, setDoctor] = useState<any>(null);
    const [patient, setPatient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [readOnly, setReadOnly] = useState(false);
    const [existingData, setExistingData] = useState<any>(null);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

    // Form States
    const [formData, setFormData] = useState({
        fatherName: '',
        place: '',
        phone: '',
        allergy: 'Nil',
        diagnosis: '',
        reviewDate: '',
        testsToReview: '',
        specialistToReview: '',
        saltIntake: '',
        fluidIntake: ''
    });

    const [medications, setMedications] = useState([
        { name: '', number: '', dose: '', morning: '', noon: '', night: '', foodTiming: 'A/F' },
        { name: '', number: '', dose: '', morning: '', noon: '', night: '', foodTiming: 'A/F' },
        { name: '', number: '', dose: '', morning: '', noon: '', night: '', foodTiming: 'A/F' },
        { name: '', number: '', dose: '', morning: '', noon: '', night: '', foodTiming: 'A/F' },
        { name: '', number: '', dose: '', morning: '', noon: '', night: '', foodTiming: 'A/F' }
    ]);

    // Drug Search States
    const [savedDrugs, setSavedDrugs] = useState<SavedDrug[]>([]);
    const [referenceDrugs, setReferenceDrugs] = useState<ReferenceDrug[]>([]);
    const [showDrugDropdown, setShowDrugDropdown] = useState<number | null>(null);
    const [drugSearchQuery, setDrugSearchQuery] = useState('');
    const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
    const [newDrugName, setNewDrugName] = useState('');
    const [editingDrug, setEditingDrug] = useState<SavedDrug | null>(null);
    const [isSavingDrug, setIsSavingDrug] = useState(false);

    // Dose & Timing Dropdown States
    const [showDoseDropdown, setShowDoseDropdown] = useState<number | null>(null);
    const [doseSearchQuery, setDoseSearchQuery] = useState('');
    const [showFoodTimingDropdown, setShowFoodTimingDropdown] = useState<number | null>(null);

    const componentRef = useRef<HTMLDivElement>(null);
    const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    // 1. Initial Data Fetch
    useEffect(() => {
        const init = async () => {
            if (!doctorId) return;
            setLoading(true);
            try {
                // Fetch Doctor
                const { data: docData, error: docError } = await (supabase as any)
                    .from('hospital_doctor_profiles')
                    .select('*')
                    .eq('id', doctorId)
                    .single();
                if (docError) throw docError;
                if (!docData) throw new Error("Doctor profile not found");
                setDoctor(docData);

                // Fetch Hospital Logo
                if (docData.hospital_id) {
                    const { data: hospData } = await (supabase
                        .from('hospitals' as any) as any)
                        .select('logo_url')
                        .eq('id', docData.hospital_id)
                        .single();
                    setHospitalLogo(hospData?.logo_url || null);
                }

                if (prescriptionId) {
                    // HISTORY MODE
                    setReadOnly(true);
                    const { data: rxData, error: rxError } = await (supabase as any)
                        .from('hospital_prescriptions')
                        .select('*, patient:patients(*)')
                        .eq('id', prescriptionId)
                        .single();
                    if (rxError) throw rxError;
                    if (!rxData) throw new Error("Prescription not found");

                    setExistingData(rxData);
                    setPatient({
                        ...rxData.patient,
                        token_number: rxData.token_number || rxData.patient?.token_number
                    });
                } else if (patientId) {
                    // NEW PRESCRIBE MODE
                    setReadOnly(false);
                    const { data: patData, error: patError } = await (supabase as any)
                        .from('patients')
                        .select('*')
                        .eq('id', patientId)
                        .single();
                    if (patError) throw patError;
                    setPatient(patData);
                }

                // Fetch Drugs (same as modal)
                await fetchSavedDrugs(doctorId);
                await fetchReferenceDrugs();

            } catch (err: any) {
                console.error('Initialization error:', err);
                toast.error('Failed to load data: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [doctorId, patientId, prescriptionId]);

    // Combined drug options for search
    const allDrugOptions: DrugOption[] = [
        ...savedDrugs.map(d => ({ id: d.id, name: d.name, isReference: false })),
        ...referenceDrugs.map(d => ({
            id: d.id,
            name: d.brand_name,
            genericName: d.generic_name,
            category: d.category,
            isReference: true
        }))
    ];

    const filteredDrugs = allDrugOptions.filter(drug =>
        drug.name.toLowerCase().includes(drugSearchQuery.toLowerCase()) ||
        (drug.genericName && drug.genericName.toLowerCase().includes(drugSearchQuery.toLowerCase()))
    ).slice(0, 20);

    const fetchSavedDrugs = async (id: string) => {
        const { data } = await (supabase as any)
            .from('hospital_doctor_drugs')
            .select('*')
            .eq('doctor_id', id)
            .order('name', { ascending: true });
        setSavedDrugs(data || []);
    };

    const fetchReferenceDrugs = async () => {
        const { data } = await (supabase as any)
            .from('reference_drugs')
            .select('*')
            .order('category', { ascending: true });
        setReferenceDrugs(data || []);
    };

    // Auto-populate logic (same as modal)
    useEffect(() => {
        if (patient) {
            setFormData(prev => ({
                ...prev,
                fatherName: patient.father_husband_name || prev.fatherName || '',
                place: patient.place || prev.place || '',
                phone: patient.phone || prev.phone || ''
            }));
        }

        if (existingData) {
            try {
                const parsedMeds = (existingData.medications || []).map((m: any) => {
                    const freqs = (m.frequency || '0-0-0').split('-');
                    return {
                        name: m.name,
                        number: (m.dosage || '').replace(' tab', ''),
                        dose: m.dose || '',
                        morning: freqs[0] !== '0' ? freqs[0] : '',
                        noon: freqs[1] !== '0' ? freqs[1] : '',
                        night: freqs[2] !== '0' ? freqs[2] : '',
                        beforeFood: (m.instruction || '').toLowerCase().includes('before')
                    };
                });
                if (parsedMeds.length > 0) setMedications(parsedMeds);

                const notes = existingData.notes || '';
                setFormData(prev => ({
                    ...prev,
                    diagnosis: notes.match(/Diagnosis: (.*?)(\n|$)/)?.[1] || '',
                    reviewDate: notes.match(/Review: (.*?)(\n|$)/)?.[1] || '',
                    testsToReview: notes.match(/Tests: (.*?)(\n|$)/)?.[1] || '',
                    place: notes.match(/Place: (.*?)(\n|$)/)?.[1] || prev.place,
                    phone: notes.match(/Phone: (.*?)(\n|$)/)?.[1] || prev.phone
                }));
            } catch (e) {
                console.error("Error parsing existing prescription:", e);
            }
        }
    }, [patient, existingData]);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Prescription-${patient?.name || 'Patient'}-${new Date().toLocaleDateString()}`,
    } as any);

    const handleSend = async () => {
        if (readOnly) return;
        const toastId = toast.loading('Sending to pharmacy...');
        try {
            const pharmacyMeds = medications.filter(m => m.name).map(m => {
                const freq = `${m.morning || '0'}-${m.noon || '0'}-${m.night || '0'}`;
                return {
                    name: m.name,
                    dosage: m.number + ' tab',
                    dose: m.dose,
                    frequency: freq,
                    duration: 'See Review Date',
                    instruction: m.foodTiming === 'B/F' ? 'Before Food' : m.foodTiming === 'nil' ? '' : m.foodTiming || 'After Food'
                };
            });

            const notes = `Place: ${formData.place}\nPhone: ${formData.phone}\nDiagnosis: ${formData.diagnosis}\nReview: ${formData.reviewDate}\nTests: ${formData.testsToReview}`;

            // This is handled by EnterpriseDoctorDashboard.handleSendToPharmacy usually
            // We need to implement it here or expose it.
            // For now, let's replicate the core logic:

            const { data: prescriptionData, error: rxError } = await (supabase as any)
                .from('hospital_prescriptions')
                .insert({
                    hospital_id: doctor.hospital_id,
                    doctor_id: doctor.id,
                    patient_id: patient.id,
                    token_number: patient.token_number,
                    medications: pharmacyMeds,
                    notes: notes,
                    status: 'pending'
                } as any)
                .select()
                .single();

            if (rxError) throw rxError;
            if (!prescriptionData) throw new Error("Failed to create prescription");

            // Add to Pharmacy Queue
            console.log('[PrescriptionPage] Inserting into pharmacy queue:', {
                hospital_id: doctor.hospital_id,
                prescription_id: prescriptionData.id,
                patient_name: patient.name,
                token_number: patient.token_number
            });

            const { error: queueError } = await (supabase as any).from('hospital_pharmacy_queue').insert({
                hospital_id: doctor.hospital_id,
                prescription_id: prescriptionData.id,
                patient_name: patient.name,
                token_number: patient.token_number,
                status: 'waiting'
            });

            if (queueError) {
                console.error('[PrescriptionPage] Queue insert error:', queueError);
            } else {
                console.log('[PrescriptionPage] Successfully added to queue');
            }

            toast.success('Prescription sent to Pharmacy!', { id: toastId });
            setTimeout(() => window.close(), 1500); // Auto-close tab on success
        } catch (error: any) {
            toast.error('Failed to send: ' + error.message, { id: toastId });
        }
    };

    const addRow = () => !readOnly && setMedications([...medications, { name: '', number: '', dose: '', morning: '', noon: '', night: '', foodTiming: 'A/F' }]);
    const removeRow = (i: number) => !readOnly && medications.length > 1 && setMedications(medications.filter((_, idx) => idx !== i));
    const updateMed = (i: number, f: string, v: any) => {
        if (readOnly) return;
        const newMeds = [...medications];
        (newMeds[i] as any)[f] = v;

        // Auto-populate morning/noon/night when dose is selected
        if (f === 'dose' && DOSE_MAPPINGS[v]) {
            const mapping = DOSE_MAPPINGS[v];
            (newMeds[i] as any).morning = mapping.morning;
            (newMeds[i] as any).noon = mapping.noon;
            (newMeds[i] as any).night = mapping.night;
        }

        setMedications(newMeds);
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="font-medium">Loading Prescription...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            {/* Header Controls (Fixed, non-print) */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 p-4 shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => window.close()} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{readOnly ? 'View Prescription' : 'New Prescription'}</h1>
                            <p className="text-sm text-gray-500">{patient?.name} ({patient?.token_number})</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handlePrint} className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-black shadow-lg transition-all active:scale-95 flex items-center gap-2 text-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Print PDF
                        </button>
                        {!readOnly && (
                            <button onClick={handleSend} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-2 text-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                Send to Pharmacy
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Container for Preview */}
            <div className="p-4 bg-gray-50 min-h-[calc(100vh-80px)] overflow-y-auto">
                <div ref={componentRef} className="bg-white mx-auto shadow-sm p-4 max-w-[210mm] text-black w-full print-content">
                    {/* Reuse the exact JSX from PrescriptionModal here for A4 output */}
                    {/* ... (The multi-page template logic starts here) */}
                    {(() => {
                        const FIRST_PAGE_ITEMS = 15;
                        const SUBSEQUENT_PAGE_ITEMS = 25;
                        const totalMeds = medications.length;
                        const chunks = [];
                        if (totalMeds === 0) { chunks.push([]); chunks.push([]); }
                        else if (totalMeds <= FIRST_PAGE_ITEMS) { chunks.push(medications); chunks.push([]); }
                        else {
                            chunks.push(medications.slice(0, FIRST_PAGE_ITEMS));
                            const remaining = medications.slice(FIRST_PAGE_ITEMS);
                            for (let i = 0; i < remaining.length; i += SUBSEQUENT_PAGE_ITEMS) {
                                chunks.push(remaining.slice(i, i + SUBSEQUENT_PAGE_ITEMS));
                            }
                        }

                        return chunks.map((chunk, pageIndex) => {
                            const isFirstPage = pageIndex === 0;
                            const isLastPage = pageIndex === chunks.length - 1;
                            return (
                                <div key={pageIndex} className="flex flex-col relative bg-white" style={{ pageBreakAfter: pageIndex < chunks.length - 1 ? 'always' : 'auto', minHeight: '260mm', display: 'flex', flexDirection: 'column' }}>
                                    {isFirstPage && (
                                        <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1">
                                            <div className="w-16 h-16 relative"><img src={hospitalLogo || "/logo.png"} alt="Clinic Logo" className="w-[70px] h-[70px] object-contain absolute -top-1 left-0" /></div>
                                            <div className="text-center flex-1">
                                                <h1 className="text-lg font-bold text-blue-900 leading-tight">KONGUNAD KIDNEY CENTRE, Coimbatore - 641 012</h1>
                                                <h2 className="text-base font-bold text-blue-900 leading-tight">கொங்குநாடு கிட்னி சென்டர், கோயம்புத்தூர் - 641 012</h2>
                                            </div>
                                        </div>
                                    )}

                                    {isFirstPage && (
                                        <div className="border-2 border-black mb-2 text-xs font-bold">
                                            <div className="flex border-b border-black min-h-[24px]">
                                                <div className="w-1/2 flex border-r border-black">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">பெயர் / NAME</div>
                                                    <div className="flex-1 py-1 px-1.5 uppercase flex items-center">{patient?.name}</div>
                                                </div>
                                                <div className="w-1/2 flex">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">வயது-AGE / ஆ/பெ-M/F</div>
                                                    <div className="flex-1 py-1 px-1.5 flex items-center">{patient?.age} / {patient?.gender || 'M'}</div>
                                                </div>
                                            </div>
                                            <div className="flex border-b border-black min-h-[24px]">
                                                <div className="w-1/2 flex border-r border-black">
                                                    <div className="w-32 py-1 px-1.5 text-[10px] border-r border-black bg-gray-50 flex items-center leading-tight">தகப்பன்/கணவன் FATHER/HUSBAND</div>
                                                    <input className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent" value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} readOnly={readOnly} />
                                                </div>
                                                <div className="w-1/2 flex">
                                                    <div className="w-24 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center text-[10px]">பதிவு எண் / REG. No.</div>
                                                    <div className="flex-1 py-1 px-1.5 flex items-center border-r border-black">{patient?.token_number}</div>
                                                    <div className="w-16 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center text-[10px]">MR. NO</div>
                                                    <div className="flex-1 py-1 px-1.5 flex items-center">{patient?.mr_number || ''}</div>
                                                </div>
                                            </div>
                                            <div className="flex border-b border-black min-h-[24px]">
                                                <div className="w-1/2 flex border-r border-black">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">ஊர் / PLACE</div>
                                                    <input className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent" value={formData.place} onChange={e => setFormData({ ...formData, place: e.target.value })} readOnly={readOnly} />
                                                </div>
                                                <div className="w-1/2 flex">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">தேதி / DATE</div>
                                                    <div className="flex-1 py-1 px-1.5 flex items-center">{new Date().toLocaleDateString('en-GB')}</div>
                                                </div>
                                            </div>
                                            <div className="flex border-b border-black min-h-[24px]">
                                                <div className="flex-1 flex">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">போன் / PHONE</div>
                                                    <input className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} readOnly={readOnly} />
                                                </div>
                                            </div>
                                            <div className="flex border-b border-black min-h-[24px]">
                                                <div className="flex-1 flex">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">மருந்து/Drug அலர்ஜி/Allergy</div>
                                                    <input className="flex-1 py-1 px-1.5 outline-none font-normal text-red-600 bg-transparent" value={formData.allergy} onChange={e => setFormData({ ...formData, allergy: e.target.value })} readOnly={readOnly} />
                                                </div>
                                            </div>
                                            <div className="flex min-h-[24px]">
                                                <div className="flex-1 flex">
                                                    <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 flex items-center">வியாதிகள் / Diagnosis</div>
                                                    <input className="flex-1 py-1 px-1.5 outline-none font-normal w-full bg-transparent" value={formData.diagnosis} onChange={e => setFormData({ ...formData, diagnosis: e.target.value })} readOnly={readOnly} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`border-2 border-black flex flex-col ${pageIndex < chunks.length - 1 ? 'flex-1 mb-1' : 'mb-4'}`}>
                                        <div className="text-center font-bold border-b border-black py-1 text-xs shrink-0">மருந்துகள் பரிந்துரை விபரம் - MEDICINES PRESCRIPTION DETAILS</div>
                                        <div className="flex border-b border-black text-center font-bold text-xs shrink-0">
                                            <div className="w-8 border-r border-black py-1.5 flex items-center justify-center shrink-0">வ.எ<br />S.N</div>
                                            <div className="flex-1 border-r border-black py-1.5 flex items-center justify-center min-w-0">மருந்துக்கள் / DRUGS</div>
                                            <div className="w-[360px] shrink-0 flex flex-col">
                                                <div className="border-b border-black py-1">அளவு - Dose</div>
                                                <div className="flex flex-1 items-stretch">
                                                    <div className="w-20 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0">Dose / அளவு</div>
                                                    <div className="w-10 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0">Qty / எண்</div>
                                                    <div className="w-12 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0">M / கா</div>
                                                    <div className="w-12 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0">N / ம</div>
                                                    <div className="w-12 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0">Nt / இ</div>
                                                    <div className="w-14 py-1 text-[9px] flex flex-col items-center justify-center shrink-0">B/F A/F</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={isFirstPage ? "flex-1 flex flex-col justify-between" : ""}>
                                            {chunk.map((med, localI) => {
                                                const globalI = isFirstPage ? localI : FIRST_PAGE_ITEMS + (pageIndex - 1) * SUBSEQUENT_PAGE_ITEMS + localI;
                                                return (
                                                    <div key={globalI} className={`flex border-b border-black ${isFirstPage ? 'flex-1 items-stretch' : 'py-1'} text-xs relative group`}>
                                                        <div className="w-8 border-r border-black py-1 text-center flex items-center justify-center shrink-0">{globalI + 1}</div>
                                                        <div className="flex-1 border-r border-black px-1.5 relative min-w-0 flex items-center" ref={el => { dropdownRefs.current[globalI] = el; }}>
                                                            <input className="w-full outline-none font-bold uppercase text-xs" value={med.name} onChange={e => { updateMed(globalI, 'name', e.target.value); setDrugSearchQuery(e.target.value); !readOnly && setShowDrugDropdown(globalI); }} onFocus={() => !readOnly && (setShowDrugDropdown(globalI), setDrugSearchQuery(med.name))} readOnly={readOnly} />
                                                            {!readOnly && showDrugDropdown === globalI && filteredDrugs.length > 0 && (
                                                                <div className="absolute left-0 top-full z-50 w-[400px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto print:hidden">
                                                                    {filteredDrugs.map(drug => (
                                                                        <button key={drug.id} onClick={() => { updateMed(globalI, 'name', drug.name); setShowDrugDropdown(null); }} className="w-full px-3 py-2 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-0">
                                                                            <span className="font-semibold text-sm">{drug.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {!readOnly && (
                                                                <div className="absolute right-0 top-0 h-full hidden group-hover:flex items-center pr-1 print:hidden bg-white">
                                                                    <button onClick={() => removeRow(globalI)} className="text-red-500 hover:text-red-700 font-bold px-1">×</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="w-[360px] flex shrink-0 items-stretch">
                                                            {/* Dose - Searchable ComboBox */}
                                                            <div className="w-20 border-r border-black px-0.5 flex items-center justify-center shrink-0 relative">
                                                                <input
                                                                    className="w-full text-center outline-none text-[10px] font-bold uppercase"
                                                                    value={med.dose}
                                                                    onChange={e => { updateMed(globalI, 'dose', e.target.value.toUpperCase()); setDoseSearchQuery(e.target.value.toUpperCase()); !readOnly && setShowDoseDropdown(globalI); }}
                                                                    onFocus={() => !readOnly && (setShowDoseDropdown(globalI), setDoseSearchQuery(''))}
                                                                    onBlur={() => setTimeout(() => setShowDoseDropdown(null), 150)}
                                                                    readOnly={readOnly}
                                                                    placeholder="--"
                                                                />
                                                                {!readOnly && showDoseDropdown === globalI && (
                                                                    <div className="absolute left-0 top-full z-50 w-24 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto print:hidden">
                                                                        {DOSE_OPTIONS.filter(opt => !doseSearchQuery || opt.toUpperCase().includes(doseSearchQuery)).map(opt => (
                                                                            <button key={opt} onMouseDown={() => { updateMed(globalI, 'dose', opt); setShowDoseDropdown(null); }} className="w-full px-2 py-1.5 text-left hover:bg-emerald-50 text-xs font-bold border-b border-gray-50 last:border-0">
                                                                                {opt}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Qty */}
                                                            <div className="w-10 border-r border-black px-0.5 flex items-center justify-center shrink-0">
                                                                <input className="w-full text-center outline-none text-xs" value={med.number} onChange={e => updateMed(globalI, 'number', e.target.value)} readOnly={readOnly} />
                                                            </div>
                                                            {/* Morning */}
                                                            <div className="w-12 border-r border-black flex items-center justify-center shrink-0">
                                                                <input className="w-full text-center text-xs font-bold outline-none" value={med.morning} onChange={e => updateMed(globalI, 'morning', e.target.value)} readOnly={readOnly} placeholder="0" />
                                                            </div>
                                                            {/* Noon */}
                                                            <div className="w-12 border-r border-black flex items-center justify-center shrink-0">
                                                                <input className="w-full text-center text-xs font-bold outline-none" value={med.noon} onChange={e => updateMed(globalI, 'noon', e.target.value)} readOnly={readOnly} placeholder="0" />
                                                            </div>
                                                            {/* Night */}
                                                            <div className="w-12 border-r border-black flex items-center justify-center shrink-0">
                                                                <input className="w-full text-center text-xs font-bold outline-none" value={med.night} onChange={e => updateMed(globalI, 'night', e.target.value)} readOnly={readOnly} placeholder="0" />
                                                            </div>
                                                            {/* Food Timing Dropdown */}
                                                            <div className="w-14 flex items-center justify-center shrink-0 relative">
                                                                <button
                                                                    className="w-full text-center font-bold text-[9px] outline-none cursor-pointer hover:bg-gray-100 py-1"
                                                                    onClick={() => !readOnly && setShowFoodTimingDropdown(showFoodTimingDropdown === globalI ? null : globalI)}
                                                                    disabled={readOnly}
                                                                >
                                                                    {med.foodTiming || 'A/F'}
                                                                </button>
                                                                {!readOnly && showFoodTimingDropdown === globalI && (
                                                                    <div className="absolute right-0 top-full z-50 w-16 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden print:hidden">
                                                                        {FOOD_TIMING_OPTIONS.map(opt => (
                                                                            <button key={opt} onClick={() => { updateMed(globalI, 'foodTiming', opt); setShowFoodTimingDropdown(null); }} className="w-full px-2 py-1.5 text-left hover:bg-emerald-50 text-[10px] font-bold border-b border-gray-50 last:border-0">
                                                                                {opt}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {isLastPage && !readOnly && (
                                            <div className="p-2 text-center border-t border-dashed border-gray-300 print:hidden">
                                                <button onClick={addRow} className="text-emerald-600 text-sm font-bold hover:underline">+ Add Medicine Row</button>
                                            </div>
                                        )}
                                    </div>

                                    {isLastPage && (
                                        <div className="mt-auto">
                                            <div className="border-t border-black pt-2 mt-1 mb-2">
                                                <p className="font-bold underline italic text-[10px] mb-1.5">To be specified / monitored:</p>
                                                <div className="flex gap-6 text-[10px] font-bold">
                                                    <div className="flex gap-1 items-baseline"><span>Salt intake (உப்பு):</span><input className="w-16 border-b border-gray-300 border-dotted outline-none text-center" value={formData.saltIntake} onChange={e => setFormData({ ...formData, saltIntake: e.target.value })} readOnly={readOnly} /><span>gm/day</span></div>
                                                    <div className="flex gap-1 items-baseline"><span>Fluid intake (நீர்/திரவம்):</span><input className="w-16 border-b border-gray-300 border-dotted outline-none text-center" value={formData.fluidIntake} onChange={e => setFormData({ ...formData, fluidIntake: e.target.value })} readOnly={readOnly} /><span>lit/day</span></div>
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-xs font-bold mb-2">
                                                <div className="flex gap-2 items-end"><div className="shrink-0 w-80">மீண்டும் வரவேண்டிய நாள் / Review on :</div><input type="date" className="flex-1 border-b border-dashed outline-none" value={formData.reviewDate} onChange={e => setFormData({ ...formData, reviewDate: e.target.value })} readOnly={readOnly} /></div>
                                                <div className="flex gap-2 items-end"><div className="shrink-0 w-80">செய்ய வேண்டிய பரிசோதனைகள் / Tests :</div><input className="flex-1 border-b border-dashed outline-none" value={formData.testsToReview} onChange={e => setFormData({ ...formData, testsToReview: e.target.value })} readOnly={readOnly} /></div>
                                                <div className="flex gap-2 items-end"><div className="shrink-0 w-80">பார்க்க வேண்டிய டாக்டர்கள் / Specialists :</div><input className="flex-1 border-b border-dashed outline-none" value={formData.specialistToReview} onChange={e => setFormData({ ...formData, specialistToReview: e.target.value })} readOnly={readOnly} /></div>
                                            </div>
                                            <div className="flex justify-end mt-4">
                                                <div className="text-center"><div className="h-8"></div><div className="font-bold border-t border-black px-4 pt-1">டாக்டர் கையொப்பம். / DOCTOR SIGNATURE.</div></div>
                                            </div>
                                            <div className="w-full border-2 border-black p-2 text-[12px] leading-[1.5] text-center font-bold mt-4">
                                                <p>முன்பதிவு காலதாமதத்தை குறைக்கும் / Prior registration avoids delay</p>
                                                <p>Appt: 0422-2494333, 73588 41555, 41666 | Time: 8am - 6pm</p>
                                                <p className="border-t border-gray-300 mt-1 pt-1">Dr. A. பிரபாகர் MD., DNB (Nephrology) | Dr. A. திவாகர் MS., M.ch (Urology)</p>
                                                <p>அவசர உதவிக்கு / Emergency: 0422 - 2494333 (24 மணி நேரமும் / 24 hrs Service)</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>
        </div>
    );
};

export default PrescriptionPage;
