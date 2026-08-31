/**
 * EditPatientModal — correct a patient's own details from Past Records.
 *
 * Reception could already edit a patient, but ONLY from the Live Queue or
 * History Log, because that flow updates hospital_queues (token, doctor) and
 * checks the token against today's queue. A patient who is not in a queue today
 * — which is every patient in Past Records — was uneditable. A typo in an MR
 * number was permanent.
 *
 * So this edits the PATIENT only. No token, no doctor: those belong to a visit,
 * not to a person, and inventing a queue row to change a spelling would create a
 * phantom visit.
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../utils/requestUtils';
import type { ReceptionPastRecordPatient } from '../../services/enterpriseReviewService';

interface Props {
    hospitalId: string;
    patient: ReceptionPastRecordPatient;
    onClose: () => void;
    onSaved: () => void;
}

const EditPatientModal: React.FC<Props> = ({ hospitalId, patient, onClose, onSaved }) => {
    const [form, setForm] = useState({
        name: patient.name || '',
        age: patient.age != null ? String(patient.age) : '',
        gender: patient.gender || '',
        fatherHusbandName: patient.father_husband_name || '',
        mrNumber: patient.mr_number || '',
        phone: patient.phone || '',
    });
    const [saving, setSaving] = useState(false);
    const [mrError, setMrError] = useState<string | null>(null);

    const set = (k: keyof typeof form, v: string) => {
        setForm((f) => ({ ...f, [k]: v }));
        if (k === 'mrNumber') setMrError(null);
    };

    const handleSave = async () => {
        const name = form.name.trim();
        const mrNumber = form.mrNumber.trim();
        if (!name) { toast.error('Name is required'); return; }

        setSaving(true);
        try {
            // MR number is the identity every other surface keys on — the print
            // sheet, the call round, the patient app login. Two patients sharing
            // one is not a cosmetic problem, so check before writing rather than
            // relying on a constraint that may not exist on older databases.
            if (mrNumber && mrNumber !== (patient.mr_number || '')) {
                const { data: clash } = await withTimeout(
                    (supabase.from('hospital_patients' as any) as any)
                        .select('id, name')
                        .eq('hospital_id', hospitalId)
                        .eq('mr_number', mrNumber)
                        .neq('id', patient.id)
                        .maybeSingle(),
                    10000,
                    'Timed out while checking the MR number'
                ) as { data: any };

                if (clash?.id) {
                    setMrError(`Already used by ${clash.name || 'another patient'}.`);
                    setSaving(false);
                    return;
                }
            }

            const { error } = await withTimeout(
                (supabase.from('hospital_patients' as any) as any)
                    .update({
                        name,
                        age: form.age.trim() || null,
                        gender: form.gender || null,
                        father_husband_name: form.fatherHusbandName.trim() || null,
                        mr_number: mrNumber || null,
                        phone: form.phone.trim() || null,
                        // No updated_at: hospital_patients does not have that column.
                        // hospital_queues does, which is where the habit comes from.
                    })
                    .eq('id', patient.id)
                    // Tenancy boundary: without it a signed-in hospital could edit
                    // another clinic's patient by id.
                    .eq('hospital_id', hospitalId),
                10000,
                'Timed out while saving'
            ) as { error: any };

            if (error) throw error;
            toast.success('Patient details updated');
            onSaved();
            onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Could not save changes');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900">Edit Patient Details</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
                </div>

                <div className="p-5 space-y-3">
                    <Field label="Name">
                        <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
                    </Field>

                    <Field label="MR ID">
                        <input value={form.mrNumber} onChange={(e) => set('mrNumber', e.target.value)}
                            className={`${inputCls} ${mrError ? 'border-red-300 bg-red-50' : ''}`} />
                        {mrError && <p className="mt-1 text-[11px] font-semibold text-red-600">{mrError}</p>}
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Age">
                            <input value={form.age} onChange={(e) => set('age', e.target.value)}
                                placeholder="e.g. 65 or 7 months" className={inputCls} />
                        </Field>
                        <Field label="Gender">
                            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
                                <option value="">--</option>
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                            </select>
                        </Field>
                    </div>

                    <Field label={form.gender === 'F' ? 'W/o' : 'S/o'}>
                        <input value={form.fatherHusbandName} onChange={(e) => set('fatherHusbandName', e.target.value)} className={inputCls} />
                    </Field>

                    <Field label="Phone">
                        <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="numeric" className={inputCls} />
                    </Field>
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2.5 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300">
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">{label}</label>
        {children}
    </div>
);

export default EditPatientModal;
