import React from 'react';

const FREQ_OPTIONS_ROWS = [
    ['OD', 'BD', 'TDS'],
    ['2OD', '2BD', '2TDS'],
    ['1/2OD', '1/2BD', '1/2TDS'],
    ['Q6H', 'HS'],
];

const TIMING_OPTIONS = ['A/F', 'B/F', 'S/C B/F', 'S/C'];

const DOSE_MAPPINGS: Record<string, { morning: string; noon: string; evening: string; night: string }> = {
    'OD': { morning: '1', noon: '0', evening: '0', night: '0' },
    'HS': { morning: '0', noon: '0', evening: '0', night: '1' },
    'BD': { morning: '1', noon: '0', evening: '0', night: '1' },
    'TDS': { morning: '1', noon: '1', evening: '0', night: '1' },
    'QID': { morning: '1', noon: '1', evening: '1', night: '1' },
    'Q6H': { morning: '1', noon: '1', evening: '1', night: '1' },
    '2OD': { morning: '2', noon: '0', evening: '0', night: '0' },
    '2BD': { morning: '2', noon: '0', evening: '0', night: '2' },
    '2TDS': { morning: '2', noon: '2', evening: '0', night: '2' },
    '1/2OD': { morning: '1/2', noon: '0', evening: '0', night: '0' },
    '1/2BD': { morning: '1/2', noon: '0', evening: '0', night: '1/2' },
    '1/2TDS': { morning: '1/2', noon: '1/2', evening: '0', night: '1/2' },
};

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

const parseSpecialists = (value: string) =>
    (value || '').split(',').map((s) => s.trim()).filter(Boolean);

interface Medication {
    name: string;
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

// ── Slot row — monochrome ──────────────────────────────────────────────────
const SlotRow: React.FC<{
    label: string;
    value: string;
    timeValue: string;
    amPm: string;
    onValueChange: (v: string) => void;
    onTimeChange: (v: string) => void;
    onAmPmChange: (v: string) => void;
    onTimeFocus: () => void;
    readOnly: boolean;
}> = ({ label, value, timeValue, amPm, onValueChange, onTimeChange, onAmPmChange, onTimeFocus, readOnly }) => (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '34px', borderBottom: '1px solid #e5e7eb', flex: 1 }}>
        <div style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', color: '#4a7c2f', fontSize: '9px', fontWeight: 900, flexShrink: 0, borderRight: '1px solid #e5e7eb' }}>
            {label}
        </div>
        <input type="text" value={value} onChange={e => !readOnly && onValueChange(e.target.value)} readOnly={readOnly}
            placeholder="-"
            style={{ flex: 1.5, minWidth: 0, borderRight: '1px solid #e5e7eb', textAlign: 'center', fontSize: '11px', fontWeight: 700, outline: 'none', background: 'transparent', color: '#1f2937' }} />
        <input type="text" value={timeValue} onChange={e => !readOnly && onTimeChange(e.target.value)} onFocus={onTimeFocus} readOnly={readOnly}
            placeholder="-"
            style={{ flex: 1, minWidth: 0, borderRight: '1px solid #e5e7eb', textAlign: 'center', fontSize: '11px', fontWeight: 700, outline: 'none', background: 'transparent', color: '#374151' }} />
        <div style={{ display: 'flex', flexDirection: 'column', width: '32px', flexShrink: 0 }}>
            <button type="button" onClick={() => !readOnly && onAmPmChange('AM')}
                style={{ flex: 1, fontSize: '8px', fontWeight: 900, border: 'none', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: 'transparent', color: amPm === 'AM' ? '#4a7c2f' : '#d1d5db', transition: 'all 0.15s ease-out', textDecoration: amPm === 'AM' ? 'underline' : 'none', transform: amPm === 'AM' ? 'scale(1.1)' : 'scale(1)', transformOrigin: 'center' }}>
                AM
            </button>
            <button type="button" onClick={() => !readOnly && onAmPmChange('PM')}
                style={{ flex: 1, fontSize: '8px', fontWeight: 900, border: 'none', cursor: 'pointer', background: 'transparent', color: amPm === 'PM' ? '#4a7c2f' : '#d1d5db', transition: 'all 0.15s ease-out', textDecoration: amPm === 'PM' ? 'underline' : 'none', transform: amPm === 'PM' ? 'scale(1.1)' : 'scale(1)', transformOrigin: 'center' }}>
                PM
            </button>
        </div>
    </div>
);

