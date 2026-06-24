import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase, getProxiedUrl } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import MobilePrescriptionInput from './MobilePrescriptionInput';
import {
  deleteHospitalSavedDrug,
  fetchHospitalSavedDiagnoses,
  fetchHospitalSavedDrugs,
  upsertHospitalSavedDrug,
  upsertHospitalSavedDiagnosis,
} from '../../services/hospitalCatalogService';

interface SavedDrug {
  id: string;
  name: string;
  drug_type?: string;
  default_timing?: string;
  dosages?: string[];
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
  default_timing?: string;
  dosages?: string[];
  isReference?: boolean;
}

interface Medication {
  name: string;
  dosage_value?: string;
  availableDosages?: string[];
  number: string;
  dose: string;
  morning: string;
  morningTime: string;
  morningAmPm: string;
  noon: string;
  noonTime: string;
  noonAmPm: string;
  evening: string;
  eveningTime: string;
  eveningAmPm: string;
  night: string;
  nightTime: string;
  nightAmPm: string;
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
  onSendToPharmacy?: (medications: any[], notes: string, reviewContext?: { nextReviewDate: string | null; testsToReview: string; specialistsToReview: string }, callbackPatientId?: string) => void;
  readOnly?: boolean;
  existingData?: any;
  clinicLogo?: string;
  actorAttribution?: {
    actorType: 'chief' | 'assistant';
    actorDisplayName: string;
  };
  onPrintOpen?: () => void;
  // ── Tenant-driven overrides (injected by KKCPrescriptionModal wrapper) ──
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  emergencyPhone?: string;
  workingHours?: string;
  footerDoctorText?: string;
  specialistOptions?: string[] | null;
  forceDesktop?: boolean;
  /**
   * Force the mobile-input UI on any screen size (used by the enterprise
   * doctor live-queue prescribe flow so doctors on desktop also see the
   * mobile prescription form). After Send is clicked, the desktop preview
   * still overlays as usual for confirmation.
   */
  forceMobile?: boolean;
  /** Force Print PDF behaviour even when readOnly=true (e.g. pharmacy view). */
  forcePrint?: boolean;
}

// Dose mappings for auto-populate: Morning, Noon, Evening, Night
const DOSE_MAPPINGS: Record<string, { morning: string; noon: string; evening: string; night: string }> = {
  'OD': { morning: '1', noon: '0', evening: '0', night: '0' },
  'BD': { morning: '1', noon: '0', evening: '0', night: '1' },
  'TDS': { morning: '1', noon: '1', evening: '0', night: '1' },
  'HS': { morning: '0', noon: '0', evening: '0', night: '1' },
  'QID': { morning: '1', noon: '1', evening: '1', night: '1' },
  'Q6H': { morning: '1', noon: '1', evening: '1', night: '1' },
  '2OD': { morning: '2', noon: '0', evening: '0', night: '0' },
  '2BD': { morning: '2', noon: '0', evening: '0', night: '2' },
  '2TDS': { morning: '2', noon: '2', evening: '0', night: '2' },
  '1/2 OD': { morning: '1/2', noon: '0', evening: '0', night: '0' },
  '1/2 BD': { morning: '1/2', noon: '0', evening: '0', night: '1/2' },
  '1/2 TDS': { morning: '1/2', noon: '1/2', evening: '0', night: '1/2' },
  '1/2 HS': { morning: '0', noon: '0', evening: '0', night: '1/2' },
  // No-space aliases: mobile saves without spaces; these allow auto-populate when editing mobile-saved Rx on desktop
  '1/2OD': { morning: '1/2', noon: '0', evening: '0', night: '0' },
  '1/2BD': { morning: '1/2', noon: '0', evening: '0', night: '1/2' },
  '1/2TDS': { morning: '1/2', noon: '1/2', evening: '0', night: '1/2' },
  '1/2HS': { morning: '0', noon: '0', evening: '0', night: '1/2' },
};

const DOSE_OPTIONS = [
  'OD', 'BD', 'TDS', 'HS', 'Q6H',
  '2OD', '2BD', '2TDS',
  '1/2 OD', '1/2 BD', '1/2 TDS', '1/2 HS',
];

const FOOD_TIMING_OPTIONS = ['nil', 'A/F', 'B/F', 'E/S', 'S/C B/F'];

const ROW_PREVIEW_COLORS = ['#1d4ed8', '#e11d48', '#7e22ce', '#d97706', '#059669'];

interface DuplicateMedicationEntry {
  rowNumber: number;
  dosage: string;
  dose: string;
  frequency: string;
  foodTiming: string;
  quantity: string;
}

interface DuplicateMedicationGroup {
  drugName: string;
  entries: DuplicateMedicationEntry[];
}

const normalizeDrugName = (value: string): string => {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
};

const formatMedicationFrequency = (med: Medication): string => {
  return `${med.morning || '0'}-${med.noon || '0'}-${med.evening || '0'}-${med.night || '0'}`;
};

const findDuplicateMedications = (rows: Medication[]): DuplicateMedicationGroup[] => {
  const grouped = new Map<string, DuplicateMedicationEntry[]>();

  rows.forEach((med, index) => {
    const normalizedName = normalizeDrugName(med.name || '');
    if (!normalizedName) return;

    const entry: DuplicateMedicationEntry = {
      rowNumber: index + 1,
      dosage: med.dosage_value || '--',
      dose: med.dose || '--',
      frequency: formatMedicationFrequency(med),
      foodTiming: med.foodTiming || '--',
      quantity: med.number ? `${med.number} tab` : '--',
    };

    const existing = grouped.get(normalizedName) || [];
    existing.push(entry);
    grouped.set(normalizedName, existing);
  });

  return Array.from(grouped.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([drugName, entries]) => ({ drugName, entries }));
};

// Slot-specific time ranges
const MORNING_TIMES = ['4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM'];
const NOON_TIMES = ['12 PM', '1 PM', '2 PM', '3 PM', '4 PM'];
const EVENING_TIMES = ['5 PM', '6 PM', '7 PM', '8 PM'];
const NIGHT_TIMES = ['7 PM', '8 PM', '9 PM', '10 PM', '11 PM', '12 AM', '1 AM'];

const DEFAULT_SPECIALIST_OPTIONS = [
  'Dr. A. Prabhakar',
  'Dr. A. Divakar'
];

