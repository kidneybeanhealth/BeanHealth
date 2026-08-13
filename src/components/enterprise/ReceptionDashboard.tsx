import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useHospitalName } from '../../hooks/useHospitalName';
import { supabase, getProxiedUrl } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { LogoIcon } from '../icons/LogoIcon';
import PrinterSetupModal from '../PrinterSetupModal';
import { printerService } from '../../services/BluetoothPrinterService';
import { createTokenData } from '../../utils/tokenReceiptGenerator';
import { getReceiptBytes } from '../../utils/receipts/receiptGeneratorSelector';
import PrinterPreview from '../PrinterPreview';
import { useTenant } from '../../contexts/TenantContext';
import { BeanhealthIdService } from '../../services/beanhealthIdService';
const VisitJourneyModal = lazy(() => import('../modals/VisitJourneyModal'));
import {
    fetchReceptionPastRecords,
    stopPatientFollowup,
    updatePatientAppAccess,
    type ReceptionPastRecordPatient,
    type ReceptionReviewFilter,
} from '../../services/enterpriseReviewService';
import AdmittedPatientsPanel from './AdmittedPatientsPanel';
import { resolvePatientDoctorSpecialty } from './PastRecordsMetricsSection';
import PastRecordsPatientCard, {
    getReviewFilterLabel,
    formatPastDate,
    type PastRecordsView,
} from './PastRecordsPatientCard';

// Past Records report views — lazy (only loaded when the chip is opened)
const WeeklyOverdueReportPanel = lazy(() =>
    import('./ReceptionActivityPanels').then(m => ({ default: m.WeeklyOverdueReportPanel }))
);
const ReceptionCalendarPanel = lazy(() =>
    import('./ReceptionActivityPanels').then(m => ({ default: m.ReceptionCalendarPanel }))
);

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
}

interface QueueItem {
    id: string;
    hospital_id: string;
    patient_id: string;
    doctor_id: string | null;
    queue_number: number;
    token_number?: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    patient: {
        id?: string;
        name: string;
        age: number | string | null;
        token_number: string;
        mr_number?: string;
        beanhealth_id?: string;
    };
    doctor: {
        id?: string;
        name: string;
        specialty: string;
    };
    created_at: string;
    preparing_by?: string | null;
}

interface MrPatient {
    id: string;
    name: string;
    age: number | string | null;
    mr_number: string | null;
    phone: string | null;
    place: string | null;
    father_husband_name: string | null;
    gender: string | null;
}

type CallLogStatus = 'picked' | 'not_picked';

interface CallLogTarget {
    patientId: string;
    mrNumber: string | null;
    patientName: string;
    reviewDate: string | null;
    doctorId?: string | null;  // Track which doctor's review
    doctorName?: string | null; // Doctor name for display
}

interface StopFollowupTarget {
    patientId: string;
    patientName: string;
}

interface StopFollowupOverride {
    continuityStatus: 'transferred_out';
    followupStoppedAt: string;
    followupStopReason: string;
}

interface CallHistoryEntry {
    id: string;
    called_at: string;
    call_status: string | null;
    patient_response: string | null;
}

// Helper to format doctor name professionally
const formatDoctorName = (name: string) => {
    if (!name) return "";
    // Remove existing Dr prefix and any trailing dots/spaces
    let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
    // Fix initials formatting (e.g., A.Divakar -> A. Divakar)
    cleanName = cleanName.replace(/([A-Z])\.(\S)/g, "$1. $2");
    return `Dr. ${cleanName}`;
};

const toLocalISODate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

/** Past Records view — review filters plus the two report views */
/**
 * The token actually issued to THIS queue row — never the patient's stored one.
 *
 * hospital_patients.token_number holds the token from the patient's most recent
 * registration. Falling back to it makes a row created without a token (a direct
 * admission, which inserts no token_number) look like it owns a token from an
 * earlier visit. That stale value was inflating the next-token calculation and
 * skipping whole ranges of the day's sequence (e.g. 31 → 60).
 */
const queueRowToken = (item: any): string => String(item?.token_number ?? '').trim();

// Numeric value of a queue token, ignoring any letter prefix (e.g. "D5" → 5).
// Tokenless rows sort to the end regardless of direction.
const tokenNumericValue = (item: any): number => {
    const raw = queueRowToken(item).replace(/\D/g, '');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : NaN;
};