// ── Medication Card — monochrome ────────────────────────────────────────────
const MedCard: React.FC<{
    med: Medication;
    index: number;
    updateMed: (index: number, field: string, value: string) => void;
    removeRow: (index: number) => void;
    readOnly: boolean;
    filteredDrugs: any[];
    drugSearchQuery: string;
    setDrugSearchQuery: (q: string) => void;
    showDrugDropdown: number | null;
    setShowDrugDropdown: (n: number | null) => void;
    handleSelectDrug: (index: number, drug: any) => void;
    showRemove: boolean;
}> = ({ med, index, updateMed, removeRow, readOnly, filteredDrugs, setDrugSearchQuery, showDrugDropdown, setShowDrugDropdown, handleSelectDrug, showRemove }) => {

    const [lastFocused, setLastFocused] = React.useState('morningTime');
    const drugInputRef = React.useRef<HTMLInputElement>(null);

    // Strip drug-type prefix (e.g., "TAB. ", "SYP. ", "INJ. ") from a name to get the raw drug name for search
    const stripDrugPrefix = (name: string) => {
        return name.replace(/^(TAB|SYP|INJ|CAP|DROPS|CREAM|OINT|GEL|SUSP|POWDER|LOTION|SPRAY|PATCH|INHALER)\.\s*/i, '');
    };

    const applyFrequency = (opt: string) => {
        updateMed(index, 'dose', opt);
        const m = DOSE_MAPPINGS[opt];
        if (m) {
            updateMed(index, 'morning', m.morning === '0' ? '' : m.morning);
            updateMed(index, 'noon', m.noon === '0' ? '' : m.noon);
            updateMed(index, 'evening', m.evening === '0' ? '' : m.evening);
            updateMed(index, 'night', m.night === '0' ? '' : m.night);
        }
    };

    const sectionHeader = (label: string, color = '#374151') => (
        <div style={{ background: '#f0f9ff', padding: '5px 4px', textAlign: 'center', borderBottom: '2px solid #111827' }}>
            <span style={{ color: color, fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        </div>
    );

    const freqBtn = (opt: string) => (
        <button key={opt} type="button" onMouseDown={() => !readOnly && applyFrequency(opt)}
            style={{
                flex: 1, padding: '3px 0', fontSize: '8px', fontWeight: 900, borderRadius: '5px',
                border: med.dose === opt ? '1.5px solid #4a7c2f' : '1px solid #e5e7eb',
                cursor: 'pointer', background: 'transparent',
                color: med.dose === opt ? '#4a7c2f' : '#6b7280',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: med.dose === opt ? 'scale(1.05)' : 'scale(1)',
                boxShadow: med.dose === opt ? '0 4px 6px -1px rgba(74, 124, 47, 0.1)' : 'none',
                zIndex: med.dose === opt ? 10 : 1
            }}>
            {opt}
        </button>
    );

    const timingBtn = (opt: string) => (
        <button key={opt} type="button" onMouseDown={() => !readOnly && updateMed(index, 'foodTiming', opt)}
            style={{
                width: '100%', flex: 1, minHeight: '24px', fontSize: '8px', fontWeight: 900, borderRadius: '5px',
                border: med.foodTiming === opt ? '1.5px solid #3d7a6a' : '1px solid #e5e7eb',
                cursor: 'pointer', background: 'transparent',
                color: med.foodTiming === opt ? '#3d7a6a' : '#6b7280',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: med.foodTiming === opt ? 'scale(1.05)' : 'scale(1)',
                boxShadow: med.foodTiming === opt ? '0 4px 6px -1px rgba(61, 122, 106, 0.1)' : 'none',
                zIndex: med.foodTiming === opt ? 10 : 1
            }}>
            {opt}
        </button>
    );

    return (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ width: '20px', height: '20px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, color: '#4a7c2f', flexShrink: 0, border: '1.5px solid #d1d5db' }}>{index + 1}</span>
                <span style={{ flex: 1, fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Medication</span>
                {showRemove && !readOnly && (
                    <button onClick={() => removeRow(index)} style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                )}
            </div>

            {/* Drug Name + QTY */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{ padding: '3px 10px', background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4a7c2f' }}>Drug Name</span>
                    </div>
                    <input type="text" value={med.name}
                        ref={drugInputRef}
                        onChange={e => {
                            const input = e.target;
                            const cursorPos = input.selectionStart;
                            const v = e.target.value.toUpperCase();
                            updateMed(index, 'name', v);
                            const searchTerm = stripDrugPrefix(v);
                            setDrugSearchQuery(searchTerm);
                            setShowDrugDropdown(index);
                            // Restore cursor position after React re-render
                            requestAnimationFrame(() => {
                                if (drugInputRef.current && cursorPos !== null) {
                                    drugInputRef.current.setSelectionRange(cursorPos, cursorPos);
                                }
                            });
                        }}
                        onFocus={() => { setDrugSearchQuery(stripDrugPrefix(med.name)); setShowDrugDropdown(index); }}
                        onBlur={() => setTimeout(() => setShowDrugDropdown(null), 200)}
                        readOnly={readOnly}
                        placeholder="Type or select..."
                        style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: 700, outline: 'none', border: 'none', background: 'transparent', color: '#111827', textTransform: 'uppercase', boxSizing: 'border-box' }} />
                    {showDrugDropdown === index && filteredDrugs.length > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50, background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,124,47,0.15)', borderRadius: '0 0 12px 12px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', maxHeight: '160px', overflowY: 'auto' }}>
                            {filteredDrugs.slice(0, 8).map(drug => (
                                <button key={drug.id} type="button" onMouseDown={() => handleSelectDrug(index, drug)}
                                    style={{ width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: '12px', color: '#374151', background: 'none', border: 'none', borderBottom: '1px solid #f9fafb', cursor: 'pointer', fontWeight: 500 }}>
                                    {drug.drugType && <span style={{ fontWeight: 700, color: '#4a7c2f', marginRight: '4px' }}>{drug.drugType}.</span>}
                                    {drug.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* QTY */}
                <div style={{ width: '70px', borderLeft: '1px solid #f3f4f6', flexShrink: 0 }}>
                    <div style={{ padding: '3px 8px', background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#374151' }}>QTY</span>
                    </div>
                    <input type="text" value={med.number} onChange={e => updateMed(index, 'number', e.target.value)}
                        readOnly={readOnly} placeholder="10"
                        style={{ width: '100%', padding: '6px 4px', fontSize: '13px', fontWeight: 700, outline: 'none', border: 'none', background: '#fff', color: '#111827', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
            </div>

            {/* 4-column grid */}
            <div style={{ display: 'flex', alignItems: 'stretch', margin: '0 8px 8px 8px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #111827', background: '#fff' }}>

                {/* Col 1: Frequency */}
                <div style={{ flex: '1.2', borderRight: '2px solid #111827', display: 'flex', flexDirection: 'column' }}>
                    {sectionHeader('Frequency', '#4a7c2f')}
                    <input type="text" value={med.dose} onChange={e => updateMed(index, 'dose', e.target.value.toUpperCase())} readOnly={readOnly}
                        placeholder="e.g. OD"
                        style={{ padding: '6px 4px', fontSize: '10px', fontWeight: 700, textAlign: 'center', outline: 'none', border: 'none', borderBottom: '2px solid #111827', background: 'transparent', color: '#374151' }} />
                    <div style={{ flex: 1, padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        {FREQ_OPTIONS_ROWS.map((row, ri) => (
                            <div key={ri} style={{ display: 'flex', gap: '2px', flex: 1, marginBottom: ri < FREQ_OPTIONS_ROWS.length - 1 ? '3px' : '0' }}>
                                {row.map(opt => freqBtn(opt))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Col 2: Timing */}
                <div style={{ flex: '0.6', borderRight: '2px solid #111827', display: 'flex', flexDirection: 'column' }}>
                    {sectionHeader('Timing', '#3d7a6a')}
                    <input type="text" value={med.foodTiming} onChange={e => updateMed(index, 'foodTiming', e.target.value.toUpperCase())} readOnly={readOnly}
                        placeholder="A/F"
                        style={{ padding: '6px 4px', fontSize: '10px', fontWeight: 700, textAlign: 'center', outline: 'none', border: 'none', borderBottom: '2px solid #111827', background: 'transparent', color: '#374151' }} />
                    <div style={{ flex: 1, padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '3px' }}>
                        {TIMING_OPTIONS.map(opt => timingBtn(opt))}
                    </div>
                </div>

                {/* Col 3: M/N/E/NT */}
                <div style={{ flex: '2', borderRight: '2px solid #111827', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: '#f0f9ff', display: 'flex', padding: '5px 0', borderBottom: '2px solid #111827' }}>
                        <span style={{ width: '28px', fontSize: '6px', color: 'transparent', flexShrink: 0, borderRight: '1px solid #e5e7eb' }}>.</span>
                        <span style={{ flex: 1.5, fontSize: '6px', fontWeight: 900, color: '#4a7c2f', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '1px solid #e5e7eb' }}>Dose</span>
                        <span style={{ flex: 1, fontSize: '6px', fontWeight: 900, color: '#4a7c2f', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '1px solid #e5e7eb' }}>Time</span>
                        <span style={{ width: '32px', fontSize: '6px', fontWeight: 900, color: '#4a7c2f', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>AM/PM</span>
                    </div>
                    <SlotRow label="M" value={med.morning} timeValue={med.morningTime} amPm={med.morningAmPm || ''}
                        onValueChange={v => updateMed(index, 'morning', v)} onTimeChange={v => updateMed(index, 'morningTime', v)} onAmPmChange={v => updateMed(index, 'morningAmPm', v)}
                        onTimeFocus={() => setLastFocused('morningTime')} readOnly={readOnly} />
                    <SlotRow label="N" value={med.noon} timeValue={med.noonTime} amPm={med.noonAmPm || ''}
                        onValueChange={v => updateMed(index, 'noon', v)} onTimeChange={v => updateMed(index, 'noonTime', v)} onAmPmChange={v => updateMed(index, 'noonAmPm', v)}
                        onTimeFocus={() => setLastFocused('noonTime')} readOnly={readOnly} />
                    <SlotRow label="E" value={med.evening} timeValue={med.eveningTime} amPm={med.eveningAmPm || ''}
                        onValueChange={v => updateMed(index, 'evening', v)} onTimeChange={v => updateMed(index, 'eveningTime', v)} onAmPmChange={v => updateMed(index, 'eveningAmPm', v)}
                        onTimeFocus={() => setLastFocused('eveningTime')} readOnly={readOnly} />
                    <SlotRow label="NT" value={med.night} timeValue={med.nightTime} amPm={med.nightAmPm || ''}
                        onValueChange={v => updateMed(index, 'night', v)} onTimeChange={v => updateMed(index, 'nightTime', v)} onAmPmChange={v => updateMed(index, 'nightAmPm', v)}
                        onTimeFocus={() => setLastFocused('nightTime')} readOnly={readOnly} />
                </div>

            </div>
        </div>
    );
};

interface MobilePrescriptionInputProps {
    formData: {
        fatherName: string; place: string; phone: string; allergy: string; diagnosis: string;
        reviewDate: string; testsToReview: string; saltIntake: string; fluidIntake: string;
        doctorNotes: string; specialistToReview: string;
    };
    setFormData: (data: any) => void;
    medications: Medication[];
    updateMed: (index: number, field: string, value: string) => void;
    addRow: () => void;
    removeRow: (index: number) => void;
    patient: any;
    readOnly: boolean;
    DOSE_OPTIONS: string[];
    DOSE_MAPPINGS: Record<string, any>;
    FOOD_TIMING_OPTIONS: string[];
    drugSearchQuery: string;
    setDrugSearchQuery: (q: string) => void;
    filteredDrugs: any[];
    handleSelectDrug: (index: number, drug: any) => void;
    showDrugDropdown: number | null;
    setShowDrugDropdown: (n: number | null) => void;
    onClose: () => void;
    onPrint: () => void;
    onSend: () => void;
    doctor: any;
    savedDiagnoses: any[];
    diagnosisSearchQuery: string;
    setDiagnosisSearchQuery: (q: string) => void;
    showDiagnosisDropdown: boolean;
    setShowDiagnosisDropdown: (b: boolean) => void;
    SPECIALIST_OPTIONS: string[];
}

const MobilePrescriptionInput: React.FC<MobilePrescriptionInputProps> = ({
    formData, setFormData, medications, updateMed, addRow, removeRow, patient, readOnly,
    drugSearchQuery, setDrugSearchQuery, filteredDrugs, handleSelectDrug, showDrugDropdown, setShowDrugDropdown,
    onClose, onPrint, onSend,
    savedDiagnoses, diagnosisSearchQuery, setDiagnosisSearchQuery, showDiagnosisDropdown, setShowDiagnosisDropdown,
    SPECIALIST_OPTIONS
}) => {
    const [showSpecialistDropdown, setShowSpecialistDropdown] = React.useState(false);

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-gray-50 overflow-hidden">

            {/* Header */}
            <div className="bg-white px-4 py-2.5 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="font-black text-gray-900 text-base leading-tight">{patient?.name || 'Patient'}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-[10px] font-bold">Token {patient?.token_number}</span>
                            <span className="text-sm font-semibold text-gray-600">{patient?.age} yrs</span>
                        </div>
                    </div>
                    {patient?.mr_number && (
                        <span className="text-xs font-bold text-gray-500 shrink-0 text-right">MR: {patient.mr_number}</span>
                    )}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-3 py-3 pb-28 space-y-3">

                {/* Diagnosis + Allergy */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                    <div className="space-y-2.5">
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Diagnosis</label>
                            <div className="relative">
                                <textarea
                                    value={formData.diagnosis}
                                    onChange={e => {
                                        const val = e.target.value.toUpperCase();
                                        setFormData({ ...formData, diagnosis: val });
                                        const parts = val.split('/');
                                        setDiagnosisSearchQuery(parts[parts.length - 1].trim());
                                        setShowDiagnosisDropdown(true);
                                    }}
                                    onFocus={() => { const parts = (formData.diagnosis || '').split('/'); setDiagnosisSearchQuery(parts[parts.length - 1].trim()); setShowDiagnosisDropdown(true); }}
                                    onBlur={() => setTimeout(() => setShowDiagnosisDropdown(false), 200)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none resize-none leading-tight"
                                    placeholder="Enter diagnosis..." readOnly={readOnly} rows={2} />
                                {(() => {
                                    const selected = (formData.diagnosis || '').split('/').map(d => d.trim()).filter(Boolean);
                                    const filtered = savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase()) && !selected.includes(d.name));
                                    return showDiagnosisDropdown && diagnosisSearchQuery.length > 0 && filtered.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1">
                                            {filtered.map(diag => (
                                                <button key={diag.id} type="button"
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm font-medium border-b border-gray-100 last:border-0"
                                                    onMouseDown={() => {
                                                        const parts = (formData.diagnosis || '').split('/');
                                                        parts[parts.length - 1] = '';
                                                        const newValue = [...parts.filter(p => p.trim()), diag.name].join('/') + '/';
                                                        setFormData({ ...formData, diagnosis: newValue });
                                                        setDiagnosisSearchQuery('');
                                                        setShowDiagnosisDropdown(false);
                                                    }}>
                                                    {diag.name}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Drug Allergy</label>
                            <input type="text" value={formData.allergy} onChange={e => setFormData({ ...formData, allergy: e.target.value.toUpperCase() })}
                                className="w-full mt-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 outline-none uppercase font-bold text-gray-900"
                                placeholder="Nil" readOnly={readOnly} />
                        </div>
                    </div>
                </div>

                {/* Medications */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide">Medications</h3>
                        {!readOnly && (
                            <button onClick={addRow} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-black flex items-center gap-1">
                                <span className="text-base leading-none">+</span> Add
                            </button>
                        )}
                    </div>
                    {medications.map((med, idx) => (
                        <MedCard key={idx} med={med as Medication} index={idx} updateMed={updateMed} removeRow={removeRow} readOnly={readOnly}
                            filteredDrugs={filteredDrugs} drugSearchQuery={drugSearchQuery} setDrugSearchQuery={setDrugSearchQuery}
                            showDrugDropdown={showDrugDropdown} setShowDrugDropdown={setShowDrugDropdown}
                            handleSelectDrug={handleSelectDrug} showRemove={medications.length > 1} />
                    ))}
                    {!readOnly && (
                        <button onClick={addRow} className="w-full py-3 bg-white border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                            <span className="text-xl">+</span> Add Another Medication
                        </button>
                    )}
                </div>

                {/* Doctor Notes */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-900 text-sm mb-2">Notes</h3>
                    <textarea value={formData.doctorNotes} onChange={e => setFormData({ ...formData, doctorNotes: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 outline-none resize-none uppercase"
                        placeholder="ADDITIONAL NOTES FOR THE PATIENT..." readOnly={readOnly} rows={4} />
                </div>

                {/* Intake */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-900 text-sm mb-2">Intake Restrictions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Salt (gm/day)</label>
                            <input type="text" value={formData.saltIntake} onChange={e => setFormData({ ...formData, saltIntake: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" placeholder="e.g., 5" readOnly={readOnly} />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Fluid (lit/day)</label>
                            <input type="text" value={formData.fluidIntake} onChange={e => setFormData({ ...formData, fluidIntake: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none" placeholder="e.g., 1.5" readOnly={readOnly} />
                        </div>
                    </div>
                </div>

                {/* Follow-up */}
                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-900 text-sm mb-2">Follow-up</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Review Date</label>
                            <input type="date" value={formData.reviewDate} onChange={e => setFormData({ ...formData, reviewDate: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none min-h-[45px]"
                                readOnly={readOnly} min={new Date().toISOString().split('T')[0]} />
                            {formData.reviewDate && getReviewDaysLabel(formData.reviewDate) && (
                                <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold">
                                    Review {getReviewDaysLabel(formData.reviewDate)}
                                </span>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tests to Review</label>
                            <input type="text" value={formData.testsToReview} onChange={e => setFormData({ ...formData, testsToReview: e.target.value.toUpperCase() })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none uppercase"
                                placeholder="BLOOD TESTS, X-RAY, ETC." readOnly={readOnly} />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Specialists to be seen</label>
                            <div className="relative">
                                <input type="text" value={formData.specialistToReview} onChange={e => setFormData({ ...formData, specialistToReview: e.target.value.toUpperCase() })}
                                    onFocus={() => !readOnly && setShowSpecialistDropdown(true)}
                                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none uppercase"
                                    placeholder="TYPE OR SELECT SPECIALISTS..." readOnly={readOnly} />
                                {!readOnly && showSpecialistDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-50" onClick={() => setShowSpecialistDropdown(false)} />
                                        <div className="absolute left-0 right-0 bottom-full mb-1 z-[60] bg-white border border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto py-2">
                                            {SPECIALIST_OPTIONS.map(opt => {
                                                const current = parseSpecialists(formData.specialistToReview || '');
                                                const selected = current.includes(opt);
                                                return (
                                                    <button key={opt} type="button"
                                                        onMouseDown={e => {
                                                            e.preventDefault();
                                                            const next = selected ? current.filter(s => s !== opt) : [...current, opt];
                                                            setFormData({ ...formData, specialistToReview: next.join(', ') });
                                                        }}
                                                        className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-50 last:border-0 ${selected ? 'bg-gray-100 font-bold' : 'text-gray-700'}`}>
                                                        {opt} {selected && <span className="text-gray-700 font-black">✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 flex gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.07)] z-20">
                <button onClick={onClose} className="flex-1 px-3 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm">Cancel</button>
                <button onClick={onPrint} className="flex-1 px-3 py-3 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                </button>
                {!readOnly && (
                    <button onClick={onSend} className="flex-1 px-3 py-3 bg-gray-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        Send
                    </button>
                )}
            </div>
        </div>
    );
};

export default MobilePrescriptionInput;
