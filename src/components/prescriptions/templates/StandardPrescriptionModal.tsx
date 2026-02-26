/**
 * Standard Prescription Modal
 * ────────────────────────────
 * Fully standalone generic prescription. English-only labels.
 * No KKC branding, no Tamil text. Header/footer driven by `tenant` prop.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase, getProxiedUrl } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { HospitalProfile, getTenantDisplayName, getTenantPhone } from '../../../contexts/TenantContext';

/* ─────────── Types ─────────── */
interface SavedDrug { id: string; name: string; drug_type?: string; }
interface DrugOption {
  id: string; name: string; genericName?: string;
  category?: string; drugType?: string; isReference?: boolean;
}
interface Medication {
  name: string; number: string; dose: string;
  morning: string; morningTime: string; morningAmPm: string;
  noon: string; noonTime: string; noonAmPm: string;
  evening: string; eveningTime: string; eveningAmPm: string;
  night: string; nightTime: string; nightAmPm: string;
  foodTiming: string; drugType?: string;
}

const getDrugTypeIcon = (t?: string) =>
  t === 'CAP' ? '🔶' : t === 'INJ' ? '💉' : t === 'SYP' ? '🧴' : '💊';

interface StandardPrescriptionModalProps {
  doctor: any;
  patient: any;
  onClose: () => void;
  onSendToPharmacy?: (
    medications: any[], notes: string,
    reviewContext?: { nextReviewDate: string | null; testsToReview: string; specialistsToReview: string }
  ) => void;
  readOnly?: boolean;
  existingData?: any;
  clinicLogo?: string;
  actorAttribution?: { actorType: 'chief' | 'assistant'; actorDisplayName: string };
  onPrintOpen?: () => void;
  tenant: HospitalProfile | null;
}

/* ─────────── Constants ─────────── */
const DOSE_MAPPINGS: Record<string, { morning: string; noon: string; evening: string; night: string }> = {
  'OD':      { morning: '1',   noon: '0',   evening: '0', night: '0'   },
  'BD':      { morning: '1',   noon: '0',   evening: '0', night: '1'   },
  'TDS':     { morning: '1',   noon: '1',   evening: '0', night: '1'   },
  'HS':      { morning: '0',   noon: '0',   evening: '0', night: '1'   },
  'QID':     { morning: '1',   noon: '1',   evening: '1', night: '1'   },
  '1/2 OD':  { morning: '1/2', noon: '0',   evening: '0', night: '0'   },
  '1/2 BD':  { morning: '1/2', noon: '0',   evening: '0', night: '1/2' },
  '1/2 TDS': { morning: '1/2', noon: '1/2', evening: '0', night: '1/2' },
  '1/2 HS':  { morning: '0',   noon: '0',   evening: '0', night: '1/2' },
};
const DOSE_OPTIONS = Object.keys(DOSE_MAPPINGS);
const FOOD_TIMING_OPTIONS = ['nil', 'A/F', 'B/F', 'S/C', 'S/C B/F'];
const MORNING_TIMES = ['4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM','12 PM'];
const NOON_TIMES    = ['12 PM','1 PM','2 PM','3 PM','4 PM'];
const EVENING_TIMES = ['5 PM','6 PM','7 PM','8 PM'];
const NIGHT_TIMES   = ['7 PM','8 PM','9 PM','10 PM','11 PM','12 AM','1 AM'];

const FIRST_PAGE_ITEMS = 12;
const SUBSEQUENT_PAGE_ITEMS = 25;

const parseDiagnosis = (v: string) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
const joinDiagnosis  = (arr: string[]) => arr.join(', ');

const parseSpecialists = (v: string) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

const blankMed = (): Medication => ({
  name: '', number: '', dose: '',
  morning: '', morningTime: '', morningAmPm: 'AM',
  noon: '',   noonTime: '',   noonAmPm: 'PM',
  evening: '', eveningTime: '', eveningAmPm: 'PM',
  night: '',  nightTime: '',  nightAmPm: 'PM',
  foodTiming: '', drugType: undefined,
});

