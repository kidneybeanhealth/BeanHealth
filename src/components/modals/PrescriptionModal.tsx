import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface SavedDrug {
  id: string;
  name: string;
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
  isReference?: boolean;
}

interface PrescriptionModalProps {
  doctor: any;
  patient: any;
  onClose: () => void;
  onSendToPharmacy?: (medications: any[], notes: string) => void;
  readOnly?: boolean;
  existingData?: any;
  clinicLogo?: string;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ doctor, patient, onClose, onSendToPharmacy, readOnly = false, existingData = null, clinicLogo }) => {
  // Form States matching the PDF structure
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
    { name: '', number: '', dose: '', morning: '', noon: '', night: '', beforeFood: false },
    { name: '', number: '', dose: '', morning: '', noon: '', night: '', beforeFood: false },
    { name: '', number: '', dose: '', morning: '', noon: '', night: '', beforeFood: false },
    { name: '', number: '', dose: '', morning: '', noon: '', night: '', beforeFood: false },
    { name: '', number: '', dose: '', morning: '', noon: '', night: '', beforeFood: false }
  ]);

  // Saved Drugs State
  const [savedDrugs, setSavedDrugs] = useState<SavedDrug[]>([]);
  const [referenceDrugs, setReferenceDrugs] = useState<ReferenceDrug[]>([]);
  const [showDrugDropdown, setShowDrugDropdown] = useState<number | null>(null);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [editingDrug, setEditingDrug] = useState<SavedDrug | null>(null);
  const [isSavingDrug, setIsSavingDrug] = useState(false);

  // Saved Diagnosis State
  const [savedDiagnoses, setSavedDiagnoses] = useState<{ id: string, name: string }[]>([]);
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
  const [showManageDiagnosisModal, setShowManageDiagnosisModal] = useState(false);
  const [newDiagnosisName, setNewDiagnosisName] = useState('');
  const [editingDiagnosis, setEditingDiagnosis] = useState<{ id: string, name: string } | null>(null);
  const [isSavingDiagnosis, setIsSavingDiagnosis] = useState(false);

  // Refs for printing
  const componentRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Scaling Logic
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth;
        // 210mm is approx 794px. We use 800px as the target breakpoint including padding.
        const targetWidth = 800;

        if (availableWidth < targetWidth) {
          // Calculate scale to fit
          const newScale = (availableWidth - 32) / targetWidth; // 32px buffer for margins
          setScale(Math.max(newScale, 0.3)); // prevent too small
        } else {
          setScale(1);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch saved drugs and reference drugs on mount
  useEffect(() => {
    if (!readOnly) {
      fetchReferenceDrugs();
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

  const handleSaveDiagnosis = async () => {
    if (!newDiagnosisName.trim()) {
      toast.error('Diagnosis name is required');
      return;
    }

    setIsSavingDiagnosis(true);
    try {
      if (editingDiagnosis) {
        const { error } = await (supabase
          .from('hospital_doctor_diagnoses') as any)
          .update({
            name: newDiagnosisName.toUpperCase().trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDiagnosis.id);

        if (error) throw error;
        toast.success('Diagnosis updated successfully');
      } else {
        const { error } = await (supabase
          .from('hospital_doctor_diagnoses') as any)
          .insert({
            doctor_id: doctor.id,
            name: newDiagnosisName.toUpperCase().trim(),
            created_at: new Date().toISOString()
          });

        if (error) {
          if (error.code === '23505') {
            toast.error('This diagnosis already exists');
            return;
          }
          throw error;
        }
        toast.success('Diagnosis saved successfully');
      }

      setNewDiagnosisName('');
      setEditingDiagnosis(null);
      fetchSavedDiagnoses();
    } catch (error: any) {
      console.error('Error saving diagnosis:', error);
      toast.error(error.message || 'Failed to save diagnosis');
    } finally {
      setIsSavingDiagnosis(false);
    }
  };

  const handleDeleteDiagnosis = async (id: string) => {
    if (!confirm('Are you sure you want to delete this diagnosis?')) return;

    try {
      const { error } = await supabase
        .from('hospital_doctor_diagnoses' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Diagnosis deleted');
      fetchSavedDiagnoses();
    } catch (error: any) {
      console.error('Error deleting diagnosis:', error);
      toast.error('Failed to delete diagnosis');
    }
  };

  const fetchReferenceDrugs = async () => {
    try {
      const { data, error } = await supabase
        .from('reference_drugs' as any)
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        console.log('Reference drugs table not available yet:', error.message);
        return;
      }
      setReferenceDrugs(data || []);
    } catch (error) {
      console.error('Error fetching reference drugs:', error);
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
    newMeds[index] = {
      ...newMeds[index],
      name: drug.name
    };
    setMedications(newMeds);
    setShowDrugDropdown(null);
    setDrugSearchQuery('');
  };

  // Combine saved drugs and reference drugs for searching
  const allDrugOptions: DrugOption[] = [
    // Personal saved drugs first
    ...savedDrugs.map(d => ({
      id: d.id,
      name: d.name,
      isReference: false
    })),
    // Reference drugs (now with brand_name as primary)
    ...referenceDrugs.map(d => ({
      id: d.id,
      name: d.brand_name,           // Brand name is now primary
      genericName: d.generic_name,  // Generic name as secondary
      category: d.category,
      isReference: true
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

        // Notes parsing
        const notes = existingData.notes || '';
        const diagnosis = notes.match(/Diagnosis: (.*?)(\n|$)/)?.[1] || '';
        const review = notes.match(/Review: (.*?)(\n|$)/)?.[1] || '';
        const tests = notes.match(/Tests: (.*?)(\n|$)/)?.[1] || '';
        // New fields
        const place = notes.match(/Place: (.*?)(\n|$)/)?.[1] || '';
        const phone = notes.match(/Phone: (.*?)(\n|$)/)?.[1] || '';

        setFormData(prev => ({
          ...prev,
          diagnosis,
          reviewDate: review,
          testsToReview: tests,
          place: place || prev.place,
          phone: phone || prev.phone
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
  } as any);

  // Medicine Handlers
  const addRow = () => {
    if (readOnly) return;
    setMedications([...medications, { name: '', number: '', dose: '', morning: '', noon: '', night: '', beforeFood: false }]);
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
    setMedications(newMeds);
  };

  const handleDoseChange = (index: number, value: string) => {
    if (readOnly) return;
    const newMeds = [...medications];
    newMeds[index].dose = value.toUpperCase();

    // Auto-population logic
    if (value.toUpperCase() === 'OD') {
      newMeds[index].morning = '1';
      newMeds[index].noon = '0';
      newMeds[index].night = '0';
    } else if (value.toUpperCase() === 'TD') {
      newMeds[index].morning = '1';
      newMeds[index].noon = '0';
      newMeds[index].night = '1';
    } else if (value.toUpperCase() === 'TDS') {
      newMeds[index].morning = '1';
      newMeds[index].noon = '1';
      newMeds[index].night = '1';
    } else if (value.toUpperCase() === 'HS') {
      newMeds[index].morning = '0';
      newMeds[index].noon = '0';
      newMeds[index].night = '1';
    }

    setMedications(newMeds);
  };

  const handleSend = () => {
    if (readOnly) return;
    // Convert to pharmacy format
    const pharmacyMeds = medications.filter(m => m.name).map(m => {
      const freq = `${m.morning || '0'}-${m.noon || '0'}-${m.night || '0'}`;
      return {
        name: m.name,
        dosage: m.number + ' tab',
        dose: m.dose,
        frequency: freq,
        duration: 'See Review Date',
        instruction: m.beforeFood ? 'Before Food' : 'After Food'
      };
    });

    // We pack the extra metadata (Place, Phone, etc) into the notes field so it persists without schema changes
    const notes = `Place: ${formData.place}\nPhone: ${formData.phone}\nDiagnosis: ${formData.diagnosis}\nReview: ${formData.reviewDate}\nTests: ${formData.testsToReview}`;
    if (onSendToPharmacy) onSendToPharmacy(pharmacyMeds, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-scale-in">

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100" ref={containerRef}>

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

          {/* PRINT PREVIEW AREA - EXACT REPLICA OF PDF */}
          <div
            ref={componentRef}
            className="print-content bg-white mx-auto shadow-sm p-4 max-w-[210mm] text-black w-full origin-top"
            style={{
              fontFamily: '"Times New Roman", Times, serif',
              minWidth: '210mm',
              transform: `scale(${scale})`,
              marginBottom: scale < 1 ? `-${(1 - scale) * 100}%` : '0' // Attempt to reduce bottom whitespace
            }}
          >
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
                // Standardize expansion for the first page to fill space beautifully
                const shouldExpand = isFirstPage;
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
                        <div className="flex min-h-[32px]">
                          <div className="flex-1 flex relative">
                            <div className="w-32 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center justify-between">
                              <span>வியாதிகள் / Diagnosis</span>
                              {!readOnly && (
                                <button
                                  onClick={() => setShowManageDiagnosisModal(true)}
                                  className="p-1 hover:bg-gray-200 rounded print:hidden transition-colors"
                                  title="Manage Saved Diagnoses"
                                >
                                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col relative">
                              <textarea
                                className="w-full h-full py-1 px-1.5 outline-none font-normal bg-transparent resize-none overflow-hidden"
                                value={formData.diagnosis}
                                rows={1}
                                onChange={e => {
                                  setFormData({ ...formData, diagnosis: e.target.value });
                                  if (!readOnly && e.target.value.length > 0) setShowDiagnosisDropdown(true);
                                }}
                                onFocus={() => {
                                  if (!readOnly && formData.diagnosis.length > 0) setShowDiagnosisDropdown(true);
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.style.height = 'auto';
                                  target.style.height = `${target.scrollHeight}px`;
                                }}
                                readOnly={readOnly}
                              />
                              {/* Diagnosis Autocomplete Dropdown */}
                              {!readOnly && showDiagnosisDropdown && (
                                <div className="absolute left-0 top-full z-[100] w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto print:hidden">
                                  {savedDiagnoses
                                    .filter(d => d.name.toLowerCase().includes(formData.diagnosis.toLowerCase()))
                                    .map(d => (
                                      <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => {
                                          setFormData({ ...formData, diagnosis: d.name });
                                          setShowDiagnosisDropdown(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-0 text-sm"
                                      >
                                        {d.name}
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
                        <div className="w-[340px] shrink-0 flex flex-col">
                          <div className="border-b border-black py-1">அளவு - Dose</div>
                          <div className="flex flex-1 items-stretch">
                            <div className="w-20 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0 leading-tight">
                              <span>Dose</span>
                              <span>அளவு</span>
                            </div>
                            <div className="w-10 border-r border-black py-1 text-[10px] flex flex-col items-center justify-center shrink-0 leading-tight">
                              <span>Qty</span>
                              <span>எண்</span>
                            </div>
                            <div className="w-[60px] border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                              <span>M</span>
                              <span>கா</span>
                            </div>
                            <div className="w-[60px] border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                              <span>N</span>
                              <span>ம</span>
                            </div>
                            <div className="w-[60px] border-r border-black py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                              <span>Nt</span>
                              <span>இ</span>
                            </div>
                            <div className="w-8 py-1 text-[10px] px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
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

                          const shouldExpandRow = shouldExpand || isFirstPageMulti;

                          return (
                            <div
                              key={globalIndex}
                              className={`flex border-b border-black ${shouldExpandRow ? 'flex-1 items-stretch' : 'py-1'} text-xs relative group`}
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
                                    updateMed(globalIndex, 'name', e.target.value);
                                    setDrugSearchQuery(e.target.value);
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
                                {/* Drug Dropdown */}
                                {!readOnly && showDrugDropdown === globalIndex && filteredDrugs.length > 0 && (
                                  <div className="absolute left-0 top-full z-50 w-[400px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto print:hidden">
                                    {filteredDrugs.map(drug => (
                                      <button
                                        key={drug.id}
                                        type="button"
                                        onClick={() => handleSelectDrug(globalIndex, drug)}
                                        className="w-full px-3 py-2 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-0"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-900 text-sm">{drug.name}</span>
                                          {drug.isReference && drug.category && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                              {drug.category}
                                            </span>
                                          )}
                                          {!drug.isReference && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                              SAVED
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
                                <div className="absolute right-0 top-0 h-full hidden group-hover:flex items-center pr-1 print:hidden bg-white">
                                  {medications.length > 1 && (
                                    <button onClick={() => removeRow(globalIndex)} className="text-red-500 hover:text-red-700 font-bold px-1">×</button>
                                  )}
                                </div>
                              </div>
                              <div className="w-[340px] flex shrink-0 items-stretch">
                                {/* Dose Dropdown */}
                                <div className="w-20 border-r border-black px-0.5 flex items-center justify-center shrink-0">
                                  <input
                                    list="dose-options"
                                    className="w-full text-center outline-none text-[10px] bg-transparent font-bold"
                                    value={med.dose}
                                    onChange={e => handleDoseChange(globalIndex, e.target.value)}
                                    placeholder="--"
                                    readOnly={readOnly}
                                  />
                                  <datalist id="dose-options">
                                    <option value="OD">OD</option>
                                    <option value="TD">TD</option>
                                    <option value="TDS">TDS</option>
                                    <option value="HS">HS</option>
                                    <option value="QID">QID</option>
                                    <option value="ALT">Alt Day</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="HALF-ALT">½ Alt</option>
                                    <option value="HALF-DAILY">½ Daily</option>
                                  </datalist>
                                </div>
                                {/* Quantity */}
                                <div className="w-10 border-r border-black px-0.5 flex items-center justify-center shrink-0">
                                  <input className="w-full text-center outline-none text-xs" placeholder="1" value={med.number} onChange={e => updateMed(globalIndex, 'number', e.target.value)} readOnly={readOnly} />
                                </div>
                                {/* M dosage container */}
                                <div className="w-[60px] border-r border-black flex items-center justify-center shrink-0">
                                  <textarea
                                    className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none overflow-hidden py-1"
                                    rows={1}
                                    placeholder=""
                                    value={med.morning}
                                    onChange={e => updateMed(globalIndex, 'morning', e.target.value)}
                                    readOnly={readOnly}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                    }}
                                  />
                                </div>
                                {/* N dosage container */}
                                <div className="w-[60px] border-r border-black flex items-center justify-center shrink-0">
                                  <textarea
                                    className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none overflow-hidden py-1"
                                    rows={1}
                                    placeholder=""
                                    value={med.noon}
                                    onChange={e => updateMed(globalIndex, 'noon', e.target.value)}
                                    readOnly={readOnly}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                    }}
                                  />
                                </div>
                                {/* Nt dosage container */}
                                <div className="w-[60px] border-r border-black flex items-center justify-center shrink-0">
                                  <textarea
                                    className="w-full text-center text-xs font-bold outline-none bg-transparent resize-none overflow-hidden py-1"
                                    rows={1}
                                    placeholder=""
                                    value={med.night}
                                    onChange={e => updateMed(globalIndex, 'night', e.target.value)}
                                    readOnly={readOnly}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                    }}
                                  />
                                </div>
                                {/* Instruction (A/F, B/F, SC, etc.) */}
                                <div className="w-8 flex items-center justify-center font-bold shrink-0 text-[10px]">
                                  <select
                                    className="w-full text-center outline-none bg-transparent cursor-pointer appearance-none px-0.5"
                                    value={med.instruction}
                                    onChange={e => updateMed(globalIndex, 'instruction', e.target.value)}
                                    disabled={readOnly}
                                  >
                                    <option value="nil">nil</option>
                                    <option value="A/F">A/F</option>
                                    <option value="B/F">B/F</option>
                                    <option value="SC">SC</option>
                                    <option value="SC/BF">SC/BF</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Row Button (Hidden in Print and ReadOnly) - Only show on last page */}
                      {pageIndex === chunks.length - 1 && (
                        <div
                          className="p-2 text-center border-t border-dashed border-gray-300 flex items-center justify-center gap-4 no-print"
                          style={{ display: 'flex' }}
                        >
                          {!readOnly && (
                            <>
                              <button onClick={addRow} className="text-emerald-600 text-sm font-bold hover:underline">+ Add Medicine Row</button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => setShowManageDrugsModal(true)}
                                className="text-purple-600 text-sm font-bold hover:underline flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Manage Saved Drugs
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

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
                              <input className="flex-1 border-b border-gray-300 border-dashed outline-none px-1 bg-transparent" value={formData.specialistToReview} onChange={e => !readOnly && setFormData({ ...formData, specialistToReview: e.target.value })} readOnly={readOnly} />
                            </div>
                          </div>

                          {/* Signature */}
                          <div className="flex justify-end mt-1 mb-1">
                            <div className="text-center">
                              <div className="h-8"></div> {/* Space for signature */}
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
                      <div className="text-right mt-4 mb-2 text-sm font-bold text-gray-700 italic">
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
        <div className="bg-white p-6 border-t border-gray-100 flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={onClose} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print PDF
          </button>
          {!readOnly && (
            <button
              onClick={handleSend}
              className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Send to Pharmacy
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
              {editingDrug && (
                <button
                  onClick={() => {
                    setEditingDrug(null);
                    setNewDrugName('');
                  }}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel editing
                </button>
              )}
            </div>

            {/* Drug List */}
            <div className="flex-1 overflow-y-auto">
              {savedDrugs.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <p className="font-medium">No saved drugs yet</p>
                  <p className="text-sm">Add your commonly prescribed medications above</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {savedDrugs.map(drug => (
                    <div key={drug.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 group">
                      <div className="font-semibold text-gray-900">{drug.name}</div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingDrug(drug);
                            setNewDrugName(drug.name);
                          }}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteDrug(drug.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-sm text-gray-500">{savedDrugs.length} drugs saved</span>
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
      {/* Manage Diagnosis Modal */}
      {showManageDiagnosisModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Manage Saved Diagnoses</h3>
                <p className="text-sm text-gray-500 mt-1">Add or edit diagnoses for quick selection</p>
              </div>
              <button
                onClick={() => {
                  setShowManageDiagnosisModal(false);
                  setEditingDiagnosis(null);
                  setNewDiagnosisName('');
                }}
                className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Save Form */}
            <div className="p-6 bg-white border-b border-gray-100">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Diagnosis Name</label>
                  <input
                    type="text"
                    className="w-full h-12 px-4 rounded-xl border-2 border-gray-100 focus:border-emerald-500 focus:ring-0 transition-all font-medium placeholder-gray-300"
                    placeholder="E.G., TYPE 2 DIABETES MELLITUS"
                    value={newDiagnosisName}
                    onChange={e => setNewDiagnosisName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveDiagnosis()}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSaveDiagnosis}
                    disabled={isSavingDiagnosis}
                    className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                  >
                    {isSavingDiagnosis ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    {editingDiagnosis ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              {savedDiagnoses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1.724 1.724 0 001.066.257c1.756.426 1.756 2.924 0 3.35" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">No diagnoses saved yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {savedDiagnoses.map(diag => (
                    <div
                      key={diag.id}
                      className="group flex items-center justify-between p-4 bg-white hover:bg-emerald-50/30 border border-gray-100 rounded-2xl transition-all hover:shadow-md"
                    >
                      <span className="font-bold text-gray-900">{diag.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingDiagnosis(diag);
                            setNewDiagnosisName(diag.name);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteDiagnosis(diag.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">{savedDiagnoses.length} diagnoses saved</span>
              <button
                onClick={() => setShowManageDiagnosisModal(false)}
                className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionModal;
