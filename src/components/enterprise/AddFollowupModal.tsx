/**
 * AddFollowupModal — put an existing patient into the follow-up loop
 * ──────────────────────────────────────────────────────────────────
 * Past Records could create a NEW patient, but had no way to take someone who
 * already exists and schedule them a review. That gap is why reviews were being
 * created through side doors — call logs, past registrations — which is where
 * most of the bad review data came from.
 *
 * Two rules this screen enforces, both learned the hard way:
 *
 *   • A DOCTOR IS REQUIRED. Reviews with a null doctor belong to nobody: no
 *     visit ever closes them, they never show under a doctor's own list, and
 *     they age into false Missed Followups. Every review created here has an
 *     owner.
 *
 *   • THE DATE CANNOT BE IN THE PAST. A review created already-overdue is not a
 *     plan, it is noise — KNH/26/016749 carried one dated 04 Aug that was
 *     written on 14 Aug.
 *
 * Existing reviews are shown before saving, because scheduling a review for a
 * patient who already has one with that doctor MOVES it rather than adding a
 * second (the DB allows only one active review per patient+doctor). The user
 * should see that before it happens, not discover it afterwards.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
    scheduleReviewForPatient,
    fetchPatientPendingReviews,
    type PendingReviewInfo,
} from '../../services/enterpriseReviewService';

interface PatientHit {
    id: string;
    name: string;
    age: number | string | null;
    gender?: string | null;
    mr_number: string | null;
    father_husband_name?: string | null;
    phone?: string | null;
}

interface DoctorOption {
    id: string;
    name: string;
    specialty?: string | null;
}

interface Props {
    hospitalId: string;
    /** Pre-selects the doctor and hides the picker (doctor dashboard). */
    lockedDoctor?: DoctorOption | null;
    onClose: () => void;
    /** Fired after a successful save so the caller can refresh its list. */
    onScheduled: () => void;
}

