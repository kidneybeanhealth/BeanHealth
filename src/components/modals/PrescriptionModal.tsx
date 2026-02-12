import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import MobilePrescriptionInput from './MobilePrescriptionInput';

interface SavedDrug {
  id: string;
  name: string;
  drug_type?: string;
}

interface ReferenceDrug {
  id: string;
  brand_name: string;      // Primary: "Ciprodac 500"
  generic_name: string;    // Secondary: "CIPROFLOXACIN"
  category: string;        // "ANTIBIOTIC"
}

interface DrugOption {
  id: string;
  name: string;            // The display name (brand or saved drug name)
  genericName?: string;    // Generic name for reference drugs
  category?: string;
  drugType?: string;       // TAB, CAP, INJ, SYP
  isReference?: boolean;
}

interface Medication {
  name: string;
  number: string;
  dose: string;
  morning: string;
  morningTime: string;
  noon: string;
  noonTime: string;
  evening: string;
  eveningTime: string;
  night: string;
  nightTime: string;
  foodTiming: string;
  drugType?: string;
}

// Drug type icons helper
const getDrugTypeIcon = (type?: string): string => {
  switch (type) {
    case 'CAP': return '🔶';
    case 'INJ': return '💉';
    case 'SYP': return '🧴';
    default: return '💊';
  }
};

interface PrescriptionModalProps {
  doctor: any;
  patient: any;
  onClose: () => void;
  onSendToPharmacy?: (medications: any[], notes: string) => void;
  readOnly?: boolean;
  existingData?: any;
  clinicLogo?: string;
}

// Dose mappings for auto-populate: Morning, Noon, Evening, Night
const DOSE_MAPPINGS: Record<string, { morning: string; noon: string; evening: string; night: string }> = {
  'OD': { morning: '1', noon: '0', evening: '0', night: '0' },
  'BD': { morning: '1', noon: '0', evening: '0', night: '1' },
  'TDS': { morning: '1', noon: '1', evening: '0', night: '1' },
  'HS': { morning: '0', noon: '0', evening: '0', night: '1' },
  'QID': { morning: '1', noon: '1', evening: '1', night: '1' },
  '1/2 OD': { morning: '1/2', noon: '0', evening: '0', night: '0' },
  '1/2 BD': { morning: '1/2', noon: '0', evening: '0', night: '1/2' },
  '1/2 TDS': { morning: '1/2', noon: '1/2', evening: '0', night: '1/2' },
  '1/2 HS': { morning: '0', noon: '0', evening: '0', night: '1/2' },
};

const DOSE_OPTIONS = Object.keys(DOSE_MAPPINGS);

const FOOD_TIMING_OPTIONS = ['nil', 'A/F', 'B/F', 'SC', 'SC A/F'];

const TIME_OPTIONS = ['6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'];