const parseSpecialists = (value: string) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const splitDiagnosis = (value: string) =>
  (value || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

const getReviewDaysLabel = (value: string): string => {
  if (!value) return '';
  const dateOnly = value.split('T')[0];
  const [y, m, d] = dateOnly.split('-').map(Number);
  if (!y || !m || !d) return value;

  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 0) return `In ${diffDays} days`;
  if (diffDays === 0) return 'Today';
  return `${Math.abs(diffDays)} days ago`;
};

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  doctor,
  patient,
  onClose,
  onSendToPharmacy,
  readOnly = false,
  existingData = null,
  clinicLogo,
  actorAttribution,
  onPrintOpen,
  // Tenant-driven overrides (injected by KKCPrescriptionModal wrapper)
  clinicName,
  clinicAddress,
  clinicPhone,
  emergencyPhone,
  workingHours,
  footerDoctorText,
  specialistOptions,
  forceDesktop = false,
  forceMobile = false,
  forcePrint = false,
}) => {
  // Resolve specialist list: prefer tenant-provided, fall back to KKC defaults
  const SPECIALIST_OPTIONS = specialistOptions ?? DEFAULT_SPECIALIST_OPTIONS;

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
    { name: '', dosage_value: '', number: '', dose: '', morning: '', morningTime: '', morningAmPm: '', noon: '', noonTime: '', noonAmPm: '', evening: '', eveningTime: '', eveningAmPm: '', night: '', nightTime: '', nightAmPm: '', foodTiming: '' },
    { name: '', dosage_value: '', number: '', dose: '', morning: '', morningTime: '', morningAmPm: '', noon: '', noonTime: '', noonAmPm: '', evening: '', eveningTime: '', eveningAmPm: '', night: '', nightTime: '', nightAmPm: '', foodTiming: '' },
    { name: '', dosage_value: '', number: '', dose: '', morning: '', morningTime: '', morningAmPm: '', noon: '', noonTime: '', noonAmPm: '', evening: '', eveningTime: '', eveningAmPm: '', night: '', nightTime: '', nightAmPm: '', foodTiming: '' },
    { name: '', dosage_value: '', number: '', dose: '', morning: '', morningTime: '', morningAmPm: '', noon: '', noonTime: '', noonAmPm: '', evening: '', eveningTime: '', eveningAmPm: '', night: '', nightTime: '', nightAmPm: '', foodTiming: '' },
    { name: '', dosage_value: '', number: '', dose: '', morning: '', morningTime: '', morningAmPm: '', noon: '', noonTime: '', noonAmPm: '', evening: '', eveningTime: '', eveningAmPm: '', night: '', nightTime: '', nightAmPm: '', foodTiming: '' }
  ]);

  // Time options for timing dropdowns (removed internal constant, uses outside one)

  const prescribedByName = (() => {
    // Priority 1: live session actor (actorAttribution prop).
    // This covers both live-queue prescriptions AND edit-resend flows where
    // the current user (PA, junior doctor, chief) must be credited — not the
    // actor who wrote the original prescription being edited.
    if (actorAttribution?.actorType === 'assistant') {
      return `Prepared by ${actorAttribution.actorDisplayName}`;
    }
    if (actorAttribution?.actorType === 'chief') {
      // Chief may have a specific display name too (e.g. junior doctor logged in as chief)
      return actorAttribution.actorDisplayName
        ? `Prepared by ${actorAttribution.actorDisplayName}`
        : 'Prepared by Chief Doctor';
    }

    // Priority 2: saved metadata from existingData — used in read-only view
    // (patient app, view-only Rx) where no live actorAttribution is supplied.
    const existingActorType = existingData?.metadata?.actorType;
    const existingPrescribedByName = existingData?.metadata?.actorDisplayName;

    if (existingActorType === 'assistant') {
      return existingPrescribedByName
        ? `Prepared by ${existingPrescribedByName}`
        : 'Prepared by PA';
    }
    if (existingActorType === 'chief') {
      return existingPrescribedByName
        ? `Prepared by ${existingPrescribedByName}`
        : 'Prepared by Chief Doctor';
    }

    // Priority 3: fall back to doctor prop name
    if (doctor?.name) {
      return `Prepared by ${doctor.name}`;
    }
    return '';
  })();

  const reviewDaysLabel = getReviewDaysLabel(formData.reviewDate);

  // Medication and Mobile States
  const [isMobile, setIsMobile] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showSendPreview, setShowSendPreview] = useState(false);
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);
  const [showConfirmCloseModal, setShowConfirmCloseModal] = useState(false);
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState(false);
  const [duplicateMedicationGroups, setDuplicateMedicationGroups] = useState<DuplicateMedicationGroup[]>([]);
  const [showIncompleteWarningModal, setShowIncompleteWarningModal] = useState(false);
  const [incompleteDrugs, setIncompleteDrugs] = useState<{ name: string; missingDosage: boolean; missingFrequency: boolean }[]>([]);
  const [showMissingDiagnosisWarningModal, setShowMissingDiagnosisWarningModal] = useState(false);

  // Saved Drugs State
  const [savedDrugs, setSavedDrugs] = useState<SavedDrug[]>([]);
  const [showDrugDropdown, setShowDrugDropdown] = useState<number | null>(null);
  const [showDosageDropdown, setShowDosageDropdown] = useState<number | null>(null);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugType, setNewDrugType] = useState('');
  const [newDrugDosages, setNewDrugDosages] = useState('');
  const [newDrugDefaultTiming, setNewDrugDefaultTiming] = useState('');
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
  // Keyboard navigation state for all dropdowns
  const [highlightedDropdownIndex, setHighlightedDropdownIndex] = useState(-1);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const diagnosisInputRef = useRef<HTMLInputElement>(null);
  const manageDrugFormRef = useRef<HTMLDivElement>(null);
  const dosageInputRef = useRef<HTMLInputElement>(null);

  // Refs for printing
  const componentRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitializedFromExisting = useRef(false);

  // Helper: scroll highlighted dropdown item into view
  const scrollHighlightedIntoView = useCallback((index: number) => {
    if (dropdownListRef.current) {
      const items = dropdownListRef.current.querySelectorAll('[data-dropdown-item]');
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }
  }, []);

  // Diagnosis tag-chip helpers
  const addDiagnosis = (name: string) => {
    setFormData(prev => {
      const parts = (prev.diagnosis || '').split(',').map(d => d.trim()).filter(Boolean);
      if (!parts.includes(name)) parts.push(name);
      return { ...prev, diagnosis: parts.join(', ') };
    });
    setDiagnosisSearchQuery('');
    setShowDiagnosisDropdown(false);
    setHighlightedDropdownIndex(-1);
  };
  const removeDiagnosis = (index: number) => {
    setFormData(prev => {
      const parts = (prev.diagnosis || '').split(',').map(d => d.trim()).filter(Boolean);
      parts.splice(index, 1);
      return { ...prev, diagnosis: parts.join(', ') };
    });
  };

  // Generic keyboard handler for searchable dropdowns
  const handleDropdownKeyDown = useCallback((
    e: React.KeyboardEvent,
    isOpen: boolean,
    itemCount: number,
    onSelect: (index: number) => void,
    onClose: () => void
  ) => {
    if (!isOpen || itemCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedDropdownIndex(prev => {
        const next = prev < itemCount - 1 ? prev + 1 : 0;
        setTimeout(() => scrollHighlightedIntoView(next), 0);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedDropdownIndex(prev => {
        const next = prev > 0 ? prev - 1 : itemCount - 1;
        setTimeout(() => scrollHighlightedIntoView(next), 0);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedDropdownIndex >= 0 && highlightedDropdownIndex < itemCount) {
        onSelect(highlightedDropdownIndex);
        setHighlightedDropdownIndex(-1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      setHighlightedDropdownIndex(-1);
    } else if (e.key === 'Tab') {
      // Select current highlighted item and let Tab move focus naturally
      if (highlightedDropdownIndex >= 0 && highlightedDropdownIndex < itemCount) {
        onSelect(highlightedDropdownIndex);
      }
      onClose();
      setHighlightedDropdownIndex(-1);
    }
  }, [highlightedDropdownIndex, scrollHighlightedIntoView]);

  // Scaling Logic
  const [layoutState, setLayoutState] = useState({ scale: 1, marginLeft: 0 });

  useEffect(() => {
    const handleResize = () => {
      // Logic for mobile view detection
      const totalWidth = window.innerWidth;
      // forceMobile (set by enterprise doctor live-queue prescribe flow) overrides
      // the width check so even desktops/tablets render the mobile input form.
      setIsMobile(forceMobile || (!forceDesktop && totalWidth < 768));

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
  }, [forceDesktop, forceMobile]);

  useEffect(() => {
    if (!readOnly) {
      if (doctor?.hospital_id || doctor?.hospitalId) {
        fetchSavedDrugs();
        fetchSavedDiagnoses();
      }
    }
  }, [doctor?.id, doctor?.hospital_id, doctor?.hospitalId, readOnly]);

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
      const hospitalId = doctor?.hospital_id || doctor?.hospitalId;
      if (!hospitalId) return;
      const data = await fetchHospitalSavedDrugs(hospitalId);
      setSavedDrugs(data || []);
    } catch (error) {
      console.error('Error fetching saved drugs:', error);
    }
  };

  const fetchSavedDiagnoses = async () => {
    try {
      const hospitalId = doctor?.hospital_id || doctor?.hospitalId;
      if (!hospitalId) return;
      const data = await fetchHospitalSavedDiagnoses(hospitalId);
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

    const parsedDosages = Array.from(
      new Set(
        newDrugDosages
          .split(',')
          .map(d => d.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    setIsSavingDrug(true);
    try {
      const hospitalId = doctor?.hospital_id || doctor?.hospitalId;
      if (!hospitalId) {
        toast.error('Hospital context is missing');
        return;
      }

      if (editingDrug) {
        // Update existing drug
        await upsertHospitalSavedDrug({
          id: editingDrug.id,
          hospitalId,
          doctorId: doctor?.id,
          name: newDrugName.toUpperCase().trim(),
          drugType: newDrugType || undefined,
          defaultTiming: newDrugDefaultTiming || undefined,
          dosages: parsedDosages,
        });
        toast.success('Drug updated successfully');
      } else {
        // Insert new drug
        await upsertHospitalSavedDrug({
          hospitalId,
          doctorId: doctor?.id,
          name: newDrugName.toUpperCase().trim(),
          drugType: newDrugType || undefined,
          defaultTiming: newDrugDefaultTiming || undefined,
          dosages: parsedDosages,
        });
        toast.success('Drug saved successfully');
      }

      // Reset form and refresh list
      setNewDrugName('');
      setNewDrugType('');
      setNewDrugDosages('');
      setNewDrugDefaultTiming('');
      setEditingDrug(null);
      fetchSavedDrugs();
    } catch (error: any) {
      console.error('Error saving drug:', error);
      if (error?.code === '23505') {
        toast.error('This drug already exists');
        return;
      }
      toast.error(error.message || 'Failed to save drug');
    } finally {
      setIsSavingDrug(false);
    }
  };

  const handleDeleteDrug = async (drugId: string) => {
    if (!confirm('Are you sure you want to delete this drug?')) return;

    try {
      const hospitalId = doctor?.hospital_id || doctor?.hospitalId;
      if (!hospitalId) {
        toast.error('Hospital context is missing');
        return;
      }
      await deleteHospitalSavedDrug(hospitalId, drugId);
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
    const defaultTiming = (drug as any).default_timing || '';
    const availableDosages = Array.isArray((drug as any).dosages) ? (drug as any).dosages : [];
    const isSyrup = (drugType || '').toUpperCase() === 'SYP' || drug.name.toUpperCase().startsWith('SYP.');
    newMeds[index] = {
      ...newMeds[index],
      name: `${prefix}${drug.name}`.toUpperCase(),
      drugType: drugType || '',
      availableDosages,
      // Always overwrite drug-specific fields so they don't leak from the
      // previously selected drug. Empty when the new drug has no saved dosage.
      dosage_value: availableDosages.length > 0 ? availableDosages[0] : '',
      dose: isSyrup ? 'ML' : '',
      foodTiming: defaultTiming && defaultTiming !== 'nil' ? defaultTiming : ''
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
      drugType: d.drug_type || '',
      default_timing: d.default_timing || '',
      dosages: d.dosages || [],
      isReference: false
    }))
  ];

  const filteredDrugs = allDrugOptions.filter(drug =>
    drug.name.toLowerCase().includes(drugSearchQuery.toLowerCase()) ||
    (drug.genericName && drug.genericName.toLowerCase().includes(drugSearchQuery.toLowerCase()))
  ).slice(0, 20); // Limit to 20 results for performance

  // If user types a saved drug name manually (without selecting dropdown),
  // hydrate row defaults so dosage dropdown still opens from saved dosage list.
  useEffect(() => {
    if (readOnly || showDrugDropdown !== null) return;

    const normalized = (v: string) =>
      String(v || '')
        .toUpperCase()
        .replace(/^\s*(TAB|CAP|INJ|SYP)\.\s*/, '')
        .trim();

    setMedications(prev => {
      let changed = false;
      const next = prev.map(med => {
        const typed = normalized(med.name);
        if (!typed) return med;

        const matched = savedDrugs.find(d => normalized(d.name) === typed);
        if (!matched) return med;

        const available = Array.isArray(matched.dosages) ? matched.dosages : [];
        const sameDosages =
          Array.isArray(med.availableDosages) &&
          med.availableDosages.length === available.length &&
          med.availableDosages.every((v, i) => v === available[i]);

        const shouldSetDosage = !med.dosage_value && available.length > 0 && !sameDosages;
        const shouldSetTiming = !med.foodTiming && !!matched.default_timing && !sameDosages;

        if (!shouldSetDosage && !shouldSetTiming && sameDosages) return med;

        changed = true;
        return {
          ...med,
          availableDosages: available,
          ...(shouldSetDosage ? { dosage_value: available[0] } : {}),
          ...(shouldSetTiming ? { foodTiming: matched.default_timing } : {})
        };
      });
      return changed ? next : prev;
    });
  }, [savedDrugs, medications, readOnly, showDrugDropdown]);

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

    if (existingData && !hasInitializedFromExisting.current) {
      hasInitializedFromExisting.current = true;
      // Parse Existing Data for Read-Only View
      try {
        // medications
        const parsedMeds = (existingData.medications || []).map((m: any) => {
          const freqs = (m.frequency || '0-0-0').split('-');
          // Parse instruction to foodTiming
          // New saves store foodTiming directly; fall back to parsing instruction for older records
          const instruction = (m.instruction || '').toLowerCase();
          let foodTiming = 'A/F';
          if (m.foodTiming) {
            foodTiming = m.foodTiming;
          } else if (instruction.includes('s/c b/f') || instruction === 's/c b/f') {
            foodTiming = 'S/C B/F';
          } else if (instruction === 'e/s') {
            foodTiming = 'E/S';
          } else if (instruction.includes('before')) {
            foodTiming = 'B/F';
          } else if (instruction.includes('sc a/f') || instruction.includes('sc af') || instruction.includes('s/c a/f')) {
            foodTiming = 'S/C B/F'; // normalise legacy SC variants to closest option
          } else if (instruction.includes('sc') || instruction.includes('s/c')) {
            foodTiming = 'S/C B/F'; // normalise
          } else if (instruction === '' || instruction.includes('nil')) {
            foodTiming = 'nil';
          }

          // Helper to extract clean time and detect AM/PM for legacy/transitionary data
          const getInitialTimeAndAmPm = (rawTime: string, existingAmPm: string, defaultAmPm: string) => {
            const time = (rawTime || '').replace(/\s*(AM|PM)$/i, '').trim();
            const amPmMatch = (rawTime || '').match(/AM|PM/i);
            const amPm = existingAmPm || (amPmMatch ? amPmMatch[0].toUpperCase() : (time ? defaultAmPm : ''));
            return { time, amPm };
          };

          const morning = getInitialTimeAndAmPm(m.morningTime || m.morning_time, m.morningAmPm, 'AM');
          const noon = getInitialTimeAndAmPm(m.noonTime || m.noon_time, m.noonAmPm, 'PM');
          const evening = getInitialTimeAndAmPm(m.eveningTime || m.evening_time, m.eveningAmPm, 'PM');
          const night = getInitialTimeAndAmPm(m.nightTime || m.night_time, m.nightAmPm, 'PM');
          const dosageText = String(m.dosage || '');
          const quantityText = String((m as any).quantity || '');
          const hasTabInDosage = /tab/i.test(dosageText);

          return {
            name: String(m.name || '').toUpperCase(),
            dosage_value: m.dosage_value || (!hasTabInDosage ? dosageText : ''),
            number: quantityText
              ? quantityText.replace(/\s*tabs?/i, '').trim()
              : (hasTabInDosage ? dosageText.replace(/\s*tabs?/i, '').trim() : ''),
            dose: m.dose || '',
            morning: freqs[0] !== '0' ? freqs[0] : '',
            morningTime: morning.time,
            morningAmPm: morning.amPm,
            noon: freqs[1] !== '0' ? freqs[1] : '',
            noonTime: noon.time,
            noonAmPm: noon.amPm,
            evening: freqs[2] !== '0' ? freqs[2] : '',
            eveningTime: evening.time,
            eveningAmPm: evening.amPm,
            night: freqs[3] !== '0' ? freqs[3] : '',
            nightTime: night.time,
            nightAmPm: night.amPm,
            foodTiming
          };
        });
        if (parsedMeds.length > 0) setMedications(parsedMeds);

        // Robust Notes parsing using key delimiters
        const notes = existingData.notes || '';
        const keys = [
          'Place:', 'Phone:', 'Diagnosis:', 'Review:', 'Tests:',
          'SpecialistToReview:', 'SpecialistsToReview:', 'SaltIntake:',
          'FluidIntake:', 'Allergy:', 'DoctorNotes:'
        ];

        const extractField = (str: string, label: string) => {
          const index = str.indexOf(label);
          if (index === -1) return '';
          const start = index + label.length;
          let end = str.length;

          // Find the nearest next key starting from 'start'
          for (const k of keys) {
            const nextIdx = str.indexOf('\n' + k, start);
            if (nextIdx !== -1 && nextIdx < end) {
              end = nextIdx;
            }
            // Also check for keys at start of string if it's the very first part (shouldn't happen here but safe)
          }
          return str.substring(start, end).trim();
        };

        const diagnosis = extractField(notes, 'Diagnosis:');
        const review = existingData.next_review_date || extractField(notes, 'Review:');
        const tests = existingData.tests_to_review || extractField(notes, 'Tests:');
        const specialists = existingData.specialists_to_review
          || extractField(notes, 'SpecialistToReview:')
          || extractField(notes, 'SpecialistsToReview:');
        const place = extractField(notes, 'Place:');
        const phone = extractField(notes, 'Phone:');
        const docNotes = extractField(notes, 'DoctorNotes:');
        const salt = extractField(notes, 'SaltIntake:');
        const fluid = extractField(notes, 'FluidIntake:');
        const allergy = extractField(notes, 'Allergy:');

        setFormData(prev => ({
          ...prev,
          diagnosis,
          reviewDate: review ? review.split('T')[0] : '',
          testsToReview: tests,
          specialistToReview: specialists,
          place: place || prev.place,
          phone: phone || prev.phone,
          doctorNotes: docNotes,
          saltIntake: salt,
          fluidIntake: fluid,
          allergy: allergy || prev.allergy,
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
      onPrintOpen?.();
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 2000); // Wait for 2000ms to ensure styles/Tailwind are fully loaded in the iframe context
      });
    },
    removeAfterPrint: true
  } as any);

  const handleDownloadPdf = async () => {
    const target = componentRef.current;
    if (!target) {
      toast.error('Unable to prepare PDF');
      return;
    }

    try {
      onPrintOpen?.();

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const fileName = `Prescription-${(patient?.name || 'Patient').replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Download PDF failed:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Medicine Handlers
  const addRow = () => {
    if (readOnly) return;
    setMedications([...medications, { name: '', dosage_value: '', number: '', dose: '', morning: '', morningTime: '', morningAmPm: '', noon: '', noonTime: '', noonAmPm: '', evening: '', eveningTime: '', eveningAmPm: '', night: '', nightTime: '', nightAmPm: '', foodTiming: '' }]);
  };

  const removeRow = (index: number) => {
    if (readOnly) return;
    if (medications.length === 1) return;
    const newMeds = [...medications];
    newMeds.splice(index, 1);
    setMedications(newMeds);
  };

  // Reorder a medication up (-1) or down (+1) within the list
  const moveMed = (index: number, direction: -1 | 1) => {
    if (readOnly) return;
    const target = index + direction;
    if (target < 0 || target >= medications.length) return;
    const newMeds = [...medications];
    const [m] = newMeds.splice(index, 1);
    newMeds.splice(target, 0, m);
    setMedications(newMeds);
  };

  const updateMed = (index: number, field: string, value: any) => {
    if (readOnly) return;
    const newMeds = [...medications];
    (newMeds[index] as any)[field] = value;

    // Auto-populate morning/noon/night when dose is selected
    if (field === 'dose' && DOSE_MAPPINGS[value]) {
      const mapping = DOSE_MAPPINGS[value];
      const isSyrup = /^SYP\./i.test(String((newMeds[index] as any).name || ''));
      const applyUnit = (v: string) => (isSyrup && v && v !== '0' ? `${v}ml` : v);
      (newMeds[index] as any).morning = applyUnit(mapping.morning);
      (newMeds[index] as any).noon = applyUnit(mapping.noon);
      (newMeds[index] as any).evening = applyUnit(mapping.evening);
      (newMeds[index] as any).night = applyUnit(mapping.night);
    }

    setMedications(newMeds);
  };

  const continueToSendFlow = () => {
    if (isMobile) {
      // On mobile, show the print preview with confirm overlay
      setShowSendPreview(true);
    } else {
      setShowConfirmSendModal(true);
    }
  };

  // Show confirmation popup instead of sending directly
  const handleSend = () => {
    if (readOnly) return;
    // Flush any uncommitted diagnosis text before showing preview/confirm.
    // Mobile: diagnosisSearchQuery holds the last '/'-segment of the textarea; dedup prevents
    // re-adding it to formData.diagnosis, but this clears the query so the preview doesn't
    // show it twice alongside the committed chip.
    // Desktop: commits any text typed-but-not-Enter'd in the chip input.
    if (diagnosisSearchQuery.trim()) {
      addDiagnosis(diagnosisSearchQuery.trim());
    }

    const diagnosisValue = diagnosisSearchQuery.trim()
      ? [formData.diagnosis, diagnosisSearchQuery.trim()].filter(Boolean).join(', ')
      : formData.diagnosis;
    const hasDiagnosis = diagnosisValue
      .split(',')
      .map(d => d.trim())
      .filter(Boolean)
      .length > 0;

    if (!hasDiagnosis) {
      setShowMissingDiagnosisWarningModal(true);
      return;
    }

    const incomplete = medications
      .filter(m => m.name)
      .map(m => ({
        name: m.name,
        missingDosage: !m.dosage_value,
        missingFrequency: !m.dose && !m.morning && !m.noon && !m.evening && !m.night
      }))
      .filter(m => m.missingDosage || m.missingFrequency);
    if (incomplete.length > 0) {
      setIncompleteDrugs(incomplete);
      setShowIncompleteWarningModal(true);
      return;
    }

    const duplicateGroups = findDuplicateMedications(medications);
    if (duplicateGroups.length > 0) {
      setDuplicateMedicationGroups(duplicateGroups);
      setShowDuplicateWarningModal(true);
      return;
    }

    continueToSendFlow();
  };

  // Actually send to pharmacy after confirmation
  const confirmSendToPharmacy = () => {
    setShowConfirmSendModal(false);
    // Convert to pharmacy format
    const pharmacyMeds = medications.filter(m => m.name).map(m => {
      const freq = `${m.morning || '0'}-${m.noon || '0'}-${m.evening || '0'}-${m.night || '0'}`;
      return {
        name: String(m.name || '').toUpperCase(),
        dosage: m.dosage_value || '',
        dosage_value: m.dosage_value || '',
        quantity: m.number ? `${m.number} tab` : '',
        dose: m.dose,
        frequency: freq,
        morningTime: m.morningTime ? [m.morningTime, (m as any).morningAmPm || 'AM'].filter(Boolean).join(' ') : '',
        noonTime: m.noonTime ? [m.noonTime, (m as any).noonAmPm || 'PM'].filter(Boolean).join(' ') : '',
        eveningTime: m.eveningTime ? [m.eveningTime, (m as any).eveningAmPm || 'PM'].filter(Boolean).join(' ') : '',
        nightTime: m.nightTime ? [m.nightTime, (m as any).nightAmPm || 'PM'].filter(Boolean).join(' ') : '',
        drugType: m.drugType || '',
        duration: 'See Review Date',
        foodTiming: m.foodTiming || '',
        instruction: m.foodTiming === 'B/F' ? 'Before Food' : m.foodTiming === 'A/F' ? 'After Food' : m.foodTiming === 'nil' || !m.foodTiming ? '' : m.foodTiming
      };
    });

    // We pack the extra metadata (Place, Phone, etc) into the notes field so it persists without schema changes
    const notes = `Place: ${formData.place}\nPhone: ${formData.phone}\nDiagnosis: ${formData.diagnosis}\nReview: ${formData.reviewDate}\nTests: ${formData.testsToReview}\nSpecialistToReview: ${formData.specialistToReview}\nSaltIntake: ${formData.saltIntake}\nFluidIntake: ${formData.fluidIntake}\nAllergy: ${formData.allergy}\nDoctorNotes: ${formData.doctorNotes}`;
    if (onSendToPharmacy) {
      onSendToPharmacy(pharmacyMeds, notes, {
        nextReviewDate: formData.reviewDate || null,
        testsToReview: formData.testsToReview || '',
        specialistsToReview: formData.specialistToReview || ''
      }, patient?.id);
    }

    // Auto-save any new diagnoses to the shared hospital catalog in the background.
    // We compare against the already-loaded savedDiagnoses list so we only insert
    // entries that genuinely don't exist yet — no duplicates, no noise for the doctor.
    const hospitalId = doctor?.hospital_id || doctor?.hospitalId;
    const doctorId = doctor?.id;
    if (hospitalId && formData.diagnosis) {
      const existingNormalized = new Set(
        savedDiagnoses.map((d: any) => (d.normalized_name || d.name || '').toUpperCase().trim())
      );
      const newDiagnoses = formData.diagnosis
        .split(',')
        .map((d: string) => d.trim())
        .filter((d: string) => d && !existingNormalized.has(d.toUpperCase()));

      // Fire-and-forget: failures are silent so they never block or confuse the doctor
      newDiagnoses.forEach((diagnosisName: string) => {
        upsertHospitalSavedDiagnosis({ hospitalId, name: diagnosisName, doctorId })
          .catch(() => {/* silently ignore — catalog update is best-effort */});
      });
    }
  };

  const DuplicateMedicationWarningModal = () => (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowDuplicateWarningModal(false)}>
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Duplicate Drug Detected</h3>
            <p className="text-amber-100 text-sm">Review duplicate entries before sending</p>
          </div>
        </div>

        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto space-y-4">
          <p className="text-sm text-gray-700">
            Same drug is entered multiple times in this prescription. Please verify if this is intentional.
          </p>

          {duplicateMedicationGroups.map(group => (
            <div key={group.drugName} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
              <p className="text-sm font-bold text-amber-900 mb-2">{group.drugName}</p>
              <div className="space-y-2">
                {group.entries.map(entry => (
                  <div key={`${group.drugName}-${entry.rowNumber}`} className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Row {entry.rowNumber}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <span>Dosage: <strong>{entry.dosage}</strong></span>
                      <span>Dose: <strong>{entry.dose}</strong></span>
                      <span>Frequency: <strong>{entry.frequency}</strong></span>
                      <span>Food: <strong>{entry.foodTiming}</strong></span>
                      <span>Qty: <strong>{entry.quantity}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => setShowDuplicateWarningModal(false)}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
          >
            Back to Edit
          </button>
          <button
            onClick={() => {
              setShowDuplicateWarningModal(false);
              continueToSendFlow();
            }}
            className="flex-1 px-4 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all active:scale-95"
          >
            Confirm Send Anyway
          </button>
        </div>
      </div>
    </div>
  );

  const IncompleteDrugWarningModal = () => (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowIncompleteWarningModal(false)}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Incomplete Prescription</h3>
            <p className="text-red-100 text-sm">Some drugs are missing required fields</p>
          </div>
        </div>
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-3">
          {incompleteDrugs.map((drug, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="mt-0.5 w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-xs font-bold">{i + 1}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{drug.name}</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {[drug.missingDosage && 'Dosage not entered', drug.missingFrequency && 'Frequency not entered'].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5 pt-2 flex gap-3">
          <button
            onClick={() => setShowIncompleteWarningModal(false)}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
          >
            Go Back & Fix
          </button>
          <button
            onClick={() => {
              setShowIncompleteWarningModal(false);
              const duplicateGroups = findDuplicateMedications(medications);
              if (duplicateGroups.length > 0) {
                setDuplicateMedicationGroups(duplicateGroups);
                setShowDuplicateWarningModal(true);
              } else {
                continueToSendFlow();
              }
            }}
            className="flex-1 px-4 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all active:scale-95"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );

  const MissingDiagnosisWarningModal = () => (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowMissingDiagnosisWarningModal(false)}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Diagnosis Required</h3>
            <p className="text-red-100 text-sm">Add a diagnosis before sending</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            This prescription has no diagnosis. Please add at least one diagnosis before sending it to the pharmacy.
          </p>
        </div>
        <div className="px-6 pb-5">
          <button
            onClick={() => {
              setShowMissingDiagnosisWarningModal(false);
              requestAnimationFrame(() => diagnosisInputRef.current?.focus());
            }}
            className="w-full px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95"
          >
            Add Diagnosis
          </button>
        </div>
      </div>
    </div>
  );

  // Confirmation Modal Component (shared between mobile and desktop)
  const ConfirmSendModal = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmSendModal(false)}>
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Send to Pharmacy</h3>
            <p className="text-emerald-100 text-sm">Confirm prescription submission</p>
          </div>
        </div>

        {/* Patient Identity Banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm font-bold text-blue-900">
            Sending for: {patient?.name || 'Unknown'}
            {patient?.mr_number && <span className="ml-1">(MR: {patient.mr_number})</span>}
            {patient?.token_number && <span className="ml-1">| Token: {patient.token_number}</span>}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-sm leading-relaxed">
            Are you sure you want to send this prescription to the <strong>Pharmacy</strong>?
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => setShowConfirmSendModal(false)}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={confirmSendToPharmacy}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Yes, Send
          </button>
        </div>
      </div>
    </div>
  );

  // Confirmation Modal for closing the prescription (shared between mobile and desktop)
  const ConfirmCloseModal = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirmCloseModal(false)}>
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Close Prescription</h3>
            <p className="text-emerald-100 text-sm">Confirm before closing</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-sm leading-relaxed">
            Are you sure you want to <strong>close</strong> this prescription? Any unsaved changes will be lost.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={() => setShowConfirmCloseModal(false)}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
          >
            Go Back
          </button>
          <button
            onClick={() => { setShowConfirmCloseModal(false); onClose(); }}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Yes, Close
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile && !showPrintView && !showSendPreview) {
    return (
      <>
        <MobilePrescriptionInput
          patient={patient}
          medications={medications}
          updateMed={updateMed}
          addRow={addRow}
          removeRow={removeRow}
          moveMed={moveMed}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowConfirmCloseModal(true)}
          onPrint={() => setShowPrintView(true)}
          onSend={handleSend}
          readOnly={readOnly}
          savedDiagnoses={savedDiagnoses}
          diagnosisSearchQuery={diagnosisSearchQuery}
          setDiagnosisSearchQuery={setDiagnosisSearchQuery}
          showDiagnosisDropdown={showDiagnosisDropdown}
          setShowDiagnosisDropdown={setShowDiagnosisDropdown}
          drugSearchQuery={drugSearchQuery}
          setDrugSearchQuery={setDrugSearchQuery}
          filteredDrugs={filteredDrugs}
          handleSelectDrug={handleSelectDrug}
          showDrugDropdown={showDrugDropdown}
          setShowDrugDropdown={setShowDrugDropdown}
          SPECIALIST_OPTIONS={SPECIALIST_OPTIONS}
        />
        {showIncompleteWarningModal && <IncompleteDrugWarningModal />}
        {showDuplicateWarningModal && <DuplicateMedicationWarningModal />}
        {showMissingDiagnosisWarningModal && <MissingDiagnosisWarningModal />}
        {showConfirmSendModal && <ConfirmSendModal />}
        {showConfirmCloseModal && <ConfirmCloseModal />}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-scale-in">


        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100" ref={containerRef}>


          <div
            ref={componentRef}
            translate="no"
            className="notranslate print-content bg-white shadow-sm p-4 max-w-[210mm] text-black w-full origin-top-left"
            style={{
              fontFamily: 'Tahoma, Geneva, sans-serif',
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
              
              /* Critical Layout Fixes for Print */
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
              .w-28 { width: 112px !important; }
              .w-14 { width: 56px !important; }
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
              
              /* Font Sizes */
              .text-base { font-size: 16px !important; }
              .text-sm { font-size: 14px !important; }
              .text-xs { font-size: 12px !important; }
              .text-\[10px\] { font-size: 10px !important; }
              .text-\[11px\] { font-size: 11px !important; }
              .text-\[9px\] { font-size: 9px !important; }
              
              /* Padding/Spacing */
              .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
              .py-1\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
              .px-0\.5 { padding-left: 2px !important; padding-right: 2px !important; }
              .px-1 { padding-left: 4px !important; padding-right: 4px !important; }
              .px-1\.5 { padding-left: 6px !important; padding-right: 6px !important; }
              .mb-1 { margin-bottom: 4px !important; }
              .mb-4 { margin-bottom: 16px !important; }

              /* Auto-height for textareas in print */
              textarea {
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                font-size: 12px !important;
                word-break: break-word !important;
                overflow-wrap: break-word !important;
              }

              /* Responsive drug name sizing */
              textarea[style*="clamp"] {
                font-size: 12px !important;
              }


              /* Dropdown and display text sizing */
              .line-clamp-2 {
                display: -webkit-box !important;
                -webkit-line-clamp: 2 !important;
                -webkit-box-orient: vertical !important;
              }
            }
          `}</style>
            {(() => {
              const FIRST_PAGE_ITEMS = 12;
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
                          <div className="absolute top-0 right-0 text-xs font-bold text-gray-500 uppercase">
                            PAGE {pageIndex + 1} OF {chunks.length}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Patient Details Grid Box - Only on Page 1 — compact 4-row layout */}
                    {pageIndex === 0 && (
                      <div className="border-2 border-black mb-2 text-xs font-bold" style={{ borderCollapse: 'collapse' }}>
                        {/* Row 1: NAME | AGE | MR NO — unified flex/label widths so vertical dividers
                            align with Row 2 (FATHER/HUSBAND | PLACE | DATE) */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="flex-[2] flex border-r border-black min-w-0">
                            <div className="w-28 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[11px] leading-tight">பெயர் / NAME</div>
                            <div className="flex-1 py-1 px-1.5 uppercase flex items-center min-w-0">{patient.name}</div>
                          </div>
                          <div className="flex-1 flex border-r border-black min-w-0">
                            <div className="w-20 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[10px] leading-tight">வயது / AGE / M/F</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center uppercase min-w-0">{patient.age}{patient.gender ? ` / ${patient.gender}` : ''}</div>
                          </div>
                          <div className="flex-1 flex min-w-0">
                            <div className="w-16 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[10px]">MR. NO</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center uppercase min-w-0">{patient.mr_number || ''}</div>
                          </div>
                        </div>
                        {/* Row 2: FATHER/HUSBAND | PLACE | DATE — same widths as Row 1 */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="flex-[2] flex border-r border-black min-w-0">
                            <div className="w-28 py-1 px-1.5 text-[10px] border-r border-black bg-gray-50 print:bg-white flex items-center leading-tight">தகப்பன்/கணவன் FATHER/HUSBAND</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent min-w-0"
                              value={formData.fatherName}
                              onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                            />
                          </div>
                          <div className="flex-1 flex border-r border-black min-w-0">
                            <div className="w-20 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[10px]">PLACE</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-normal bg-transparent min-w-0"
                              value={formData.place}
                              onChange={e => setFormData({ ...formData, place: e.target.value })}
                            />
                          </div>
                          <div className="flex-1 flex min-w-0">
                            <div className="w-16 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[10px]">DATE</div>
                            <div className="flex-1 py-1 px-1.5 flex items-center min-w-0">{(readOnly && existingData?.created_at) ? new Date(existingData.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</div>
                          </div>
                        </div>
                        {/* Row 3: ALLERGY — label width matches column 1 of rows above */}
                        <div className="flex border-b border-black min-h-[24px]">
                          <div className="flex-1 flex">
                            <div className="w-28 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[11px] leading-tight">ALLERGY</div>
                            <input
                              className="flex-1 py-1 px-1.5 outline-none font-bold text-red-600 bg-transparent uppercase"
                              value={formData.allergy}
                              onChange={e => setFormData({ ...formData, allergy: e.target.value.toUpperCase() })}
                            />
                          </div>
                        </div>
                        {/* Row 4: DIAGNOSIS — label width matches column 1 of rows above */}
                        <div className="flex min-h-[48px]">
                          <div className="flex-1 flex relative">
                            <div className="w-28 py-1 px-1.5 border-r border-black bg-gray-50 print:bg-white flex items-center text-[11px] leading-tight">வியாதிகள் / DIAGNOSIS</div>
                            <div className="flex-1 relative flex">
                              {readOnly ? (
                                <div className="flex-1 py-1 px-1.5 font-bold w-full bg-transparent leading-tight uppercase break-words min-h-[1.5em] flex flex-wrap gap-x-2 gap-y-0.5 items-start content-start" style={{ fontFamily: 'Tahoma, Geneva, sans-serif' }}>
                                  {formData.diagnosis
                                    ? formData.diagnosis.split(',').map(d => d.trim()).filter(Boolean).map((d, i, arr) => (
                                      <span key={i} className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
                                        <span className="text-gray-400 font-black" style={{ fontSize: '0.65em' }}>{i + 1}.</span>
                                        <span>{d}{i < arr.length - 1 ? ',' : ''}</span>
                                      </span>
                                    ))
                                    : null}
                                </div>
                              ) : (
                                <div
                                  className="flex-1 py-1 px-1.5 font-bold w-full bg-transparent leading-tight uppercase break-words min-h-[1.5em] flex flex-wrap gap-x-2 gap-y-0.5 items-center content-start cursor-text"
                                  style={{ fontFamily: 'Tahoma, Geneva, sans-serif' }}
                                  onClick={() => diagnosisInputRef.current?.focus()}
                                >
                                  {(formData.diagnosis || '').split(',').map(d => d.trim()).filter(Boolean).map((d, i, arr) => (
                                    <span key={i} className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
                                      <span className="text-gray-400 font-black" style={{ fontSize: '0.65em' }}>{i + 1}.</span>
                                      <span>{d}</span>
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={e => { e.preventDefault(); removeDiagnosis(i); }}
                                        className="ml-0.5 text-gray-300 hover:text-red-400 font-black leading-none"
                                        style={{ fontSize: '0.85em' }}
                                      >×</button>
                                      {i < arr.length - 1 && <span className="-ml-1 mr-1">,</span>}
                                    </span>
                                  ))}
                                  <input
                                    ref={diagnosisInputRef}
                                    className="outline-none bg-transparent font-bold uppercase leading-tight min-w-[60px] flex-1"
                                    style={{ fontSize: 'inherit' }}
                                    value={diagnosisSearchQuery}
                                    onChange={e => {
                                      const val = e.target.value.toUpperCase();
                                      setDiagnosisSearchQuery(val);
                                      setShowDiagnosisDropdown(true);
                                      setHighlightedDropdownIndex(-1);
                                    }}
                                    onFocus={() => {
                                      setShowDiagnosisDropdown(true);
                                      setHighlightedDropdownIndex(-1);
                                    }}
                                    onBlur={() => setTimeout(() => setShowDiagnosisDropdown(false), 200)}
                                    onKeyDown={e => {
                                      const selectedDiags = (formData.diagnosis || '').split(',').map(d => d.trim()).filter(Boolean);
                                      const filteredDiags = savedDiagnoses.filter(d => {
                                        const matchesQuery = d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase());
                                        const notSelected = !selectedDiags.includes(d.name);
                                        return matchesQuery && notSelected;
                                      });
                                      const isDropdownOpen = showDiagnosisDropdown && filteredDiags.length > 0;

                                      if (e.key === 'Backspace' && !diagnosisSearchQuery) {
                                        const parts = (formData.diagnosis || '').split(',').map(d => d.trim()).filter(Boolean);
                                        if (parts.length > 0) removeDiagnosis(parts.length - 1);
                                        return;
                                      }
                                      if (e.key === 'ArrowDown' && isDropdownOpen) {
                                        e.preventDefault();
                                        setHighlightedDropdownIndex(prev => {
                                          const next = prev < filteredDiags.length - 1 ? prev + 1 : 0;
                                          setTimeout(() => scrollHighlightedIntoView(next), 0);
                                          return next;
                                        });
                                      } else if (e.key === 'ArrowUp' && isDropdownOpen) {
                                        e.preventDefault();
                                        setHighlightedDropdownIndex(prev => {
                                          const next = prev > 0 ? prev - 1 : filteredDiags.length - 1;
                                          setTimeout(() => scrollHighlightedIntoView(next), 0);
                                          return next;
                                        });
                                      } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (isDropdownOpen && highlightedDropdownIndex >= 0 && highlightedDropdownIndex < filteredDiags.length) {
                                          addDiagnosis(filteredDiags[highlightedDropdownIndex].name);
                                        } else if (diagnosisSearchQuery.trim()) {
                                          addDiagnosis(diagnosisSearchQuery.trim());
                                        }
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setShowDiagnosisDropdown(false);
                                        setHighlightedDropdownIndex(-1);
                                      } else if (e.key === 'Tab') {
                                        if (isDropdownOpen && highlightedDropdownIndex >= 0 && highlightedDropdownIndex < filteredDiags.length) {
                                          e.preventDefault();
                                          addDiagnosis(filteredDiags[highlightedDropdownIndex].name);
                                        } else if (diagnosisSearchQuery.trim()) {
                                          addDiagnosis(diagnosisSearchQuery.trim());
                                        }
                                        setShowDiagnosisDropdown(false);
                                        setHighlightedDropdownIndex(-1);
                                      }
                                    }}
                                    placeholder={formData.diagnosis ? '' : 'Type diagnosis...'}
                                  />
                                </div>
                              )}
                              {(() => {
                                // Get already selected diagnoses
                                const selectedDiags = (formData.diagnosis || '')
                                  .split(',')
                                  .map(d => d.trim())
                                  .filter(Boolean);

                                // Filter: match current query AND exclude already selected
                                const filteredDiags = savedDiagnoses.filter(d => {
                                  const matchesQuery = d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase());
                                  const notSelected = !selectedDiags.includes(d.name);
                                  return matchesQuery && notSelected;
                                });

                                return showDiagnosisDropdown && diagnosisSearchQuery.length > 0 && filteredDiags.length > 0 && (
                                  <div ref={dropdownListRef} className="absolute left-0 right-0 top-full z-[100] bg-white border-2 border-black shadow-xl max-h-48 overflow-y-auto">
                                    {filteredDiags.map((diag, dIdx) => (
                                      <button
                                        key={diag.id}
                                        type="button"
                                        data-dropdown-item
                                        className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-gray-100 last:border-0 ${highlightedDropdownIndex === dIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}
                                        onMouseDown={() => {
                                          addDiagnosis(diag.name);
                                        }}
                                        onMouseEnter={() => setHighlightedDropdownIndex(dIdx)}
                                      >
                                        {diag.name}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Medicine Table Box */}
                    {chunk.length > 0 && (
                      <div className={`border-2 border-black flex flex-col ${pageIndex < chunks.length - 1 ? 'flex-1 mb-1' : 'mb-4'}`}>
                        <div className="text-center font-bold border-b border-black py-1 text-base shrink-0">
                          மருந்துகள் பரிந்துரை விபரம் - MEDICINES PRESCRIPTION DETAILS
                        </div>

                        {/* Table Headers */}
                        <div className="flex border-b border-black text-center font-bold text-base shrink-0">
                          <div className="w-12 border-r border-black py-1.5 flex items-center justify-center shrink-0">
                            வ.எ<br />S.N
                          </div>
                          <div className="flex-1 border-r border-black py-1.5 flex items-center justify-center min-w-0 px-1.5">
                            மருந்துக்கள் / DRUGS
                          </div>
                          <div className="w-16 border-r border-black py-1.5 flex items-center justify-center shrink-0 text-[10px]">
                            DOSAGE
                          </div>
                          <div className="w-[398px] shrink-0 flex flex-col uppercase">
                            <div className="border-b border-black py-1 text-base uppercase">எத்தனை முறை - FREQUENCY</div>
                            <div className="flex flex-1 items-stretch uppercase">
                              <div className="w-16 border-r border-black py-1 text-xs flex flex-col items-center justify-center shrink-0 leading-tight uppercase">
                                <span>QTY</span>
                                <span>எண்</span>
                              </div>
                              <div className="w-10 border-r border-black py-1 text-xs flex flex-col items-center justify-center shrink-0 leading-tight uppercase">
                                <span>FREQ</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight uppercase">
                                <span>M</span>
                                <span>கா</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight uppercase">
                                <span>N</span>
                                <span>ம</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight uppercase">
                                <span>E</span>
                                <span>மா</span>
                              </div>
                              <div className="w-14 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight uppercase">
                                <span>NT</span>
                                <span>இ</span>
                              </div>
                              <div className="flex-1 py-1 text-xs px-0.5 flex flex-col items-center justify-center leading-tight">
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
                            const previewColor = showSendPreview ? ROW_PREVIEW_COLORS[globalIndex % ROW_PREVIEW_COLORS.length] : '';

                            return (
                              <div
                                key={globalIndex}
                                className={`flex border-b border-black ${shouldExpandRow ? 'flex-1 items-stretch' : 'py-1 min-h-[40px]'} text-xs relative group`}
                                style={previewColor ? { color: previewColor } : undefined}
                              >
                                <div className="w-12 border-r border-black py-1 text-center flex items-center justify-center shrink-0">
                                  {globalIndex + 1}
                                </div>
                                <div className={`flex-1 border-r border-black px-1.5 relative min-w-0 flex items-center`} ref={el => { dropdownRefs.current[globalIndex] = el; }}>
                                  {readOnly ? (
                                    <div
                                      className="w-full font-bold uppercase leading-tight py-1 whitespace-pre-wrap break-words"
                                      style={{ fontSize: med.name && med.name.length > 20 ? 'clamp(9px, 1.8vw, 12px)' : 'clamp(10px, 2vw, 14px)' }}
                                    >
                                      {med.name}
                                    </div>
                                  ) : (
                                  <textarea
                                    className={"w-full outline-none font-bold uppercase bg-transparent resize-none leading-tight py-1 overflow-hidden word-break overflow-wrap break-words"}
                                    style={{ fontSize: med.name && med.name.length > 20 ? 'clamp(9px, 1.8vw, 12px)' : 'clamp(10px, 2vw, 14px)' }}
                                    placeholder="Type drug name..."
                                    value={med.name}
                                    rows={2}
                                    onChange={e => {
                                      const val = e.target.value.toUpperCase();
                                      updateMed(globalIndex, 'name', val);
                                      setDrugSearchQuery(val);
                                      setHighlightedDropdownIndex(-1);
                                      if (!readOnly && allDrugOptions.length > 0) {
                                        setShowDrugDropdown(globalIndex);
                                      }
                                    }}
                                    onFocus={() => {
                                      if (!readOnly && allDrugOptions.length > 0) {
                                        setShowDrugDropdown(globalIndex);
                                        setDrugSearchQuery(med.name.toUpperCase());
                                        setHighlightedDropdownIndex(-1);
                                      }
                                    }}
                                    onKeyDown={e => handleDropdownKeyDown(
                                      e,
                                      showDrugDropdown === globalIndex && filteredDrugs.length > 0,
                                      filteredDrugs.length,
                                      (idx) => {
                                        const drug = filteredDrugs[idx];
                                        if (drug) {
                                          handleSelectDrug(globalIndex, drug as SavedDrug);
                                        }
                                      },
                                      () => setShowDrugDropdown(null)
                                    )}
                                    readOnly={readOnly}
                                  />
                                  )}
                                  {!readOnly && showDrugDropdown === globalIndex && filteredDrugs.length > 0 && (
                                    <div ref={dropdownListRef} className="absolute left-0 top-full z-[100] w-[400px] bg-white border-2 border-black shadow-xl max-h-64 overflow-y-auto print:hidden">
                                      {filteredDrugs.map((drug, dIdx) => (
                                        <button
                                          key={drug.id}
                                          type="button"
                                          data-dropdown-item
                                          className={`w-full px-3 py-2 text-left border-b border-gray-100 last:border-0 ${highlightedDropdownIndex === dIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}
                                          onMouseDown={() => handleSelectDrug(globalIndex, drug as SavedDrug)}
                                          onMouseEnter={() => setHighlightedDropdownIndex(dIdx)}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 line-clamp-2" style={{ fontSize: drug.name && drug.name.length > 20 ? 'clamp(9px, 1.2vw, 12px)' : 'clamp(12px, 1.5vw, 14px)' }}>{drug.name}</span>
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
                                    {/* Reorder buttons */}
                                    {!readOnly && medications.length > 1 && (
                                      <>
                                        <button onClick={() => moveMed(globalIndex, -1)} disabled={globalIndex === 0}
                                          className={`font-bold px-1 ${globalIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-800'}`} title="Move up">↑</button>
                                        <button onClick={() => moveMed(globalIndex, 1)} disabled={globalIndex === medications.length - 1}
                                          className={`font-bold px-1 ${globalIndex === medications.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-800'}`} title="Move down">↓</button>
                                      </>
                                    )}
                                    {/* Add row button - only on last medication */}
                                    {!readOnly && globalIndex === medications.length - 1 && (
                                      <button onClick={addRow} className="text-emerald-500 hover:text-emerald-700 font-bold text-lg px-1" title="Add medication">+</button>
                                    )}
                                    {medications.length > 1 && (
                                      <button onClick={() => removeRow(globalIndex)} className="text-red-500 hover:text-red-700 font-bold px-1" title="Remove">×</button>
                                    )}
                                  </div>
                                </div>
                                {/* DOSAGE (e.g. 500mg, 10ml) - Searchable ComboBox */}
                                <div className="w-16 border-r border-black flex items-center justify-center shrink-0 relative">
                                  {readOnly ? (
                                    <div className="w-full text-center py-1 px-1 font-bold text-[13px] uppercase leading-tight">
                                      {med.dosage_value || ''}
                                    </div>
                                  ) : (
                                  <input
                                    className="w-full h-full outline-none text-center bg-transparent py-1 px-1 font-bold text-[13px] uppercase"
                                    placeholder={readOnly ? '' : 'MG'}
                                    value={med.dosage_value || ''}
                                    onChange={(e) => {
                                      updateMed(globalIndex, 'dosage_value', e.target.value);
                                      !readOnly && med.availableDosages && med.availableDosages.length > 0 && setShowDosageDropdown(globalIndex);
                                    }}
                                    onFocus={() => !readOnly && med.availableDosages && med.availableDosages.length > 0 && setShowDosageDropdown(globalIndex)}
                                    onBlur={() => setTimeout(() => setShowDosageDropdown(null), 150)}
                                    readOnly={readOnly}
                                  />
                                  )}
                                  {!readOnly && showDosageDropdown === globalIndex && med.availableDosages && med.availableDosages.length > 0 && (
                                    <div className="absolute left-0 top-full mt-1 z-50 w-20 bg-white border border-gray-200 rounded-lg shadow-xl max-h-32 overflow-y-auto print:hidden">
                                      {med.availableDosages.map((opt: string, dIdx: number) => (
                                        <button

                                          type="button"
                                          key={`${opt}-${dIdx}`}
                                          data-dropdown-item
                                          onMouseDown={() => {
                                            updateMed(globalIndex, 'dosage_value', opt);
                                            setShowDosageDropdown(null);
                                          }}
                                          className="w-full px-2 py-1.5 text-left text-[9px] font-bold border-b border-gray-50 last:border-0 hover:bg-emerald-50"
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="w-[398px] flex shrink-0 items-stretch">
                                  {/* Quantity */}
                                  <div className="w-16 border-r border-black px-0.5 flex items-center justify-center shrink-0">
                                    {readOnly ? (
                                      <div className="w-full text-center text-xs font-bold uppercase leading-tight">{med.number}</div>
                                    ) : (
                                    <input
                                      className="w-full text-center outline-none text-xs bg-transparent font-bold uppercase"
                                      placeholder={readOnly ? '' : '1'}
                                      value={med.number}
                                      onChange={e => updateMed(globalIndex, 'number', e.target.value.toUpperCase())}
                                      readOnly={readOnly}
                                    />
                                    )}
                                  </div>
                                  {/* Frequency - Searchable ComboBox */}
                                  <div className="w-10 border-r border-black px-0.5 flex items-center justify-center shrink-0 relative">
                                    {readOnly ? (
                                      <div className="w-full text-center text-[11px] font-bold uppercase leading-tight">{med.dose}</div>
                                    ) : (
                                    <input
                                      className={"w-full text-center outline-none text-[11px] font-bold uppercase bg-transparent"}
                                      value={med.dose}
                                      onChange={e => {
                                        const val = e.target.value.toUpperCase();
                                        updateMed(globalIndex, 'dose', val);
                                        setDoseSearchQuery(val);
                                        setHighlightedDropdownIndex(-1);
                                        !readOnly && setShowDoseDropdown(globalIndex);
                                      }}
                                      onFocus={() => !readOnly && (setShowDoseDropdown(globalIndex), setDoseSearchQuery(''), setHighlightedDropdownIndex(-1))}
                                      onBlur={() => setTimeout(() => setShowDoseDropdown(null), 150)}
                                      onKeyDown={e => {
                                        const filtered = DOSE_OPTIONS.filter(opt => !doseSearchQuery || opt.toUpperCase().includes(doseSearchQuery));
                                        handleDropdownKeyDown(
                                          e,
                                          showDoseDropdown === globalIndex,
                                          filtered.length,
                                          (idx) => { updateMed(globalIndex, 'dose', filtered[idx]); setShowDoseDropdown(null); },
                                          () => setShowDoseDropdown(null)
                                        );
                                      }}
                                      readOnly={readOnly}
                                      placeholder="--"
                                    />
                                    )}
                                    {!readOnly && showDoseDropdown === globalIndex && (() => {
                                      const filtered = DOSE_OPTIONS.filter(opt => !doseSearchQuery || opt.toUpperCase().includes(doseSearchQuery));
                                      return filtered.length > 0 && (
                                        <div ref={dropdownListRef} className="absolute left-0 top-full z-50 w-24 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto print:hidden">
                                          {filtered.map((opt, oIdx) => (
                                            <button type="button" key={opt} data-dropdown-item onMouseDown={() => { updateMed(globalIndex, 'dose', opt); setShowDoseDropdown(null); }} onMouseEnter={() => setHighlightedDropdownIndex(oIdx)} className={`w-full px-2 py-1.5 text-left text-xs font-bold border-b border-gray-50 last:border-0 ${highlightedDropdownIndex === oIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  {/* M dosage container - Split: Top time, Bottom value */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      {readOnly ? (
                                        <div className="w-full text-center text-[10px] font-bold uppercase leading-tight">
                                          {(med as any).morningTime ? `${(med as any).morningTime}${(med as any).morningAmPm ? ' ' + (med as any).morningAmPm : ''}` : ''}
                                        </div>
                                      ) : (
                                      <input
                                        className="w-full text-center text-[10px] font-bold outline-none bg-transparent uppercase"
                                        placeholder=""
                                        value={((med as any).morningTime ? `${(med as any).morningTime}${(med as any).morningAmPm ? ' ' + (med as any).morningAmPm : ''}` : '')}
                                        onChange={e => { updateMed(globalIndex, 'morningTime', e.target.value.toUpperCase()); setTimeSearchQuery(e.target.value.toUpperCase()); setHighlightedDropdownIndex(-1); }}
                                        onFocus={() => !readOnly && (setShowTimeDropdown({ index: globalIndex, field: 'morningTime' }), setTimeSearchQuery(''), setHighlightedDropdownIndex(-1))}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        onKeyDown={e => {
                                          const filtered = MORNING_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                          handleDropdownKeyDown(e, showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'morningTime', filtered.length, (idx) => { updateMed(globalIndex, 'morningTime', filtered[idx]); setShowTimeDropdown(null); }, () => setShowTimeDropdown(null));
                                        }}
                                        readOnly={readOnly}
                                      />
                                      )}
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'morningTime' && (() => {
                                        const filtered = MORNING_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                        return filtered.length > 0 && (
                                          <div ref={dropdownListRef} className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                            {filtered.map((t, tIdx) => (
                                              <button type="button" key={t} data-dropdown-item onMouseDown={() => { updateMed(globalIndex, 'morningTime', t); setShowTimeDropdown(null); }} onMouseEnter={() => setHighlightedDropdownIndex(tIdx)} className={`w-full px-1 py-1 text-left text-[9px] border-b border-gray-50 last:border-0 ${highlightedDropdownIndex === tIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                                                {t}
                                              </button>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      {readOnly ? (
                                        <div className="w-full text-center text-xs font-bold leading-tight uppercase">
                                          {med.morning && med.morning !== '0' ? med.morning : '-'}
                                        </div>
                                      ) : (
                                      <textarea
                                        className={"w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight uppercase"}
                                        placeholder={readOnly ? '' : '0'}
                                        value={med.morning}
                                        onChange={e => updateMed(globalIndex, 'morning', e.target.value.toUpperCase())}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                      )}
                                    </div>
                                  </div>
                                  {/* N dosage container - Split: Top time, Bottom value */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      {readOnly ? (
                                        <div className="w-full text-center text-[10px] font-bold uppercase leading-tight">
                                          {(med as any).noonTime ? `${(med as any).noonTime}${(med as any).noonAmPm ? ' ' + (med as any).noonAmPm : ''}` : ''}
                                        </div>
                                      ) : (
                                      <input
                                        className="w-full text-center text-[10px] font-bold outline-none bg-transparent uppercase"
                                        placeholder=""
                                        value={((med as any).noonTime ? `${(med as any).noonTime}${(med as any).noonAmPm ? ' ' + (med as any).noonAmPm : ''}` : '')}
                                        onChange={e => { updateMed(globalIndex, 'noonTime', e.target.value.toUpperCase()); setTimeSearchQuery(e.target.value.toUpperCase()); setHighlightedDropdownIndex(-1); }}
                                        onFocus={() => !readOnly && (setShowTimeDropdown({ index: globalIndex, field: 'noonTime' }), setTimeSearchQuery(''), setHighlightedDropdownIndex(-1))}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        onKeyDown={e => {
                                          const filtered = NOON_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                          handleDropdownKeyDown(e, showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'noonTime', filtered.length, (idx) => { updateMed(globalIndex, 'noonTime', filtered[idx]); setShowTimeDropdown(null); }, () => setShowTimeDropdown(null));
                                        }}
                                        readOnly={readOnly}
                                      />
                                      )}
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'noonTime' && (() => {
                                        const filtered = NOON_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                        return filtered.length > 0 && (
                                          <div ref={dropdownListRef} className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                            {filtered.map((t, tIdx) => (
                                              <button type="button" key={t} data-dropdown-item onMouseDown={() => { updateMed(globalIndex, 'noonTime', t); setShowTimeDropdown(null); }} onMouseEnter={() => setHighlightedDropdownIndex(tIdx)} className={`w-full px-1 py-1 text-left text-[9px] border-b border-gray-50 last:border-0 ${highlightedDropdownIndex === tIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                                                {t}
                                              </button>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      {readOnly ? (
                                        <div className="w-full text-center text-xs font-bold leading-tight uppercase">
                                          {med.noon && med.noon !== '0' ? med.noon : '-'}
                                        </div>
                                      ) : (
                                      <textarea
                                        className={"w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight uppercase"}
                                        placeholder={readOnly ? '' : '0'}
                                        value={med.noon}
                                        onChange={e => updateMed(globalIndex, 'noon', e.target.value.toUpperCase())}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                      )}
                                    </div>
                                  </div>
                                  {/* evening dosage container */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      {readOnly ? (
                                        <div className="w-full text-center text-[10px] font-bold uppercase leading-tight">
                                          {med.eveningTime ? `${med.eveningTime}${(med as any).eveningAmPm ? ' ' + (med as any).eveningAmPm : ''}` : ''}
                                        </div>
                                      ) : (
                                      <input
                                        className="w-full text-center text-[10px] font-bold outline-none bg-transparent"
                                        placeholder=""
                                        value={(med.eveningTime ? `${med.eveningTime}${(med as any).eveningAmPm ? ' ' + (med as any).eveningAmPm : ''}` : '')}
                                        onChange={e => { updateMed(globalIndex, 'eveningTime', e.target.value); setTimeSearchQuery(e.target.value); setHighlightedDropdownIndex(-1); }}
                                        onFocus={() => !readOnly && (setShowTimeDropdown({ index: globalIndex, field: 'eveningTime' }), setHighlightedDropdownIndex(-1))}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        onKeyDown={e => {
                                          const filtered = EVENING_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                          handleDropdownKeyDown(e, showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'eveningTime', filtered.length, (idx) => { updateMed(globalIndex, 'eveningTime', filtered[idx]); setShowTimeDropdown(null); }, () => setShowTimeDropdown(null));
                                        }}
                                        readOnly={readOnly}
                                      />
                                      )}
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'eveningTime' && (() => {
                                        const filtered = EVENING_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                        return filtered.length > 0 && (
                                          <div ref={dropdownListRef} className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                            {filtered.map((t, tIdx) => (
                                              <button type="button" key={t} data-dropdown-item onMouseDown={() => { updateMed(globalIndex, 'eveningTime', t); setShowTimeDropdown(null); }} onMouseEnter={() => setHighlightedDropdownIndex(tIdx)} className={`w-full px-1 py-1 text-left text-[9px] border-b border-gray-50 last:border-0 ${highlightedDropdownIndex === tIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                                                {t}
                                              </button>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      {readOnly ? (
                                        <div className="w-full text-center text-xs font-bold leading-tight uppercase">
                                          {med.evening && med.evening !== '0' ? med.evening : '-'}
                                        </div>
                                      ) : (
                                      <textarea
                                        className={"w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight uppercase"}
                                        placeholder={readOnly ? '' : '0'}
                                        value={med.evening}
                                        onChange={e => updateMed(globalIndex, 'evening', e.target.value.toUpperCase())}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                      )}
                                    </div>
                                  </div>
                                  {/* night dosage container */}
                                  <div className="w-14 border-r border-black flex flex-col shrink-0 relative">
                                    <div className="flex-1 flex items-center justify-center border-b border-gray-300 min-h-[16px] relative">
                                      {readOnly ? (
                                        <div className="w-full text-center text-[10px] font-bold uppercase leading-tight">
                                          {med.nightTime ? `${med.nightTime}${(med as any).nightAmPm ? ' ' + (med as any).nightAmPm : ''}` : ''}
                                        </div>
                                      ) : (
                                      <input
                                        className="w-full text-center text-[10px] font-bold outline-none bg-transparent"
                                        placeholder=""
                                        value={(med.nightTime ? `${med.nightTime}${(med as any).nightAmPm ? ' ' + (med as any).nightAmPm : ''}` : '')}
                                        onChange={e => { updateMed(globalIndex, 'nightTime', e.target.value); setTimeSearchQuery(e.target.value); setHighlightedDropdownIndex(-1); }}
                                        onFocus={() => !readOnly && (setShowTimeDropdown({ index: globalIndex, field: 'nightTime' }), setHighlightedDropdownIndex(-1))}
                                        onBlur={() => setTimeout(() => setShowTimeDropdown(null), 150)}
                                        onKeyDown={e => {
                                          const filtered = NIGHT_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                          handleDropdownKeyDown(e, showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'nightTime', filtered.length, (idx) => { updateMed(globalIndex, 'nightTime', filtered[idx]); setShowTimeDropdown(null); }, () => setShowTimeDropdown(null));
                                        }}
                                        readOnly={readOnly}
                                      />
                                      )}
                                      {!readOnly && showTimeDropdown?.index === globalIndex && showTimeDropdown?.field === 'nightTime' && (() => {
                                        const filtered = NIGHT_TIMES.filter(t => !timeSearchQuery || t.toLowerCase().includes(timeSearchQuery.toLowerCase()));
                                        return filtered.length > 0 && (
                                          <div ref={dropdownListRef} className="absolute left-0 top-full z-50 w-16 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto print:hidden">
                                            {filtered.map((t, tIdx) => (
                                              <button type="button" key={t} data-dropdown-item onMouseDown={() => { updateMed(globalIndex, 'nightTime', t); setShowTimeDropdown(null); }} onMouseEnter={() => setHighlightedDropdownIndex(tIdx)} className={`w-full px-1 py-1 text-left text-[9px] border-b border-gray-50 last:border-0 ${highlightedDropdownIndex === tIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                                                {t}
                                              </button>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[18px]">
                                      {readOnly ? (
                                        <div className="w-full text-center text-xs font-bold leading-tight uppercase">
                                          {med.night && med.night !== '0' ? med.night : '-'}
                                        </div>
                                      ) : (
                                      <textarea
                                        className={"w-full text-center text-xs font-bold outline-none bg-transparent resize-none leading-tight uppercase"}
                                        placeholder={readOnly ? '' : '0'}
                                        value={med.night}
                                        onChange={e => updateMed(globalIndex, 'night', e.target.value.toUpperCase())}
                                        readOnly={readOnly}
                                        rows={1}
                                      />
                                      )}
                                    </div>
                                  </div>
                                  {/* Food Timing - Searchable Combobox */}
                                  <div className="flex-1 flex items-center justify-center relative">
                                    {readOnly ? (
                                      <div className="w-full text-center font-bold text-xs uppercase leading-tight">
                                        {(med.foodTiming === 'nil' || !med.foodTiming) ? '-' : med.foodTiming}
                                      </div>
                                    ) : (
                                    <input
                                      className={"w-full h-full text-center font-bold text-xs outline-none bg-transparent uppercase"}
                                      value={(med.foodTiming === 'nil' || !med.foodTiming) ? '' : med.foodTiming}
                                      onChange={e => { updateMed(globalIndex, 'foodTiming', e.target.value.toUpperCase()); setFoodTimingSearchQuery(e.target.value.toUpperCase()); setHighlightedDropdownIndex(-1); !readOnly && setShowFoodTimingDropdown(globalIndex); }}
                                      onFocus={() => !readOnly && (setShowFoodTimingDropdown(globalIndex), setFoodTimingSearchQuery(''), setHighlightedDropdownIndex(-1))}
                                      onBlur={() => setTimeout(() => setShowFoodTimingDropdown(null), 150)}
                                      onKeyDown={e => {
                                        const filtered = FOOD_TIMING_OPTIONS.filter(opt => !foodTimingSearchQuery || opt.toUpperCase().includes(foodTimingSearchQuery));
                                        handleDropdownKeyDown(
                                          e,
                                          showFoodTimingDropdown === globalIndex,
                                          filtered.length,
                                          (idx) => { updateMed(globalIndex, 'foodTiming', filtered[idx]); setShowFoodTimingDropdown(null); },
                                          () => setShowFoodTimingDropdown(null)
                                        );
                                      }}
                                      readOnly={readOnly}
                                      placeholder=""
                                    />
                                    )}
                                    {!readOnly && showFoodTimingDropdown === globalIndex && (() => {
                                      const filtered = FOOD_TIMING_OPTIONS.filter(opt => !foodTimingSearchQuery || opt.toUpperCase().includes(foodTimingSearchQuery));
                                      return filtered.length > 0 && (
                                        <div ref={dropdownListRef} className="absolute right-0 top-full z-50 w-16 bg-white border border-gray-200 rounded-lg shadow-xl max-h-32 overflow-y-auto print:hidden">
                                          {filtered.map((opt, oIdx) => (
                                            <button type="button" key={opt} data-dropdown-item onMouseDown={() => { updateMed(globalIndex, 'foodTiming', opt); setShowFoodTimingDropdown(null); }} onMouseEnter={() => setHighlightedDropdownIndex(oIdx)} className={`w-full px-2 py-1.5 text-left text-[10px] font-bold border-b border-gray-50 last:border-0 ${highlightedDropdownIndex === oIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}>
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Empty space - Add button now on last row, Manage Drugs moved to dashboard */}
                      </div>
                    )
                    }

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

                          {/* Specified / Monitored + Review block — two-column layout
                              Left: SALT / FLUID / TESTS   Right: SPECIALISTS / REVIEW ON */}
                          <div className={`border-t border-black pt-2 mt-1 ${scale.mb}`}>
                            <div className="flex justify-between items-baseline mb-1.5">
                              <p className="font-bold underline italic text-sm">TO BE SPECIFIED / MONITORED:</p>
                              <span className="font-bold text-sm" style={{ marginRight: '2cm' }}>VEG ONLY DIET</span>
                            </div>
                            <div className={`flex gap-6 ${scale.textSize} font-bold`}>
                              {/* Left column: SALT, FLUID, TESTS */}
                              <div className={`flex-1 min-w-0 ${scale.spacing}`}>
                              {/* SALT — input left edge aligned to shared label margin */}
                              <div className="flex gap-2 items-center">
                                <span className="shrink-0 uppercase w-20 whitespace-nowrap">SALT (உப்பு):</span>
                                {readOnly ? (
                                  <div className="w-40 inline-flex items-center justify-center border border-gray-400 bg-transparent text-center uppercase px-1 py-0.5 leading-none min-h-[24px]">
                                    <span className="leading-none">{formData.saltIntake || ''}</span>
                                  </div>
                                ) : (
                                <input
                                  className="w-40 border border-gray-400 outline-none bg-transparent text-center uppercase px-1 leading-tight"
                                  value={formData.saltIntake}
                                  onChange={e => setFormData({ ...formData, saltIntake: e.target.value.toUpperCase() })}
                                  placeholder="____"
                                  readOnly={readOnly}
                                />
                                )}
                                <span className="shrink-0 uppercase whitespace-nowrap">GM/DAY</span>
                              </div>
                              {/* FLUID */}
                              <div className="flex gap-2 items-center">
                                <span className="shrink-0 uppercase w-20 whitespace-nowrap">FLUID (நீர்):</span>
                                {readOnly ? (
                                  <div className="w-40 inline-flex items-center justify-center border border-gray-400 bg-transparent text-center uppercase px-1 py-0.5 leading-none min-h-[24px]">
                                    <span className="leading-none">{formData.fluidIntake || ''}</span>
                                  </div>
                                ) : (
                                <input
                                  className="w-40 border border-gray-400 outline-none bg-transparent text-center uppercase px-1 leading-tight"
                                  value={formData.fluidIntake}
                                  onChange={e => setFormData({ ...formData, fluidIntake: e.target.value.toUpperCase() })}
                                  placeholder="____"
                                  readOnly={readOnly}
                                />
                                )}
                                <span className="shrink-0 uppercase whitespace-nowrap">LIT/DAY</span>
                              </div>
                              {/* TESTS — same left column, aligned with SALT/FLUID */}
                              <div className="flex gap-2 items-start">
                                  <div className="shrink-0 whitespace-nowrap uppercase pt-1 w-20">TESTS :</div>
                                  {readOnly ? (
                                    <div className="flex-1 min-w-0 border border-gray-400 px-1.5 py-1 bg-transparent uppercase leading-tight whitespace-pre-wrap break-words min-h-[3.5em]">
                                      {formData.testsToReview}
                                    </div>
                                  ) : (
                                    <textarea
                                      className="flex-1 min-w-0 border border-gray-400 outline-none px-1.5 py-1 bg-transparent uppercase resize-none leading-tight min-h-[3.5em]"
                                      value={formData.testsToReview}
                                      onChange={e => !readOnly && setFormData({ ...formData, testsToReview: e.target.value.toUpperCase() })}
                                      readOnly={readOnly}
                                      rows={3}
                                    />
                                  )}
                                </div>
                              </div>
                              {/* Right column: SPECIALISTS, REVIEW ON — top, beside SALT */}
                              <div className={`flex-1 min-w-0 ${scale.spacing}`}>
                                <div>
                                  <div className="uppercase leading-tight flex items-baseline gap-2 mb-1">
                                    <span>SPECIALISTS :</span>
                                    <span className="text-[10px] font-normal">மருத்துவர்கள்</span>
                                  </div>
                              <div className="relative w-full min-w-0">
                                {readOnly ? (
                                  <div className="w-full border border-gray-400 px-2 bg-transparent uppercase leading-relaxed py-1.5 whitespace-pre-wrap break-words min-h-[2.25em]">
                                    {formData.specialistToReview}
                                  </div>
                                ) : (
                                  <textarea
                                    className="w-full border border-gray-400 outline-none px-2 bg-transparent uppercase resize-none leading-relaxed py-1.5 min-h-[2.25em]"
                                    value={formData.specialistToReview}
                                    onChange={e => !readOnly && setFormData({ ...formData, specialistToReview: e.target.value.toUpperCase() })}
                                    onFocus={() => { if (!readOnly) { setShowSpecialistDropdown(true); setHighlightedDropdownIndex(-1); } }}
                                    onKeyDown={e => {
                                      if (!showSpecialistDropdown || SPECIALIST_OPTIONS.length === 0) return;
                                      if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setHighlightedDropdownIndex(prev => {
                                          const next = prev < SPECIALIST_OPTIONS.length - 1 ? prev + 1 : 0;
                                          setTimeout(() => scrollHighlightedIntoView(next), 0);
                                          return next;
                                        });
                                      } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setHighlightedDropdownIndex(prev => {
                                          const next = prev > 0 ? prev - 1 : SPECIALIST_OPTIONS.length - 1;
                                          setTimeout(() => scrollHighlightedIntoView(next), 0);
                                          return next;
                                        });
                                      } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (highlightedDropdownIndex >= 0 && highlightedDropdownIndex < SPECIALIST_OPTIONS.length) {
                                          const opt = SPECIALIST_OPTIONS[highlightedDropdownIndex];
                                          const currentSpecs = parseSpecialists(formData.specialistToReview || '');
                                          const isSelected = currentSpecs.includes(opt);
                                          const newSpecs = isSelected ? currentSpecs.filter(s => s !== opt) : [...currentSpecs, opt];
                                          setFormData({ ...formData, specialistToReview: newSpecs.join(', ') });
                                        }
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setShowSpecialistDropdown(false);
                                        setHighlightedDropdownIndex(-1);
                                      } else if (e.key === 'Tab') {
                                        setShowSpecialistDropdown(false);
                                        setHighlightedDropdownIndex(-1);
                                      }
                                    }}
                                    placeholder="TYPE OR SELECT SPECIALIST..."
                                    readOnly={readOnly}
                                    rows={1}
                                  />
                                )}
                                {!readOnly && showSpecialistDropdown && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-[110]"
                                      onClick={() => setShowSpecialistDropdown(false)}
                                    />
                                    <div ref={dropdownListRef} className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-[120] max-h-48 overflow-y-auto py-1 font-normal">
                                      {SPECIALIST_OPTIONS.map((opt, sIdx) => {
                                        const currentSpecs = parseSpecialists(formData.specialistToReview || '');
                                        const isSelected = currentSpecs.includes(opt);
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            data-dropdown-item
                                            className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between ${highlightedDropdownIndex === sIdx ? 'bg-emerald-100' : 'hover:bg-emerald-50'} ${isSelected ? 'text-emerald-700 font-bold' : 'text-gray-700'}`}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              let newSpecs;
                                              if (isSelected) {
                                                newSpecs = currentSpecs.filter(s => s !== opt);
                                              } else {
                                                newSpecs = [...currentSpecs, opt];
                                              }
                                              setFormData({ ...formData, specialistToReview: newSpecs.join(', ') });
                                            }}
                                            onMouseEnter={() => setHighlightedDropdownIndex(sIdx)}
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
                                <div className="flex gap-2 items-center">
                                  <div className="shrink-0 whitespace-nowrap uppercase">REVIEW ON :</div>
                                  <div className="flex-1 flex items-center gap-2 min-w-0">
                                    {readOnly ? (
                                      <div className="inline-flex items-center border border-gray-400 px-2 py-0.5 bg-transparent min-w-0 leading-none min-h-[24px]">
                                        <span className="leading-none">
                                          {formData.reviewDate
                                            ? new Date(formData.reviewDate).toLocaleDateString('en-GB')
                                            : ''}
                                        </span>
                                      </div>
                                    ) : (
                                    <input
                                      type="date"
                                      className="border border-gray-400 outline-none px-1 cursor-pointer bg-transparent min-w-0 leading-tight"
                                      value={formData.reviewDate}
                                      onChange={e => !readOnly && setFormData({ ...formData, reviewDate: e.target.value })}
                                      readOnly={readOnly}
                                      min={new Date().toISOString().split('T')[0]}
                                    />
                                    )}
                                    {reviewDaysLabel && (
                                      <span className="text-[11px] font-bold whitespace-nowrap border-2 border-black rounded px-1.5 py-0 bg-gray-100 print:bg-gray-100 tracking-wide">
                                        {reviewDaysLabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: Notes on Left, Signature on Right */}
                          <div className="flex gap-4 items-end mt-4 mb-2">
                            {/* Doctor Notes (Relocated) */}
                            {(() => {
                              const getNoteFontSize = (text: string) => {
                                const len = (text || '').length;
                                if (len > 500) return 'text-[9px] leading-[1.1]';
                                if (len > 300) return 'text-[10px] leading-[1.2]';
                                if (len > 150) return 'text-xs leading-tight';
                                return 'text-sm leading-normal';
                              };
                              const fontSizeClass = getNoteFontSize(formData.doctorNotes || '');

                              return (
                                <div className="flex-1">
                                  <div className="flex gap-2 items-start text-sm font-bold uppercase">
                                    <div className="flex flex-col shrink-0 pt-0.5 leading-tight mr-2 uppercase">
                                      <span>குறிப்புகள்</span>
                                      <span>/ NOTES:</span>
                                    </div>
                                    {readOnly ? (
                                      <div className={`flex-1 border border-gray-400 bg-transparent px-1 py-0.5 ${fontSizeClass} uppercase whitespace-pre-wrap break-words min-h-[56px]`}>
                                        {formData.doctorNotes}
                                      </div>
                                    ) : (
                                      <textarea
                                        className={`flex-1 border border-gray-400 outline-none bg-transparent px-1 py-0.5 ${fontSizeClass} resize-none uppercase overflow-y-auto break-all min-h-[56px]`}
                                        value={formData.doctorNotes}
                                        onChange={e => !readOnly && setFormData({ ...formData, doctorNotes: e.target.value.toUpperCase() })}
                                        readOnly={readOnly}
                                        rows={4}
                                        placeholder="ADDITIONAL NOTES..."
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Signature */}
                            <div className="text-center min-w-[150px] flex flex-col items-center justify-end shrink-0">
                              {/* Dynamic Signature Image - Reduced size */}
                              {doctor?.signature_url ? (
                                <div className="h-10 w-32 mb-1 flex items-end justify-center">
                                  <img
                                    src={getProxiedUrl(doctor.signature_url)}
                                    alt="Signature"
                                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                                  />
                                </div>
                              ) : (
                                <div className="h-10 w-32"></div>
                              )}

                              <div className={`font-bold border-t border-black px-4 pt-0.5 ${scale.textSize} flex flex-col items-center`}>
                                <span>DOCTOR SIGNATURE.</span>
                                {prescribedByName && (
                                  <span className="text-[10px] mt-0.5">{prescribedByName}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Footer Box */}
                          <div className="w-full border-2 border-black p-2 text-[11px] leading-[1.6] flex flex-col justify-center mt-2 bg-gray-50 print:bg-white text-center font-bold uppercase tracking-wide">
                            <p>முன்பதிவு காலதாமதத்தை குறைக்கும் / PRIOR REGISTRATION AVOIDS DELAY</p>
                            <p>APPT: 0422-2494333, 73588 41555, 41666 | TIME: 8AM - 6PM</p>
                            
                            <div className="border-t border-gray-400 my-1.5 mx-2"></div>
                            
                            <p>DR. A. பிரபாகர் MD., DNB (NEPHROLOGY) | DR. A. திவாகர் MS., M.CH (UROLOGY)</p>
                            <p>அவசர உதவிக்கு / EMERGENCY: 0422 - 2494333 (24 மணி நேரமும் / 24 HRS SERVICE)</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* PTO (Please Turn Over) - Only show on non-final pages */}
                    {!isLastPage && (
                      <div className="text-right mt-auto pb-2 text-xs font-bold text-gray-700 italic uppercase">
                        தொடர்ச்சி அடுத்த பக்கத்தில் / PTO (PLEASE TURN OVER)
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {showIncompleteWarningModal && <IncompleteDrugWarningModal />}
        {showDuplicateWarningModal && <DuplicateMedicationWarningModal />}
        {showMissingDiagnosisWarningModal && <MissingDiagnosisWarningModal />}

        {/* Mobile Preview sticky actions: stick to bottom */}
        {isMobile && (showPrintView || showSendPreview) && (
          <div className="sticky bottom-0 z-[80] bg-white/95 backdrop-blur-md p-4 pb-8 border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col gap-3">
            {/* Patient identity banner for mobile send preview */}
            {showSendPreview && !readOnly && (
              <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs font-bold text-blue-900 text-center">
                  Sending for: {patient?.name || 'Unknown'}
                  {patient?.mr_number && <span className="ml-1">(MR: {patient.mr_number})</span>}
                  {patient?.token_number && <span className="ml-1">| Token: {patient.token_number}</span>}
                </p>
              </div>
            )}
            <div className="text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {showSendPreview ? 'Review & Send' : 'Print Preview'}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (readOnly) onClose();
                  else { setShowPrintView(false); setShowSendPreview(false); }
                }}
                className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {readOnly ? 'Close' : '← Edit'}
              </button>
              {showSendPreview && !readOnly ? (
                <button
                  onClick={() => { setShowSendPreview(false); confirmSendToPharmacy(); }}
                  className="flex-[2] px-4 py-3.5 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm & Send to Pharmacy
                </button>
              ) : (
                <button
                  onClick={(readOnly && !forcePrint) ? handleDownloadPdf : handlePrint}
                  className="flex-[2] px-4 py-3.5 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {(readOnly && !forcePrint) ? 'Download PDF' : 'Print PDF'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className={`bg-white p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] ${isMobile && (showPrintView || showSendPreview) ? 'hidden' : 'flex'}`}>
          <button onClick={() => setShowConfirmCloseModal(true)} className="w-full sm:w-auto px-6 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors order-2 sm:order-1">
            Cancel
          </button>
          <div className="flex flex-1 sm:flex-none gap-3 order-1 sm:order-2">
            {/* In read-only viewers (e.g. Visit History at reception, pharmacy view),
                expose an explicit Download PDF action alongside Print so users can
                save the file directly without going through the browser print dialog. */}
            {readOnly && forcePrint && (
              <button
                onClick={handleDownloadPdf}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
                title="Save a copy as PDF"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>Download PDF</span>
              </button>
            )}
            <button
              onClick={(readOnly && !forcePrint) ? handleDownloadPdf : handlePrint}
              className="flex-1 sm:flex-none px-4 sm:px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              <span>{(readOnly && !forcePrint) ? 'Download PDF' : 'Print PDF'}</span>
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
                    setNewDrugType('');
                    setNewDrugDosages('');
                    setNewDrugDefaultTiming('');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add/Edit Form */}
              <div ref={manageDrugFormRef} className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="text-sm font-semibold text-gray-700 mb-3">
                  {editingDrug ? 'Edit Drug' : 'Add New Drug'}
                </div>
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Type</label>
                    <select
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm font-semibold uppercase bg-white"
                      value={newDrugType}
                      onChange={e => setNewDrugType(e.target.value)}
                    >
                      <option value="">NONE</option>
                      {DRUG_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.value}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Drug Name</label>
                    <input
                      type="text"
                      placeholder="PARACETAMOL"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm uppercase"
                      value={newDrugName}
                      onChange={e => setNewDrugName(e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Dosages (Comma Separated)</label>
                    <input
                      ref={dosageInputRef}
                      type="text"
                      placeholder="200MG, 300MG"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm uppercase"
                      value={newDrugDosages}
                      onChange={e => setNewDrugDosages(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveDrug()}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Default Timing</label>
                    <select
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm font-semibold uppercase bg-white"
                      value={newDrugDefaultTiming}
                      onChange={e => setNewDrugDefaultTiming(e.target.value)}
                    >
                      <option value="">NONE</option>
                      {FOOD_TIMING_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={handleSaveDrug}
                      disabled={isSavingDrug || !newDrugName.trim()}
                      className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingDrug ? '...' : editingDrug ? 'Update' : 'Add'}
                    </button>
                  </div>
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
                    <div className="px-6 py-2 bg-gray-50 grid grid-cols-12 gap-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      <div className="col-span-2">Type</div>
                      <div className="col-span-3">Drug</div>
                      <div className="col-span-3">Dosages</div>
                      <div className="col-span-2">Default Timing</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>
                    {savedDrugs.map(drug => (
                      <div key={drug.id} className="px-6 py-3 grid grid-cols-12 gap-3 items-center hover:bg-gray-50 group">
                        <div className="col-span-2">
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold uppercase">
                            {drug.drug_type || 'NONE'}
                          </span>
                        </div>
                        <div className="col-span-3 font-semibold text-gray-900 truncate">{drug.name}</div>
                        <div className="col-span-3 text-[12px] text-gray-600 truncate">
                          {Array.isArray(drug.dosages) && drug.dosages.length > 0 ? drug.dosages.join(', ') : '-'}
                        </div>
                        <div className="col-span-2 text-[12px] text-gray-700 font-semibold uppercase">
                          {drug.default_timing || '-'}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingDrug(drug);
                              setNewDrugName(drug.name);
                              setNewDrugType(drug.drug_type || '');
                              setNewDrugDosages(Array.isArray(drug.dosages) ? drug.dosages.join(', ') : '');
                              setNewDrugDefaultTiming(drug.default_timing || '');
                              requestAnimationFrame(() => {
                                manageDrugFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                dosageInputRef.current?.focus();
                              });
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
                  onClick={() => {
                    setShowManageDrugsModal(false);
                    setEditingDrug(null);
                    setNewDrugName('');
                    setNewDrugType('');
                    setNewDrugDosages('');
                    setNewDrugDefaultTiming('');
                  }}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-black"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        {showConfirmSendModal && <ConfirmSendModal />}
        {showConfirmCloseModal && <ConfirmCloseModal />}
      </div>
    </div >
  );
};

export default PrescriptionModal;