const compareQueueTokens = (a: any, b: any, dir: 'asc' | 'desc'): number => {
    const na = tokenNumericValue(a);
    const nb = tokenNumericValue(b);
    const aMissing = Number.isNaN(na);
    const bMissing = Number.isNaN(nb);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;   // no token → always last
    if (bMissing) return -1;
    return dir === 'asc' ? na - nb : nb - na;
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const ReceptionDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { profile, refreshProfile } = useAuth();
    const { displayName } = useHospitalName('Hospital');
    const { tenant } = useTenant();

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [activeTab, setActiveTab] = useState<'queue' | 'patients' | 'past_records' | 'admitted'>('queue');

    // Walk-in / Registration Modal
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [registrationMode, setRegistrationMode] = useState<'queue' | 'past_record'>('queue');
    const [walkInForm, setWalkInForm] = useState({
        name: '',
        age: '',
        dob: '',
        gender: '',
        fatherHusbandName: '',
        place: '',
        phone: '',
        department: '',
        doctorId: '',
        tokenNumber: '',
        mrNumber: '',
        reviewDate: ''
    });

    // MR number search
    const [mrSuggestions, setMrSuggestions] = useState<MrPatient[]>([]);
    const [mrSearchLoading, setMrSearchLoading] = useState(false);
    const [showMrDropdown, setShowMrDropdown] = useState(false);
    const mrSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mrInputRef = useRef<HTMLInputElement>(null);
    const [mrDropdownStyle, setMrDropdownStyle] = useState<React.CSSProperties>({});

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [hospitalSettings, setHospitalSettings] = useState({
        hospitalName: profile?.name || '',
        address: '',
        contactNumber: '',
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || '',
        features: { capture_phone: true } as { capture_phone: boolean }
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    // Printer state
    const [showPrinterSetup, setShowPrinterSetup] = useState(false);
    const [printerConnected, setPrinterConnected] = useState(false);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [reviewAlertCount, setReviewAlertCount] = useState(0);
    const [duplicateQueueWarning, setDuplicateQueueWarning] = useState<{
        patientName: string;
        existingDoctorName: string;
        newDoctorName: string;
    } | null>(null);
    const duplicateOverrideRef = React.useRef(false);
    const [lastRegisteredPatient, setLastRegisteredPatient] = useState<{
        tokenNumber: string;
        name: string;
        mrNumber?: string;
        doctorName: string;
        department: string;
    } | null>(null);
    const [isPrintingToken, setIsPrintingToken] = useState(false);
    const [printerSettings, setPrinterSettings] = useState<{ spacing: number; alignment: 'left' | 'center' | 'right' }>({
        spacing: 1,
        alignment: 'center'
    });
    const [isSavingPrinterSettings, setIsSavingPrinterSettings] = useState(false);

    // Delete Patient State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'queue' | 'patient', id: string, name: string, queueId?: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // BeanHealth ID Lookup
    const [bhidMatch, setBhidMatch] = useState<{
        id: string;
        name: string;
        email: string;
        beanhealthId: string;
    } | null>(null);
    const [isSearchingBhid, setIsSearchingBhid] = useState(false);
    const phoneDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const handlePhoneLookup = useCallback((phone: string) => {
        // Clear previous match and timer
        setBhidMatch(null);
        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);

        // Need at least 10 digits for a valid phone
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) return;

        setIsSearchingBhid(true);
        phoneDebounceRef.current = setTimeout(async () => {
            try {
                const match = await BeanhealthIdService.findPatientByPhone(digits);
                setBhidMatch(match);
            } catch (err) {
                console.warn('BHID lookup failed:', err);
            } finally {
                setIsSearchingBhid(false);
            }
        }, 600);
    }, []);

    // Memoized fetch functions
    const fetchDoctors = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('hospital_doctors')
                .select('id, name, specialty')
                .eq('hospital_id', profile.id)
                .eq('is_active', true);

            if (error) throw error;
            setDoctors(data || []);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        }
    }, [profile?.id]);

    const fetchQueue = useCallback(async (isBackground = false) => {
        if (!profile?.id) return;
        if (!isBackground) setIsLoadingQueue(true);
        try {
            const { data, error } = await supabase
                .from('hospital_queues')
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    doctor:hospital_doctors(*)
                `)
                .eq('hospital_id', profile.id)
                .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Sort by token_number descending (highest token first)
            const sortedQueue = (data as any || []).sort((a: any, b: any) => {
                const tokenA = parseInt(queueRowToken(a) || '0', 10);
                const tokenB = parseInt(queueRowToken(b) || '0', 10);
                return tokenB - tokenA; // Descending: 9, 8, 7, 6...
            });

            setQueue(sortedQueue);
        } catch (error) {
            console.error('Error fetching queue:', error);
            if (!isBackground) toast.error('Failed to update queue');
        } finally {
            if (!isBackground) setIsLoadingQueue(false);
        }
    }, [profile?.id]);

    // Queue doctor filter
    const [queueDoctorFilter, setQueueDoctorFilter] = useState<string>('all');
    // Live queue token sort direction (icon-toggled)
    const [queueSortDir, setQueueSortDir] = useState<'asc' | 'desc'>('asc');
    // History Log type filter: all / outpatient (normal completed) / admitted
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'outpatient' | 'admitted'>('all');

    // Edit queue item state
    const [editQueueItem, setEditQueueItem] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ name: '', age: '', tokenNumber: '', doctorId: '', gender: '', fatherHusbandName: '', place: '', phone: '', mrNumber: '' });
    const [editSaving, setEditSaving] = useState(false);
    const [editTokenError, setEditTokenError] = useState('');

    // Patient Database State (Past Records tab)
    const [pastRecords, setPastRecords] = useState<ReceptionPastRecordPatient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewFilter, setReviewFilter] = useState<PastRecordsView>('all');
    const [reviewDateFilter, setReviewDateFilter] = useState('');
    // Report views replace the patient list; list fetches fall back to 'all'
    const isPanelView = reviewFilter === 'weekly_report' || reviewFilter === 'calendar';
    const activeListFilter: ReceptionReviewFilter = isPanelView ? 'all' : (reviewFilter as ReceptionReviewFilter);
    const [pastRecordsPage, setPastRecordsPage] = useState(0);
    const [hasMorePastRecords, setHasMorePastRecords] = useState(true);
    const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);
    const [pastRecordsTotal, setPastRecordsTotal] = useState(0);
    const [rxHistoryPatient, setRxHistoryPatient] = useState<ReceptionPastRecordPatient | null>(null);
    /** When the visible list was last pulled — the call round works off this list,
     *  so its age has to be on screen rather than assumed. */
    const [pastRecordsLoadedAt, setPastRecordsLoadedAt] = useState<Date | null>(null);
    const [callLogTarget, setCallLogTarget] = useState<CallLogTarget | null>(null);
    const [callLogDoctorSelector, setCallLogDoctorSelector] = useState<{ patientId: string; patient: ReceptionPastRecordPatient } | null>(null);
    const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
    const [callHistoryLoading, setCallHistoryLoading] = useState(false);
    const [expandedCallHistoryPatientIds, setExpandedCallHistoryPatientIds] = useState<Set<string>>(new Set());
    const [callLogSubmitting, setCallLogSubmitting] = useState(false);
    const [callLogStatus, setCallLogStatus] = useState<CallLogStatus>('picked');
    const [callLogNotes, setCallLogNotes] = useState('');
    const [callLogNextDate, setCallLogNextDate] = useState('');
    const [callLogRescheduleDate, setCallLogRescheduleDate] = useState('');
    /** Set when the stored review date changed after this call-log modal opened. */
    const [callLogConflict, setCallLogConflict] = useState<{ storedDate: string; typedDate: string } | null>(null);
    /** null = not asked yet · 'keep' = leave the newer date · 'override' = write the typed one.
     *  A ref, not state: the banner's buttons are type="submit", so onClick and the form
     *  submit run inside the same React event — a queued setState would still read null
     *  in the handler and re-open this prompt forever. Refs apply synchronously. */
    const callLogDateDecisionRef = useRef<null | 'keep' | 'override'>(null);
    const [stopFollowupTarget, setStopFollowupTarget] = useState<StopFollowupTarget | null>(null);
    const [stopFollowupReason, setStopFollowupReason] = useState('');
    const [stopFollowupSubmitting, setStopFollowupSubmitting] = useState(false);
    const [locallyStoppedFollowupIds, setLocallyStoppedFollowupIds] = useState<Set<string>>(new Set());
    const [stopFollowupOverrides, setStopFollowupOverrides] = useState<Record<string, StopFollowupOverride>>({});
    const [updatingAccessPatientIds, setUpdatingAccessPatientIds] = useState<Set<string>>(new Set());
    const PAST_RECORDS_PER_PAGE = 50;
    /** Print pulls the whole filtered set in one go, independent of what's on screen. */
    const PAST_RECORDS_PRINT_LIMIT = 5000;
    const isPastRegistration = registrationMode === 'past_record';

    const fetchPastRecords = useCallback(async (
        isBackground = false,
        page = 0,
        append = false,
        options?: {
            searchValue?: string;
            reviewFilterValue?: ReceptionReviewFilter;
            reviewDateValue?: string;
        }
    ) => {
        if (!profile?.id) return;
        if (!isBackground && !append) setIsLoadingQueue(true);
        if (append) setIsLoadingMorePast(true);
        try {
            const result = await fetchReceptionPastRecords({
                hospitalId: profile.id,
                page,
                pageSize: PAST_RECORDS_PER_PAGE,
                searchQuery: options?.searchValue ?? '',
                reviewFilter: options?.reviewFilterValue ?? 'all',
                reviewDate: options?.reviewDateValue || undefined,
            });

            setPastRecordsTotal(result.totalCount);
            setHasMorePastRecords(result.hasMore);
            if (!append) setPastRecordsLoadedAt(new Date());
            const mergedPatients = result.patients.map((patient) => {
                const localOverride = stopFollowupOverrides[patient.id];
                if (!localOverride) return patient;
                return {
                    ...patient,
                    continuityStatus: localOverride.continuityStatus,
                    followupStoppedAt: patient.followupStoppedAt || localOverride.followupStoppedAt,
                    followupStopReason: patient.followupStopReason || localOverride.followupStopReason,
                    latestReviewDate: null,
                };
            });
            if (append) {
                setPastRecords(prev => [...prev, ...mergedPatients]);
            } else {
                setPastRecords(mergedPatients);
            }
            setPastRecordsPage(page);
        } catch (error) {
            console.error('Error fetching patients:', error);
            if (!isBackground) toast.error('Failed to load patients');
        } finally {
            if (!isBackground && !append) setIsLoadingQueue(false);
            if (append) setIsLoadingMorePast(false);
        }
    }, [profile?.id, stopFollowupOverrides]);

    const handleLoadMorePastRecords = () => {
        fetchPastRecords(true, pastRecordsPage + 1, true, {
            searchValue: searchQuery,
            reviewFilterValue: activeListFilter,
            reviewDateValue: reviewDateFilter,
        });
    };

    const handleSearchPastRecords = async (e: React.FormEvent) => {
        e.preventDefault();
        setPastRecords([]);
        setPastRecordsPage(0);
        setHasMorePastRecords(true);
        await fetchPastRecords(false, 0, false, {
            searchValue: searchQuery,
            reviewFilterValue: activeListFilter,
            reviewDateValue: reviewDateFilter,
        });
    };

    const handlePrintPastRecordsList = async () => {
        if (!['due_today', 'due_tomorrow', 'overdue'].includes(reviewFilter)) {
            toast.error('Print List is available for Due Today, Due Tomorrow, or Missed Followup');
            return;
        }

        if (!profile?.id) return;

        // Print the COMPLETE filtered set, never the page on screen.
        //
        // The list renders PAST_RECORDS_PER_PAGE at a time behind "Load More", so
        // printing `pastRecords` silently dropped everyone past that cut — while
        // stamping a "Total" that read as authoritative. This sheet is what the
        // 10 AM call round works from; a short list here is a patient nobody rings.
        const loadingId = toast.loading('Preparing the full list…');
        let printRecords: ReceptionPastRecordPatient[];
        try {
            const full = await fetchReceptionPastRecords({
                hospitalId: profile.id,
                page: 0,
                pageSize: PAST_RECORDS_PRINT_LIMIT,
                searchQuery,
                reviewFilter: activeListFilter,
                reviewDate: reviewDateFilter || undefined,
            });
            printRecords = full.patients;
            if (full.hasMore) {
                // Should not happen at the print limit, but never print silently short.
                toast.error(`More than ${PAST_RECORDS_PRINT_LIMIT} patients match — printing the first ${PAST_RECORDS_PRINT_LIMIT}.`, { duration: 8000 });
            }
        } catch (err) {
            console.error('[Past Records] print fetch failed', err);
            toast.error('Could not load the full list — nothing printed', { id: loadingId });
            return;
        }
        toast.dismiss(loadingId);

        if (printRecords.length === 0) {
            toast.error('No patient records to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            toast.error('Pop-up blocked. Please allow pop-ups to print the list.');
            return;
        }

        const generatedAt = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        const rowsHtml = printRecords
            .map((patient, index) => {
                const relationLabel = patient.gender === 'F' ? 'W/o' : 'S/o';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(patient.name || '--')}</td>
                        <td>${patient.age ?? '--'}</td>
                        <td>${relationLabel} ${escapeHtml(patient.father_husband_name || '--')}</td>
                        <td>${escapeHtml(patient.mr_number || '--')}</td>
                        <td>${formatPastDate(patient.latestReviewDate)}</td>
                        <td>${formatPastDate(patient.lastVisitAt)}</td>
                    </tr>
                `;
            })
            .join('');

        const filterLabel = getReviewFilterLabel(reviewFilter);

        const html = `
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Past Records Print List</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1f2937; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
                    .title { font-size: 20px; font-weight: 700; margin: 0; }
                    .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
                    .pill { display: inline-block; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; margin-right: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    thead th { text-align: left; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; }
                    tbody td { border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; vertical-align: top; }
                    tbody tr:nth-child(even) { background: #fcfcfd; }
                    .footer { margin-top: 14px; font-size: 11px; color: #6b7280; }
                    @media print {
                        body { margin: 10mm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1 class="title">Past Records List</h1>
                        <p class="meta">${escapeHtml(displayName || 'Hospital')}</p>
                        <p class="meta">Generated: ${generatedAt}</p>
                    </div>
                    <div>
                        <span class="pill">Filter: ${escapeHtml(filterLabel)}</span>
                        <span class="pill">Total: ${printRecords.length}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>S/o / W/o</th>
                            <th>MR ID</th>
                            <th>Due Date</th>
                            <th>Last Visit Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <p class="footer">Printed from Reception Past Records module.</p>

                <script>
                    window.onload = function () {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const openCallLog = async (patient: ReceptionPastRecordPatient) => {
        if (!profile?.id) return;
        
        // If multiple doctors, show selector; otherwise proceed with primary doctor
        if (patient.doctorReviews && patient.doctorReviews.length > 1) {
            setCallLogDoctorSelector({ patientId: patient.id, patient });
            return;
        }
        
        // Single or no doctor review - use primary doctor
        const primaryDoctor = patient.doctorReviews?.[0];
        setCallLogTarget({
            patientId: patient.id,
            mrNumber: patient.mr_number || null,
            patientName: patient.name,
            reviewDate: primaryDoctor?.reviewDate || patient.latestReviewDate,
            doctorId: primaryDoctor?.doctorId || null,
            doctorName: primaryDoctor?.doctorName || null,
        });
        setCallHistory([]);
        setCallHistoryLoading(true);
        setCallLogStatus('picked');
        setCallLogNotes('');
        setCallLogNextDate('');
        setCallLogRescheduleDate('');
        setCallLogConflict(null);
        callLogDateDecisionRef.current = null;

        try {
            let query = (supabase as any)
                .from('hospital_patient_followups')
                .select('id, called_at, call_status, patient_response')
                .eq('hospital_id', profile.id)
                .eq('patient_id', patient.id);
            
            // Filter by doctor if available
            const primaryDoctor = patient.doctorReviews?.[0];
            if (primaryDoctor?.doctorId) {
                query = query.eq('doctor_id', primaryDoctor.doctorId);
            }
            
            const { data, error } = await query
                .order('called_at', { ascending: false })
                .limit(15);

            if (error) throw error;
            setCallHistory((data || []) as CallHistoryEntry[]);
        } catch (error) {
            console.error('Call history fetch error:', error);
            toast.error('Failed to load call history');
            setCallHistory([]);
        } finally {
            setCallHistoryLoading(false);
        }
    };

    const closeCallLog = () => {
        setCallLogTarget(null);
        setCallLogDoctorSelector(null);
        setCallHistory([]);
        setCallHistoryLoading(false);
        setCallLogSubmitting(false);
        setCallLogStatus('picked');
        setCallLogNotes('');
        setCallLogNextDate('');
        setCallLogRescheduleDate('');
    };

    const handleSelectDoctorForCallLog = async (doctorReview: any) => {
        if (!profile?.id || !callLogDoctorSelector) return;
        const patient = callLogDoctorSelector.patient;
        
        setCallLogTarget({
            patientId: patient.id,
            mrNumber: patient.mr_number || null,
            patientName: patient.name,
            reviewDate: doctorReview.reviewDate,
            doctorId: doctorReview.doctorId,
            doctorName: doctorReview.doctorName,
        });
        setCallLogDoctorSelector(null);
    };

    const togglePatientCallHistory = (patientId: string) => {
        setExpandedCallHistoryPatientIds((prev) => {
            const next = new Set(prev);
            if (next.has(patientId)) {
                next.delete(patientId);
            } else {
                next.add(patientId);
            }
            return next;
        });
    };

    const handleTogglePatientAppAccess = async (patient: ReceptionPastRecordPatient) => {
        if (!profile?.id) return;

        const nextEnabled = !Boolean(patient.app_access_enabled);
        setUpdatingAccessPatientIds((prev) => {
            const next = new Set(prev);
            next.add(patient.id);
            return next;
        });

        try {
            await updatePatientAppAccess({
                hospitalId: profile.id,
                patientId: patient.id,
                enabled: nextEnabled,
            });

            setPastRecords((prev) => prev.map((item) => (
                item.id === patient.id
                    ? { ...item, app_access_enabled: nextEnabled }
                    : item
            )));

            toast.success(`Patient App access ${nextEnabled ? 'enabled' : 'disabled'} for ${patient.name}`);
        } catch (error: any) {
            console.error('Failed to update patient app access:', error);
            toast.error(error?.message || 'Failed to update Patient App access');
        } finally {
            setUpdatingAccessPatientIds((prev) => {
                const next = new Set(prev);
                next.delete(patient.id);
                return next;
            });
        }
    };

    const handleStopFollowup = (patient: ReceptionPastRecordPatient) => {
        setStopFollowupTarget({
            patientId: patient.id,
            patientName: patient.name,
        });
        setStopFollowupReason(patient.followupStopReason || '');
    };

    const closeStopFollowupModal = () => {
        if (stopFollowupSubmitting) return;
        setStopFollowupTarget(null);
        setStopFollowupReason('');
    };

    const handleSubmitStopFollowup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id || !stopFollowupTarget) return;

        const reason = stopFollowupReason.trim();
        if (!reason) {
            toast.error('Reason is required to stop follow-up');
            return;
        }

        setStopFollowupSubmitting(true);
        try {
            await stopPatientFollowup({
                hospitalId: profile.id,
                patientId: stopFollowupTarget.patientId,
                reason,
            });

            const nowIso = new Date().toISOString();
            setLocallyStoppedFollowupIds((prev) => {
                const next = new Set(prev);
                next.add(stopFollowupTarget.patientId);
                return next;
            });
            setStopFollowupOverrides((prev) => ({
                ...prev,
                [stopFollowupTarget.patientId]: {
                    continuityStatus: 'transferred_out',
                    followupStoppedAt: nowIso,
                    followupStopReason: reason,
                },
            }));
            setPastRecords((prev) => prev.map((item) => {
                if (item.id !== stopFollowupTarget.patientId) return item;
                return {
                    ...item,
                    continuityStatus: 'transferred_out',
                    followupStoppedAt: item.followupStoppedAt || nowIso,
                    followupStopReason: reason,
                    latestReviewDate: null,
                };
            }));

            toast.success('Follow-up stopped and active reviews cancelled');
            closeStopFollowupModal();
            fetchPastRecords(true, 0, false, {
                searchValue: searchQuery,
                reviewFilterValue: activeListFilter,
                reviewDateValue: reviewDateFilter,
            });
        } catch (error) {
            console.error('Failed to stop follow-up:', error);
            toast.error('Could not stop follow-up for this patient');
        } finally {
            setStopFollowupSubmitting(false);
        }
    };

    const handleSubmitCallLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id || !callLogTarget) return;

        setCallLogSubmitting(true);
        try {
            const effectiveReviewDate = callLogStatus === 'picked'
                ? callLogRescheduleDate
                : callLogNextDate;

            // Supabase quirk: .eq(col, null) sends `col=eq.null` which Postgres tries
            // to coerce to the column type (UUID here) and rejects with
            // "invalid input syntax for type uuid: 'null'". Use .is(col, null) instead.
            let reviewLookup = (supabase as any)
                .from('hospital_patient_reviews')
                .select('id, patient_id, next_review_date')
                .eq('hospital_id', profile.id)
                .eq('patient_id', callLogTarget.patientId);
            reviewLookup = callLogTarget.doctorId
                ? reviewLookup.eq('doctor_id', callLogTarget.doctorId)
                : reviewLookup.is('doctor_id', null);

            const { data: existingReview, error: existingError } = await reviewLookup
                .in('status', ['pending', 'rescheduled'])
                .order('next_review_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingError) throw existingError;

            // Has the review moved since this modal opened?
            //
            // Calls are made in the morning and typed up in the evening, so the card
            // behind this form can be hours old. A doctor who saw the patient in the
            // meantime has already set a new date, and writing the typed one on top
            // silently overrules them — which is exactly how KNH/25/028475 lost her
            // 13 Aug review to a 14 Jul call logged 3h38m after her visit. Ask first.
            const storedReviewDate = existingReview?.next_review_date || null;
            const capturedReviewDate = callLogTarget.reviewDate || null;
            if (
                effectiveReviewDate
                && storedReviewDate
                && storedReviewDate !== capturedReviewDate
                && callLogDateDecisionRef.current === null
            ) {
                setCallLogConflict({ storedDate: storedReviewDate, typedDate: effectiveReviewDate });
                setCallLogSubmitting(false);
                return;
            }

            // Only write next_review_date when the user actually chose one.
            //
            // This used to fall back to `callLogTarget.reviewDate` — the date captured
            // from the CARD when the modal opened. Logging a call with no reschedule
            // date then wrote that on-screen value straight back into the row, so a
            // stale list silently overwrote the doctor's newer date. KNH/25/028475 was
            // prescribed a 13 Aug review at 02:07pm; a call logged afterwards from a
            // list loaded earlier that day pushed 14 Jul back over it, and she dropped
            // out of Due Today on 13 Aug entirely. A call log records a CALL — it must
            // not silently move an appointment nobody asked to move.
            const reviewPatch: Record<string, any> = {
                status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
                cancelled_at: null,
                completed_at: null,
                updated_at: new Date().toISOString(),
            };
            if (effectiveReviewDate && callLogDateDecisionRef.current !== 'keep') {
                reviewPatch.next_review_date = effectiveReviewDate;
            }

            if (existingReview?.id) {
                const { error: updateError } = await (supabase as any)
                    .from('hospital_patient_reviews')
                    .update(reviewPatch)
                    .eq('id', existingReview.id);
                if (updateError) throw updateError;
            } else if (callLogTarget.mrNumber) {
                const { data: mrPatient, error: mrLookupError } = await (supabase as any)
                    .from('hospital_patients')
                    .select('id')
                    .eq('hospital_id', profile.id)
                    .eq('mr_number', callLogTarget.mrNumber)
                    .maybeSingle();

                if (mrLookupError) throw mrLookupError;

                if (mrPatient?.id) {
                    const { error: insertError } = await (supabase as any)
                        .from('hospital_patient_reviews')
                        .insert({
                            hospital_id: profile.id,
                            patient_id: mrPatient.id,
                            doctor_id: null,
                            next_review_date: effectiveReviewDate || callLogTarget.reviewDate,
                            status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
                        });
                    if (insertError) throw insertError;
                }
            }

            await (supabase as any)
                .from('hospital_patient_followups')
                .insert({
                    hospital_id: profile.id,
                    review_id: existingReview?.id || null,
                    patient_id: callLogTarget.patientId,
                    doctor_id: callLogTarget.doctorId || null,  // NEW: Include doctor_id
                    called_at: new Date().toISOString(),
                    call_status: callLogStatus,
                    patient_response: callLogNotes.trim() || null,
                    next_followup_date: callLogStatus === 'not_picked' ? (callLogNextDate || null) : null,
                    attended: null,
                    created_by_name: profile?.name || null,
                });

            toast.success('Call log saved');
            closeCallLog();
            await fetchPastRecords(false, 0, false, {
                searchValue: searchQuery,
                reviewFilterValue: activeListFilter,
                reviewDateValue: reviewDateFilter,
            });
        } catch (error: any) {
            console.error('Call log save error:', error);
            toast.error(error.message || 'Failed to save call log');
        } finally {
            setCallLogSubmitting(false);
        }
    };

    // Loading timeout - prevents infinite loading state
    useEffect(() => {
        if (isLoadingQueue) {
            const timeout = setTimeout(() => {
                setIsLoadingQueue(false);
                toast.error('Loading timed out. Please try refreshing.');
            }, 15000); // 15 second timeout
            return () => clearTimeout(timeout);
        }
    }, [isLoadingQueue]);

    const fetchReviewAlertCount = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const today = toLocalISODate(new Date());
            const { count, error } = await (supabase as any)
                .from('hospital_patient_reviews')
                .select('id', { count: 'exact', head: true })
                .eq('hospital_id', profile.id)
                .in('status', ['pending', 'rescheduled'])
                .lte('next_review_date', today);

            if (error) {
                // If table is not migrated yet, silently ignore.
                if (String(error.message || '').toLowerCase().includes('hospital_patient_reviews')) {
                    setReviewAlertCount(0);
                    return;
                }
                throw error;
            }
            setReviewAlertCount(count || 0);
        } catch (error) {
            console.warn('Review alert count unavailable:', error);
            setReviewAlertCount(0);
        }
    }, [profile?.id]);

    // Initial fetch
    useEffect(() => {
        if (profile?.id) {
            fetchDoctors();
            fetchQueue();
            fetchHospitalSettings();
            fetchReviewAlertCount();
        }
    }, [profile?.id, fetchDoctors, fetchQueue, fetchReviewAlertCount]);

    useEffect(() => {
        if (activeTab !== 'past_records' || isPanelView) return;
        setPastRecords([]);
        setPastRecordsPage(0);
        setHasMorePastRecords(true);
        fetchPastRecords(false, 0, false, {
            searchValue: searchQuery,
            reviewFilterValue: activeListFilter,
            reviewDateValue: reviewDateFilter,
        });
    }, [activeTab, reviewFilter, reviewDateFilter, fetchPastRecords]);

    useEffect(() => {
        if (activeTab !== 'past_records' || isPanelView) return;

        const debounce = setTimeout(() => {
            setPastRecords([]);
            setPastRecordsPage(0);
            setHasMorePastRecords(true);
            // Background fetch keeps typing smooth and avoids input focus disruption.
            fetchPastRecords(true, 0, false, {
                searchValue: searchQuery,
                reviewFilterValue: activeListFilter,
                reviewDateValue: reviewDateFilter,
            });
        }, 350);

        return () => clearTimeout(debounce);
    }, [searchQuery, activeTab, reviewFilter, reviewDateFilter, fetchPastRecords]);

    // Fetch single item for realtime inserts
    const fetchSingleQueueItem = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('hospital_queues')
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    doctor:hospital_doctors(*)
                `)
                .eq('id', id)
                .single();

            if (data && !error) {
                setQueue((prev: any[]) => {
                    const exists = prev.some((item: any) => item.id === (data as any).id);
                    if (exists) return prev;
                    return [data, ...prev].sort((a: any, b: any) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                });
            }
        } catch (error) {
            console.error('Error fetching new queue item:', error);
        }
    };

    // Realtime subscription for queue updates - Optimized
    useEffect(() => {
        if (!profile?.id) return;

        console.log('Setting up optimized realtime subscription...');
        const channel = supabase
            .channel(`reception-queue-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_queues',
                    filter: `hospital_id=eq.${profile.id}`
                },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        // New item added - fetch details with joins
                        fetchSingleQueueItem(payload.new.id);
                        toast.success('New patient registered', { duration: 3000, position: 'bottom-right' });
                    } else if (payload.eventType === 'UPDATE') {
                        // Update existing item - merge changes
                        setQueue((prev: any[]) => prev.map((item: any) => {
                            if (item.id === payload.new.id) {
                                return { ...item, ...payload.new };
                            }
                            return item;
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        // Remove item
                        setQueue((prev: any[]) => prev.filter((item: any) => item.id !== payload.old.id));
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_doctors',
                    filter: `hospital_id=eq.${profile.id}`
                },
                () => {
                    fetchDoctors();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Realtime connected');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime connection error, falling back to fetch');
                    fetchQueue(true);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, fetchDoctors]); // Removed fetchQueue dependency to avoid recreation

    // Refetch when tab becomes visible (Keep this for consistency/recovery)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && profile?.id) {
                // Check if queue is empty or stale? Just quick refresh to be safe.
                fetchQueue(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [profile?.id, fetchQueue]);

    const calculateNextToken = useCallback(() => {
        if (queue.length === 0) return "1";

        // Extract numeric tokens, filtering out non-numeric ones
        const numericTokens = queue
            .map(item => parseInt(queueRowToken(item) || '0', 10))
            .filter(num => !isNaN(num) && num > 0);

        if (numericTokens.length === 0) return "1";

        const maxToken = Math.max(...numericTokens);
        return String(maxToken + 1);
    }, [queue]);

    const handleOpenWalkInModal = () => {
        const nextToken = calculateNextToken();

        setRegistrationMode('queue');
        setWalkInForm({
            name: '',
            age: '',
            dob: '',
            gender: '',
            fatherHusbandName: '',
            place: '',
            phone: '',
            department: '',
            doctorId: '',
            tokenNumber: nextToken, // Pre-fill with smart Auto-Calc
            mrNumber: 'KNH/',
            reviewDate: ''
        });

        setShowWalkInModal(true);
    };

    const handleOpenPastRegistrationModal = () => {
        setRegistrationMode('past_record');
        setWalkInForm({
            name: '',
            age: '',
            dob: '',
            gender: '',
            fatherHusbandName: '',
            place: '',
            phone: '',
            department: '',
            doctorId: '',
            tokenNumber: '',
            mrNumber: 'KNH/',
            reviewDate: ''
        });
        setShowWalkInModal(true);
        setBhidMatch(null);
        setIsSearchingBhid(false);
        setMrSuggestions([]);
        setShowMrDropdown(false);
    };

    const searchPatientsByMr = useCallback(async (query: string) => {
        if (!profile?.id) return;
        if (!query || query.length < 2) {
            setMrSuggestions([]);
            setShowMrDropdown(false);
            return;
        }
        setMrSearchLoading(true);
        try {
            const { data, error } = await supabase
                .from('hospital_patients' as any)
                .select('id, name, age, mr_number, phone, place, father_husband_name, gender')
                .eq('hospital_id', profile.id)
                .ilike('mr_number', `%${query}%`)
                .order('created_at', { ascending: false })
                .limit(8) as { data: MrPatient[] | null; error: any };
            if (!error && data && data.length > 0) {
                setMrSuggestions(data);
                setShowMrDropdown(true);
            } else {
                setMrSuggestions([]);
                setShowMrDropdown(false);
            }
        } catch {
            setMrSuggestions([]);
            setShowMrDropdown(false);
        } finally {
            setMrSearchLoading(false);
        }
    }, [profile?.id]);

    const handleMrNumberChange = (value: string) => {
        setWalkInForm(prev => ({ ...prev, mrNumber: value }));
        if (registrationMode === 'past_record') {
            setMrSuggestions([]);
            setShowMrDropdown(false);
            return;
        }
        if (mrInputRef.current) {
            const rect = mrInputRef.current.getBoundingClientRect();
            setMrDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            });
        }
        if (mrSearchTimeout.current) clearTimeout(mrSearchTimeout.current);
        mrSearchTimeout.current = setTimeout(() => searchPatientsByMr(value), 300);
    };

    const handleSelectMrPatient = (patient: MrPatient) => {
        setWalkInForm(prev => ({
            ...prev,
            mrNumber: patient.mr_number || '',
            name: patient.name || '',
            age: patient.age ? String(patient.age) : '',
            phone: patient.phone || '',
            place: patient.place || '',
            fatherHusbandName: patient.father_husband_name || '',
            gender: patient.gender || '',
        }));
        setShowMrDropdown(false);
        setMrSuggestions([]);
        toast.success('Returning patient — details filled');
    };

    const handleCloseWalkInModal = () => {
        setShowWalkInModal(false);
        setRegistrationMode('queue');
        setWalkInForm({ name: '', age: '', dob: '', gender: '', fatherHusbandName: '', place: '', phone: '', department: '', doctorId: '', tokenNumber: '', mrNumber: '', reviewDate: '' });
        setBhidMatch(null);
        setIsSearchingBhid(false);
        setMrSuggestions([]);
        setShowMrDropdown(false);
        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    };

    const fetchHospitalSettings = async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('hospital_profiles')
                .select('*')
                .eq('id', profile.id)
                .single() as { data: any; error: any };

            if (data && !error) {
                setHospitalSettings({
                    hospitalName: data.hospital_name || profile.name || '',
                    address: data.address || '',
                    contactNumber: data.contact_number || '',
                    email: data.email || profile.email || '',
                    avatarUrl: data.avatar_url || profile.avatar_url || '',
                    features: data.features || { capture_phone: true }
                });
                if (data.avatar_url || profile.avatar_url) {
                    setAvatarPreview(data.avatar_url || profile.avatar_url);
                }
            } else {
                setHospitalSettings({
                    hospitalName: profile.name || '',
                    address: '',
                    contactNumber: '',
                    email: profile.email || '',
                    avatarUrl: profile.avatar_url || '',
                    features: { capture_phone: true }
                });
                if (profile.avatar_url) {
                    setAvatarPreview(profile.avatar_url);
                }
            }

            // Sync printer settings if they exist
            if (data?.printer_settings) {
                setPrinterSettings(data.printer_settings);
            }
        } catch (err) {
            console.warn('Failed to fetch hospital settings:', err);
        }
    };

    const handleSavePrinterSettings = async (newSettings: { spacing: number; alignment: 'left' | 'center' | 'right' }) => {
        if (!profile?.id) return;

        setIsSavingPrinterSettings(true);
        try {
            const { error: updateError } = await ((supabase
                .from('hospital_profiles' as any) as any)
                .update({
                    printer_settings: newSettings
                } as any)
                .eq('id', profile.id) as any);

            if (updateError) throw updateError;

            setPrinterSettings(newSettings);
            toast.success('Layout saved successfully!');
        } catch (error: any) {
            console.error('Save printer settings error:', error);
            toast.error(`Auto-save failed: ${error.message}`);
        } finally {
            setIsSavingPrinterSettings(false);
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setIsSavingSettings(true);
        const toastId = toast.loading('Saving settings...');

        try {
            let avatarUrl = hospitalSettings.avatarUrl;

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `hospital-${profile.id}-${Date.now()}.${fileExt}`;
                const filePath = `hospital-logos/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('medical-records')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) {
                    console.error('Avatar upload error:', uploadError);
                    toast.error('Failed to upload image', { id: toastId });
                    setIsSavingSettings(false);
                    return;
                }

                const { data: urlData } = supabase.storage
                    .from('medical-records')
                    .getPublicUrl(filePath);

                avatarUrl = getProxiedUrl(urlData.publicUrl);
            }

            const { error: profileError } = await (supabase
                .from('hospital_profiles' as any)
                .upsert({
                    id: profile.id,
                    hospital_name: hospitalSettings.hospitalName,
                    address: hospitalSettings.address,
                    contact_number: hospitalSettings.contactNumber,
                    features: hospitalSettings.features,
                    updated_at: new Date().toISOString()
                } as any) as any);

            if (profileError) {
                console.error('Settings save error:', profileError);
                toast.error('Failed to save settings', { id: toastId });
                setIsSavingSettings(false);
                return;
            }

            await (supabase.from('users') as any)
                .update({
                    name: hospitalSettings.hospitalName,
                    avatar_url: avatarUrl,
                    email: hospitalSettings.email
                } as any)
                .eq('id', profile.id);

            // Refresh profile to update dashboard header and global state
            await refreshProfile();

            toast.success('Settings saved successfully!', { id: toastId });
            setShowSettingsModal(false);
            setAvatarFile(null);
        } catch (error: any) {
            console.error('Save settings error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleWalkInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const toastId = toast.loading('Registering patient...');

        try {
            if (!profile?.id) {
                throw new Error('Hospital profile not found');
            }

            const manualToken = walkInForm.tokenNumber.trim();
            // Treat a bare "KNH/" prefix (no MR digits typed) as empty so the
            // autofilled prefix alone isn't saved as a real MR number.
            const trimmedMr = walkInForm.mrNumber.trim();
            const normalizedMrNumber = (trimmedMr && trimmedMr.toUpperCase() !== 'KNH/') ? trimmedMr : null;
            const normalizedPhone = walkInForm.phone.trim() || null;
            const linkedUserId = bhidMatch?.id || null;

            if (isPastRegistration) {
                if (!walkInForm.name.trim() || !walkInForm.age.trim() || !normalizedMrNumber) {
                    throw new Error('Please fill name, date of birth, and MR number');
                }

                const { data: duplicateMr, error: duplicateMrError } = await (supabase as any)
                    .from('hospital_patients')
                    .select('id')
                    .eq('hospital_id', profile.id)
                    .eq('mr_number', normalizedMrNumber)
                    .maybeSingle();

                if (duplicateMrError) throw duplicateMrError;
                if (duplicateMr?.id) {
                    throw new Error('MR number already exists');
                }

                const { data: patientData, error: patientError } = await (supabase as any)
                    .from('hospital_patients')
                    .insert({
                        hospital_id: profile.id,
                        name: walkInForm.name,
                        age: walkInForm.age.trim() || null,
                        gender: walkInForm.gender || null,
                        token_number: null,
                        mr_number: normalizedMrNumber,
                        father_husband_name: walkInForm.fatherHusbandName || null,
                        place: walkInForm.place || null,
                        phone: normalizedPhone,
                        linked_user_id: linkedUserId || null,
                    })
                    .select('id, name')
                    .single();

                if (patientError) throw patientError;

                if (walkInForm.reviewDate) {
                    const { error: reviewInsertError } = await (supabase as any)
                        .from('hospital_patient_reviews')
                        .insert({
                            hospital_id: profile.id,
                            patient_id: patientData.id,
                            doctor_id: null,
                            next_review_date: walkInForm.reviewDate,
                            status: 'pending',
                        });
                    if (reviewInsertError) throw reviewInsertError;
                }

                toast.success(`New registration saved for ${patientData.name}`, { id: toastId });
                handleCloseWalkInModal();
                setActiveTab('past_records');
                await fetchPastRecords(false, 0, false, {
                    searchValue: searchQuery,
                    reviewFilterValue: activeListFilter,
                    reviewDateValue: reviewDateFilter,
                });
                await fetchReviewAlertCount();
                return;
            }

            if (!walkInForm.doctorId || !walkInForm.tokenNumber) {
                toast.error('Please fill all required fields', { id: toastId });
                return;
            }

            // 1. UNIQUE TOKEN CHECK (For today)
            // Check against local queue state which contains all today's patients
            const isTokenTaken = queue.some(item =>
                queueRowToken(item) === manualToken &&
                item.status !== 'cancelled'
            );

            if (isTokenTaken) {
                toast.dismiss(toastId);
                toast.error(`Token #${manualToken} is already active today! Please choose another.`);
                return;
            }

            let patientId: string | null = null;
            let existingPatientName: string | null = null;
            let isExistingPatient = false;

            // Reuse existing patient by MR number (strong key).
            if (normalizedMrNumber) {
                const existingByMr = await supabase
                    .from('hospital_patients')
                    .select('id, name')
                    .eq('hospital_id', profile.id)
                    .eq('mr_number', normalizedMrNumber)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (existingByMr.error) throw existingByMr.error;
                if ((existingByMr as any).data) {
                    patientId = (existingByMr as any).data.id;
                    existingPatientName = (existingByMr as any).data.name;
                    isExistingPatient = true;
                }
            }

            // Fallback reuse by linked BeanHealth user.
            if (!patientId && linkedUserId) {
                const existingByLinkedUser = await supabase
                    .from('hospital_patients')
                    .select('id, name')
                    .eq('hospital_id', profile.id)
                    .eq('linked_user_id', linkedUserId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (existingByLinkedUser.error) throw existingByLinkedUser.error;
                if ((existingByLinkedUser as any).data) {
                    patientId = (existingByLinkedUser as any).data.id;
                    existingPatientName = (existingByLinkedUser as any).data.name;
                    isExistingPatient = true;
                }
            }

            // CHECK: Is this patient already in the queue TODAY?
            if (patientId && !duplicateOverrideRef.current) {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const { data: existingQueueData } = await (supabase
                    .from('hospital_queues') as any)
                    .select('id, queue_number, doctor_id, doctor:hospital_doctors(name)')
                    .eq('hospital_id', profile.id)
                    .eq('patient_id', patientId)
                    .gte('created_at', todayStart.toISOString())
                    .limit(1)
                    .maybeSingle();

                if (existingQueueData) {
                    const existingDoctorId = existingQueueData.doctor_id;
                    const newDoctorId = walkInForm.doctorId;

                    if (existingDoctorId === newDoctorId) {
                        // Same doctor — hard block
                        toast.dismiss(toastId);
                        toast.error(`${existingPatientName || 'Patient'} is already in queue for this doctor today!`);
                        return;
                    } else {
                        // Different doctor — prompt for confirmation
                        const existingDoctorName = (existingQueueData.doctor as any)?.name || 'another doctor';
                        const newDoctorName = doctors.find(d => d.id === newDoctorId)?.name || 'new doctor';
                        toast.dismiss(toastId);
                        setDuplicateQueueWarning({
                            patientName: existingPatientName || walkInForm.name,
                            existingDoctorName,
                            newDoctorName,
                        });
                        return;
                    }
                }
            }
            // Capture override state before resetting — needed to skip patient token update below
            const wasDuplicateOverride = duplicateOverrideRef.current;
            // Reset override flag after it's been used
            duplicateOverrideRef.current = false;

            // Assign the validated manual token to globalToken variable to maintain compatibility with updated code below
            const globalToken = manualToken;
            if (patientId) {
                const patientPayload: any = {
                    name: walkInForm.name,
                    age: walkInForm.age.trim() || null,
                    gender: walkInForm.gender || null,
                    mr_number: normalizedMrNumber,
                    father_husband_name: walkInForm.fatherHusbandName || null,
                    place: walkInForm.place || null,
                    phone: normalizedPhone,
                    linked_user_id: linkedUserId || null
                };
                // Skip patient token update on duplicate override — the second queue entry
                // for a different doctor gets its own token stored on hospital_queues.token_number
                if (!wasDuplicateOverride) {
                    patientPayload.token_number = globalToken;
                }
                const patientUpdate = await (supabase
                    .from('hospital_patients') as any)
                    .update(patientPayload)
                    .eq('id', patientId);
                if (patientUpdate.error) throw patientUpdate.error;
            } else {
                const patientInsert = await (supabase
                    .from('hospital_patients') as any)
                    .insert({
                        hospital_id: profile.id,
                        name: walkInForm.name,
                        age: walkInForm.age.trim() || null,
                        gender: walkInForm.gender || null,
                        token_number: globalToken, // Use calculated global token
                        mr_number: normalizedMrNumber,
                        father_husband_name: walkInForm.fatherHusbandName || null,
                        place: walkInForm.place || null,
                        phone: normalizedPhone,
                        linked_user_id: linkedUserId
                    })
                    .select('id')
                    .single();

                if (patientInsert.error) throw patientInsert.error;
                patientId = (patientInsert.data as any)?.id || null;
            }

            if (!patientId) throw new Error('Patient save failed');

            let nextQueueNo = 1;
            let queueError: any = null;

            // Doctor-Specific Queue Number
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);

            const maxQueue = await supabase
                .from('hospital_queues')
                .select('queue_number')
                .eq('doctor_id', walkInForm.doctorId)
                .gte('created_at', todayStart.toISOString())
                .lt('created_at', tomorrowStart.toISOString())
                .order('queue_number', { ascending: false })
                .limit(1);

            if (maxQueue.error) throw maxQueue.error;
            nextQueueNo = ((maxQueue.data?.[0] as any)?.queue_number || 0) + 1;

            const queueInsert = await (supabase
                .from('hospital_queues') as any)
                .insert({
                    hospital_id: profile.id,
                    patient_id: patientId,
                    doctor_id: walkInForm.doctorId,
                    queue_number: nextQueueNo,
                    token_number: globalToken,
                    status: 'pending'
                });
            queueError = queueInsert.error;

            if (queueError) {
                console.error('Queue Insertion Error:', queueError);
                throw new Error(queueError.message);
            }

            // Auto-complete pending review if returning patient walked in early
            if (isExistingPatient && patientId) {
                try {
                    const { data: activeReview } = await (supabase as any)
                        .from('hospital_patient_reviews')
                        .select('id')
                        .eq('hospital_id', profile.id)
                        .eq('patient_id', patientId)
                        .in('status', ['pending', 'rescheduled'])
                        .order('next_review_date', { ascending: true })
                        .limit(1)
                        .maybeSingle();

                    if (activeReview?.id) {
                        await (supabase as any)
                            .from('hospital_patient_reviews')
                            .update({
                                status: 'completed',
                                completed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', activeReview.id);

                        toast.success('Review marked as completed — patient visited early', { duration: 4000 });
                        fetchReviewAlertCount();
                    }
                } catch (reviewErr) {
                    console.warn('Auto-complete review failed (non-critical):', reviewErr);
                }
            }

            // Find the selected doctor for the print dialog
            const selectedDoctor = doctors.find(d => d.id === walkInForm.doctorId);

            toast.success(`Patient registered! Token: ${globalToken}`, { id: toastId });

            // Store patient info for printing and show print dialog
            setLastRegisteredPatient({
                tokenNumber: globalToken,
                name: walkInForm.name,
                mrNumber: walkInForm.mrNumber || undefined,
                doctorName: selectedDoctor?.name || '',
                department: walkInForm.department
            });
            setShowPrintDialog(true);

            // Auto-link to BeanHealth app account if match was found
            if (bhidMatch && patientId) {
                try {
                    await BeanhealthIdService.linkPatientToUser(
                        patientId,
                        bhidMatch.id,
                        profile.id,
                        walkInForm.mrNumber || undefined
                    );
                    toast.success(`Linked to BeanHealth ID: ${bhidMatch.beanhealthId}`, { duration: 4000 });
                } catch (linkErr) {
                    console.warn('Auto-link failed:', linkErr);
                }
            }

            handleCloseWalkInModal();
            fetchQueue();
        } catch (error: any) {
            console.error('Registration Error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
        }
    };

    // Print token handler
    const handlePrintToken = async () => {
        if (!lastRegisteredPatient) return;

        setIsPrintingToken(true);
        try {
            const tokenData = createTokenData({
                tokenNumber: lastRegisteredPatient.tokenNumber,
                patientName: lastRegisteredPatient.name,
                mrNumber: lastRegisteredPatient.mrNumber,
                doctorName: lastRegisteredPatient.doctorName,
                department: lastRegisteredPatient.department
            });

            // Apply custom layout settings
            tokenData.settings = printerSettings;

            const receiptData = getReceiptBytes(tokenData, tenant);
            await printerService.print(receiptData);

            toast.success('Token printed successfully!');
            setShowPrintDialog(false);
            setLastRegisteredPatient(null);
        } catch (error: any) {
            console.error('Print error:', error);
            toast.error(error.message || 'Failed to print token');
        } finally {
            setIsPrintingToken(false);
        }
    };

    // Check printer connection status periodically
    useEffect(() => {
        const checkPrinterStatus = () => {
            setPrinterConnected(printerService.isConnected());
        };

        checkPrinterStatus();
        const interval = setInterval(checkPrinterStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    // Reprint token for a patient from the queue
    const handleReprintFromQueue = async (queueItem: QueueItem) => {
        if (!printerConnected) {
            toast.error('Please connect printer first');
            return;
        }

        const toastId = toast.loading('Printing token...');
        try {
            const tokenData = createTokenData({
                tokenNumber: queueRowToken(queueItem) || String(queueItem.queue_number),
                patientName: queueItem.patient?.name || 'Unknown',
                mrNumber: queueItem.patient.mr_number || undefined,
                doctorName: queueItem.doctor?.name || '',
                department: queueItem.doctor?.specialty || ''
            });

            // Apply custom layout settings
            tokenData.settings = printerSettings;

            const receiptData = getReceiptBytes(tokenData, tenant);
            await printerService.print(receiptData);

            toast.success('Token reprinted!', { id: toastId });
        } catch (error: any) {
            console.error('Reprint error:', error);
            toast.error(error.message || 'Failed to reprint', { id: toastId });
        }
    };

    const openEditQueueItem = (item: any) => {
        setEditQueueItem(item);
        setEditTokenError('');
        setEditForm({
            name: item.patient?.name || '',
            age: String(item.patient?.age || ''),
            tokenNumber: queueRowToken(item),
            doctorId: item.doctor_id || '',
            gender: item.patient?.gender || '',
            fatherHusbandName: item.patient?.father_husband_name || '',
            place: item.patient?.place || '',
            phone: item.patient?.phone || '',
            mrNumber: item.patient?.mr_number || ''
        });
    };

    const handleSaveEditQueueItem = async () => {
        if (!editQueueItem || !profile?.id) return;
        const newToken = editForm.tokenNumber.trim();
        // Check token uniqueness (excluding current patient)
        const tokenConflict = queue.find(q =>
            queueRowToken(q) === newToken &&
            q.id !== editQueueItem.id
        );
        if (tokenConflict) {
            setEditTokenError(`Token ${newToken} is already assigned to ${tokenConflict.patient?.name}`);
            return;
        }
        setEditSaving(true);
        try {
            const { error: patientErr } = await (supabase as any)
                .from('hospital_patients')
                .update({
                    name: editForm.name.trim(),
                    age: editForm.age.trim() || null,
                    token_number: newToken,
                    gender: editForm.gender || null,
                    father_husband_name: editForm.fatherHusbandName.trim() || null,
                    place: editForm.place.trim() || null,
                    phone: editForm.phone.trim() || null,
                    mr_number: editForm.mrNumber.trim() || null
                })
                .eq('id', editQueueItem.patient?.id);
            if (patientErr) throw patientErr;
            const { error: queueErr } = await (supabase as any)
                .from('hospital_queues')
                .update({ doctor_id: editForm.doctorId || null, token_number: newToken })
                .eq('id', editQueueItem.id);
            if (queueErr) throw queueErr;
            toast.success('Patient details updated');
            setEditQueueItem(null);
            fetchQueue(true);
        } catch (err: any) {
            toast.error(err.message || 'Failed to save changes');
        } finally {
            setEditSaving(false);
        }
    };

    const confirmDelete = (type: 'queue' | 'patient', id: string, name: string, queueId?: string) => {
        setItemToDelete({ type, id, name, queueId });
        setShowDeleteModal(true);
    };

    const handleDeletePatient = async () => {
        if (!itemToDelete || !profile?.id) return;

        setIsDeleting(true);
        const toastId = toast.loading('Deleting record...');

        try {
            // 1. If it's a queue item or has a queueId, delete from hospital_queues first
            // Note: If we are deleting a patient from Past Records, they might still have queue entries.
            // PostgreSQL foreign key constraints usually handle cascading deletes if configured, 
            // but we'll be explicit here to be safe and ensure UI updates correctly.

            if (itemToDelete.type === 'queue' && itemToDelete.queueId) {
                const { error: queueError } = await supabase
                    .from('hospital_queues')
                    .delete()
                    .eq('id', itemToDelete.queueId);

                if (queueError) throw queueError;
            } else if (itemToDelete.type === 'patient') {
                // If deleting a patient entirely, we should remove all their queue entries first
                const { error: queueError } = await supabase
                    .from('hospital_queues')
                    .delete()
                    .eq('patient_id', itemToDelete.id);

                if (queueError) console.warn('Error clearing queue entries:', queueError); // Continue anyway
            }

            // 2. Delete the patient record only when explicitly requested from Past Records
            if (itemToDelete.type === 'patient') {
                const { error: patientError } = await supabase
                    .from('hospital_patients')
                    .delete()
                    .eq('id', itemToDelete.id);

                if (patientError) throw patientError;
            }

            toast.success('Record deleted successfully', { id: toastId });
            setShowDeleteModal(false);
            setItemToDelete(null);

            // Refresh data
            fetchQueue();
            if (activeTab === 'past_records') {
                setPastRecords(prev => prev.filter(p => p.id !== itemToDelete.id));
                setPastRecordsTotal(prev => Math.max(0, prev - 1));
            }

        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error(`Failed to delete: ${error.message || 'Unknown error'}`, { id: toastId });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('reception_authenticated');
        navigate('/enterprise-dashboard/reception');
    };

    // Patient Details Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedPatientDetails, setSelectedPatientDetails] = useState<any>(null);

    // const handleViewDetails = (patient: any) => {
    //     setSelectedPatientDetails(patient);
    //     setShowDetailsModal(true);
    // };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-black font-sans selection:bg-secondary-100 selection:text-secondary-900">
            {/* Nav - Floating Glassmorphism Header */}
            <div className="sticky top-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-100 via-gray-100/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent" />

                <header className="pointer-events-auto relative mt-2 sm:mt-4 w-full max-w-7xl h-16 sm:h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-xl saturate-150 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-[#8AC43C]/15 flex items-center transition-all duration-300 shadow-sm md:shadow-2xl dark:shadow-[0_0_20px_rgba(138,196,60,0.1)]">
                    <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
                        {/* Left Section - Back + BeanHealth Logo & Enterprise Tagline */}
                        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                            <button
                                onClick={() => navigate('/enterprise-dashboard')}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0"
                                title="Back to Dashboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

                            <div className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all duration-300">
                                    <LogoIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <h2 className="text-sm sm:text-lg md:text-xl font-bold leading-none tracking-tight">
                                        <span className="text-primary-500 dark:text-[#e6b8a3]">Bean</span>
                                        <span className="text-secondary-500">Health</span>
                                    </h2>
                                    <p className="text-[7px] sm:text-[9px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5 uppercase truncate">Enterprise Portal</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Section - Hospital Logo & Name + Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
                            {/* Hospital Info */}
                            <button
                                onClick={() => { fetchHospitalSettings(); setShowSettingsModal(true); }}
                                className="flex items-center gap-3 p-1 rounded-xl transition-transform active:scale-95 cursor-pointer group"
                            >
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-transform group-hover:scale-105">
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={profile?.name || 'Hospital'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {profile?.name?.charAt(0) || 'H'}
                                        </span>
                                    )}
                                </div>
                                <span className="hidden sm:inline-block text-sm md:text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">{displayName}</span>
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Title & Actions */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Reception Desk</h2>
                        <p className="text-gray-700 mt-1">Manage patient check-ins and appointments</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Printer Status Button */}
                        <button
                            onClick={() => setShowPrinterSetup(true)}
                            className={`p-3 rounded-xl border transition-all shadow-sm flex items-center gap-2 ${printerConnected
                                ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                                }`}
                            title={printerConnected ? 'Printer Connected' : 'Connect Printer'}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span className={`hidden sm:inline text-sm font-medium ${printerConnected ? 'text-green-700' : 'text-gray-600'}`}>
                                {printerConnected ? 'Connected' : 'Printer'}
                            </span>
                            {printerConnected && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            )}
                        </button>
                        <button
                            onClick={() => navigate('/enterprise-dashboard/reception/tracker')}
                            className="relative px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:text-gray-900 hover:border-gray-300 font-semibold shadow-sm transition-all text-sm whitespace-nowrap"
                            title="Track patients with review dates"
                        >
                            Track patients
                            {reviewAlertCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                                    {reviewAlertCount > 99 ? '99+' : reviewAlertCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => fetchQueue()}
                            className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                            title="Reload"
                        >
                            <svg className={`w-5 h-5 ${isLoadingQueue ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <button
                            onClick={handleOpenWalkInModal}
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-semibold shadow-lg shadow-orange-500/20 hover:shadow-xl transition-all flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">New Registration</span>
                            <span className="inline sm:hidden">Register</span>
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Total Visits (Today)</p>
                        <p className="text-4xl font-bold text-gray-900">{queue.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-2">Waiting</p>
                        <p className="text-4xl font-bold text-orange-500">{queue.filter(q => q.status === 'pending').length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Completed</p>
                        <p className="text-4xl font-bold text-green-600">{queue.filter(q => q.status === 'completed').length}</p>
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Outpatient {queue.filter(q => q.status === 'completed' && q.admission_status !== 'admitted').length}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                                Admitted {queue.filter(q => q.status === 'completed' && q.admission_status === 'admitted').length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Queue List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'queue' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-700'}`}
                            >
                                Live Queue
                            </button>
                            <button
                                onClick={() => setActiveTab('patients')}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'patients' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-700'}`}
                            >
                                History Log
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('past_records');
                                    setPastRecords([]);
                                    setPastRecordsPage(0);
                                    setHasMorePastRecords(true);
                                    setReviewFilter('all');
                                    setReviewDateFilter('');
                                }}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'past_records' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-700'}`}
                            >
                                Past Records
                            </button>
                            <button
                                onClick={() => setActiveTab('admitted')}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'admitted' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-700 hover:text-rose-700 hover:bg-rose-50'}`}
                            >
                                Admitted Patients
                            </button>
                        </div>

                        {(activeTab === 'queue' || activeTab === 'patients') && (
                            <button
                                type="button"
                                onClick={() => setQueueSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                title={`Token order: ${queueSortDir === 'asc' ? 'ascending (1 → 9)' : 'descending (9 → 1)'} — click to switch`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 transition-colors whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {queueSortDir === 'asc' ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 8V8m0 0l-4 4m4-4l4 4" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0V4m0 16l-4-4m4 4l4-4" />
                                    )}
                                </svg>
                                Token {queueSortDir === 'asc' ? 'Asc' : 'Desc'}
                            </button>
                        )}
                    </div>

                    {/* Doctor filter — only shown on Live Queue / History Log tabs */}
                    {(activeTab === 'queue' || activeTab === 'patients') && doctors.length > 1 && (
                        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap bg-gray-50/60">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Doctor:</span>
                            <button
                                onClick={() => setQueueDoctorFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${queueDoctorFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'}`}
                            >
                                All
                            </button>
                            {doctors.map(doc => (
                                <button
                                    key={doc.id}
                                    onClick={() => setQueueDoctorFilter(queueDoctorFilter === doc.id ? 'all' : doc.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${queueDoctorFilter === doc.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'}`}
                                >
                                    {formatDoctorName(doc.name)}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* History Log type filter — outpatient vs admitted */}
                    {activeTab === 'patients' && (
                        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap bg-gray-50/60">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Type:</span>
                            {([
                                { key: 'all', label: 'All' },
                                { key: 'outpatient', label: 'Outpatient' },
                                { key: 'admitted', label: 'Admitted' },
                            ] as const).map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => setHistoryTypeFilter(opt.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${historyTypeFilter === opt.key
                                        ? (opt.key === 'admitted' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white')
                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {isLoadingQueue ? (
                        <div className="p-16 text-center text-gray-700">Loading...</div>
                    ) : activeTab === 'admitted' ? (
                        <div className="p-4 sm:p-6">
                            {profile?.id && (
                                <AdmittedPatientsPanel
                                    hospitalId={profile.id}
                                    enablePrescribe={false}
                                    enableMarkDeceased={true}
                                    onReturnedToQueue={() => fetchQueue(true)}
                                />
                            )}
                        </div>
                    ) : activeTab === 'past_records' ? (
                        <>
                            {/* Patient Database Header */}
                            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <h3 className="text-sm font-bold text-gray-800">Patient Database</h3>
                                    </div>
                                    {pastRecordsTotal > 0 && !isPanelView && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-200">
                                                {pastRecords.length} of {pastRecordsTotal} patients
                                            </span>
                                            {pastRecordsLoadedAt && (
                                                <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                                    as of {pastRecordsLoadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => fetchPastRecords(false, 0, false, {
                                                    searchValue: searchQuery,
                                                    reviewFilterValue: activeListFilter,
                                                    reviewDateValue: reviewDateFilter,
                                                })}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                                                title="Re-pull the list — do this right before printing the call sheet"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Refresh
                                            </button>
                                        </div>
                                    )}
                                </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                    {(['all', 'due_today', 'due_tomorrow', 'upcoming', 'overdue', 'weekly_report', 'review_completed', 'calendar'] as PastRecordsView[]).map((filterKey) => (
                                        <button
                                            key={filterKey}
                                            type="button"
                                            onClick={() => setReviewFilter(filterKey)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                                reviewFilter === filterKey
                                                    ? 'bg-orange-100 text-orange-700 border-orange-300'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-200'
                                            }`}
                                        >
                                            {getReviewFilterLabel(filterKey)}
                                        </button>
                                    ))}

                                        {(['due_today', 'due_tomorrow', 'overdue'] as PastRecordsView[]).includes(reviewFilter) && (
                                            <button
                                                type="button"
                                                onClick={handlePrintPastRecordsList}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                </svg>
                                                Print List
                                            </button>
                                        )}

                                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                                        <button
                                            type="button"
                                            onClick={handleOpenPastRegistrationModal}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                            New Registration
                                        </button>
                                        {!isPanelView && (
                                            <>
                                                <label className="text-xs font-semibold text-gray-500">Review Date</label>
                                                <input
                                                    type="date"
                                                    value={reviewDateFilter}
                                                    onChange={(e) => setReviewDateFilter(e.target.value)}
                                                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                                {reviewDateFilter && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewDateFilter('')}
                                                        className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {!isPanelView && (
                                <form onSubmit={handleSearchPastRecords} className="relative w-full max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Search by name or MR number..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </form>
                                )}
                            </div>
                            {reviewFilter === 'weekly_report' ? (
                                <Suspense fallback={<div className="p-16 text-center text-gray-400 text-sm">Loading report…</div>}>
                                    <WeeklyOverdueReportPanel hospitalId={profile?.id || ''} />
                                </Suspense>
                            ) : reviewFilter === 'calendar' ? (
                                <Suspense fallback={<div className="p-16 text-center text-gray-400 text-sm">Loading calendar…</div>}>
                                    <ReceptionCalendarPanel hospitalId={profile?.id || ''} />
                                </Suspense>
                            ) : pastRecords.length === 0 ? (
                                <div className="p-20 text-center">
                                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-gray-700 font-medium">No patients found</p>
                                    <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="divide-y divide-gray-100">
                                        {pastRecords.map((patient, index) => (
                                            <PastRecordsPatientCard
                                                key={patient.id}
                                                patient={patient}
                                                index={index}
                                                hospitalId={profile.id}
                                                metricsDoctorSpecialty={resolvePatientDoctorSpecialty(patient)}
                                                onToggleAppAccess={handleTogglePatientAppAccess}
                                                onVisitHistory={setRxHistoryPatient}
                                                onStopFollowup={handleStopFollowup}
                                                onCallLog={openCallLog}
                                                onDelete={(p) => confirmDelete('patient', p.id, p.name)}
                                                isAppAccessUpdating={updatingAccessPatientIds.has(patient.id)}
                                                isCallHistoryExpanded={expandedCallHistoryPatientIds.has(patient.id)}
                                                onToggleCallHistory={togglePatientCallHistory}
                                                locallyStoppedFollowupIds={locallyStoppedFollowupIds}
                                                stopFollowupOverrides={stopFollowupOverrides}
                                            />
                                        ))}
                                    </div>
                                    {hasMorePastRecords && (
                                        <div className="p-4 text-center border-t border-gray-100">
                                            <button
                                                onClick={handleLoadMorePastRecords}
                                                disabled={isLoadingMorePast}
                                                className="px-6 py-2.5 bg-orange-50 text-orange-600 font-bold text-sm rounded-xl hover:bg-orange-100 transition-colors border border-orange-200 disabled:opacity-50"
                                            >
                                                {isLoadingMorePast ? 'Loading...' : 'Load More Patients'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : queue.length === 0 ? (
                        <div className="p-20 text-center">
                            <p className="text-gray-700 font-medium">No records found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {queue
                                .filter(item => activeTab === 'queue' ? (item.status === 'pending' || item.status === 'in_progress') : (item.status === 'completed' || item.status === 'cancelled'))
                                .filter(item => queueDoctorFilter === 'all' || item.doctor_id === queueDoctorFilter)
                                .filter(item => activeTab !== 'patients' || historyTypeFilter === 'all'
                                    || (historyTypeFilter === 'admitted' ? item.admission_status === 'admitted' : item.admission_status !== 'admitted'))
                                .slice()
                                .sort((a, b) => compareQueueTokens(a, b, queueSortDir))
                                .map((item) => (
                                    <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors gap-4">
                                        <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
                                            {item.admission_status === 'admitted' ? (
                                                <div className="w-14 h-12 sm:w-16 sm:h-12 rounded-xl flex flex-col items-center justify-center font-black text-[10px] leading-tight bg-rose-50 text-rose-700 border border-rose-200 shadow-sm px-1 shrink-0 uppercase tracking-wide text-center">
                                                    Admitted
                                                </div>
                                            ) : (
                                                <div className="w-14 h-12 sm:w-16 sm:h-12 rounded-xl flex items-center justify-center font-black text-base bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm px-2 shrink-0">
                                                    {queueRowToken(item) || 'N/A'}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-gray-900 truncate pr-2">{item.patient?.name}</h4>
                                                {item.preparing_by && (
                                                    <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                        {item.preparing_by} preparing
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 flex-wrap text-sm text-gray-700 mt-1">
                                                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                                    {item.patient?.mr_number && (
                                                        <span className="text-[10px] font-mono font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {item.patient.mr_number}
                                                        </span>
                                                    )}
                                                    {item.patient?.beanhealth_id && (
                                                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {item.patient.beanhealth_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-[4.5rem] sm:pl-0">
                                            {/* Reprint Token Button */}
                                            <button
                                                onClick={() => handleReprintFromQueue(item)}
                                                disabled={!printerConnected}
                                                className={`p-2 rounded-xl border transition-all ${printerConnected
                                                    ? 'bg-white text-gray-500 border-gray-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'
                                                    : 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                                                    }`}
                                                title={printerConnected ? 'Reprint Token' : 'Connect printer first'}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                </svg>
                                            </button>

                                            {/* Edit Button */}
                                            <button
                                                onClick={() => openEditQueueItem(item)}
                                                className="p-2 rounded-xl border border-transparent hover:bg-indigo-50 hover:border-indigo-100 text-gray-300 hover:text-indigo-500 transition-all"
                                                title="Edit Patient Details"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>

                                            {/* Delete Button (Queue) */}
                                            <button
                                                onClick={() => confirmDelete('queue', item.patient?.id || '', item.patient?.name || 'Unknown', item.id)}
                                                className="p-2 rounded-xl border border-transparent hover:bg-red-50 hover:border-red-100 text-gray-300 hover:text-red-500 transition-all"
                                                title="Remove from Queue & Delete"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>

                                            <div className="text-right">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase
                                                    ${item.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                        item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                    {item.status.replace('_', ' ')}
                                                </span>
                                                <p className="font-medium text-xs sm:text-sm text-gray-800 mt-1">{formatDoctorName(item.doctor?.name || '')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {activeTab === 'queue' && queue.filter(i => i.status === 'pending' || i.status === 'in_progress').length === 0 && (
                                <div className="p-16 text-center text-gray-700">All caught up! No active patients in queue.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Queue Item Modal */}
            {editQueueItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditQueueItem(null)}>
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-900">Edit Patient Details</h3>
                            <button onClick={() => setEditQueueItem(null)} className="text-gray-400 hover:text-gray-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="px-6 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Patient Name</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Age</label>
                                    <input type="text" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                                        placeholder="e.g. 65 or 7 months"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Gender</label>
                                    <select value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">S/o or W/o</label>
                                    <input type="text" value={editForm.fatherHusbandName} onChange={e => setEditForm(f => ({ ...f, fatherHusbandName: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">MR Number</label>
                                    <input type="text" value={editForm.mrNumber} onChange={e => setEditForm(f => ({ ...f, mrNumber: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Phone</label>
                                    <input type="text" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Place</label>
                                    <input type="text" value={editForm.place} onChange={e => setEditForm(f => ({ ...f, place: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Doctor</label>
                                    <select value={editForm.doctorId} onChange={e => setEditForm(f => ({ ...f, doctorId: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                                        <option value="">No Doctor</option>
                                        {doctors.map(doc => (
                                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Token Number</label>
                                    <input type="text" value={editForm.tokenNumber}
                                        onChange={e => { setEditTokenError(''); setEditForm(f => ({ ...f, tokenNumber: e.target.value })); }}
                                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none ${editTokenError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-indigo-400'}`} />
                                    {editTokenError && <p className="text-xs text-red-600 mt-1">{editTokenError}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button onClick={() => setEditQueueItem(null)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSaveEditQueueItem} disabled={editSaving || !editForm.name.trim()}
                                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Walk-In Modal */}
            {showWalkInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">{isPastRegistration ? 'New Registration' : 'Patient Registration'}</h3>
                            <button onClick={handleCloseWalkInModal} className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleWalkInSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!isPastRegistration && (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Token #</label>
                                        <input
                                            type="text"
                                            required={!isPastRegistration}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                            value={walkInForm.tokenNumber}
                                            onChange={e => setWalkInForm({ ...walkInForm, tokenNumber: e.target.value })}
                                            placeholder="T-101"
                                        />
                                    </div>
                                )}
                                <div className={isPastRegistration ? 'sm:col-span-2' : ''}>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                                        MR. NO {isPastRegistration && <span className="normal-case text-gray-400">(required)</span>}
                                    </label>
                                    <div className="relative">
                                        <input
                                            ref={mrInputRef}
                                            type="text"
                                            autoComplete="off"
                                            required={isPastRegistration}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                            value={walkInForm.mrNumber}
                                            onChange={e => handleMrNumberChange(e.target.value)}
                                            onBlur={() => setTimeout(() => setShowMrDropdown(false), 200)}
                                            placeholder="MR-12345"
                                        />
                                        {mrSearchLoading && !isPastRegistration && (
                                            <div className="absolute right-3 top-3.5">
                                                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    {isPastRegistration && (
                                        <p className="mt-1 text-[11px] text-gray-500">MR number must be unique for new registrations.</p>
                                    )}
                                    {showMrDropdown && mrSuggestions.length > 0 && !isPastRegistration && (
                                        <div style={mrDropdownStyle} className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                            {mrSuggestions.map(patient => (
                                                <button
                                                    key={patient.id}
                                                    type="button"
                                                    className="w-full px-4 py-2.5 text-left hover:bg-orange-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                                                    onMouseDown={() => handleSelectMrPatient(patient)}
                                                >
                                                    <div>
                                                        <span className="font-semibold text-gray-900 text-sm">{patient.mr_number}</span>
                                                        <span className="text-gray-500 text-sm ml-2">— {patient.name}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">{patient.phone || 'No phone'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {isPastRegistration && (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Review Date <span className="normal-case text-gray-400">(optional)</span></label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                            value={walkInForm.reviewDate}
                                            onChange={e => setWalkInForm({ ...walkInForm, reviewDate: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center justify-between text-xs font-semibold text-gray-700 uppercase mb-2">
                                        <span>Date of Birth</span>
                                        {walkInForm.age && (
                                            <span className="text-blue-600 normal-case font-normal">
                                                Age: {walkInForm.age}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="date"
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.dob}
                                        onChange={e => {
                                            const dob = e.target.value;
                                            let computedAge = '';
                                            if (dob) {
                                                const birth = new Date(dob);
                                                const today = new Date();
                                                // Total months difference (years × 12 + months) with day-rollover correction.
                                                let totalMonths =
                                                    (today.getFullYear() - birth.getFullYear()) * 12 +
                                                    (today.getMonth() - birth.getMonth());
                                                if (today.getDate() < birth.getDate()) totalMonths--;

                                                if (totalMonths < 0 || totalMonths > 1800) {
                                                    // Out of plausible range — leave age blank.
                                                    computedAge = '';
                                                } else if (totalMonths < 1) {
                                                    // Less than a month → show days.
                                                    const days = Math.max(0, Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
                                                    computedAge = `${days} day${days === 1 ? '' : 's'}`;
                                                } else if (totalMonths < 12) {
                                                    computedAge = `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;
                                                } else {
                                                    const years = Math.floor(totalMonths / 12);
                                                    computedAge = `${years} year${years === 1 ? '' : 's'}`;
                                                }
                                            }
                                            setWalkInForm({ ...walkInForm, dob, age: computedAge });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.name}
                                        onChange={e => setWalkInForm({ ...walkInForm, name: e.target.value })}
                                        placeholder="Patient Name"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Gender</label>
                                <select
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                    value={walkInForm.gender}
                                    onChange={e => setWalkInForm({ ...walkInForm, gender: e.target.value })}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            {!isPastRegistration && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Father/Husband Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                            value={walkInForm.fatherHusbandName}
                                            onChange={e => setWalkInForm({ ...walkInForm, fatherHusbandName: e.target.value })}
                                            placeholder="Father or Husband Name"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Place</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                                value={walkInForm.place}
                                                onChange={e => setWalkInForm({ ...walkInForm, place: e.target.value })}
                                                placeholder="City/Town"
                                            />
                                        </div>
                                        {/* Phone field — previously hidden for KKC via hardcoded email check */}
                                        {hospitalSettings.features?.capture_phone !== false && (
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Phone</label>
                                                <div className="relative">
                                                    <input
                                                        type="tel"
                                                        className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 ${bhidMatch ? 'border-green-400 bg-green-50/30' : 'border-gray-200'
                                                            }`}
                                                        value={walkInForm.phone}
                                                        onChange={e => {
                                                            setWalkInForm({ ...walkInForm, phone: e.target.value });
                                                            handlePhoneLookup(e.target.value);
                                                        }}
                                                        placeholder="Phone Number"
                                                    />
                                                    {isSearchingBhid && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    )}
                                                    {bhidMatch && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* BeanHealth ID Match Banner */}
                                    {bhidMatch && (
                                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-green-800">BeanHealth Patient Found!</p>
                                                <p className="text-xs text-green-700 truncate">
                                                    {bhidMatch.name} · <span className="font-mono font-bold">{bhidMatch.beanhealthId}</span>
                                                </p>
                                            </div>
                                            <span className="px-2 py-1 bg-green-200/60 text-green-800 text-[10px] font-bold rounded-full uppercase tracking-wide flex-shrink-0">
                                                Auto-Link
                                            </span>
                                        </div>
                                    )}
                                    <div className="relative">
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Department</label>
                                        <input
                                            type="text"
                                            required
                                            autoComplete="off"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                            value={walkInForm.department}
                                            onChange={e => setWalkInForm({ ...walkInForm, department: e.target.value })}
                                            placeholder="e.g. Cardiology"
                                        />
                                        {(() => {
                                            const DEPARTMENTS = [
                                                'Cardiology', 'Nephrology', 'Urology', 'Neurology', 'Orthopedics',
                                                'Gastroenterology', 'Pulmonology', 'Endocrinology', 'Dermatology',
                                                'Ophthalmology', 'ENT', 'Oncology', 'Psychiatry', 'General Medicine',
                                                'Pediatrics', 'Obstetrics & Gynecology', 'Rheumatology', 'Hematology',
                                            ];
                                            const q = walkInForm.department.trim().toLowerCase();
                                            if (!q) return null;
                                            const match = DEPARTMENTS.find(d => d.toLowerCase().startsWith(q) && d.toLowerCase() !== q);
                                            if (!match) return null;
                                            return (
                                                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                                    <button
                                                        type="button"
                                                        className="w-full px-4 py-3 text-left text-sm text-gray-900 hover:bg-orange-50 transition-colors"
                                                        onMouseDown={e => { e.preventDefault(); setWalkInForm({ ...walkInForm, department: match }); }}
                                                    >
                                                        {match}
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Consulting Doctor</label>
                                        <select
                                            required
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                            value={walkInForm.doctorId}
                                            onChange={e => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                                        >
                                            <option value="">Select Physician</option>
                                            {doctors.map(doc => (
                                                <option key={doc.id} value={doc.id}>{doc.name} - {doc.specialty}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseWalkInModal}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 shadow-lg transition-colors"
                                >
                                    {isPastRegistration ? 'Save Registration' : 'Create Token'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}



            {/* View Patient Details Modal */}
            {showDetailsModal && selectedPatientDetails && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">Patient Details</h3>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Token Number</label>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPatientDetails.token_number || '--'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">MR. NO</label>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPatientDetails.mr_number || '--'}</p>
                                </div>
                            </div>

                            {selectedPatientDetails.beanhealth_id && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase">BH ID</span>
                                    <span className="text-xs font-mono font-medium text-gray-500">{selectedPatientDetails.beanhealth_id}</span>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Patient Name</label>
                                <p className="font-bold text-gray-900 text-lg">{selectedPatientDetails.name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Age</label>
                                    <p className="font-medium text-gray-900">{selectedPatientDetails.age ? `${selectedPatientDetails.age} Years` : '--'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Phone</label>
                                    <p className="font-medium text-gray-900">{selectedPatientDetails.phone || '--'}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Father/Husband Name</label>
                                <p className="font-medium text-gray-900">{selectedPatientDetails.father_husband_name || '--'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Place</label>
                                <p className="font-medium text-gray-900">{selectedPatientDetails.place || '--'}</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Hospital Settings</h3>
                            <button
                                onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-xl bg-primary-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Hospital Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl font-bold text-gray-600">{hospitalSettings.hospitalName?.charAt(0) || 'H'}</span>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Hospital Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
                                    value={hospitalSettings.hospitalName}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, hospitalName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Address</label>
                                <textarea
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 resize-none"
                                    value={hospitalSettings.address}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Contact Number</label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
                                    value={hospitalSettings.contactNumber}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, contactNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
                                    value={hospitalSettings.email}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, email: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900">Capture Phone Number</h4>
                                    <p className="text-xs text-gray-500 mt-1">Require and show phone number during patient registration</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={hospitalSettings.features.capture_phone !== false}
                                        onChange={e => setHospitalSettings(prev => ({
                                            ...prev, 
                                            features: { ...prev.features, capture_phone: e.target.checked }
                                        }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>

                            <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingSettings}
                                        className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 shadow-lg transition-colors disabled:opacity-50"
                                    >
                                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Sign Out from Portal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Duplicate queue warning — different doctor */}
            {duplicateQueueWarning && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-bold text-gray-900">Already in Queue</h3>
                        </div>
                        <div className="px-5 py-4 space-y-1">
                            <p className="text-sm text-gray-700">
                                <span className="font-bold">{duplicateQueueWarning.patientName}</span> is already in the live queue for{' '}
                                <span className="font-bold text-rose-700">{duplicateQueueWarning.existingDoctorName}</span>.
                            </p>
                            <p className="text-sm text-gray-500 pt-1">
                                Proceed to also register for <span className="font-semibold text-gray-700">{duplicateQueueWarning.newDoctorName}</span>?
                            </p>
                        </div>
                        <div className="px-5 pb-5 flex gap-3">
                            <button
                                onClick={() => setDuplicateQueueWarning(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setDuplicateQueueWarning(null);
                                    duplicateOverrideRef.current = true;
                                    handleWalkInSubmit({ preventDefault: () => {} } as React.FormEvent);
                                }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                            >
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Token Dialog */}
            {showPrintDialog && lastRegisteredPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
                        {/* Header */}
                        <div className="px-6 py-5 bg-green-50 border-b border-green-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Patient Registered!</h3>
                                    <p className="text-sm text-gray-600">Token created successfully</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-inner">
                                <PrinterPreview
                                    data={{
                                        tokenNumber: lastRegisteredPatient.tokenNumber,
                                        patientName: lastRegisteredPatient.name,
                                        mrNumber: lastRegisteredPatient.mrNumber,
                                        doctorName: lastRegisteredPatient.doctorName,
                                        department: lastRegisteredPatient.department,
                                        date: new Date().toLocaleDateString('en-GB'),
                                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                                        settings: printerSettings
                                    }}
                                    isSandbox={true}
                                    onSettingsChange={handleSavePrinterSettings}
                                    isSaving={isSavingPrinterSettings}
                                    tenant={tenant}
                                />
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 border border-blue-100">
                                <span className="text-blue-600 mt-0.5">ℹ️</span>
                                <p className="text-[10px] text-blue-700 leading-tight">
                                    Above is a live simulation of the 58mm thermal receipt. Verify the token spacing and layout before printing.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPrintDialog(false);
                                    setLastRegisteredPatient(null);
                                }}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handlePrintToken}
                                disabled={isPrintingToken || !printerConnected}
                                className={`flex-1 py-3 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${printerConnected
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {isPrintingToken ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Printing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Print Token
                                    </>
                                )}
                            </button>
                        </div>

                        {!printerConnected && (
                            <div className="px-6 pb-6 pt-0">
                                <button
                                    onClick={() => {
                                        setShowPrintDialog(false);
                                        setShowPrinterSetup(true);
                                    }}
                                    className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Connect printer first →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Visit History (replaces old Past Prescriptions modal) */}
            {rxHistoryPatient && profile?.id && (
                <Suspense fallback={null}>
                    <VisitJourneyModal
                        hospitalId={profile.id}
                        patient={rxHistoryPatient}
                        prescriptions={rxHistoryPatient.prescriptions || []}
                        clinicLogo={profile?.avatar_url || undefined}
                        onClose={() => setRxHistoryPatient(null)}
                    />
                </Suspense>
            )}

            {callLogTarget && (
                <div className="fixed inset-0 z-[98] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header — slim */}
                        <div className="shrink-0 px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="truncate">Log Follow-up Call · {callLogTarget.patientName}</span>
                                </h3>
                                <p className="text-green-100 text-xs mt-0.5 truncate">
                                    {callLogTarget.mrNumber || '—'}
                                    {callLogTarget.doctorName && <span className="ml-2">· Dr. {callLogTarget.doctorName}</span>}
                                    {callLogTarget.reviewDate && (
                                        <span className="ml-2">· Review: {new Date(callLogTarget.reviewDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    )}
                                </p>
                            </div>
                            <button onClick={closeCallLog} className="shrink-0 p-1.5 rounded-lg text-green-100 hover:text-white hover:bg-green-700/50 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitCallLog} className="flex flex-col flex-1 min-h-0">
                          {/* Two-column body — stacks on small screens */}
                          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 md:divide-x divide-gray-100 min-h-0">
                            {/* Left: form fields */}
                            <div className="p-5 space-y-4 overflow-y-auto md:max-h-[60vh]">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Call Status <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['picked', 'not_picked'] as CallLogStatus[]).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setCallLogStatus(status)}
                                                className={`px-3 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${callLogStatus === status ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                            >
                                                {status === 'picked' ? 'Picked Up' : 'Not Picked'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {callLogStatus === 'picked' ? (
                                    <div>
                                        <label className="block text-xs font-semibold text-orange-800 mb-1.5 uppercase tracking-wide">Reschedule Review Date</label>
                                        <input
                                            type="date"
                                            value={callLogRescheduleDate}
                                            onChange={(e) => setCallLogRescheduleDate(e.target.value)}
                                            min={toLocalISODate(new Date())}
                                            className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Schedule Call Back Date</label>
                                        <input
                                            type="date"
                                            value={callLogNextDate}
                                            onChange={(e) => setCallLogNextDate(e.target.value)}
                                            min={toLocalISODate(new Date())}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Patient Response / Notes</label>
                                    <textarea
                                        value={callLogNotes}
                                        onChange={(e) => setCallLogNotes(e.target.value)}
                                        rows={4}
                                        placeholder={callLogStatus === 'picked' ? 'e.g. Patient confirmed the review date' : 'e.g. Called twice, no answer'}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Right: call history with its own scroll */}
                            <div className="flex flex-col bg-gray-50/50 min-h-0">
                                <div className="shrink-0 px-5 py-3 border-b border-gray-100 bg-white">
                                    <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Call History</p>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 md:max-h-[60vh]">
                                    {callHistoryLoading ? (
                                        <p className="text-sm text-gray-500 px-5 py-4">Loading call history...</p>
                                    ) : callHistory.length === 0 ? (
                                        <p className="text-sm text-gray-500 px-5 py-4">No previous call history.</p>
                                    ) : (
                                        callHistory.map((entry) => (
                                            <div key={entry.id} className="px-5 py-3 hover:bg-white transition-colors">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                    <span className="font-semibold text-gray-800">
                                                        {new Date(entry.called_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className={`font-bold px-2 py-0.5 rounded-full ${entry.call_status === 'picked' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                        {entry.call_status === 'picked' ? 'Picked' : 'Not Picked'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1">Response: {entry.patient_response || '--'}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                          </div>

                          {/* The review moved while this form was open — never overwrite
                              a doctor's newer date without asking. */}
                          {callLogConflict && (
                              <div className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
                                  <p className="text-sm font-bold text-amber-900">This patient's review has changed</p>
                                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                                      It was moved to <span className="font-bold">{new Date(callLogConflict.storedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span> after
                                      you opened this call log — most likely the doctor saw them since.
                                      Saving your date would replace it with <span className="font-bold">{new Date(callLogConflict.typedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>.
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                          type="submit"
                                          onClick={() => { callLogDateDecisionRef.current = 'keep'; setCallLogConflict(null); }}
                                          className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                                      >
                                          Keep {new Date(callLogConflict.storedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &middot; just log the call
                                      </button>
                                      <button
                                          type="submit"
                                          onClick={() => { callLogDateDecisionRef.current = 'override'; setCallLogConflict(null); }}
                                          className="px-3 py-2 rounded-lg text-xs font-bold text-amber-800 bg-white border border-amber-300 hover:bg-amber-100"
                                      >
                                          Change it to {new Date(callLogConflict.typedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                      </button>
                                  </div>
                              </div>
                          )}

                          {/* Sticky footer — always visible */}
                          <div className="shrink-0 flex gap-3 p-4 border-t border-gray-100 bg-white">
                              <button type="button" onClick={closeCallLog} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                              <button type="submit" disabled={callLogSubmitting} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md transition-all disabled:opacity-60">{callLogSubmitting ? 'Saving...' : 'Save Call Log'}</button>
                          </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Doctor Selector Modal (for multi-doctor call logs) */}
            {callLogDoctorSelector && (
                <div className="fixed inset-0 z-[98] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold">Select Doctor</h3>
                                <p className="text-blue-100 text-sm mt-0.5 font-medium">
                                    Which doctor's review do you want to log a call for?
                                </p>
                            </div>
                            <button onClick={() => setCallLogDoctorSelector(null)} className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-blue-700/50 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-2">
                            {callLogDoctorSelector.patient.doctorReviews?.map((dr) => (
                                <button
                                    key={dr.doctorId}
                                    onClick={() => handleSelectDoctorForCallLog(dr)}
                                    className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-semibold text-gray-900">Dr. {dr.doctorName || 'Unknown'}</p>
                                            {dr.doctorSpecialty && (
                                                <p className="text-xs text-gray-500 mt-0.5">{dr.doctorSpecialty}</p>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap ml-2">
                                            {dr.reviewDate ? new Date(dr.reviewDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '--'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setCallLogDoctorSelector(null)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {stopFollowupTarget && (
                <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold">Stop Follow-up</h3>
                                <p className="text-amber-100 text-sm mt-0.5 font-medium">
                                    {stopFollowupTarget.patientName}
                                </p>
                            </div>
                            <button
                                onClick={closeStopFollowupModal}
                                disabled={stopFollowupSubmitting}
                                className="p-1.5 rounded-lg text-amber-100 hover:text-white hover:bg-amber-700/50 transition-colors disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitStopFollowup} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                This will cancel active upcoming or pending reviews for this patient.
                            </p>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={stopFollowupReason}
                                    onChange={(e) => setStopFollowupReason(e.target.value)}
                                    rows={3}
                                    placeholder="Enter reason for stopping follow-up"
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={closeStopFollowupModal}
                                    disabled={stopFollowupSubmitting}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={stopFollowupSubmitting}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md transition-all disabled:opacity-60"
                                >
                                    {stopFollowupSubmitting ? 'Saving...' : 'Stop Follow-up'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Printer Setup Modal */}
            <PrinterSetupModal
                isOpen={showPrinterSetup}
                onClose={() => setShowPrinterSetup(false)}
                onConnected={() => setPrinterConnected(true)}
                settings={printerSettings}
                onSettingsChange={handleSavePrinterSettings}
                isSavingSettings={isSavingPrinterSettings}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && itemToDelete && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-scale-in">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Patient?</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Are you sure you want to delete <span className="font-bold text-gray-800">{itemToDelete.name}</span>?
                                <br />
                                <span className="text-red-500 font-medium mt-1 block">This action cannot be undone.</span>
                            </p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeletePatient}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Deleting...
                                        </>
                                    ) : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ReceptionDashboard;