const SPECIALIST_OPTIONS = [
  'Dr. A. Prabhakar',
  'Dr. A. Divakar'
];

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ doctor, patient, onClose, onSendToPharmacy, readOnly = false, existingData = null, clinicLogo }) => {
  // Form States matching the PDF structure
  const [formData, setFormData] = useState({
    fatherName: '',
    place: '',
    phone: '',
    allergy: '',
    diagnosis: '',
    reviewDate: '',
    testsToReview: '',
    specialistToReview: '',
    saltIntake: '',
    fluidIntake: '',
    doctorNotes: ''
  });

  const [medications, setMedications] = useState<Medication[]>([
    { name: '', number: '', dose: '', morning: '', morningTime: '', noon: '', noonTime: '', evening: '', eveningTime: '', night: '', nightTime: '', foodTiming: '' },
    { name: '', number: '', dose: '', morning: '', morningTime: '', noon: '', noonTime: '', evening: '', eveningTime: '', night: '', nightTime: '', foodTiming: '' },
    { name: '', number: '', dose: '', morning: '', morningTime: '', noon: '', noonTime: '', evening: '', eveningTime: '', night: '', nightTime: '', foodTiming: '' },
    { name: '', number: '', dose: '', morning: '', morningTime: '', noon: '', noonTime: '', evening: '', eveningTime: '', night: '', nightTime: '', foodTiming: '' },
    { name: '', number: '', dose: '', morning: '', morningTime: '', noon: '', noonTime: '', evening: '', eveningTime: '', night: '', nightTime: '', foodTiming: '' }
  ]);

  // Time options for timing dropdowns (removed internal constant, uses outside one)

  // Medication and Mobile States
  const [isMobile, setIsMobile] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  // Saved Drugs State
  const [savedDrugs, setSavedDrugs] = useState<SavedDrug[]>([]);
  const [showDrugDropdown, setShowDrugDropdown] = useState<number | null>(null);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugType, setNewDrugType] = useState('');
  const DRUG_TYPES = [
    { value: 'TAB', label: 'TAB', icon: '💊', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'CAP', label: 'CAP', icon: '🔶', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { value: 'INJ', label: 'INJ', icon: '💉', color: 'bg-red-50 text-red-700 border-red-200' },
    { value: 'SYP', label: 'SYP', icon: '🧴', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  ];
  const [editingDrug, setEditingDrug] = useState<SavedDrug | null>(null);
  const [isSavingDrug, setIsSavingDrug] = useState(false);

  // Saved Diagnosis State
  const [savedDiagnoses, setSavedDiagnoses] = useState<any[]>([]);
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
  const [diagnosisSearchQuery, setDiagnosisSearchQuery] = useState('');
  // Dose & Timing Dropdown States
  const [showDoseDropdown, setShowDoseDropdown] = useState<number | null>(null);
  const [doseSearchQuery, setDoseSearchQuery] = useState('');
  const [showFoodTimingDropdown, setShowFoodTimingDropdown] = useState<number | null>(null);
  const [foodTimingSearchQuery, setFoodTimingSearchQuery] = useState('');
  const [showTimeDropdown, setShowTimeDropdown] = useState<{ index: number, field: string } | null>(null);
  const [timeSearchQuery, setTimeSearchQuery] = useState('');
  const [showSpecialistDropdown, setShowSpecialistDropdown] = useState(false);

  // Refs for printing
  const componentRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Scaling Logic
  const [layoutState, setLayoutState] = useState({ scale: 1, marginLeft: 0 });

  useEffect(() => {
    const handleResize = () => {
      // Logic for mobile view detection
      const totalWidth = window.innerWidth;
      setIsMobile(totalWidth < 768);

      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth;
        // 210mm is approx 794px. We use 800px as the target breakpoint.
        const targetWidth = 800;

        if (availableWidth < targetWidth) {
          // Calculate scale with 5% Zoom Boost for readability
          const fitScale = availableWidth / targetWidth;
          const newScale = Math.max(fitScale * 1.05, 0.5);

          // Calculate Margins to Center
          const scaledWidth = targetWidth * newScale;
          let marginLeft = 0;

          if (scaledWidth < availableWidth) {
            marginLeft = (availableWidth - scaledWidth) / 2;
          }
          // If overflows, marginLeft stays 0 (left aligned scrolling)

          setLayoutState({ scale: newScale, marginLeft });
        } else {
          const marginLeft = Math.max(0, (availableWidth - targetWidth) / 2);
          setLayoutState({ scale: 1, marginLeft });
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!readOnly) {
      if (doctor?.id) {
        fetchSavedDrugs();
        fetchSavedDiagnoses();
      }
    }
  }, [doctor?.id, readOnly]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDrugDropdown !== null) {
        const dropdownEl = dropdownRefs.current[showDrugDropdown];
        if (dropdownEl && !dropdownEl.contains(event.target as Node)) {
          setShowDrugDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDrugDropdown]);

  const fetchSavedDrugs = async () => {
    try {
      const { data, error } = await supabase
        .from('hospital_doctor_drugs' as any)
        .select('*')
        .eq('doctor_id', doctor.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setSavedDrugs(data || []);
    } catch (error) {
      console.error('Error fetching saved drugs:', error);
    }
  };

  const fetchSavedDiagnoses = async () => {
    try {
      const { data, error } = await supabase
        .from('hospital_doctor_diagnoses' as any)
        .select('*')
        .eq('doctor_id', doctor.id)
        .order('name', { ascending: true });
      if (error) throw error;
      setSavedDiagnoses(data || []);
    } catch (error) {
      console.error('Error fetching saved diagnoses:', error);
    }
  };

  const handleSaveDrug = async () => {
    if (!newDrugName.trim()) {
      toast.error('Drug name is required');
      return;
    }

    setIsSavingDrug(true);
    try {
      if (editingDrug) {
        // Update existing drug
        const { error } = await (supabase
          .from('hospital_doctor_drugs') as any)
          .update({
            name: newDrugName.toUpperCase().trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDrug.id);

        if (error) throw error;
        toast.success('Drug updated successfully');
      } else {
        // Insert new drug
        const { error } = await (supabase
          .from('hospital_doctor_drugs') as any)
          .insert({
            doctor_id: doctor.id,
            name: newDrugName.toUpperCase().trim(),
            drug_type: newDrugType || null,
            created_at: new Date().toISOString()
          });

        if (error) {
          if (error.code === '23505') {
            toast.error('This drug already exists');
            return;
          }
          throw error;
        }
        toast.success('Drug saved successfully');
      }

      // Reset form and refresh list
      setNewDrugName('');
      setNewDrugType('');
      setEditingDrug(null);
      fetchSavedDrugs();
    } catch (error: any) {
      console.error('Error saving drug:', error);
      toast.error(error.message || 'Failed to save drug');
    } finally {
      setIsSavingDrug(false);
    }
  };

  const handleDeleteDrug = async (drugId: string) => {
    if (!confirm('Are you sure you want to delete this drug?')) return;

    try {
      const { error } = await supabase
        .from('hospital_doctor_drugs' as any)
        .delete()
        .eq('id', drugId);

      if (error) throw error;
      toast.success('Drug deleted');
      fetchSavedDrugs();
    } catch (error: any) {
      console.error('Error deleting drug:', error);
      toast.error('Failed to delete drug');
    }
  };

  const handleSelectDrug = (index: number, drug: SavedDrug) => {
    const newMeds = [...medications];
    const drugType = (drug as any).drugType || (drug as any).drug_type;
    const prefix = drugType ? `${drugType}. ` : '';
    newMeds[index] = {
      ...newMeds[index],
      name: `${prefix}${drug.name}`,
      drugType: drugType || ''
    };
    setMedications(newMeds);
    setShowDrugDropdown(null);
    setDrugSearchQuery('');
  };

  // Combine saved drugs for searching
  const allDrugOptions: DrugOption[] = [
    // Personal saved drugs only
    ...savedDrugs.map(d => ({
      id: d.id,
      name: d.name,
      drugType: d.drug_type || 'TAB',
      isReference: false
    }))
  ];

  const filteredDrugs = allDrugOptions.filter(drug =>
    drug.name.toLowerCase().includes(drugSearchQuery.toLowerCase()) ||
    (drug.genericName && drug.genericName.toLowerCase().includes(drugSearchQuery.toLowerCase()))
  ).slice(0, 20); // Limit to 20 results for performance

  // Initialize patient data fields
  useEffect(() => {
    // Auto-populate from patient data
    if (patient) {
      setFormData(prev => ({
        ...prev,
        fatherName: patient.father_husband_name || prev.fatherName || '',
        place: patient.place || prev.place || '',
        phone: patient.phone || prev.phone || ''
      }));
    }

    if (existingData) {
      // Parse Existing Data for Read-Only View
      try {
        // medications
        const parsedMeds = (existingData.medications || []).map((m: any) => {
          const freqs = (m.frequency || '0-0-0').split('-');
          // Parse instruction to foodTiming
          const instruction = (m.instruction || '').toLowerCase();
          let foodTiming = 'A/F';
          if (instruction.includes('before')) foodTiming = 'B/F';
          else if (instruction.includes('sc a/f') || instruction.includes('sc af')) foodTiming = 'SC A/F';
          else if (instruction.includes('sc')) foodTiming = 'SC';
          else if (instruction === '' || instruction.includes('nil')) foodTiming = 'nil';

          return {
            name: m.name,
            number: (m.dosage || '').replace(' tab', ''),
            dose: m.dose || '',
            morning: freqs[0] !== '0' ? freqs[0] : '',
            morningTime: '',
            noon: freqs[1] !== '0' ? freqs[1] : '',
            noonTime: '',
            evening: freqs[2] !== '0' ? freqs[2] : '',
            eveningTime: '',
            night: freqs[3] !== '0' ? freqs[3] : '',
            nightTime: '',
            foodTiming
          };
        });
        if (parsedMeds.length > 0) setMedications(parsedMeds);

        // Notes parsing
        const notes = existingData.notes || '';
        const diagnosis = notes.match(/Diagnosis: (.*?)(\n|$)/)?.[1] || '';
        const review = notes.match(/Review: (.*?)(\n|$)/)?.[1] || '';
        const tests = notes.match(/Tests: (.*?)(\n|$)/)?.[1] || '';
        const specialists = notes.match(/SpecialistToReview: (.*?)(\n|$)/)?.[1]
          || notes.match(/SpecialistsToReview: (.*?)(\n|$)/)?.[1]
          || '';
        const place = notes.match(/Place: (.*?)(\n|$)/)?.[1] || '';
        const phone = notes.match(/Phone: (.*?)(\n|$)/)?.[1] || '';
        const docNotes = notes.match(/DoctorNotes: (.*?)(\n|$)/)?.[1] || '';
        const salt = notes.match(/SaltIntake: (.*?)(\n|$)/)?.[1] || '';
        const fluid = notes.match(/FluidIntake: (.*?)(\n|$)/)?.[1] || '';

        setFormData(prev => ({
          ...prev,
          diagnosis,
          reviewDate: review,
          testsToReview: tests,
          specialistToReview: specialists,
          place: place || prev.place,
          phone: phone || prev.phone,
          doctorNotes: docNotes,
          saltIntake: salt,
          fluidIntake: fluid
        }));

      } catch (e) {
        console.error("Error parsing existing prescription:", e);
      }
    }
  }, [patient, existingData]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Prescription-${patient?.name || 'Patient'}-${new Date().toLocaleDateString()}`,
    onPrintError: (error) => console.error('Print failed:', error),
    onBeforeGetContent: () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 500); // Wait for 500ms to ensure styles/Tailwind are fully loaded in the iframe context
      });
    },
    removeAfterPrint: true
  } as any);

  // Medicine Handlers
  const addRow = () => {
    if (readOnly) return;
    setMedications([...medications, { name: '', number: '', dose: '', morning: '', morningTime: '', noon: '', noonTime: '', evening: '', eveningTime: '', night: '', nightTime: '', foodTiming: '' }]);
  };

  const removeRow = (index: number) => {
    if (readOnly) return;
    if (medications.length === 1) return;
    const newMeds = [...medications];
    newMeds.splice(index, 1);
    setMedications(newMeds);
  };

  const updateMed = (index: number, field: string, value: any) => {
    if (readOnly) return;
    const newMeds = [...medications];
    (newMeds[index] as any)[field] = value;

    // Auto-populate morning/noon/night when dose is selected
    if (field === 'dose' && DOSE_MAPPINGS[value]) {
      const mapping = DOSE_MAPPINGS[value];
      (newMeds[index] as any).morning = mapping.morning;
      (newMeds[index] as any).noon = mapping.noon;
      (newMeds[index] as any).night = mapping.night;
    }

    setMedications(newMeds);
  };

  const handleSend = () => {
    if (readOnly) return;
    // Convert to pharmacy format
    const pharmacyMeds = medications.filter(m => m.name).map(m => {
      const freq = `${m.morning || '0'}-${m.noon || '0'}-${m.evening || '0'}-${m.night || '0'}`;
      return {
        name: m.name,
        dosage: m.number + ' tab',
        dose: m.dose,
        frequency: freq,
        duration: 'See Review Date',
        instruction: m.foodTiming === 'B/F' ? 'Before Food' : m.foodTiming === 'nil' ? '' : m.foodTiming || 'After Food'
      };
    });

    // We pack the extra metadata (Place, Phone, etc) into the notes field so it persists without schema changes
    const notes = `Place: ${formData.place}\nPhone: ${formData.phone}\nDiagnosis: ${formData.diagnosis}\nReview: ${formData.reviewDate}\nTests: ${formData.testsToReview}\nSpecialistToReview: ${formData.specialistToReview}\nSaltIntake: ${formData.saltIntake}\nFluidIntake: ${formData.fluidIntake}${formData.doctorNotes ? '\nDoctorNotes: ' + formData.doctorNotes : ''}`;
    if (onSendToPharmacy) onSendToPharmacy(pharmacyMeds, notes);
  };

  if (isMobile && !showPrintView) {
    return (
      <MobilePrescriptionInput
        doctor={doctor}
        patient={patient}
        medications={medications}
        updateMed={updateMed}
        addRow={addRow}
        removeRow={removeRow}
        formData={formData}
        setFormData={setFormData}
        onClose={onClose}
        onPrint={() => setShowPrintView(true)}
        onSend={handleSend}
        readOnly={readOnly}
        savedDiagnoses={savedDiagnoses}
        diagnosisSearchQuery={diagnosisSearchQuery}
        setDiagnosisSearchQuery={setDiagnosisSearchQuery}
        showDiagnosisDropdown={showDiagnosisDropdown}
        setShowDiagnosisDropdown={setShowDiagnosisDropdown}
        DOSE_OPTIONS={DOSE_OPTIONS}
        DOSE_MAPPINGS={DOSE_MAPPINGS}
        FOOD_TIMING_OPTIONS={FOOD_TIMING_OPTIONS}
        TIME_OPTIONS={TIME_OPTIONS}
        drugSearchQuery={drugSearchQuery}
        setDrugSearchQuery={setDrugSearchQuery}
        filteredDrugs={filteredDrugs}
        handleSelectDrug={handleSelectDrug}
        showDrugDropdown={showDrugDropdown}
        setShowDrugDropdown={setShowDrugDropdown}
        SPECIALIST_OPTIONS={SPECIALIST_OPTIONS}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-scale-in">

        {/* Mobile View Toggle (Floating back button when in print preview on mobile) */}
        {isMobile && showPrintView && (
          <div className="sticky top-0 z-[70] bg-white/80 backdrop-blur-md p-4 border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setShowPrintView(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center gap-2"
            >
              ← Back to Edit
            </button>
            <span className="font-bold text-gray-900">Print Preview</span>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100" ref={containerRef}>
          <div
            ref={componentRef}
            className="print-content bg-white shadow-sm p-4 max-w-[210mm] text-black w-full origin-top-left"
            style={{
              fontFamily: '"Times New Roman", Times, serif',
              minWidth: '210mm',
              transform: `scale(${layoutState.scale})`,
              marginLeft: layoutState.marginLeft,
              marginBottom: layoutState.scale < 1 ? `-${(1 - layoutState.scale) * 100}%` : '0' // Attempt to reduce bottom whitespace
            }}
          >
            <style>{`
            @media print {
              .print-content {
                transform: none !important;
                width: 100% !important;
                margin: 0 !important;
                min-width: 0 !important;
              }
            }
          `}</style>
            {(() => {
              const FIRST_PAGE_ITEMS = 15;
              const SUBSEQUENT_PAGE_ITEMS = 25; // High capacity for additional pages if needed
              const totalMeds = medications.length;
              const chunks = [];

              if (totalMeds === 0) {
                chunks.push([]); // Page 1
                chunks.push([]); // Page 2 (footer)
              } else if (totalMeds <= FIRST_PAGE_ITEMS) {
                chunks.push(medications); // Page 1
                chunks.push([]); // Page 2 (footer)
              } else {
                // Page 1: First 15
                chunks.push(medications.slice(0, FIRST_PAGE_ITEMS));
                const remaining = medications.slice(FIRST_PAGE_ITEMS);
                for (let i = 0; i < remaining.length; i += SUBSEQUENT_PAGE_ITEMS) {
                  chunks.push(remaining.slice(i, i + SUBSEQUENT_PAGE_ITEMS));
                }
                // If it ended exactly at the end of a chunk, we still need a footer page? 
                // Actually the current logic puts footer on isLastPage.
                // If the last chunk is very full, it might push footer to a new page in actual print, 
                // but here we are forcing chunks.
              }

              return chunks.map((chunk, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === chunks.length - 1;
                // Standardize expansion for the first page only if there are enough items to fill space
                const shouldExpand = isFirstPage && chunk.length >= 5;
                const isFirstPageMulti = false; // Deprecated by new logic

                return (
                  <div
                    key={pageIndex}
                    className="flex flex-col relative bg-white"
                    style={{
                      pageBreakAfter: pageIndex < chunks.length - 1 ? 'always' : 'auto',
                      minHeight: '260mm',
                      marginBottom: '0',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Header - Only on Page 1 */}
                    {pageIndex === 0 && (
                      <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1 relative">
                        <div className="w-16 h-16 relative">
                          <img src={clinicLogo || "/logo.png"} alt="Clinic Logo" className="w-[70px] h-[70px] object-contain absolute -top-1 left-0" />
                        </div>
                        <div className="text-center flex-1">
                          <h1 className="text-lg font-bold text-blue-900 leading-tight">KONGUNAD KIDNEY CENTRE, Coimbatore - 641 012</h1>
                          <h2 className="text-base font-bold text-blue-900 leading-tight">கொங்குநாடு கிட்னி சென்டர், கோயம்புத்தூர் - 641 012</h2>
                        </div>
                        {/* Page Number Indicator */}
                        {chunks.length > 1 && (
                          <div className="absolute top-0 right-0 text-xs font-bold text-gray-500">
                            Page {pageIndex + 1} of {chunks.length}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Patient Details Grid Box - Only on Page 1 */}
                    {pageIndex === 0 && (
                      <div className="border-2 border-black mb-2 text-xs font-bold" style={{ borderCollapse: 'collapse' }}>
                        {/* Row 1 */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="w-1/2 flex border-r border-black">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">பெயர் / NAME</div>
                            <div className="flex-1 py-1 px-1.5 uppercase flex items-center">{patient.name}</div>
                          </div>
                          <div className="w-1/2 flex">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">வயது-AGE / ஆ/பெ-M/F</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center">{patient.age} / {patient.gender || 'M'}</div>
                          </div>
                        </div>
                        {/* Row 2 */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="w-1/2 flex border-r border-black">
                            <div className="w-32 py-1 px-1.5 text-[10px] border-r border-black bg-gray-50 print:bg-white flex items-center leading-tight">தகப்பன்/கணவன் FATHER/HUSBAND</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent"
                              value={formData.fatherName}
                              onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                            />
                          </div>
                          <div className="w-1/2 flex">
                            <div className="w-24 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[10px]">பதிவு எண் / REG. No.</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center border-r border-black">{patient.token_number}</div>
                            <div className="w-16 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[10px]">MR. NO</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center">{patient.mr_number || ''}</div>
                          </div>
                        </div>
                        {/* Row 3 */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="w-1/2 flex border-r border-black">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">ஊர் / PLACE</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent"
                              value={formData.place}
                              onChange={e => setFormData({ ...formData, place: e.target.value })}
                            />
                          </div>
                          <div className="w-1/2 flex">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">தேதி / DATE</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center">{new Date().toLocaleDateString('en-GB')}</div>
                          </div>
                        </div>
                        {/* Row 4 */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="flex-1 flex">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">போன் / PHONE</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent"
                              value={formData.phone}
                              onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                          </div>
                        </div>
                        {/* Row 5 */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="flex-1 flex">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">மருந்து/Drug அலர்ஜி/Allergy</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-normal text-red-600 bg-transparent"
                              value={formData.allergy}
                              onChange={e => setFormData({ ...formData, allergy: e.target.value })}
                            />
                          </div>
                        </div>
                        {/* Row 6 */}
                        <div className="flex min-h-[48px]">
                          <div className="flex-1 flex relative">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center">வியாதிகள் / Diagnosis</div>
                            <div className="flex-1 relative flex">
                              <textarea
                                className="flex-1 py-1 px-1.5 outline-none font-normal w-full bg-transparent resize-none leading-tight"
                                value={formData.diagnosis}
                                onChange={e => {
                                  setFormData({ ...formData, diagnosis: e.target.value.toUpperCase() });
                                  setDiagnosisSearchQuery(e.target.value);
                                  setShowDiagnosisDropdown(true);
                                }}
                                onFocus={() => setShowDiagnosisDropdown(true)}
                                onBlur={() => setTimeout(() => setShowDiagnosisDropdown(false), 200)}
                                rows={2}
                              />
                              {showDiagnosisDropdown && savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase())).length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-[100] bg-white border-2 border-black shadow-xl max-h-48 overflow-y-auto">
                                  {savedDiagnoses
                                    .filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase()))
                                    .map(diag => (
                                      <button
                                        key={diag.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs font-bold border-b border-gray-100 last:border-0"
                                        onMouseDown={() => {
                                          setFormData({ ...formData, diagnosis: diag.name });
                                          setShowDiagnosisDropdown(false);
                                        }}
                                      >
                                        {diag.name}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Medicine Table Box */}
                    {chunk.length > 0 && (
                      <div className={`border-2 border-black flex flex-col ${pageIndex < chunks.length - 1 ? 'flex-1 mb-1' : 'mb-4'}`}>
                        <div className="text-center font-bold border-b border-black py-1 text-xs shrink-0">
                          மருந்துகள் பரிந்துரை விபரம் - MEDICINES PRESCRIPTION DETAILS
                        </div>

                        {/* Table Headers */}
                        <div className="flex border-b border-black text-center font-bold text-xs shrink-0">
                          <div className="w-8 border-r border-black py-1.5 flex items-center justify-center shrink-0">
                            வ.எ<br />S.N
                          </div>
                          <div className="flex-1 border-r border-black py-1.5 flex items-center justify-center min-w-0">
                            மருந்துக்கள் / DRUGS
                          </div>
                          <div className="w-[446px] shrink-0 flex flex-col">
                            <div className="border-b border-black py-1">எத்தனை முறை - Frequency</div>
                            <div className="flex flex-1 items-stretch">
                              <div className="w-28 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>Qty</span>
                                <span>எண்</span>
                              </div>
                              <div className="w-10 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>Freq</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>M</span>
                                <span>கா</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>N</span>
                                <span>ம</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>E</span>
                                <span>மா</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>Nt</span>
                                <span>இ</span>
                              </div>
                              <div className="w-8 py-1 text-[9px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                                <span>B/F</span>
                                <span>A/F</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Table Body Container - Expand on first page if single page */}
                        <div className={shouldExpand || isFirstPageMulti ? "flex-1 flex flex-col justify-between" : ""}>

                          {chunk.map((med, localIndex) => {
                            // Calculate correct global index based on page
                            const globalIndex = pageIndex === 0
                              ? localIndex
                              : FIRST_PAGE_ITEMS + (pageIndex - 1) * SUBSEQUENT_PAGE_ITEMS + localIndex;

                            const shouldExpandRow = shouldExpand;

                            return (
                              <div
                                key={globalIndex}
                                className={`flex border-b border-black ${shouldExpandRow ? 'flex-1 items-stretch' : 'py-1 min-h-[40px]'} text-xs relative group`}
                              >
                                <div className="w-8 border-r border-black py-1 text-center flex items-center justify-center shrink-0">
                                  {globalIndex + 1}
                                </div>
                                <div className={`flex-1 border-r border-black px-1.5 relative min-w-0 flex items-center`} ref={el => { dropdownRefs.current[globalIndex] = el; }}>
                                  <input
                                    className="w-full outline-none font-bold uppercase text-xs"
                                    placeholder="Type drug name..."
                                    value={med.name}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateMed(globalIndex, 'name', val);
                                      setDrugSearchQuery(val);
                                      if (!readOnly && allDrugOptions.length > 0) {
                                        setShowDrugDropdown(globalIndex);
                                      }
                                    }}
                                    onFocus={() => {
                                      if (!readOnly && allDrugOptions.length > 0) {
                                        setShowDrugDropdown(globalIndex);
                                        setDrugSearchQuery(med.name);
                                      }
                                    }}
                                    readOnly={readOnly}
                                  />
                                  {!readOnly && showDrugDropdown === globalIndex && filteredDrugs.length > 0 && (
                                    <div className="absolute left-0 top-full z-[100] w-[400px] bg-white border-2 border-black shadow-xl max-h-64 overflow-y-auto print:hidden">
                                      {filteredDrugs.map(drug => (
                                        <button
                                          key={drug.id}
                                          type="button"
                                          className="w-full px-3 py-2 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-0"
                                          onMouseDown={() => {
                                            const newMeds = [...medications];
                                            const prefix = drug.drugType ? `${drug.drugType}. ` : '';
                                            newMeds[globalIndex].name = `${prefix}${drug.name}`;
                                            newMeds[globalIndex].drugType = drug.drugType || '';
                                            setMedications(newMeds);
                                            setShowDrugDropdown(null);
                                            setDrugSearchQuery('');
                                          }}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-gray-900">{drug.name}</span>
                                            {drug.category && (
                                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium uppercase">
                                                {drug.category}
                                              </span>
                                            )}
                                            {!drug.isReference && (
                                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                                {drug.drugType || 'TAB'}
                                              </span>
                                            )}
                                          </div>
                                          {drug.genericName && (
                                            <div className="text-xs text-gray-500 mt-0.5">
                                              {drug.genericName}
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {/* Row Controls (Hidden in Print) */}
                                  <div className="absolute right-0 top-0 h-full hidden group-hover:flex items-center pr-1 print:hidden bg-white gap-1">
                                    {/* Add row button - only on last medication */}
                                    {!readOnly && globalIndex === medications.length - 1 && (
                                      <button onClick={addRow} className="text-emerald-500 hover:text-emerald-700 font-bold text-lg px-1" title="Add medication">+</button>
                                    )}
                                    {medications.length > 1 && (
                                      <button onClick={() => removeRow(globalIndex)} className="text-red-500 hover:text-red-700 font-bold px-1" title="Remove">×</button>
                                    )}
                                  </div>
                                </div>
                                <div className="w-[446px] flex shrink-0 items-stretch">
                                  {/* Quantity */}
                                  <div className="w-28 border-r border-black px-0.5 flex items-center justify-center shrink-0">
                                    <input className="w-full text-center outline-none text-xs bg-transparent font-bold" placeholder="1" value={med.number} onChange={e => updateMed(globalIndex, 'number', e.target.value)} readOnly={readOnly} />
                                  </div>
                                  {/* Frequency - Searchable ComboBox */}
                                  <div className="w-10 border-r border-black px-0.5 flex items-center justify-center shrink-0 relative">
                                    <input
                                      className="w-full text-center outline-none text-[9px] font-bold uppercase bg-transparent"
                                      value={med.dose}
                                      onChange={e => { updateMed(globalIndex, 'dose', e.target.value.toUpperCase()); setDoseSearchQuery(e.target.value.toUpperCase()); !readOnly && setShowDoseDropdown(globalIndex); }}
                                      onFocus={() => !readOnly && (setShowDoseDropdown(globalIndex), setDoseSearchQuery(''))}
                                      onBlur={() => setTimeout(() => setShowDoseDropdown(null), 150)}
                                      readOnly={readOnly}
                                      placeholder="--"
                                    />
                                    {!readOnly && showDoseDropdown === globalIndex && (
                                      <div className="absolute left-0 top-full z-50 w-24 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto print:hidden">
                                        {DOSE_OPTIONS.filter(opt => !doseSearchQuery || opt.toUpperCase().includes(doseSearchQuery)).map(opt => (
                                          <button type="button" key={opt} onMouseDown={() => { updateMed(globalIndex, 'dose', opt); setShowDoseDropdown(null); }} className="w-full px-2 py-1.5 text-left hover:bg-emerald-50 text-xs font-bold border-b border-gray-50 last:border-0">
                                            {opt}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {/* M dosage container - Split: Top time, Bottom value */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      <input
                                        className="w-full text-center text-[9px] font-bold outline-none bg-transparent text-gray-600"
                                        placeholder=""
                                        value={(med as any).morningTime || ''}
                                        onChange={e => { updateMed(globalIndex, 'morningTime', e.target.value); setTimeSearchQuery(e.target.value); }}
                                        onFocus={() => !readOnly && setShowTimeDropdown({ index: globalIndex, field: 'morningTime' })}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        readOnly={readOnly}
                                      />
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'morningTime' && (
                                        <div className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                          {TIME_OPTIONS.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase())).map(t => (
                                            <button type="button" key={t} onMouseDown={() => { updateMed(globalIndex, 'morningTime', t); setShowTimeDropdown(null); }} className="w-full px-1 py-1 text-left hover:bg-emerald-50 text-[9px] border-b border-gray-50 last:border-0">
                                              {t}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      <textarea
                                        className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight"
                                        placeholder="0"
                                        value={med.morning}
                                        onChange={e => updateMed(globalIndex, 'morning', e.target.value)}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                    </div>
                                  </div>
                                  {/* N dosage container - Split: Top time, Bottom value */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      <input
                                        className="w-full text-center text-[9px] font-bold outline-none bg-transparent text-gray-600"
                                        placeholder=""
                                        value={(med as any).noonTime || ''}
                                        onChange={e => { updateMed(globalIndex, 'noonTime', e.target.value); setTimeSearchQuery(e.target.value); }}
                                        onFocus={() => !readOnly && setShowTimeDropdown({ index: globalIndex, field: 'noonTime' })}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        readOnly={readOnly}
                                      />
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'noonTime' && (
                                        <div className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                          {TIME_OPTIONS.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase())).map(t => (
                                            <button type="button" key={t} onMouseDown={() => { updateMed(globalIndex, 'noonTime', t); setShowTimeDropdown(null); }} className="w-full px-1 py-1 text-left hover:bg-emerald-50 text-[9px] border-b border-gray-50 last:border-0">
                                              {t}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      <textarea
                                        className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight"
                                        placeholder="0"
                                        value={med.noon}
                                        onChange={e => updateMed(globalIndex, 'noon', e.target.value)}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                    </div>
                                  </div>
                                  {/* evening dosage container */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      <input
                                        className="w-full text-center text-[9px] font-bold outline-none bg-transparent text-gray-600"
                                        placeholder=""
                                        value={med.eveningTime || ''}
                                        onChange={e => { updateMed(globalIndex, 'eveningTime', e.target.value); setTimeSearchQuery(e.target.value); }}
                                        onFocus={() => !readOnly && setShowTimeDropdown({ index: globalIndex, field: 'eveningTime' })}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        readOnly={readOnly}
                                      />
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'eveningTime' && (
                                        <div className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                          {TIME_OPTIONS.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase())).map(t => (
                                            <button type="button" key={t} onMouseDown={() => { updateMed(globalIndex, 'eveningTime', t); setShowTimeDropdown(null); }} className="w-full px-1 py-1 text-left hover:bg-emerald-50 text-[9px] border-b border-gray-50 last:border-0">
                                              {t}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      <textarea
                                        className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight"
                                        placeholder="0"
                                        value={med.evening}
                                        onChange={e => updateMed(globalIndex, 'evening', e.target.value)}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                    </div>
                                  </div>
                                  {/* night dosage container */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      <input
                                        className="w-full text-center text-[9px] font-bold outline-none bg-transparent text-gray-600"
                                        placeholder=""
                                        value={med.nightTime || ''}
                                        onChange={e => { updateMed(globalIndex, 'nightTime', e.target.value); setTimeSearchQuery(e.target.value); }}
                                        onFocus={() => !readOnly && setShowTimeDropdown({ index: globalIndex, field: 'nightTime' })}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        readOnly={readOnly}
                                      />
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'nightTime' && (
                                        <div className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                          {TIME_OPTIONS.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase())).map(t => (
                                            <button type="button" key={t} onMouseDown={() => { updateMed(globalIndex, 'nightTime', t); setShowTimeDropdown(null); }} className="w-full px-1 py-1 text-left hover:bg-emerald-50 text-[9px] border-b border-gray-50 last:border-0">
                                              {t}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      <textarea
                                        className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight"
                                        placeholder="0"
                                        value={med.night}
                                        onChange={e => updateMed(globalIndex, 'night', e.target.value)}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                    </div>
                                  </div>
                                  {/* Food Timing - Searchable Combobox */}
                                  <div className="w-8 flex items-center justify-center shrink-0 relative">
                                    <input
                                      className="w-full h-full text-center font-bold text-[8px] outline-none bg-transparent uppercase"
                                      value={med.foodTiming}
                                      onChange={e => { updateMed(globalIndex, 'foodTiming', e.target.value.toUpperCase()); setFoodTimingSearchQuery(e.target.value.toUpperCase()); !readOnly && setShowFoodTimingDropdown(globalIndex); }}
                                      onFocus={() => !readOnly && (setShowFoodTimingDropdown(globalIndex), setFoodTimingSearchQuery(''))}
                                      onBlur={() => setTimeout(() => setShowFoodTimingDropdown(null), 150)}
                                      readOnly={readOnly}
                                      placeholder=""
                                    />
                                    {!readOnly && showFoodTimingDropdown === globalIndex && (
                                      <div className="absolute right-0 top-full z-50 w-16 bg-white border border-gray-200 rounded-lg shadow-xl max-h-32 overflow-y-auto print:hidden">
                                        {FOOD_TIMING_OPTIONS.filter(opt => !foodTimingSearchQuery || opt.toUpperCase().includes(foodTimingSearchQuery)).map(opt => (
                                          <button type="button" key={opt} onMouseDown={() => { updateMed(globalIndex, 'foodTiming', opt); setShowFoodTimingDropdown(null); }} className="w-full px-2 py-1.5 text-left hover:bg-emerald-50 text-[10px] font-bold border-b border-gray-50 last:border-0">
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

                        {/* Empty space - Add button now on last row, Manage Drugs moved to dashboard */}
                      </div>
                    )}

                    {/* Footer Section - ONLY on the final page */}
                    {isLastPage && (() => {
                      // Calculate dynamic scaling based on number of medications in the current chunk
                      const medCount = chunk.length;
                      const getFooterScale = () => {
                        if (medCount <= 4) return { textSize: 'text-sm', footerTextSize: 'text-xs', spacing: 'space-y-2', mb: 'mb-4', signatureH: 'h-12', padding: 'p-2', legendMb: 'mb-2', footerP: 'p-1' };
                        if (medCount <= 6) return { textSize: 'text-xs', footerTextSize: 'text-[11px]', spacing: 'space-y-1.5', mb: 'mb-3', signatureH: 'h-10', padding: 'p-1.5', legendMb: 'mb-1.5', footerP: 'p-0.5' };
                        if (medCount <= 9) return { textSize: 'text-xs', footerTextSize: 'text-[10px]', spacing: 'space-y-0.8', mb: 'mb-1.5', signatureH: 'h-9', padding: 'p-1', legendMb: 'mb-1', footerP: 'p-0.5' };
                        return { textSize: 'text-[11px]', footerTextSize: 'text-[9px]', spacing: 'space-y-0.5', mb: 'mb-1', signatureH: 'h-8', padding: 'p-0.5', legendMb: 'mb-0.5', footerP: 'p-0.5' };
                      };
                      const scale = getFooterScale();

                      return (
                        <div className="mt-auto">
                          {/* Doctor Notes */}
                          <div className="border-t border-black pt-1.5 mt-1 mb-1">
                            <div className="flex gap-2 items-start text-[10px] font-bold">
                              <span className="shrink-0 pt-0.5">குறிப்புகள் / Notes:</span>
                              <textarea
                                className="flex-1 border border-gray-300 border-dashed outline-none bg-transparent px-1 py-0.5 text-[10px] resize-none leading-tight min-h-[56px]"
                                value={formData.doctorNotes}
                                onChange={e => !readOnly && setFormData({ ...formData, doctorNotes: e.target.value })}
                                readOnly={readOnly}
                                rows={4}
                                placeholder="Additional notes..."
                              />
                            </div>
                          </div>
                          {/* Salt and Fluid Intake - Parallel Layout */}
                          <div className="border-t border-black pt-2 mt-1 mb-2">
                            <p className="font-bold underline italic text-[10px] mb-1.5">To be specified / monitored:</p>
                            <div className="flex gap-6 text-[10px] font-bold">
                              <div className="flex gap-1 items-baseline">
                                <span className="shrink-0">Salt intake (உப்பு):</span>
                                <input
                                  className="w-16 border-b border-gray-300 border-dotted outline-none bg-transparent text-center"
                                  value={formData.saltIntake}
                                  onChange={e => setFormData({ ...formData, saltIntake: e.target.value })}
                                  placeholder="____"
                                  readOnly={readOnly}
                                />
                                <span className="shrink-0">gm/day</span>
                              </div>
                              <div className="flex gap-1 items-baseline">
                                <span className="shrink-0">Fluid intake (நீர்/திரவம்):</span>
                                <input
                                  className="w-16 border-b border-gray-300 border-dotted outline-none bg-transparent text-center"
                                  value={formData.fluidIntake}
                                  onChange={e => setFormData({ ...formData, fluidIntake: e.target.value })}
                                  placeholder="____"
                                  readOnly={readOnly}
                                />
                                <span className="shrink-0">lit/day</span>
                              </div>
                              <div className="flex items-baseline">
                                <span className="shrink-0">VEG ONLY DIET</span>
                              </div>
                            </div>
                          </div>

                          {/* Footer Review Section */}
                          <div className={`${scale.spacing} ${scale.textSize} font-bold ${scale.mb}`}>
                            <div className="flex gap-2 items-end">
                              <div className="shrink-0 w-80 whitespace-nowrap">மீண்டும் வரவேண்டிய நாள் / Review on :</div>
                              <input
                                type="date"
                                className="flex-1 border-b border-gray-300 border-dashed outline-none px-1 cursor-pointer bg-transparent"
                                value={formData.reviewDate}
                                onChange={e => !readOnly && setFormData({ ...formData, reviewDate: e.target.value })}
                                readOnly={readOnly}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div className="flex gap-2 items-end">
                              <div className="shrink-0 w-80 whitespace-nowrap">செய்ய வேண்டிய பரிசோதனைகள் / Tests :</div>
                              <input className="flex-1 border-b border-gray-300 border-dashed outline-none px-1 bg-transparent" value={formData.testsToReview} onChange={e => !readOnly && setFormData({ ...formData, testsToReview: e.target.value })} readOnly={readOnly} />
                            </div>
                            <div className="flex gap-2 items-end">
                              <div className="shrink-0 w-80 whitespace-nowrap">பார்க்க வேண்டிய டாக்டர்கள் / Specialists :</div>
                              <div className="relative flex-1">
                                <input
                                  className="w-full border-b border-gray-300 border-dashed outline-none px-1 bg-transparent"
                                  value={formData.specialistToReview}
                                  onChange={e => !readOnly && setFormData({ ...formData, specialistToReview: e.target.value })}
                                  onFocus={() => !readOnly && setShowSpecialistDropdown(true)}
                                  placeholder="Type or select specialist..."
                                  readOnly={readOnly}
                                />
                                {!readOnly && showSpecialistDropdown && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-[110]"
                                      onClick={() => setShowSpecialistDropdown(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-[120] max-h-48 overflow-y-auto py-1 font-normal">
                                      {SPECIALIST_OPTIONS.map((opt) => {
                                        const isSelected = (formData.specialistToReview || '').split(', ').includes(opt);
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between ${isSelected ? 'text-emerald-700 font-bold bg-emerald-50/30' : 'text-gray-700'}`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const currentSpecs = (formData.specialistToReview || '').split(', ').filter(s => s);
                                              let newSpecs;
                                              if (isSelected) {
                                                newSpecs = currentSpecs.filter(s => s !== opt);
                                              } else {
                                                newSpecs = [...currentSpecs, opt];
                                              }
                                              setFormData({ ...formData, specialistToReview: newSpecs.join(', ') });
                                            }}
                                          >
                                            <span>{opt}</span>
                                            {isSelected && <span className="text-emerald-600">✓</span>}
                                          </button>
                                        );
                                      })}
                                      {SPECIALIST_OPTIONS.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-gray-400 italic">No specialists configured</div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Signature */}
                          <div className="flex justify-end mt-4 mb-2">
                            <div className="text-center min-w-[150px] flex flex-col items-center justify-end">
                              {/* Dynamic Signature Image - Takes real space now */}
                              {doctor?.signature_url ? (
                                <div className="h-16 w-40 mb-1 flex items-end justify-center">
                                  <img
                                    src={doctor.signature_url}
                                    alt="Signature"
                                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                                  />
                                </div>
                              ) : (
                                /* Empty space for manual signature if no digital one */
                                <div className="h-16 w-40"></div>
                              )}

                              <div className={`font-bold border-t border-black px-4 pt-1 ${scale.textSize}`}>
                                டாக்டர் கையொப்பம். / DOCTOR SIGNATURE.
                              </div>
                            </div>
                          </div>

                          {/* Footer Box - Full Width with Larger Font */}
                          <div className="w-full border-2 border-black p-2 text-[12px] leading-[1.5] flex flex-col justify-center font-bold mt-2 bg-gray-50 print:bg-white">
                            <p className="text-center mb-1.5">முன்பதிவு காலதாமதத்தை குறைக்கும் / Prior registration avoids delay</p>
                            <p className="text-center mb-1">Appt: 0422-2494333, 73588 41555, 41666 | Time: 8am - 6pm</p>
                            <p className="text-center border-t border-gray-300 mt-1.5 pt-1.5">
                              Dr. A. பிரபாகர் MD., DNB (Nephrology) | Dr. A. திவாகர் MS., M.ch (Urology)
                            </p>
                            <p className="text-center mt-1">அவசர உதவிக்கு / Emergency: 0422 - 2494333 (24 மணி நேரமும் / 24 hrs Service)</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* PTO (Please Turn Over) - Only show on non-final pages */}
                    {!isLastPage && (
                      <div className="text-right mt-auto pb-2 text-xs font-bold text-gray-700 italic">
                        தொடர்ச்சி அடுத்த பக்கத்தில் / PTO (Please Turn Over)
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-white p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={onClose} className="w-full sm:w-auto px-6 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors order-2 sm:order-1">
            Cancel
          </button>
          <div className="flex flex-1 sm:flex-none gap-3 order-1 sm:order-2">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 sm:px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              <span>Print PDF</span>
            </button>
            {!readOnly && (
              <button
                onClick={handleSend}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                <span>Send to Pharmacy</span>
              </button>
            )}
          </div>
        </div>
        {/* Manage Saved Drugs Modal */}
        {showManageDrugsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Manage Saved Drugs</h3>
                  <p className="text-sm text-gray-500">Add or edit your commonly prescribed medications</p>
                </div>
                <button
                  onClick={() => {
                    setShowManageDrugsModal(false);
                    setEditingDrug(null);
                    setNewDrugName('');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add/Edit Form */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="text-sm font-semibold text-gray-700 mb-3">
                  {editingDrug ? 'Edit Drug' : 'Add New Drug'}
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {DRUG_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setNewDrugType(newDrugType === type.value ? '' : type.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${newDrugType === type.value
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                        }`}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Drug name (e.g., PARACETAMOL 500MG)"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm uppercase"
                    value={newDrugName}
                    onChange={e => setNewDrugName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveDrug()}
                  />
                  <button
                    onClick={handleSaveDrug}
                    disabled={isSavingDrug || !newDrugName.trim()}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingDrug ? '...' : editingDrug ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Drug List */}
              <div className="flex-1 overflow-y-auto">
                {savedDrugs.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <p className="font-medium">No saved drugs yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {savedDrugs.map(drug => (
                      <div key={drug.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 group">
                        <div className="flex items-center gap-3">
                          {drug.drug_type && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold uppercase">
                              {drug.drug_type}
                            </span>
                          )}
                          <div className="font-semibold text-gray-900">{drug.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingDrug(drug);
                              setNewDrugName(drug.name);
                            }}
                            className="p-2 text-gray-400 hover:text-purple-600 rounded-lg"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDrug(drug.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowManageDrugsModal(false)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-black"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
};

export default PrescriptionModal;
