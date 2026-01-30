import React from 'react';

// Types for medication
interface Medication {
    name: string;
    number: string;
    dose: string;
    morning: string;
    morningTime: string;
    noon: string;
    noonTime: string;
    night: string;
    nightTime: string;
    foodTiming: string;
}

interface MobilePrescriptionInputProps {
    formData: {
        fatherName: string;
        place: string;
        phone: string;
        allergy: string;
        diagnosis: string;
        reviewDate: string;
        testsToReview: string;
        saltIntake: string;
        fluidIntake: string;
    };
    setFormData: (data: any) => void;
    medications: Medication[];
    updateMed: (index: number, field: string, value: string) => void;
    addRow: () => void;
    removeRow: (index: number) => void;
    patient: any;
    readOnly: boolean;
    // Dropdowns
    DOSE_OPTIONS: string[];
    DOSE_MAPPINGS: Record<string, { morning: string; noon: string; night: string }>;
    FOOD_TIMING_OPTIONS: string[];
    TIME_OPTIONS: string[];
    // Drug search
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
}

const MobilePrescriptionInput: React.FC<MobilePrescriptionInputProps> = ({
    formData,
    setFormData,
    medications,
    updateMed,
    addRow,
    removeRow,
    patient,
    readOnly,
    DOSE_OPTIONS,
    DOSE_MAPPINGS,
    FOOD_TIMING_OPTIONS,
    TIME_OPTIONS,
    drugSearchQuery,
    setDrugSearchQuery,
    filteredDrugs,
    handleSelectDrug,
    showDrugDropdown,
    setShowDrugDropdown,
    onClose,
    onPrint,
    onSend,
    doctor,
    savedDiagnoses,
    diagnosisSearchQuery,
    setDiagnosisSearchQuery,
    showDiagnosisDropdown,
    setShowDiagnosisDropdown
}) => {
    const [expandedCard, setExpandedCard] = React.useState<number | null>(null);
    const [showDoseDropdown, setShowDoseDropdown] = React.useState<number | null>(null);
    const [showTimingDropdown, setShowTimingDropdown] = React.useState<number | null>(null);

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-gray-50 overflow-hidden">
            {/* Compact Patient Header */}
            <div className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-gray-900">{patient?.name || 'Patient'}</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium">
                                Token: {patient?.token_number}
                            </span>
                            <span>{patient?.age} yrs</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-4">
                {/* Quick Fields: Diagnosis & Allergy */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnosis</label>
                            <div className="relative">
                                <textarea
                                    value={formData.diagnosis}
                                    onChange={e => {
                                        setFormData({ ...formData, diagnosis: e.target.value.toUpperCase() });
                                        setDiagnosisSearchQuery(e.target.value);
                                        setShowDiagnosisDropdown(true);
                                    }}
                                    onFocus={() => setShowDiagnosisDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDiagnosisDropdown(false), 200)}
                                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none leading-tight"
                                    placeholder="Enter diagnosis..."
                                    readOnly={readOnly}
                                    rows={2}
                                />
                                {showDiagnosisDropdown && savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase())).length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1">
                                        {savedDiagnoses
                                            .filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase()))
                                            .map(diag => (
                                                <button
                                                    key={diag.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm font-medium border-b border-gray-100 last:border-0"
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
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Drug Allergy</label>
                            <input
                                type="text"
                                value={formData.allergy}
                                onChange={e => setFormData({ ...formData, allergy: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                placeholder="Nil"
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                </div>

                {/* Medications Section */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-900">Medications</h3>
                        {!readOnly && (
                            <button
                                onClick={addRow}
                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1"
                            >
                                <span className="text-lg leading-none">+</span> Add
                            </button>
                        )}
                    </div>

                    {/* Medication Cards */}
                    <div className="space-y-3">
                        {medications.map((med, index) => (
                            <div
                                key={index}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                            >
                                {/* Card Header - Drug Name */}
                                <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={med.name}
                                            onChange={e => {
                                                updateMed(index, 'name', e.target.value);
                                                setDrugSearchQuery(e.target.value);
                                                setShowDrugDropdown(index);
                                            }}
                                            onFocus={() => setShowDrugDropdown(index)}
                                            onBlur={() => setTimeout(() => setShowDrugDropdown(null), 200)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase"
                                            placeholder="Drug name..."
                                            readOnly={readOnly}
                                        />
                                        {/* Drug Dropdown */}
                                        {showDrugDropdown === index && filteredDrugs.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1">
                                                {filteredDrugs.slice(0, 8).map(drug => (
                                                    <button
                                                        key={drug.id}
                                                        type="button"
                                                        onMouseDown={() => handleSelectDrug(index, drug)}
                                                        className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-sm border-b border-gray-50 last:border-0"
                                                    >
                                                        <span className="font-medium">{drug.name}</span>
                                                        {drug.genericName && <span className="text-gray-500 ml-1 text-xs">({drug.genericName})</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {!readOnly && medications.length > 1 && (
                                        <button
                                            onClick={() => removeRow(index)}
                                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Card Body - Dosage Details */}
                                <div className="p-3 space-y-3">
                                    {/* Dose & Qty Row */}
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-semibold text-gray-400 uppercase">Dose</label>
                                            <div className="relative mt-1">
                                                <input
                                                    type="text"
                                                    value={med.dose}
                                                    onChange={e => {
                                                        const val = e.target.value.toUpperCase();
                                                        updateMed(index, 'dose', val);
                                                        setShowDoseDropdown(index);
                                                    }}
                                                    onFocus={() => setShowDoseDropdown(index)}
                                                    onBlur={() => setTimeout(() => setShowDoseDropdown(null), 200)}
                                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    placeholder="Select / Type..."
                                                    readOnly={readOnly}
                                                />
                                                {showDoseDropdown === index && (
                                                    <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1">
                                                        {DOSE_OPTIONS.filter(opt => opt.toLowerCase().includes((med.dose || '').toLowerCase())).map(opt => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onMouseDown={() => {
                                                                    updateMed(index, 'dose', opt);
                                                                    const mapping = DOSE_MAPPINGS[opt];
                                                                    if (mapping) {
                                                                        updateMed(index, 'morning', mapping.morning);
                                                                        updateMed(index, 'noon', mapping.noon);
                                                                        updateMed(index, 'night', mapping.night);
                                                                    }
                                                                    setShowDoseDropdown(null);
                                                                }}
                                                                className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-sm border-b border-gray-50 last:border-0 font-medium"
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-20">
                                            <label className="text-[10px] font-semibold text-gray-400 uppercase">Qty</label>
                                            <input
                                                type="text"
                                                value={med.number}
                                                onChange={e => updateMed(index, 'number', e.target.value)}
                                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="10"
                                                readOnly={readOnly}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-semibold text-gray-400 uppercase">Timing</label>
                                            <div className="relative mt-1">
                                                <input
                                                    type="text"
                                                    value={med.foodTiming}
                                                    onChange={e => {
                                                        const val = e.target.value.toUpperCase();
                                                        updateMed(index, 'foodTiming', val);
                                                        setShowTimingDropdown(index);
                                                    }}
                                                    onFocus={() => setShowTimingDropdown(index)}
                                                    onBlur={() => setTimeout(() => setShowTimingDropdown(null), 200)}
                                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    placeholder="A/F, B/F..."
                                                    readOnly={readOnly}
                                                />
                                                {showTimingDropdown === index && (
                                                    <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1">
                                                        {FOOD_TIMING_OPTIONS.filter(opt => opt.toLowerCase().includes((med.foodTiming || '').toLowerCase())).map(opt => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onMouseDown={() => {
                                                                    updateMed(index, 'foodTiming', opt);
                                                                    setShowTimingDropdown(null);
                                                                }}
                                                                className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-sm border-b border-gray-50 last:border-0 font-medium"
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* M / N / Nt Row */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Morning */}
                                        <div className="bg-orange-50 rounded-lg p-2 text-center">
                                            <label className="text-[10px] font-bold text-orange-600 uppercase">Morning</label>
                                            <input
                                                type="text"
                                                value={med.morning}
                                                onChange={e => updateMed(index, 'morning', e.target.value)}
                                                className="w-full mt-1 px-2 py-2 border border-orange-200 rounded-lg text-center text-lg font-bold focus:ring-2 focus:ring-orange-400 outline-none bg-white"
                                                placeholder="0"
                                                readOnly={readOnly}
                                            />
                                            <select
                                                value={med.morningTime}
                                                onChange={e => updateMed(index, 'morningTime', e.target.value)}
                                                className="w-full mt-1 px-1 py-1 text-[10px] border border-orange-200 rounded bg-white text-gray-600"
                                                disabled={readOnly}
                                            >
                                                <option value="">Time</option>
                                                {TIME_OPTIONS.filter(t => t.includes('AM') || t === '12 PM').map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Noon */}
                                        <div className="bg-yellow-50 rounded-lg p-2 text-center">
                                            <label className="text-[10px] font-bold text-yellow-600 uppercase">Noon</label>
                                            <input
                                                type="text"
                                                value={med.noon}
                                                onChange={e => updateMed(index, 'noon', e.target.value)}
                                                className="w-full mt-1 px-2 py-2 border border-yellow-200 rounded-lg text-center text-lg font-bold focus:ring-2 focus:ring-yellow-400 outline-none bg-white"
                                                placeholder="0"
                                                readOnly={readOnly}
                                            />
                                            <select
                                                value={med.noonTime}
                                                onChange={e => updateMed(index, 'noonTime', e.target.value)}
                                                className="w-full mt-1 px-1 py-1 text-[10px] border border-yellow-200 rounded bg-white text-gray-600"
                                                disabled={readOnly}
                                            >
                                                <option value="">Time</option>
                                                {TIME_OPTIONS.filter(t => t.includes('PM') && !t.includes('9') && !t.includes('10') && !t.includes('11')).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Night */}
                                        <div className="bg-indigo-50 rounded-lg p-2 text-center">
                                            <label className="text-[10px] font-bold text-indigo-600 uppercase">Night</label>
                                            <input
                                                type="text"
                                                value={med.night}
                                                onChange={e => updateMed(index, 'night', e.target.value)}
                                                className="w-full mt-1 px-2 py-2 border border-indigo-200 rounded-lg text-center text-lg font-bold focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                                                placeholder="0"
                                                readOnly={readOnly}
                                            />
                                            <select
                                                value={med.nightTime}
                                                onChange={e => updateMed(index, 'nightTime', e.target.value)}
                                                className="w-full mt-1 px-1 py-1 text-[10px] border border-indigo-200 rounded bg-white text-gray-600"
                                                disabled={readOnly}
                                            >
                                                <option value="">Time</option>
                                                {TIME_OPTIONS.filter(t => t.includes('PM')).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!readOnly && (
                        <button
                            onClick={addRow}
                            className="w-full mt-4 py-3 bg-white border-2 border-dashed border-emerald-200 text-emerald-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm"
                        >
                            <span className="text-xl">+</span> Add Another Medication
                        </button>
                    )}
                </div>

                {/* Intake Restrictions */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-3">Intake Restrictions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Salt Intake (gm/day)</label>
                            <input
                                type="text"
                                value={formData.saltIntake}
                                onChange={e => setFormData({ ...formData, saltIntake: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="e.g., 5"
                                readOnly={readOnly}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fluid Intake (lit/day)</label>
                            <input
                                type="text"
                                value={formData.fluidIntake}
                                onChange={e => setFormData({ ...formData, fluidIntake: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="e.g., 1.5"
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                </div>

                {/* Review Fields */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-3">Follow-up</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Date</label>
                            <input
                                type="date"
                                value={formData.reviewDate}
                                onChange={e => setFormData({ ...formData, reviewDate: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[45px]"
                                readOnly={readOnly}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tests to Review</label>
                            <input
                                type="text"
                                value={formData.testsToReview}
                                onChange={e => setFormData({ ...formData, testsToReview: e.target.value })}
                                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="Blood tests, X-ray, etc."
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Mobile Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={onPrint}
                    className="flex-1 px-4 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                </button>
                {!readOnly && (
                    <button
                        onClick={onSend}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        Send
                    </button>
                )}
            </div>
        </div>
    );
};

export default MobilePrescriptionInput;