/* ══════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════ */
const StandardPrescriptionModal: React.FC<StandardPrescriptionModalProps> = ({
  doctor, patient, onClose, onSendToPharmacy,
  readOnly = false, existingData, clinicLogo,
  actorAttribution, onPrintOpen, tenant,
}) => {
  /* ── derived ── */
  const resolvedLogo    = clinicLogo || tenant?.avatar_url || undefined;
  const clinicName      = tenant ? getTenantDisplayName(tenant).toUpperCase() : 'DEMO CLINIC';
  const clinicAddress   = tenant?.address || '';
  const clinicPhone     = tenant ? getTenantPhone(tenant) : '9999900000';
  const emergencyPhone  = tenant?.emergency_phone || clinicPhone;
  const footerPhone     = tenant?.footer_phone || clinicPhone;
  // Per-tenant accent color — drives the mobile form header, tabs, badges, send button
  const accentColor     = tenant?.primary_color || '#C0132C';
  const SPECIALIST_OPTIONS = [
    doctor?.name || doctor?.full_name || 'Doctor',
  ];

  /* ── state ── */
  const [medications, setMedications] = useState<Medication[]>(() => Array.from({ length: 3 }, blankMed));
  const [mobileTab, setMobileTab] = useState<'clinical' | 'medicines' | 'followup'>('clinical');
  const [formData, setFormData] = useState({
    name: '', age: '', gender: '', fatherName: '',
    regNo: '', mrNo: '', place: '', date: new Date().toLocaleDateString('en-IN'),
    phone: '', allergy: '', diagnosis: '',
    reviewDate: '', testsToReview: '', specialistToReview: '',
    saltIntake: '', fluidIntake: '',
    doctorNotes: '',
  });
  const [showPrintView, setShowPrintView]   = useState(false);
  const [isMobile, setIsMobile]             = useState(false);
  const [showConfirmSendModal, setShowConfirmSendModal]   = useState(false);
  const [showConfirmCloseModal, setShowConfirmCloseModal] = useState(false);

  // Drug autocomplete
  const [savedDrugs, setSavedDrugs]             = useState<SavedDrug[]>([]);
  const [drugSearchQuery, setDrugSearchQuery]   = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState<number | null>(null);
  const [filteredDrugs, setFilteredDrugs]       = useState<DrugOption[]>([]);
  const [activeMedIndex, setActiveMedIndex]     = useState<number | null>(null);

  // Diagnosis autocomplete
  const [savedDiagnoses, setSavedDiagnoses]               = useState<{ id: string; name: string }[]>([]);
  const [diagnosisSearchQuery, setDiagnosisSearchQuery]   = useState('');
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);

  // Specialist dropdown (print footer)
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([]);
  const [showSpecialistDropdown, setShowSpecialistDropdown] = useState(false);

  // refs
  const componentRef  = useRef<HTMLDivElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const [layoutState, setLayoutState] = useState({ scale: 1, marginLeft: '0px' });

  /* ── mobile detection ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── layout scaling ── */
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.offsetWidth - 16;
      const A4_W_PX    = 794;
      if (containerW < A4_W_PX) {
        const scale = containerW / A4_W_PX;
        setLayoutState({ scale, marginLeft: '0px' });
      } else {
        const ml = Math.max(0, (containerW - A4_W_PX) / 2);
        setLayoutState({ scale: 1, marginLeft: `${ml}px` });
      }
    };
    resize();
    const obs = new ResizeObserver(resize);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /* ── fetch saved drugs ── */
  const fetchSavedDrugs = useCallback(async () => {
    if (!doctor?.id) return;
    const { data } = await (supabase
      .from('hospital_doctor_drugs' as any).select('id, name, drug_type')
      .eq('doctor_id', doctor.id) as any);
    if (data) setSavedDrugs(data as SavedDrug[]);
  }, [doctor?.id]);

  useEffect(() => { fetchSavedDrugs(); }, [fetchSavedDrugs]);

  /* ── drug search filter ── */
  const allDrugOptions: DrugOption[] = savedDrugs.map(d => ({
    id: d.id, name: d.name, drugType: d.drug_type, isReference: false,
  }));

  useEffect(() => {
    if (!drugSearchQuery.trim()) { setFilteredDrugs(allDrugOptions.slice(0, 20)); return; }
    const q = drugSearchQuery.toLowerCase();
    setFilteredDrugs(
      allDrugOptions.filter(o => o.name.toLowerCase().includes(q)).slice(0, 20)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drugSearchQuery, savedDrugs]);

  const handleSelectDrug = (index: number, option: DrugOption) => {
    const newMeds = [...medications];
    newMeds[index] = {
      ...newMeds[index],
      name: option.name,
      drugType: option.drugType,
    };
    setMedications(newMeds);
    setShowDrugDropdown(null);
    setDrugSearchQuery('');
  };

  const handleSaveDrug = async (name: string) => {
    if (!doctor?.id || !name.trim()) return;
    const { data } = await ((supabase
      .from('hospital_doctor_drugs' as any) as any)
      .insert({ doctor_id: doctor.id, name: name.trim().toUpperCase() })
      .select().single());
    if (data) { setSavedDrugs(prev => [...prev, data as SavedDrug]); toast.success('Drug saved'); }
  };

  const handleDeleteDrug = async (id: string) => {
    await (supabase.from('hospital_doctor_drugs' as any) as any).delete().eq('id', id);
    setSavedDrugs(prev => prev.filter(d => d.id !== id));
    toast.success('Drug removed');
  };

  /* ── fetch saved diagnoses ── */
  const fetchSavedDiagnoses = useCallback(async () => {
    if (!doctor?.id) return;
    const { data } = await (supabase
      .from('hospital_doctor_diagnoses' as any).select('*')
      .eq('doctor_id', doctor.id)
      .order('name', { ascending: true }) as any);
    if (data) setSavedDiagnoses((data as any[]).map((r: any) => ({ id: r.id, name: r.name })));
  }, [doctor?.id]);

  useEffect(() => { fetchSavedDiagnoses(); }, [fetchSavedDiagnoses]);

  /* ── patient data init ── */
  useEffect(() => {
    if (!patient) return;
    const name = patient.full_name || patient.name || '';
    const age  = patient.age ? String(patient.age) : '';
    const gender = patient.gender ? patient.gender.charAt(0).toUpperCase() : '';
    setFormData(prev => ({ ...prev, name, age, gender, phone: patient.phone || '' }));
  }, [patient?.id]);

  /* ── existingData parsing ── */
  useEffect(() => {
    if (!existingData) return;
    const meds: Medication[] = (existingData.medications || []).map((m: any) => ({
      name: m.name || '', number: m.number || m.dosage?.replace(' tab', '') || '',
      dose: m.dose || '', morning: m.morning || '', morningTime: m.morningTime || '',
      morningAmPm: m.morningAmPm || 'AM', noon: m.noon || '', noonTime: m.noonTime || '',
      noonAmPm: m.noonAmPm || 'PM', evening: m.evening || '', eveningTime: m.eveningTime || '',
      eveningAmPm: m.eveningAmPm || 'PM', night: m.night || '', nightTime: m.nightTime || '',
      nightAmPm: m.nightAmPm || 'PM', foodTiming: m.foodTiming || m.instruction || '',
      drugType: m.drugType || '',
    }));
    const notes = existingData.notes || '';
    const extractNote = (key: string) => {
      const match = notes.match(new RegExp(`${key}: ([^\\n]+)`));
      return match ? match[1].trim() : '';
    };
    const diagStr = extractNote('Diagnosis');
    const specialist = extractNote('SpecialistToReview');
    setMedications(meds.length ? [...meds, ...Array.from({ length: Math.max(0, 14 - meds.length) }, blankMed)] : Array.from({ length: 14 }, blankMed));
    setFormData(prev => ({
      ...prev,
      place: extractNote('Place') || prev.place,
      phone: extractNote('Phone') || prev.phone,
      diagnosis: diagStr,
      reviewDate: extractNote('Review'),
      testsToReview: extractNote('Tests'),
      specialistToReview: specialist,
      saltIntake: extractNote('SaltIntake'),
      fluidIntake: extractNote('FluidIntake'),
      doctorNotes: extractNote('DoctorNotes'),
    }));
    if (specialist) setSelectedSpecialists(parseSpecialists(specialist));
  }, [existingData]);

  /* ── medication helpers ── */
  const updateMed = (index: number, field: keyof Medication, value: string) => {
    const newMeds = [...medications];
    (newMeds[index] as any)[field] = value;
    if (field === 'dose' && DOSE_MAPPINGS[value]) {
      const m = DOSE_MAPPINGS[value];
      newMeds[index].morning = m.morning;
      newMeds[index].noon    = m.noon;
      newMeds[index].night   = m.night;
    }
    setMedications(newMeds);
  };
  const addRow    = () => setMedications(prev => [...prev, blankMed()]);
  const removeRow = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i));

  /* ── print ── */
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Prescription_${formData.name || patient?.full_name || 'Patient'}_${formData.date}`,
    onBeforeGetContent: () => { onPrintOpen?.(); return Promise.resolve(); },
    removeAfterPrint: true,
  } as any);

  /* ── send ── */
  const handleSend = () => { if (!readOnly) setShowConfirmSendModal(true); };
  const confirmSendToPharmacy = () => {
    setShowConfirmSendModal(false);
    const pharmacyMeds = medications.filter(m => m.name).map(m => ({
      name: String(m.name || '').toUpperCase(),
      dosage: m.number + ' tab',
      dose: m.dose,
      frequency: `${m.morning||'0'}-${m.noon||'0'}-${m.evening||'0'}-${m.night||'0'}`,
      morningTime: m.morningTime || '', noonTime: m.noonTime || '',
      eveningTime: m.eveningTime || '', nightTime: m.nightTime || '',
      drugType: m.drugType || '',
      duration: 'See Review Date',
      instruction: m.foodTiming === 'B/F' ? 'Before Food' : m.foodTiming === 'nil' ? '' : m.foodTiming || 'After Food',
    }));
    const notes = `Place: ${formData.place}\nPhone: ${formData.phone}\nDiagnosis: ${formData.diagnosis}\nReview: ${formData.reviewDate}\nTests: ${formData.testsToReview}\nSpecialistToReview: ${formData.specialistToReview}\nSaltIntake: ${formData.saltIntake}\nFluidIntake: ${formData.fluidIntake}${formData.doctorNotes ? '\nDoctorNotes: ' + formData.doctorNotes : ''}`;
    onSendToPharmacy?.(pharmacyMeds, notes, {
      nextReviewDate: formData.reviewDate || null,
      testsToReview: formData.testsToReview || '',
      specialistsToReview: formData.specialistToReview || '',
    });
  };

  /* ── pagination ── */
  const filledMeds     = medications.filter(m => m.name);
  const displayMeds    = medications;
  const totalMeds      = displayMeds.length;
  const pageChunks: Medication[][] = [];
  let remaining = [...displayMeds];
  pageChunks.push(remaining.splice(0, FIRST_PAGE_ITEMS));
  while (remaining.length > 0) pageChunks.push(remaining.splice(0, SUBSEQUENT_PAGE_ITEMS));

  /* ── derived doctor name ── */
  const doctorDisplayName = doctor?.name || doctor?.full_name || 'Doctor';
  const prescribedByName  = actorAttribution?.actorDisplayName
    ? `${actorAttribution.actorDisplayName} (on behalf of ${doctorDisplayName})`
    : doctorDisplayName;

  /* ─────────────────────────────────────────────
     CONFIRM MODALS
  ───────────────────────────────────────────── */
  const ConfirmSendModal = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmSendModal(false)}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </div>
          <div><h3 className="text-lg font-bold text-white">Send to Pharmacy</h3><p className="text-emerald-100 text-sm">Confirm prescription submission</p></div>
        </div>
        <div className="px-6 py-5"><p className="text-gray-700 text-sm leading-relaxed">Are you sure you want to send this prescription to the <strong>Pharmacy</strong>?</p></div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={() => setShowConfirmSendModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95">Cancel</button>
          <button onClick={confirmSendToPharmacy} className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Yes, Send
          </button>
        </div>
      </div>
    </div>
  );

  const ConfirmCloseModal = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmCloseModal(false)}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div><h3 className="text-lg font-bold text-white">Close Prescription</h3><p className="text-emerald-100 text-sm">Confirm before closing</p></div>
        </div>
        <div className="px-6 py-5"><p className="text-gray-700 text-sm leading-relaxed">Are you sure you want to <strong>close</strong> this prescription? Any unsaved changes will be lost.</p></div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={() => setShowConfirmCloseModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95">Go Back</button>
          <button onClick={() => { setShowConfirmCloseModal(false); onClose(); }} className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Yes, Close
          </button>
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────
     MOBILE ROUTE — Inline 3-tab form
  ───────────────────────────────────────────── */
  if (isMobile && !showPrintView) {
    const tabLabel = (t: typeof mobileTab) =>
      t === 'clinical' ? '🩺 Clinical' : t === 'medicines' ? '💊 Medicines' : '📅 Follow-up';

    const cardStyle: React.CSSProperties = {
      background: '#fff', borderRadius: '14px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: '12px',
    };
    const cardHead = (emoji: string, label: string, accent = '#64748B', bg = '#FAFBFC', borderColor = '#E2E8F0') => (
      <div style={{ background: bg, padding: '9px 14px', borderBottom: `1px solid ${borderColor}`, display: 'flex', gap: '7px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px' }}>{emoji}</span>
        <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: accent, fontFamily: 'sans-serif' }}>{label}</span>
      </div>
    );
    const inputSt: React.CSSProperties = {
      width: '100%', padding: '10px 12px',
      background: '#F5F7FA', border: '1.5px solid #E2E8F0',
      borderRadius: '10px', fontSize: '13px', fontWeight: 600,
      outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#0D1117',
    };
    const labelSt: React.CSSProperties = {
      display: 'block', fontSize: '10px', fontWeight: 800,
      textTransform: 'uppercase' as const, letterSpacing: '0.1em',
      color: '#64748B', marginBottom: '6px', fontFamily: 'sans-serif',
    };
    const pillBtn = (label: string, active: boolean, onClick: () => void, activeColor = accentColor) => (
      <button key={label} type="button" onClick={onClick} style={{
        padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
        border: `1.5px solid ${active ? activeColor : '#CBD5E1'}`,
        background: active ? activeColor : '#fff',
        color: active ? '#fff' : '#64748B',
        cursor: 'pointer', transition: 'all 0.13s', fontFamily: 'sans-serif',
      }}>{label}</button>
    );

    return (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: '#F5F7FA', fontFamily: 'sans-serif' }}>

          {/* ── Header ── */}
          <div style={{ background: '#0D1117', padding: '10px 16px 0', flexShrink: 0 }}>
            {/* Clinic brand strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }}>
              {resolvedLogo && (
                <img src={resolvedLogo} alt="logo" style={{ width: '28px', height: '28px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
              )}
              {!resolvedLogo && (
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                  {clinicName.charAt(0)}
                </div>
              )}
              <div>
                <div style={{ color: '#fff', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', lineHeight: 1.2 }}>{clinicName}</div>
                {doctor && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 600 }}>Dr. {doctor.full_name || doctor.name}</div>}
              </div>
              <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '16px', lineHeight: 1.2 }}>
                  {formData.name || patient?.full_name || patient?.name || 'Patient'}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                  {patient?.token_number && (
                    <span style={{ background: accentColor, color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 }}>Token {patient.token_number}</span>
                  )}
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{formData.age || patient?.age} yrs</span>
                </div>
              </div>
              {patient?.mr_number && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>MR: {patient.mr_number}</span>
              )}
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex' }}>
              {(['clinical', 'medicines', 'followup'] as const).map(tab => (
                <button key={tab} onClick={() => setMobileTab(tab)} style={{
                  flex: 1, padding: '10px 4px', fontSize: '11px', fontWeight: 800,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: mobileTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
                  borderBottom: mobileTab === tab ? `2.5px solid ${accentColor}` : '2.5px solid transparent',
                  transition: 'all 0.15s',
                }}>{tabLabel(tab)}</button>
              ))}
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px 110px' }}>

            {/* ━━━ TAB 1: CLINICAL ━━━ */}
            {mobileTab === 'clinical' && (
              <>
                {/* Diagnosis */}
                <div style={cardStyle}>
                  {cardHead('🩺', 'Diagnosis')}
                  <div style={{ padding: '12px 14px', position: 'relative' }}>
                    <textarea
                      value={formData.diagnosis}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData((p: any) => ({ ...p, diagnosis: val }));
                        const parts = val.split(',');
                        setDiagnosisSearchQuery(parts[parts.length - 1].trim());
                        setShowDiagnosisDropdown(true);
                      }}
                      onFocus={() => { const parts = (formData.diagnosis || '').split(','); setDiagnosisSearchQuery(parts[parts.length - 1].trim()); setShowDiagnosisDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowDiagnosisDropdown(false), 250)}
                      placeholder="Type diagnosis here..."
                      readOnly={readOnly}
                      rows={3}
                      style={{ ...inputSt, resize: 'none', lineHeight: 1.6 }}
                    />
                    {showDiagnosisDropdown && diagnosisSearchQuery.trim().length > 0 && (() => {
                      const fl = savedDiagnoses.filter(d => d.name && d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase()));
                      return fl.length > 0 && (
                        <div style={{ position: 'absolute', left: 14, right: 14, top: '100%', zIndex: 50, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '0 0 12px 12px', boxShadow: '0 12px 30px rgba(0,0,0,0.12)', maxHeight: '160px', overflowY: 'auto' }}>
                          {fl.map(d => (
                            <button key={d.id} type="button" onMouseDown={() => {
                              const ex = parseDiagnosis(formData.diagnosis);
                              if (!ex.includes(d.name)) setFormData((p: any) => ({ ...p, diagnosis: joinDiagnosis([...ex, d.name]) }));
                              setShowDiagnosisDropdown(false);
                            }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '13px', fontWeight: 500, background: 'none', border: 'none', borderBottom: '1px solid #F5F7FA', cursor: 'pointer', color: '#374151' }}>
                              {d.name}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    {formData.diagnosis.split(',').filter(Boolean).length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {formData.diagnosis.split(',').map(s => s.trim()).filter(Boolean).map(diag => (
                          <span key={diag} style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {diag}
                            {!readOnly && (
                              <button type="button" onClick={() => {
                                const updated = formData.diagnosis.split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== diag).join(', ');
                                setFormData((p: any) => ({ ...p, diagnosis: updated }));
                              }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD', fontSize: '12px', lineHeight: 1, padding: 0 }}>×</button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Drug Allergy */}
                <div style={cardStyle}>
                  {cardHead('⚠️', 'Drug Allergy', accentColor, '#FFF5F5', '#FED7D7')}
                  <div style={{ padding: '12px 14px' }}>
                    <input
                      type="text" value={formData.allergy}
                      onChange={e => setFormData((p: any) => ({ ...p, allergy: e.target.value.toUpperCase() }))}
                      placeholder="NIL / Enter allergy..."
                      readOnly={readOnly}
                      style={{ ...inputSt, textTransform: 'uppercase', fontWeight: 700 }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ━━━ TAB 2: MEDICINES ━━━ */}
            {mobileTab === 'medicines' && (
              <>
                {medications.map((med, idx) => (
                  <div key={idx} style={{ ...cardStyle, marginBottom: '14px' }}>
                    {/* Card header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
                      <span style={{ width: '24px', height: '24px', background: '#0D1117', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, color: '#fff', flexShrink: 0 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontWeight: 700 }}>Medication {idx + 1}</span>
                      {medications.length > 1 && !readOnly && (
                        <button onClick={() => removeRow(idx)} style={{ fontSize: '14px', color: '#CBD5E1', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                      )}
                    </div>

                    {/* Drug name */}
                    <div style={{ padding: '10px 14px 0', position: 'relative' }}>
                      <label style={labelSt}>Drug Name</label>
                      <input
                        type="text" value={med.name}
                        onChange={e => {
                          const v = e.target.value.toUpperCase();
                          updateMed(idx, 'name', v);
                          setDrugSearchQuery(v);
                          setShowDrugDropdown(idx);
                        }}
                        onFocus={() => { setShowDrugDropdown(idx); setDrugSearchQuery(med.name || ''); }}
                        onBlur={() => setTimeout(() => setShowDrugDropdown(null), 200)}
                        placeholder={`Search or type drug ${idx + 1}...`}
                        readOnly={readOnly}
                        style={{ ...inputSt, textTransform: 'uppercase', fontWeight: 700 }}
                      />
                      {!readOnly && showDrugDropdown === idx && filteredDrugs.length > 0 && (
                        <div style={{ position: 'absolute', left: 14, right: 14, top: '100%', zIndex: 50, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '0 0 12px 12px', boxShadow: '0 12px 30px rgba(0,0,0,0.12)', maxHeight: '160px', overflowY: 'auto' }}>
                          {filteredDrugs.map(opt => (
                            <button key={opt.id} type="button" onMouseDown={() => handleSelectDrug(idx, opt)}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', borderBottom: '1px solid #F5F7FA', cursor: 'pointer', color: '#0D1117', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{getDrugTypeIcon(opt.drugType)} {opt.name}</span>
                              {opt.drugType && <span style={{ fontSize: '10px', color: '#94A3B8' }}>{opt.drugType}</span>}
                            </button>
                          ))}
                          <button type="button" onMouseDown={() => { handleSaveDrug(med.name); setShowDrugDropdown(null); }}
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 700, background: '#F8FAFC', border: 'none', cursor: 'pointer', color: '#1D4ED8', borderTop: '1px solid #E2E8F0' }}>
                            + Save "{med.name}" as new drug
                          </button>
                        </div>
                      )}
                    </div>

                    {/* QTY + Frequency */}
                    <div style={{ padding: '10px 14px 0', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px' }}>
                      <div>
                        <label style={labelSt}>Qty</label>
                        <input type="text" value={med.number} onChange={e => updateMed(idx, 'number', e.target.value)} readOnly={readOnly}
                          style={{ ...inputSt, textAlign: 'center', fontWeight: 800 }} placeholder="1" />
                      </div>
                      <div>
                        <label style={labelSt}>Frequency</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {['OD','BD','TDS','QID','HS','1/2 BD','1/2 OD'].map(freq => pillBtn(freq, med.dose === freq, () => updateMed(idx, 'dose', med.dose === freq ? '' : freq)))}
                        </div>
                      </div>
                    </div>

                    {/* Dose cells M/N/E/NT */}
                    <div style={{ padding: '10px 14px 0' }}>
                      <label style={labelSt}>Doses (Morning / Noon / Evening / Night)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {(['morning','noon','evening','night'] as const).map(slot => (
                          <div key={slot} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '3px' }}>{slot.slice(0,1).toUpperCase()}</div>
                            <input type="text" value={(med as any)[slot]} onChange={e => updateMed(idx, slot, e.target.value)} readOnly={readOnly}
                              style={{ ...inputSt, textAlign: 'center', padding: '8px 4px', fontWeight: 800, fontSize: '14px' }} placeholder="0" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Food timing */}
                    <div style={{ padding: '10px 14px 12px' }}>
                      <label style={labelSt}>Timing</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {FOOD_TIMING_OPTIONS.map(t => pillBtn(t, med.foodTiming === t, () => updateMed(idx, 'foodTiming', med.foodTiming === t ? '' : t), '#1A7A4A'))}
                      </div>
                    </div>
                  </div>
                ))}

                {!readOnly && (
                  <button onClick={addRow} style={{ width: '100%', padding: '14px', background: '#fff', border: '2px dashed #CBD5E1', borderRadius: '14px', color: '#94A3B8', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '18px' }}>+</span> Add Medication
                  </button>
                )}
              </>
            )}

            {/* ━━━ TAB 3: FOLLOW-UP ━━━ */}
            {mobileTab === 'followup' && (
              <>
                {/* Notes */}
                <div style={cardStyle}>
                  {cardHead('📝', 'Doctor Notes')}
                  <div style={{ padding: '12px 14px' }}>
                    <textarea value={formData.doctorNotes} onChange={e => setFormData((p: any) => ({ ...p, doctorNotes: e.target.value }))}
                      placeholder="Additional notes for patient..." readOnly={readOnly} rows={4}
                      style={{ ...inputSt, resize: 'none', lineHeight: 1.6 }} />
                  </div>
                </div>

                {/* Intake */}
                <div style={cardStyle}>
                  {cardHead('💧', 'Intake Restrictions')}
                  <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelSt}>Salt (gm/day)</label>
                      <input type="text" value={formData.saltIntake} onChange={e => setFormData((p: any) => ({ ...p, saltIntake: e.target.value }))}
                        placeholder="e.g. 5" readOnly={readOnly} style={inputSt} />
                    </div>
                    <div>
                      <label style={labelSt}>Fluid (lit/day)</label>
                      <input type="text" value={formData.fluidIntake} onChange={e => setFormData((p: any) => ({ ...p, fluidIntake: e.target.value }))}
                        placeholder="e.g. 1.5" readOnly={readOnly} style={inputSt} />
                    </div>
                  </div>
                </div>

                {/* Review date */}
                <div style={cardStyle}>
                  {cardHead('📅', 'Review Date')}
                  <div style={{ padding: '12px 14px' }}>
                    <input type="date" value={formData.reviewDate} onChange={e => setFormData((p: any) => ({ ...p, reviewDate: e.target.value }))}
                      readOnly={readOnly} min={new Date().toISOString().split('T')[0]}
                      style={{ ...inputSt, minHeight: '45px' }} />
                    {formData.reviewDate && (() => {
                      const d = new Date(formData.reviewDate);
                      const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
                      const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
                      const label = diff > 0 ? `In ${diff} days` : diff === 0 ? 'Today' : `${Math.abs(diff)} days ago`;
                      return <span style={{ display: 'inline-block', marginTop: '6px', padding: '4px 10px', background: '#F1F5F9', color: '#475569', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>🕒 Review {label}</span>;
                    })()}
                  </div>
                </div>

                {/* Tests */}
                <div style={cardStyle}>
                  {cardHead('🧪', 'Tests to Review')}
                  <div style={{ padding: '12px 14px' }}>
                    <input type="text" value={formData.testsToReview} onChange={e => setFormData((p: any) => ({ ...p, testsToReview: e.target.value.toUpperCase() }))}
                      placeholder="BLOOD TEST, X-RAY, ECG..." readOnly={readOnly}
                      style={{ ...inputSt, textTransform: 'uppercase', fontWeight: 700 }} />
                  </div>
                </div>

                {/* Specialists */}
                <div style={cardStyle}>
                  {cardHead('👨‍⚕️', 'Specialists')}
                  <div style={{ padding: '12px 14px' }}>
                    <input type="text" value={formData.specialistToReview} onChange={e => setFormData((p: any) => ({ ...p, specialistToReview: e.target.value.toUpperCase() }))}
                      placeholder="CARDIOLOGIST, NEUROLOGIST..." readOnly={readOnly}
                      style={{ ...inputSt, textTransform: 'uppercase', fontWeight: 700 }} />
                    {SPECIALIST_OPTIONS.length > 0 && !readOnly && (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {SPECIALIST_OPTIONS.map(s => {
                          const sel = (formData.specialistToReview || '').includes(s);
                          return (
                            <button key={s} type="button" onClick={() => {
                              const curr = parseSpecialists(formData.specialistToReview);
                              const next = sel ? curr.filter(x => x !== s) : [...curr, s];
                              setFormData((p: any) => ({ ...p, specialistToReview: next.join(', ') }));
                            }} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: `1.5px solid ${sel ? '#0D1117' : '#CBD5E1'}`, background: sel ? '#0D1117' : '#fff', color: sel ? '#fff' : '#64748B', cursor: 'pointer' }}>
                              {sel ? '✓ ' : ''}{s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E2E8F0', padding: '10px 12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', display: 'flex', gap: '8px', zIndex: 20 }}>
            <button onClick={() => setShowConfirmCloseModal(true)} style={{ flex: 1, padding: '12px', background: '#E2E8F0', color: '#475569', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            <button onClick={() => setShowPrintView(true)} style={{ flex: 1, padding: '12px', background: '#0D1117', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            {!readOnly && (
              <button onClick={handleSend} style={{ flex: 1, padding: '12px', background: accentColor, color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: `0 4px 18px ${accentColor}55` }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Send
              </button>
            )}
          </div>
        </div>
        {showConfirmSendModal  && <ConfirmSendModal />}
        {showConfirmCloseModal && <ConfirmCloseModal />}
      </>
    );
  }

  /* ─────────────────────────────────────────────
     DESKTOP / PRINT VIEW
  ───────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-scale-in">

        {/* Mobile print-preview back bar */}
        {isMobile && showPrintView && (
          <div className="sticky top-0 z-[70] bg-white/80 backdrop-blur-md p-4 border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => setShowPrintView(false)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center gap-2">← Back to Edit</button>
            <span className="font-bold text-gray-900">Print Preview</span>
          </div>
        )}

        {/* Scrollable print content */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100" ref={containerRef}>
          <div
            ref={componentRef}
            className="print-content bg-white shadow-sm p-4 max-w-[210mm] text-black w-full origin-top-left"
            style={{
              fontFamily: '"Times New Roman", Times, serif',
              minWidth: '210mm',
              transform: `scale(${layoutState.scale})`,
              marginLeft: layoutState.marginLeft,
              marginBottom: layoutState.scale < 1 ? `-${(1 - layoutState.scale) * 100}%` : '0',
            }}
          >
            <style>{`
              @media print {
                .print-content { transform: none !important; width: 100% !important; margin: 0 !important; min-width: 0 !important; }
                .flex { display: flex !important; }
                .flex-col { flex-direction: column !important; }
                .flex-row { flex-direction: row !important; }
                .items-center { align-items: center !important; }
                .items-end { align-items: flex-end !important; }
                .justify-between { justify-content: space-between !important; }
                .justify-center { justify-content: center !important; }
                .justify-end { justify-content: flex-end !important; }
                .grow { flex-grow: 1 !important; }
                .shrink-0 { flex-shrink: 0 !important; }
                .w-full { width: 100% !important; }
                .h-full { height: 100% !important; }
                .absolute { position: absolute !important; }
                .relative { position: relative !important; }
                .border { border-width: 1px !important; }
                .border-2 { border-width: 2px !important; }
                .border-b { border-bottom-width: 1px !important; }
                .border-r { border-right-width: 1px !important; }
                .border-t { border-top-width: 1px !important; }
                .border-black { border-color: black !important; }
                .text-center { text-align: center !important; }
                .text-right { text-align: right !important; }
                .font-bold { font-weight: 700 !important; }
                .uppercase { text-transform: uppercase !important; }
                input, textarea, select { border: none !important; outline: none !important; background: transparent !important; resize: none !important; }
                .no-print { display: none !important; }
                .page-break { page-break-before: always !important; break-before: page !important; }
              }
            `}</style>

            {/* ══ PAGES ══ */}
            {pageChunks.map((chunk, pageIdx) => {
              const isFirstPage = pageIdx === 0;
              const isLastPage  = pageIdx === pageChunks.length - 1;
              const globalStart = pageIdx === 0 ? 0 : FIRST_PAGE_ITEMS + (pageIdx - 1) * SUBSEQUENT_PAGE_ITEMS;

              return (
                <div
                  key={pageIdx}
                  className={`std-page ${pageIdx > 0 ? 'page-break' : ''}`}
                  style={{ width: '210mm', minHeight: '297mm', maxWidth: '210mm', padding: '8mm 10mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', position: 'relative' }}
                >
                  {/* ── HEADER (first page only) ── */}
                  {isFirstPage && (
                    <div className="flex items-center justify-between mb-2 pb-2 border-b-2 border-black">
                      {/* Logo */}
                      <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                        {resolvedLogo ? (
                          <img src={getProxiedUrl(resolvedLogo)} alt="logo" className="w-20 h-20 object-contain" />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-3xl font-bold border border-gray-200">
                            {clinicName.charAt(0)}
                          </div>
                        )}
                      </div>
                      {/* Clinic name */}
                      <div className="flex-1 text-center px-4">
                        <h1 className="text-xl font-bold uppercase leading-tight">{clinicName}</h1>
                        {clinicAddress && <p className="text-xs text-gray-600 mt-1">{clinicAddress}</p>}
                        {clinicPhone && <p className="text-xs text-gray-600">Ph: {clinicPhone}</p>}
                      </div>
                      {/* Doctor info */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold uppercase">{doctorDisplayName}</p>
                        <p className="text-xs text-gray-600">MBBS, MD</p>
                      </div>
                    </div>
                  )}

                  {/* ── PATIENT DETAILS (first page only) ── */}
                  {isFirstPage && (
                    <table className="w-full text-xs border border-black mb-2" style={{ borderCollapse: 'collapse' }}>
                      <tbody>
                        {/* Row 1: Name | Age/Gender */}
                        <tr>
                          <td className="border border-black px-1.5 py-1 w-1/2">
                            <span className="font-bold text-gray-700 mr-1">NAME:</span>
                            <input className="inline-block w-[70%] bg-transparent border-none outline-none text-xs font-semibold uppercase" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Patient Name" readOnly={readOnly} />
                          </td>
                          <td className="border border-black px-1.5 py-1 w-1/2">
                            <span className="font-bold text-gray-700 mr-1">AGE:</span>
                            <input className="inline-block w-12 bg-transparent border-none outline-none text-xs font-semibold" value={formData.age} onChange={e => setFormData(p => ({ ...p, age: e.target.value }))} placeholder="Yrs" readOnly={readOnly} />
                            <span className="font-bold text-gray-700 mx-1">M/F:</span>
                            <input className="inline-block w-10 bg-transparent border-none outline-none text-xs font-semibold" value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} placeholder="M/F" readOnly={readOnly} />
                          </td>
                        </tr>
                        {/* Row 2: Father/Husband | Reg.No/MR.No */}
                        <tr>
                          <td className="border border-black px-1.5 py-1">
                            <span className="font-bold text-gray-700 mr-1">FATHER / HUSBAND:</span>
                            <input className="inline-block w-[50%] bg-transparent border-none outline-none text-xs" value={formData.fatherName} onChange={e => setFormData(p => ({ ...p, fatherName: e.target.value }))} readOnly={readOnly} />
                          </td>
                          <td className="border border-black px-1.5 py-1">
                            <span className="font-bold text-gray-700 mr-1">REG.NO:</span>
                            <input className="inline-block w-16 bg-transparent border-none outline-none text-xs" value={formData.regNo} onChange={e => setFormData(p => ({ ...p, regNo: e.target.value }))} readOnly={readOnly} />
                            <span className="font-bold text-gray-700 mx-1">MR.NO:</span>
                            <input className="inline-block w-16 bg-transparent border-none outline-none text-xs" value={formData.mrNo} onChange={e => setFormData(p => ({ ...p, mrNo: e.target.value }))} readOnly={readOnly} />
                          </td>
                        </tr>
                        {/* Row 3: Place | Date */}
                        <tr>
                          <td className="border border-black px-1.5 py-1">
                            <span className="font-bold text-gray-700 mr-1">PLACE:</span>
                            <input className="inline-block w-[72%] bg-transparent border-none outline-none text-xs" value={formData.place} onChange={e => setFormData(p => ({ ...p, place: e.target.value }))} readOnly={readOnly} />
                          </td>
                          <td className="border border-black px-1.5 py-1">
                            <span className="font-bold text-gray-700 mr-1">DATE:</span>
                            <input className="inline-block w-[72%] bg-transparent border-none outline-none text-xs" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} readOnly={readOnly} />
                          </td>
                        </tr>
                        {/* Row 4: Phone */}
                        <tr>
                          <td className="border border-black px-1.5 py-1" colSpan={2}>
                            <span className="font-bold text-gray-700 mr-1">PHONE:</span>
                            <input className="inline-block w-48 bg-transparent border-none outline-none text-xs" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} readOnly={readOnly} />
                          </td>
                        </tr>
                        {/* Row 5: Drug Allergy */}
                        <tr>
                          <td className="border border-black px-1.5 py-1" colSpan={2}>
                            <span className="font-bold text-red-600 mr-1">DRUG ALLERGY:</span>
                            <input className="inline-block w-[75%] bg-transparent border-none outline-none text-xs" value={formData.allergy} onChange={e => setFormData(p => ({ ...p, allergy: e.target.value }))} readOnly={readOnly} />
                          </td>
                        </tr>
                        {/* Row 6: Diagnosis */}
                        <tr>
                          <td className="border border-black px-1.5 py-1" colSpan={2}>
                            <span className="font-bold text-gray-700 mr-1">DIAGNOSIS:</span>
                            <div className="inline-block relative w-[80%]">
                              <input
                                className="w-full bg-transparent border-none outline-none text-xs"
                                value={formData.diagnosis}
                                onChange={e => { setFormData(p => ({ ...p, diagnosis: e.target.value })); setDiagnosisSearchQuery(e.target.value); setShowDiagnosisDropdown(true); }}
                                onFocus={() => setShowDiagnosisDropdown(true)}
                                onBlur={() => setTimeout(() => setShowDiagnosisDropdown(false), 200)}
                                readOnly={readOnly}
                              />
                              {showDiagnosisDropdown && savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase())).length > 0 && (
                                <div className="no-print absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto w-64">
                                  {savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase())).map(d => (
                                    <button key={d.id} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50" onMouseDown={() => {
                                      const existing = parseDiagnosis(formData.diagnosis);
                                      if (!existing.includes(d.name)) { setFormData(p => ({ ...p, diagnosis: joinDiagnosis([...existing, d.name]) })); }
                                      setShowDiagnosisDropdown(false);
                                    }}>{d.name}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* ── MEDICINE TABLE ── */}
                  <table className="w-full text-xs border-2 border-black mb-2" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-gray-100">
                        <td colSpan={10} className="border border-black text-center py-1 font-bold text-sm uppercase">
                          MEDICINES PRESCRIPTION DETAILS
                        </td>
                      </tr>
                      <tr className="text-center font-bold text-xs">
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '28px' }}>S.N</td>
                        <td className="border border-black py-0.5 px-0.5 grow">DRUGS</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '32px' }}>QTY</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '52px' }}>FREQ</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '30px' }}>M</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '30px' }}>N</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '30px' }}>E</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '30px' }}>NT</td>
                        <td className="border border-black py-0.5 px-0.5" style={{ width: '42px' }}>TIMING</td>
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.map((med, localIdx) => {
                        const globalIdx = globalStart + localIdx;
                        const sn = globalIdx + 1;
                        return (
                          <tr key={globalIdx} className="align-top">
                            <td className="border border-black text-center py-0.5 text-xs font-bold">{sn}</td>

                            {/* Drug name cell */}
                            <td className="border border-black px-1 py-0.5 relative">
                              <div className="flex items-center gap-1">
                                {med.drugType && <span className="text-xs">{getDrugTypeIcon(med.drugType)}</span>}
                                <textarea
                                  className="w-full bg-transparent border-none outline-none text-xs resize-none leading-4 min-h-[20px]"
                                  rows={1}
                                  value={med.name}
                                  onChange={e => {
                                    updateMed(globalIdx, 'name', e.target.value);
                                    setDrugSearchQuery(e.target.value);
                                    setShowDrugDropdown(globalIdx);
                                    setActiveMedIndex(globalIdx);
                                  }}
                                  onFocus={() => { setShowDrugDropdown(globalIdx); setActiveMedIndex(globalIdx); setDrugSearchQuery(med.name || ''); }}
                                  onBlur={() => setTimeout(() => setShowDrugDropdown(null), 200)}
                                  readOnly={readOnly}
                                  placeholder={`Drug ${sn}`}
                                />
                              </div>
                              {/* Drug dropdown */}
                              {!readOnly && showDrugDropdown === globalIdx && filteredDrugs.length > 0 && (
                                <div className="no-print absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl w-72 max-h-52 overflow-y-auto">
                                  {filteredDrugs.map(opt => (
                                    <button key={opt.id} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-2"
                                      onMouseDown={() => handleSelectDrug(globalIdx, opt)}>
                                      <span className="flex items-center gap-1.5">
                                        {getDrugTypeIcon(opt.drugType)} {opt.name}
                                      </span>
                                      {opt.drugType && <span className="text-gray-400 text-[10px] shrink-0">{opt.drugType}</span>}
                                    </button>
                                  ))}
                                  <div className="no-print border-t border-gray-100 px-3 py-2">
                                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                      onMouseDown={() => { handleSaveDrug(med.name); setShowDrugDropdown(null); }}>
                                      + Save "{med.name}" as new drug
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* QTY */}
                            <td className="border border-black text-center px-0.5 py-0.5">
                              <input className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.number} onChange={e => updateMed(globalIdx, 'number', e.target.value)} readOnly={readOnly} />
                            </td>

                            {/* FREQ */}
                            <td className="border border-black text-center px-0.5 py-0.5 relative">
                              {readOnly ? (
                                <span className="text-xs">{med.dose}</span>
                              ) : (
                                <select className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.dose} onChange={e => updateMed(globalIdx, 'dose', e.target.value)}>
                                  <option value=""></option>
                                  {DOSE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              )}
                            </td>

                            {/* MORNING */}
                            <td className="border border-black text-center px-0.5 py-0.5">
                              <input className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.morning} onChange={e => updateMed(globalIdx, 'morning', e.target.value)} readOnly={readOnly} />
                            </td>

                            {/* NOON */}
                            <td className="border border-black text-center px-0.5 py-0.5">
                              <input className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.noon} onChange={e => updateMed(globalIdx, 'noon', e.target.value)} readOnly={readOnly} />
                            </td>

                            {/* EVENING */}
                            <td className="border border-black text-center px-0.5 py-0.5">
                              <input className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.evening} onChange={e => updateMed(globalIdx, 'evening', e.target.value)} readOnly={readOnly} />
                            </td>

                            {/* NIGHT */}
                            <td className="border border-black text-center px-0.5 py-0.5">
                              <input className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.night} onChange={e => updateMed(globalIdx, 'night', e.target.value)} readOnly={readOnly} />
                            </td>

                            {/* TIMING */}
                            <td className="border border-black text-center px-0.5 py-0.5">
                              {readOnly ? (
                                <span className="text-xs">{med.foodTiming}</span>
                              ) : (
                                <select className="w-full bg-transparent border-none outline-none text-xs text-center" value={med.foodTiming} onChange={e => updateMed(globalIdx, 'foodTiming', e.target.value)}>
                                  <option value=""></option>
                                  {FOOD_TIMING_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* ── ADD ROW button (no-print) ── */}
                  {!readOnly && isLastPage && (
                    <div className="no-print flex gap-2 mb-2">
                      <button onClick={addRow} className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100">+ Add Row</button>
                    </div>
                  )}

                  {/* ── FOOTER (last page only) ── */}
                  {isLastPage && (() => {
                    const medicineCount = filledMeds.length;
                    const isShort = medicineCount <= 4;

                    return (
                      <div className={`mt-auto ${isShort ? 'pt-8' : 'pt-2'}`}>

                        {/* Review + Tests + Specialists row */}
                        <div className="flex gap-2 mb-2 text-xs">
                          {/* Review date */}
                          <div className="border border-black px-2 py-1 flex-1">
                            <div className="font-bold text-gray-700 mb-0.5">REVIEW ON:</div>
                            <input
                              type="date"
                              className="w-full bg-transparent border-none outline-none text-xs"
                              value={formData.reviewDate}
                              onChange={e => setFormData(p => ({ ...p, reviewDate: e.target.value }))}
                              readOnly={readOnly}
                            />
                          </div>
                          {/* Tests */}
                          <div className="border border-black px-2 py-1 flex-1">
                            <div className="font-bold text-gray-700 mb-0.5">TESTS:</div>
                            <input
                              className="w-full bg-transparent border-none outline-none text-xs"
                              value={formData.testsToReview}
                              onChange={e => setFormData(p => ({ ...p, testsToReview: e.target.value }))}
                              readOnly={readOnly}
                            />
                          </div>
                          {/* Specialists */}
                          <div className="border border-black px-2 py-1 flex-2 relative">
                            <div className="font-bold text-gray-700 mb-0.5">SPECIALISTS:</div>
                            {readOnly ? (
                              <div className="text-xs">{formData.specialistToReview}</div>
                            ) : (
                              <div className="relative">
                                <div
                                  className="w-full bg-transparent border border-gray-300 rounded text-xs px-1 py-0.5 cursor-pointer min-h-[20px] flex items-center gap-1 flex-wrap"
                                  onClick={() => setShowSpecialistDropdown(p => !p)}
                                >
                                  {selectedSpecialists.length === 0
                                    ? <span className="text-gray-400">Select…</span>
                                    : selectedSpecialists.map(s => (
                                      <span key={s} className="bg-gray-100 text-gray-700 px-1 rounded text-[10px]">
                                        {s} <button className="ml-0.5 text-gray-400 hover:text-red-500"
                                          onMouseDown={e => { e.stopPropagation(); const ns = selectedSpecialists.filter(x => x !== s); setSelectedSpecialists(ns); setFormData(p => ({ ...p, specialistToReview: ns.join(', ') })); }}>×</button>
                                      </span>
                                    ))
                                  }
                                </div>
                                {showSpecialistDropdown && (
                                  <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-48 max-h-36 overflow-y-auto">
                                    {SPECIALIST_OPTIONS.filter(s => !selectedSpecialists.includes(s)).map(s => (
                                      <button key={s} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                                        onMouseDown={() => { const ns = [...selectedSpecialists, s]; setSelectedSpecialists(ns); setFormData(p => ({ ...p, specialistToReview: ns.join(', ') })); setShowSpecialistDropdown(false); }}>
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Intake Restrictions row */}
                        <div className="flex gap-2 mb-2 text-xs">
                          <div className="border border-black px-2 py-1 flex-1">
                            <div className="font-bold text-gray-700 mb-0.5">SALT INTAKE:</div>
                            <div className="flex items-center gap-1">
                              <input
                                className="w-16 bg-transparent border-none outline-none text-xs"
                                value={formData.saltIntake}
                                onChange={e => setFormData(p => ({ ...p, saltIntake: e.target.value }))}
                                readOnly={readOnly}
                                placeholder="___"
                              />
                              <span className="text-gray-500">GM / DAY</span>
                            </div>
                          </div>
                          <div className="border border-black px-2 py-1 flex-1">
                            <div className="font-bold text-gray-700 mb-0.5">FLUID INTAKE:</div>
                            <div className="flex items-center gap-1">
                              <input
                                className="w-16 bg-transparent border-none outline-none text-xs"
                                value={formData.fluidIntake}
                                onChange={e => setFormData(p => ({ ...p, fluidIntake: e.target.value }))}
                                readOnly={readOnly}
                                placeholder="___"
                              />
                              <span className="text-gray-500">LIT / DAY</span>
                            </div>
                          </div>
                        </div>

                        {/* Notes + Signature */}
                        <div className="flex gap-2 mb-3 text-xs">
                          <div className="border border-black px-2 py-1 flex-1">
                            <div className="font-bold text-gray-700 mb-0.5">NOTES:</div>
                            <textarea
                              className="w-full bg-transparent border-none outline-none text-xs resize-none"
                              rows={3}
                              value={formData.doctorNotes}
                              onChange={e => setFormData(p => ({ ...p, doctorNotes: e.target.value }))}
                              readOnly={readOnly}
                            />
                          </div>
                          <div className="border border-black px-2 py-1 w-40 flex flex-col justify-between">
                            <div className="font-bold text-gray-700 text-xs">DOCTOR'S SIGNATURE</div>
                            <div className="text-center mt-auto">
                              <div className="border-t border-gray-400 pt-1 text-xs font-bold">{prescribedByName}</div>
                            </div>
                          </div>
                        </div>

                        {/* Footer box */}
                        <div className="border-2 border-black text-xs py-2 px-3 text-center">
                          <p className="font-bold mb-1">PRIOR APPOINTMENT AVOIDS WAITING TIME</p>
                          <p className="mb-1">APPT: {footerPhone} | TIME: MON–SAT 9AM – 6PM</p>
                          <p className="border-t border-gray-400 pt-1.5 font-semibold">
                            DR. PAUL | MBBS, MD — {clinicName}
                          </p>
                          <p className="mt-1">EMERGENCY: {emergencyPhone} (24 HRS SERVICE)</p>
                        </div>

                      </div>
                    );
                  })()}

                  {/* PTO note (non-final pages) */}
                  {!isLastPage && (
                    <div className="text-right mt-auto pb-2 text-xs font-bold text-gray-700 italic uppercase">
                      PTO (PLEASE TURN OVER)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer Controls ── */}
        <div className="bg-white p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setShowConfirmCloseModal(true)} className="w-full sm:w-auto px-6 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors order-2 sm:order-1">
            Cancel
          </button>
          <div className="flex flex-1 sm:flex-none gap-3 order-1 sm:order-2">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 sm:px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print PDF
            </button>
            {!readOnly && (
              <button
                onClick={handleSend}
                className="flex-1 sm:flex-none px-4 sm:px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Send to Pharmacy
              </button>
            )}
          </div>
        </div>

      </div>

      {showConfirmSendModal  && <ConfirmSendModal />}
      {showConfirmCloseModal && <ConfirmCloseModal />}
    </div>
  );
};

export default StandardPrescriptionModal;