const todayKey = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const AddFollowupModal: React.FC<Props> = ({ hospitalId, lockedDoctor = null, onClose, onScheduled }) => {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [results, setResults] = useState<PatientHit[]>([]);
    const [searching, setSearching] = useState(false);

    const [patient, setPatient] = useState<PatientHit | null>(null);
    const [doctors, setDoctors] = useState<DoctorOption[]>([]);
    const [doctorId, setDoctorId] = useState<string>(lockedDoctor?.id || '');
    const [reviewDate, setReviewDate] = useState('');
    const [reason, setReason] = useState('');
    const [age, setAge] = useState('');
    const [tests, setTests] = useState('');
    const [specialists, setSpecialists] = useState('');

    const [existingReviews, setExistingReviews] = useState<PendingReviewInfo[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(search.trim()), 350);
        return () => window.clearTimeout(t);
    }, [search]);

    // Doctor list — only needed when the caller hasn't fixed one
    useEffect(() => {
        if (lockedDoctor || !hospitalId) return;
        (async () => {
            const { data } = await (supabase.from('hospital_doctors') as any)
                .select('id, name, specialty')
                .eq('hospital_id', hospitalId)
                .order('name', { ascending: true });
            setDoctors((data || []) as DoctorOption[]);
        })();
    }, [hospitalId, lockedDoctor]);

    useEffect(() => {
        if (!debounced) { setResults([]); return; }
        let isActive = true;
        (async () => {
            setSearching(true);
            try {
                const escaped = debounced.replace(/[%_]/g, (m) => `\\${m}`);
                const { data } = await (supabase.from('hospital_patients') as any)
                    .select('id, name, age, gender, mr_number, father_husband_name, phone')
                    .eq('hospital_id', hospitalId)
                    .or(`name.ilike.%${escaped}%,mr_number.ilike.%${escaped}%`)
                    .order('name', { ascending: true })
                    .limit(25);
                if (isActive) setResults((data || []) as PatientHit[]);
            } catch (err) {
                console.error('[AddFollowupModal] search failed', err);
            } finally {
                if (isActive) setSearching(false);
            }
        })();
        return () => { isActive = false; };
    }, [debounced, hospitalId]);

    const selectPatient = useCallback(async (hit: PatientHit) => {
        setPatient(hit);
        // Prefilled from the record: most hand-added patients have no age on file,
        // and this is the moment someone is already looking at them.
        setAge(hit.age != null ? String(hit.age) : '');
        setExistingReviews([]);
        setReviewsLoading(true);
        try {
            setExistingReviews(await fetchPatientPendingReviews(hospitalId, hit.id));
        } catch { /* non-critical */ }
        finally { setReviewsLoading(false); }
    }, [hospitalId]);

    const handleSave = async () => {
        if (!patient || saving) return;
        if (!doctorId) { toast.error('Choose which doctor this review is for'); return; }
        if (!reviewDate) { toast.error('Choose a review date'); return; }
        if (!reason.trim()) { toast.error('Say why this patient is being brought back'); return; }

        setSaving(true);
        const toastId = toast.loading('Scheduling follow-up…');
        try {
            const { created } = await scheduleReviewForPatient({
                hospitalId,
                patientId: patient.id,
                doctorId,
                reviewDate,
                reviewReason: reason.trim() || null,
                testsToReview: tests.trim() || null,
                specialistsToReview: specialists.trim() || null,
                age: age.trim() || null,
            });
            const doctorName = lockedDoctor?.name || doctors.find(d => d.id === doctorId)?.name || 'the doctor';
            toast.success(
                created
                    ? `${patient.name} added to follow-up with ${doctorName}`
                    : `${patient.name}'s existing review with ${doctorName} moved to this date`,
                { id: toastId, duration: 6000 }
            );
            onScheduled();
            onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Could not schedule the follow-up', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const relationOf = (p: PatientHit) => (p.gender === 'F' || p.gender === 'Female' ? 'W/o' : 'S/o');

    /** Does this patient already have an active review with the chosen doctor? */
    const clashingReview = doctorId
        ? existingReviews.find((r: any) => r.doctor_id === doctorId) || null
        : null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">

                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Add Patient to Follow-up</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Schedule a review for a patient already registered</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {!patient ? (
                        <div className="p-5 space-y-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Type MR number or name…"
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                                />
                            </div>

                            {!debounced ? (
                                <p className="text-center text-sm text-gray-400 py-10">Start typing to find a patient</p>
                            ) : searching ? (
                                <p className="text-center text-sm text-gray-400 py-10">Searching…</p>
                            ) : results.length === 0 ? (
                                <p className="text-center text-sm text-gray-400 py-10">No patient matches “{debounced}”</p>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {results.map((hit) => (
                                        <li key={hit.id}>
                                            <button
                                                onClick={() => selectPatient(hit)}
                                                className="w-full text-left px-3 py-3 rounded-xl hover:bg-orange-50 transition-colors"
                                            >
                                                <p className="text-sm font-bold text-gray-900">{hit.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                                                    <span>MR: <span className="font-mono font-semibold text-gray-700">{hit.mr_number || 'N/A'}</span></span>
                                                    {hit.age && <span>Age {hit.age}</span>}
                                                    {hit.father_husband_name && <span>{relationOf(hit)} {hit.father_husband_name}</span>}
                                                </p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="p-5 space-y-4">
                            <button
                                onClick={() => { setPatient(null); setExistingReviews([]); }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Choose a different patient
                            </button>

                            <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                                <p className="text-sm font-bold text-gray-900">{patient.name}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600 mt-1">
                                    <span>MR: <span className="font-mono font-bold text-gray-900">{patient.mr_number || 'N/A'}</span></span>
                                    {patient.age && <span>Age {patient.age}</span>}
                                    {patient.father_husband_name && <span>{relationOf(patient)} {patient.father_husband_name}</span>}
                                </div>
                            </div>

                            {reviewsLoading ? (
                                <p className="text-xs text-gray-400 text-center py-2">Checking existing reviews…</p>
                            ) : existingReviews.length > 0 && (
                                <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-sky-800">Already scheduled</p>
                                    <ul className="mt-1.5 space-y-1">
                                        {existingReviews.map((r) => (
                                            <li key={r.id} className="text-xs text-sky-700">
                                                {r.next_review_date
                                                    ? new Date(r.next_review_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : 'No date set'}
                                                <span className="text-sky-500 capitalize"> ({r.status})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                                    Review with <span className="text-rose-500">*</span>
                                </label>
                                {lockedDoctor ? (
                                    <div className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 font-semibold text-gray-800">
                                        {lockedDoctor.name}
                                    </div>
                                ) : (
                                    <select
                                        value={doctorId}
                                        onChange={(e) => setDoctorId(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                                    >
                                        <option value="">Select doctor…</option>
                                        {doctors.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}{d.specialty ? ` · ${d.specialty}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="mt-1 text-[11px] text-gray-500">
                                    Every review needs an owner — an unassigned one never appears on a doctor's list and never gets closed.
                                </p>
                            </div>

                            {clashingReview && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                                    This patient already has a review with this doctor
                                    {clashingReview.next_review_date
                                        ? <> on <span className="font-bold">{new Date(clashingReview.next_review_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></>
                                        : ''}.
                                    Saving will <span className="font-bold">move that review</span> to the new date rather than adding a second one.
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                                    Review date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={reviewDate}
                                    min={todayKey()}
                                    onChange={(e) => setReviewDate(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                                    Reason for follow-up <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Recheck creatinine after dose change"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
                                />
                                <p className="mt-1 text-[11px] text-gray-500">
                                    Whoever rings this patient reads this first — "come for review" is not a reason.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                                    Age {patient.age == null && <span className="font-normal normal-case text-amber-600">· missing on file</span>}
                                </label>
                                <input
                                    type="text"
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    placeholder="e.g. 54"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Tests to review</label>
                                    <input
                                        type="text" value={tests} onChange={(e) => setTests(e.target.value)}
                                        placeholder="e.g. Creatinine, RFT"
                                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Specialists</label>
                                    <input
                                        type="text" value={specialists} onChange={(e) => setSpecialists(e.target.value)}
                                        placeholder="e.g. Cardiology"
                                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {patient && (
                    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 flex-shrink-0">
                        <button
                            onClick={onClose} disabled={saving}
                            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !doctorId || !reviewDate || !reason.trim()}
                            className="px-5 py-2 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Scheduling…' : clashingReview ? 'Move Review' : 'Add to Follow-up'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddFollowupModal;
