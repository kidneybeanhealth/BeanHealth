import React from 'react';

// ── Font Injection + CSS Variables + Keyframes ─────────────────────────────
const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800;900&display=swap');

:root {
  --crimson: #1A7A4A;
  --jade: #1A7A4A;
  --orange: #D97706;
  --cobalt: #1546A0;
  --ink: #0D1117;
  --surface: #F5F7FA;
  --card-bg: #FFFFFF;
  --border: #E2E8F0;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes popIn {
  0%   { opacity: 0; transform: scale(0); }
  70%  { transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes pressDown {
  to { transform: scale(0.95); }
}

@keyframes activePulse {
  0%   { transform: scale(1);    box-shadow: none; }
  40%  { transform: scale(1.08); box-shadow: 0 4px 18px rgba(26,122,74,0.4); }
  100% { transform: scale(1.02); box-shadow: 0 2px 10px rgba(26,122,74,0.3); }
}

@keyframes activePulseCobalt {
  0%   { transform: scale(1);    box-shadow: none; }
  40%  { transform: scale(1.08); box-shadow: 0 4px 18px rgba(21,70,160,0.4); }
  100% { transform: scale(1.02); box-shadow: 0 2px 10px rgba(21,70,160,0.3); }
}

/* Freq / Timing button :active */
.rx-freq-btn:active, .rx-timing-btn:active, .rx-clock-btn:active,
.rx-footer-btn:active { animation: pressDown 0.12s ease forwards; }

.rx-freq-btn-active  { animation: activePulse 0.22s ease forwards; }
.rx-timing-btn-active { animation: activePulseCobalt 0.22s ease forwards; }

/* Input focus transitions */
.rx-input, .rx-textarea {
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}
.rx-input:focus, .rx-textarea:focus {
  outline: none;
  background: #ffffff !important;
  border-color: #0D1117 !important;
  box-shadow: 0 0 0 3px rgba(13,17,23,0.07) !important;
}
.rx-input::placeholder, .rx-textarea::placeholder { color: #CBD5E1; }

/* Clock buttons hover */
.rx-clock-btn:hover {
  background: var(--jade) !important;
  color: #fff !important;
  transform: scale(1.07);
  box-shadow: 0 2px 10px rgba(26,122,74,0.35) !important;
}

/* Add medication dashed button */
.rx-add-dashed:hover {
  border-color: var(--jade) !important;
  color: var(--jade) !important;
  background: rgba(26,122,74,0.04) !important;
}

/* MedCard hover lift */
.rx-medcard {
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.rx-medcard:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.13) !important;
  transform: translateY(-1px);
}
`;

const FREQ_OPTIONS_ROWS = [
    ['OD', 'BD', 'TDS'],
    ['2OD', '2BD', '2TDS'],
    ['1/2OD', '1/2BD', '1/2TDS'],
    ['Q6H', 'HS'],
];

const TIMING_OPTIONS = ['A/F', 'B/F', 'S/C B/F', 'S/C'];

const DOSE_MAPPINGS: Record<string, { morning: string; noon: string; evening: string; night: string }> = {
    'OD': { morning: '1', noon: '0', evening: '0', night: '0' },
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
    'HS': { morning: '0', noon: '0', evening: '0', night: '1' },
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

// ── SlotRow ────────────────────────────────────────────────────────────────
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
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '34px', borderBottom: '1px solid rgba(217,119,6,0.08)', flex: 1 }}>
        {/* Label cell — orange */}
        <div style={{
            width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--orange), #F59E0B)',
            color: '#fff', fontSize: '9px', fontWeight: 900, flexShrink: 0,
            fontFamily: "'JetBrains Mono', monospace",
        }}>
            {label}
        </div>
        {/* Dose input */}
        <input
            type="text" value={value}
            onChange={e => !readOnly && onValueChange(e.target.value)}
            readOnly={readOnly}
            placeholder="-"
            className="rx-input"
            style={{
                width: '60px',
                textAlign: 'center', fontSize: '12px', fontWeight: 800, outline: 'none',
                background: 'rgba(255,255,255,0.85)', color: '#0D1117',
                borderTop: 'none', borderBottom: 'none',
                borderLeft: '1px solid rgba(217,119,6,0.1)',
                borderRight: '1px solid rgba(217,119,6,0.1)',
                fontFamily: "'JetBrains Mono', monospace",
            }}
        />
        {/* Time input */}
        <input
            type="text" value={timeValue}
            onChange={e => !readOnly && onTimeChange(e.target.value)}
            onFocus={onTimeFocus}
            readOnly={readOnly}
            placeholder="-"
            className="rx-input"
            style={{
                width: '28px', textAlign: 'center', fontSize: '11px', fontWeight: 700,
                outline: 'none', background: '#F5F7FA', color: '#374151', border: 'none',
                borderRight: '1px solid rgba(217,119,6,0.1)',
                fontFamily: "'JetBrains Mono', monospace",
            }}
        />
        {/* AM/PM toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <button
                type="button"
                onClick={() => !readOnly && onAmPmChange('AM')}
                style={{
                    flex: 1, fontSize: '8px', fontWeight: 900, border: 'none',
                    borderBottom: '1px solid rgba(217,119,6,0.08)', cursor: 'pointer',
                    background: amPm === 'AM' ? 'linear-gradient(135deg, var(--orange), #F59E0B)' : 'rgba(245,247,250,0.8)',
                    color: amPm === 'AM' ? '#fff' : '#94A3B8',
                    transition: 'all 0.15s ease',
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >AM</button>
            <button
                type="button"
                onClick={() => !readOnly && onAmPmChange('PM')}
                style={{
                    flex: 1, fontSize: '8px', fontWeight: 900, border: 'none',
                    cursor: 'pointer',
                    background: amPm === 'PM' ? 'linear-gradient(135deg, var(--orange), #F59E0B)' : 'rgba(245,247,250,0.8)',
                    color: amPm === 'PM' ? '#fff' : '#94A3B8',
                    transition: 'all 0.15s ease',
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >PM</button>
        </div>
    </div>
);

// ── MedCard ────────────────────────────────────────────────────────────────
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

    const sectionHeader = (label: string, bg = 'var(--ink)') => (
        <div style={{ background: bg, padding: '5px 4px', textAlign: 'center' }}>
            <span style={{
                color: 'rgba(255,255,255,0.95)', fontSize: '7px', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                fontFamily: "'Outfit', sans-serif",
            }}>{label}</span>
        </div>
    );

    const freqBtn = (opt: string) => {
        const isActive = med.dose === opt;
        return (
            <button
                key={opt} type="button"
                onMouseDown={() => {
                    if (readOnly) return;
                    // Tap again on active button → deselect (toggle off)
                    if (isActive) {
                        updateMed(index, 'dose', '');
                    } else {
                        applyFrequency(opt);
                    }
                }}
                className={`rx-freq-btn${isActive ? ' rx-freq-btn-active' : ''}`}
                style={{
                    flex: 1, padding: '4px 0', fontSize: '8px', fontWeight: 900,
                    borderRadius: '6px', cursor: 'pointer',
                    background: isActive ? 'var(--jade)' : '#fff',
                    color: isActive ? '#fff' : 'var(--jade)',
                    border: `1.5px solid var(--jade)`,
                    boxShadow: isActive ? '0 2px 10px rgba(26,122,74,0.3)' : 'none',
                    transition: 'all 0.15s ease',
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >{opt}</button>
        );
    };

    const timingBtn = (opt: string) => {
        const isActive = med.foodTiming === opt;
        return (
            <button
                key={opt} type="button"
                onMouseDown={() => {
                    if (readOnly) return;
                    // Tap again on active button → deselect (toggle off)
                    updateMed(index, 'foodTiming', isActive ? '' : opt);
                }}
                className={`rx-timing-btn${isActive ? ' rx-timing-btn-active' : ''}`}
                style={{
                    width: '100%', flex: 1, minHeight: '24px', fontSize: '8px', fontWeight: 900,
                    borderRadius: '6px', cursor: 'pointer',
                    background: isActive ? 'var(--cobalt)' : '#fff',
                    color: isActive ? '#fff' : 'var(--cobalt)',
                    border: `1.5px solid var(--cobalt)`,
                    boxShadow: isActive ? '0 2px 10px rgba(21,70,160,0.3)' : 'none',
                    transition: 'all 0.15s ease',
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >{opt}</button>
        );
    };

    const cardDelay = `${index * 0.06}s`;

    return (
        <div
            className="rx-medcard"
            style={{
                background: 'var(--card-bg)', borderRadius: '18px',
                border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '14px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                animation: `slideUp 0.36s ease ${cardDelay} forwards`,
            }}
        >
            {/* Card Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 14px', background: '#FAFBFC',
                borderBottom: '1px solid var(--border)',
            }}>
                <span style={{
                    width: '24px', height: '24px',
                    background: 'var(--ink)',
                    borderRadius: '7px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 900, color: '#fff', flexShrink: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    boxShadow: '0 2px 6px rgba(13,17,23,0.3)',
                }}>{index + 1}</span>
                <span style={{
                    flex: 1, fontSize: '9px', color: '#94A3B8',
                    textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif",
                }}>Medication</span>
{showRemove && !readOnly && (
                    <RemoveConfirmBtn index={index} removeRow={removeRow} />
                )}
            </div>

            {/* Drug Name + QTY */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {/* Drug Name */}
                <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{
                        padding: '4px 12px',
                        background: 'var(--crimson)',
                    }}>
                        <span style={{
                            fontSize: '7px', fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.14em', color: 'rgba(255,255,255,0.95)',
                            fontFamily: "'Outfit', sans-serif",
                        }}>Drug Name</span>
                    </div>
                    <input
                        type="text" value={med.name}
                        ref={drugInputRef}
                        onChange={e => {
                            const input = e.target;
                            const cursorPos = input.selectionStart;
                            const v = e.target.value.toUpperCase();
                            updateMed(index, 'name', v);
                            const searchTerm = stripDrugPrefix(v);
                            setDrugSearchQuery(searchTerm);
                            // Only show dropdown when the user is actually typing something
                            if (searchTerm.trim().length > 0) {
                                setShowDrugDropdown(index);
                            } else {
                                setShowDrugDropdown(null);
                            }
                            requestAnimationFrame(() => {
                                if (drugInputRef.current && cursorPos !== null) {
                                    drugInputRef.current.setSelectionRange(cursorPos, cursorPos);
                                }
                            });
                        }}
                        onFocus={() => {
                            // Do NOT open dropdown on focus/click — only typing should open it
                        }}
                        onBlur={() => setTimeout(() => setShowDrugDropdown(null), 200)}
                        readOnly={readOnly}
                        placeholder="Type or select..."
                        className="rx-input"
                        style={{
                            width: '100%', padding: '7px 12px', fontSize: '12px', fontWeight: 700,
                            outline: 'none', border: '1.5px solid transparent', background: 'transparent',
                            color: '#0D1117', textTransform: 'uppercase', boxSizing: 'border-box',
                            fontFamily: "'Outfit', sans-serif",
                        }}
                    />
                    {showDrugDropdown === index && filteredDrugs.length > 0 && (
                        <div style={{
                            position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
                            background: '#fff', border: '1px solid var(--border)',
                            borderRadius: '0 0 12px 12px',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
                            maxHeight: '160px', overflowY: 'auto',
                            animation: 'popIn 0.18s ease both',
                        }}>
                            {filteredDrugs.slice(0, 8).map(drug => (
                                <button
                                    key={drug.id} type="button"
                                    onMouseDown={() => handleSelectDrug(index, drug)}
                                    style={{
                                        width: '100%', padding: '8px 12px', textAlign: 'left',
                                        fontSize: '12.5px', color: '#374151', background: 'none',
                                        border: 'none', borderBottom: '1px solid #F5F7FA',
                                        cursor: 'pointer', fontWeight: 500,
                                        fontFamily: "'Outfit', sans-serif",
                                        transition: 'background 0.12s ease',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F7FA')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    {drug.drugType && (
                                        <span style={{
                                            fontWeight: 700, color: '#fff',
                                            background: 'var(--crimson)',
                                            padding: '1px 5px', borderRadius: '4px',
                                            fontSize: '9px', marginRight: '6px',
                                            fontFamily: "'Outfit', sans-serif",
                                        }}>{drug.drugType}</span>
                                    )}
                                    {drug.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* QTY */}
                <div style={{ width: '72px', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ padding: '4px 8px', background: '#1E293B' }}>
                        <span style={{
                            fontSize: '7px', fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.14em', color: 'rgba(255,255,255,0.9)',
                            fontFamily: "'Outfit', sans-serif",
                        }}>QTY</span>
                    </div>
                    <input
                        type="text" value={med.number}
                        onChange={e => updateMed(index, 'number', e.target.value)}
                        readOnly={readOnly} placeholder="10"
                        className="rx-input"
                        style={{
                            width: '100%', padding: '7px 4px', fontSize: '14px', fontWeight: 800,
                            outline: 'none', border: '1.5px solid transparent', background: '#fff',
                            color: '#0D1117', textAlign: 'center', boxSizing: 'border-box',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    />
                </div>
            </div>

            {/* 4-column grid */}
            <div style={{
                display: 'flex', alignItems: 'stretch',
                margin: '10px 10px 10px 10px', borderRadius: '12px', overflow: 'hidden',
                border: '1px solid var(--border)', background: 'var(--surface)',
            }}>
                {/* Col 1: Frequency */}
                <div style={{
                    flex: '1.2', borderRight: '1px solid rgba(26,122,74,0.2)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    {sectionHeader('Frequency', 'var(--jade)')}
                    <input
                        type="text" value={med.dose}
                        onChange={e => updateMed(index, 'dose', e.target.value.toUpperCase())}
                        readOnly={readOnly}
                        placeholder="e.g. OD"
                        className="rx-input"
                        style={{
                            padding: '4px 4px', fontSize: '10px', fontWeight: 700,
                            textAlign: 'center', outline: 'none', border: 'none',
                            borderBottom: '1px solid rgba(26,122,74,0.15)',
                            background: 'rgba(255,255,255,0.7)', color: '#374151',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    />
                    <div style={{
                        flex: 1, padding: '5px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                        {FREQ_OPTIONS_ROWS.map((row, ri) => (
                            <div key={ri} style={{
                                display: 'flex', gap: '3px', flex: 1,
                                marginBottom: ri < FREQ_OPTIONS_ROWS.length - 1 ? '3px' : '0',
                            }}>
                                {row.map(opt => freqBtn(opt))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Col 2: Timing */}
                <div style={{
                    flex: '0.65', borderRight: '1px solid rgba(21,70,160,0.2)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    {sectionHeader('Timing', 'var(--cobalt)')}
                    <input
                        type="text" value={med.foodTiming}
                        onChange={e => updateMed(index, 'foodTiming', e.target.value.toUpperCase())}
                        readOnly={readOnly}
                        placeholder="A/F"
                        className="rx-input"
                        style={{
                            padding: '4px 4px', fontSize: '10px', fontWeight: 700,
                            textAlign: 'center', outline: 'none', border: 'none',
                            borderBottom: '1px solid rgba(21,70,160,0.15)',
                            background: 'rgba(255,255,255,0.7)', color: '#374151',
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    />
                    <div style={{
                        flex: 1, padding: '5px',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '3px',
                    }}>
                        {TIMING_OPTIONS.map(opt => timingBtn(opt))}
                    </div>
                </div>

                {/* Col 3: M/N/E/NT */}
                <div style={{
                    flex: '1.7', borderRight: '1px solid rgba(217,119,6,0.15)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--orange), #F59E0B)',
                        display: 'grid', gridTemplateColumns: '28px 60px 28px 1fr', padding: '4px 0',
                    }}>
                        <span style={{ fontSize: '6px', color: 'transparent' }}>.</span>
                        <span style={{ fontSize: '6px', fontWeight: 900, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>Dose</span>
                        <span style={{ fontSize: '6px', fontWeight: 900, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>Time</span>
                        <span style={{ fontSize: '6px', fontWeight: 900, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>AM/PM</span>
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

                {/* Col 4: Clock picker */}
                <div style={{ flex: '1.1', display: 'flex', flexDirection: 'column' }}>
                    {sectionHeader('Time', 'var(--jade)')}
                    <div style={{
                        flex: 1, padding: '4px',
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gridTemplateRows: 'repeat(6, 1fr)', gap: '3px',
                        height: '100%', alignContent: 'stretch',
                    }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                            <button
                                key={h} type="button"
                                onMouseDown={() => !readOnly && updateMed(index, lastFocused, String(h))}
                                className="rx-clock-btn"
                                style={{
                                    height: '100%', minHeight: '26px', fontSize: '10px', fontWeight: 700,
                                    background: '#fff', color: 'var(--jade)',
                                    border: '1.5px solid var(--jade)', borderRadius: '6px',
                                    cursor: 'pointer', transition: 'all 0.15s ease',
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >{h}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Section card header helper ────────────────────────────────────────────
// ── Remove Drug Confirmation Button ────────────────────────────────────────
const RemoveConfirmBtn: React.FC<{ index: number; removeRow: (i: number) => void }> = ({ index, removeRow }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                style={{ fontSize: '13px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
            >✕</button>
            {open && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,17,23,0.55)', padding: '24px' }}>
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 20px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💊</div>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '16px', color: '#0D1117', margin: '0 0 8px' }}>Remove Medication?</h3>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 }}>This will delete the drug and all its dose details. This cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setOpen(false)}
                                style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: '#475569', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: "'Outfit', sans-serif" }}
                            >No, Keep It</button>
                            <button
                                onClick={() => { removeRow(index); setOpen(false); }}
                                style={{ flex: 1, padding: '12px', background: '#1A7A4A', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: "'Outfit', sans-serif", boxShadow: '0 4px 14px rgba(26,122,74,0.35)' }}
                            >Yes, Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const SectionCard: React.FC<{ emoji: string; label: string; children: React.ReactNode; delay?: string }> = ({
    emoji, label, children, delay = '0s',
}) => (
    <div style={{
        background: 'var(--card-bg)', borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        animation: `slideUp 0.36s ease ${delay} forwards`,
    }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 14px', borderBottom: '1px solid var(--border)',
            background: '#FAFBFC',
        }}>
            <span style={{ fontSize: '13px' }}>{emoji}</span>
            <span style={{
                fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.14em', color: '#64748B',
                fontFamily: "'Outfit', sans-serif",
            }}>{label}</span>
        </div>
        <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
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

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '9px 12px',
        background: '#F5F7FA', border: '1.5px solid var(--border)',
        borderRadius: '10px', fontSize: '13px', fontWeight: 600,
        outline: 'none', color: '#0D1117', boxSizing: 'border-box',
        fontFamily: "'Outfit', sans-serif",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: '#64748B', marginBottom: '6px',
        display: 'block',
        fontFamily: "'Outfit', sans-serif",
    };

    return (
        <>
            {/* Inject fonts + global styles */}
            <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

            <div style={{
                position: 'fixed', inset: 0, zIndex: 60,
                display: 'flex', flexDirection: 'column',
                background: 'var(--surface)',
                fontFamily: "'Outfit', sans-serif",
            }}>
                {/* ── Header ────────────────────────────────────────────── */}
                <div style={{
                    background: 'var(--ink)', padding: '10px 16px 0 16px',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontWeight: 800, fontSize: '17px', color: '#fff',
                                lineHeight: 1.2, margin: 0,
                            }}>{patient?.name || 'Patient'}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                {/* Token badge — crimson pill */}
                                <span style={{
                                    background: 'var(--crimson)',
                                    color: '#fff', padding: '2px 9px',
                                    borderRadius: '20px', fontSize: '10px', fontWeight: 900,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    letterSpacing: '0.04em',
                                }}>Token {patient?.token_number}</span>
                                <span style={{
                                    fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.65)',
                                    fontFamily: "'Outfit', sans-serif",
                                }}>{patient?.age} yrs</span>
                            </div>
                        </div>
                        {patient?.mr_number && (
                            <span style={{
                                fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                                textAlign: 'right', flexShrink: 0,
                                fontFamily: "'Outfit', sans-serif",
                            }}>MR: {patient.mr_number}</span>
                        )}
                    </div>
                    {/* Gradient signature strip */}
                    <div style={{
                        marginTop: '10px', height: '2px',
                        background: 'linear-gradient(90deg, var(--crimson), var(--cobalt), var(--jade))',
                    }} />
                </div>

                {/* ── Scrollable body ────────────────────────────────────── */}
                <div style={{
                    flex: '1 1 0',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch' as any,
                    padding: '14px 12px 16px 12px',
                    display: 'flex', flexDirection: 'column', gap: '12px',
                }}>

                    {/* Clinical Details card */}
                    <SectionCard emoji="🩺" label="Clinical Details" delay="0s">
                        {/* Diagnosis */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={labelStyle}>Diagnosis</label>
                            <div style={{ position: 'relative' }}>
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
                                    className="rx-textarea"
                                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                                    placeholder="Enter diagnosis..."
                                    readOnly={readOnly}
                                    rows={2}
                                />
                                {(() => {
                                    const selected = (formData.diagnosis || '').split('/').map(d => d.trim()).filter(Boolean);
                                    const filtered = savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase()) && !selected.includes(d.name));
                                    return showDiagnosisDropdown && diagnosisSearchQuery.length > 0 && filtered.length > 0 && (
                                        <div style={{
                                            position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
                                            background: '#fff', border: '1px solid var(--border)',
                                            borderRadius: '0 0 12px 12px',
                                            boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
                                            maxHeight: '180px', overflowY: 'auto', marginTop: '2px',
                                            animation: 'popIn 0.18s ease both',
                                        }}>
                                            {filtered.map(diag => (
                                                <button
                                                    key={diag.id} type="button"
                                                    style={{
                                                        width: '100%', textAlign: 'left', padding: '9px 14px',
                                                        fontSize: '12.5px', fontWeight: 500,
                                                        background: 'none', border: 'none',
                                                        borderBottom: '1px solid #F5F7FA', cursor: 'pointer',
                                                        color: '#374151',
                                                        fontFamily: "'Outfit', sans-serif",
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F7FA')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                                    onMouseDown={() => {
                                                        const parts = (formData.diagnosis || '').split('/');
                                                        parts[parts.length - 1] = '';
                                                        const newValue = [...parts.filter(p => p.trim()), diag.name].join('/') + '/';
                                                        setFormData({ ...formData, diagnosis: newValue });
                                                        setDiagnosisSearchQuery('');
                                                        setShowDiagnosisDropdown(false);
                                                    }}
                                                >{diag.name}</button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        {/* Drug Allergy */}
                        <div>
                            <label style={labelStyle}>Drug Allergy</label>
                            <input
                                type="text" value={formData.allergy}
                                onChange={e => setFormData({ ...formData, allergy: e.target.value.toUpperCase() })}
                                className="rx-input"
                                style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }}
                                placeholder="Nil"
                                readOnly={readOnly}
                            />
                        </div>
                    </SectionCard>

                    {/* Medications section */}
                    <div style={{ animation: 'slideUp 0.36s ease 0.06s forwards' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h3 style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontWeight: 800, fontSize: '12px', color: '#0D1117',
                                textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0,
                            }}>Medications</h3>
                            {!readOnly && (
                                <button
                                    onClick={addRow}
                                    className="rx-footer-btn"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '5px 12px', background: 'var(--ink)',
                                        color: '#fff', borderRadius: '20px', border: 'none',
                                        fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                                        fontFamily: "'Outfit', sans-serif",
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M5 1v8M1 5h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                    Add
                                </button>
                            )}
                        </div>

                        {medications.map((med, idx) => (
                            <MedCard
                                key={idx} med={med as Medication} index={idx}
                                updateMed={updateMed} removeRow={removeRow} readOnly={readOnly}
                                filteredDrugs={filteredDrugs} drugSearchQuery={drugSearchQuery}
                                setDrugSearchQuery={setDrugSearchQuery}
                                showDrugDropdown={showDrugDropdown} setShowDrugDropdown={setShowDrugDropdown}
                                handleSelectDrug={handleSelectDrug} showRemove={medications.length > 1}
                            />
                        ))}

                        {!readOnly && (
                            <button
                                onClick={addRow}
                                className="rx-add-dashed rx-footer-btn"
                                style={{
                                    width: '100%', padding: '14px', background: '#fff',
                                    border: '2px dashed var(--border)', borderRadius: '16px',
                                    color: '#94A3B8', fontSize: '13px', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    cursor: 'pointer', transition: 'all 0.18s ease',
                                    fontFamily: "'Outfit', sans-serif",
                                }}
                            >
                                <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> Add Another Medication
                            </button>
                        )}
                    </div>

                    {/* Notes card */}
                    <SectionCard emoji="📝" label="Notes" delay="0.12s">
                        <textarea
                            value={formData.doctorNotes}
                            onChange={e => setFormData({ ...formData, doctorNotes: e.target.value.toUpperCase() })}
                            className="rx-textarea"
                            style={{ ...inputStyle, resize: 'none', textTransform: 'uppercase', lineHeight: 1.6 }}
                            placeholder="ADDITIONAL NOTES FOR THE PATIENT..."
                            readOnly={readOnly}
                            rows={4}
                        />
                    </SectionCard>

                    {/* Intake card */}
                    <SectionCard emoji="💧" label="Intake Restrictions" delay="0.18s">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={labelStyle}>Salt (gm/day)</label>
                                <input
                                    type="text" value={formData.saltIntake}
                                    onChange={e => setFormData({ ...formData, saltIntake: e.target.value })}
                                    className="rx-input" style={inputStyle}
                                    placeholder="e.g., 5" readOnly={readOnly}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Fluid (lit/day)</label>
                                <input
                                    type="text" value={formData.fluidIntake}
                                    onChange={e => setFormData({ ...formData, fluidIntake: e.target.value })}
                                    className="rx-input" style={inputStyle}
                                    placeholder="e.g., 1.5" readOnly={readOnly}
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Follow-up card */}
                    <SectionCard emoji="📅" label="Follow-up" delay="0.24s">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Review Date */}
                            <div>
                                <label style={labelStyle}>Review Date</label>
                                <input
                                    type="date" value={formData.reviewDate}
                                    onChange={e => setFormData({ ...formData, reviewDate: e.target.value })}
                                    className="rx-input"
                                    style={{ ...inputStyle, minHeight: '45px', fontFamily: "'JetBrains Mono', monospace" }}
                                    readOnly={readOnly}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                {formData.reviewDate && getReviewDaysLabel(formData.reviewDate) && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        marginTop: '6px', padding: '4px 10px',
                                        background: '#F1F5F9', color: '#475569',
                                        borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                                        fontFamily: "'Outfit', sans-serif",
                                    }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        Review {getReviewDaysLabel(formData.reviewDate)}
                                    </span>
                                )}
                            </div>

                            {/* Tests */}
                            <div>
                                <label style={labelStyle}>Tests to Review</label>
                                <input
                                    type="text" value={formData.testsToReview}
                                    onChange={e => setFormData({ ...formData, testsToReview: e.target.value.toUpperCase() })}
                                    className="rx-input"
                                    style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }}
                                    placeholder="BLOOD TESTS, X-RAY, ETC."
                                    readOnly={readOnly}
                                />
                            </div>

                            {/* Specialists */}
                            <div>
                                <label style={labelStyle}>Specialists to be seen</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text" value={formData.specialistToReview}
                                        onChange={e => setFormData({ ...formData, specialistToReview: e.target.value.toUpperCase() })}
                                        onFocus={() => !readOnly && setShowSpecialistDropdown(true)}
                                        className="rx-input"
                                        style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }}
                                        placeholder="TYPE OR SELECT SPECIALISTS..."
                                        readOnly={readOnly}
                                    />
                                    {!readOnly && showSpecialistDropdown && (
                                        <>
                                            <div
                                                style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                                                onClick={() => setShowSpecialistDropdown(false)}
                                            />
                                            <div style={{
                                                position: 'absolute', left: 0, right: 0,
                                                bottom: '100%', marginBottom: '4px', zIndex: 60,
                                                background: '#fff', border: '1px solid var(--border)',
                                                borderRadius: '14px',
                                                boxShadow: '0 -16px 40px rgba(0,0,0,0.14)',
                                                maxHeight: '260px', overflowY: 'auto', padding: '6px 0',
                                                animation: 'popIn 0.18s ease both',
                                            }}>
                                                {SPECIALIST_OPTIONS.map(opt => {
                                                    const current = parseSpecialists(formData.specialistToReview || '');
                                                    const selected = current.includes(opt);
                                                    return (
                                                        <button
                                                            key={opt} type="button"
                                                            onMouseDown={e => {
                                                                e.preventDefault();
                                                                const next = selected ? current.filter(s => s !== opt) : [...current, opt];
                                                                setFormData({ ...formData, specialistToReview: next.join(', ') });
                                                            }}
                                                            style={{
                                                                width: '100%', padding: '11px 16px',
                                                                textAlign: 'left', display: 'flex',
                                                                alignItems: 'center', justifyContent: 'space-between',
                                                                borderBottom: '1px solid #F5F7FA',
                                                                background: selected ? '#F1F5F9' : 'none',
                                                                border: 'none', cursor: 'pointer',
                                                                fontSize: '12.5px', fontWeight: selected ? 700 : 500,
                                                                color: '#374151',
                                                                fontFamily: "'Outfit', sans-serif",
                                                                transition: 'background 0.12s ease',
                                                            }}
                                                            onMouseEnter={e => !selected && (e.currentTarget.style.background = '#F5F7FA')}
                                                            onMouseLeave={e => !selected && (e.currentTarget.style.background = 'none')}
                                                        >
                                                            {opt}
                                                            {selected && (
                                                                <span style={{
                                                                    width: '18px', height: '18px',
                                                                    background: 'var(--ink)', borderRadius: '4px',
                                                                    display: 'inline-flex', alignItems: 'center',
                                                                    justifyContent: 'center', color: '#fff',
                                                                    fontSize: '11px', fontWeight: 900, flexShrink: 0,
                                                                }}>✓</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* ── Footer ────────────────────────────────────────────── */}
                <div style={{
                    flexShrink: 0,
                    background: '#fff', borderTop: '1px solid var(--border)',
                    padding: '10px 12px',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                    display: 'flex', gap: '8px',
                }}>
                    {/* Cancel */}
                    <button
                        onClick={onClose}
                        className="rx-footer-btn"
                        style={{
                            flex: 1, padding: '12px', background: '#E2E8F0',
                            color: '#475569', fontWeight: 800, borderRadius: '12px',
                            border: 'none', cursor: 'pointer', fontSize: '13px',
                            fontFamily: "'Outfit', sans-serif",
                            transition: 'all 0.15s ease',
                        }}
                    >Cancel</button>

                    {/* Print */}
                    <button
                        onClick={onPrint}
                        className="rx-footer-btn"
                        style={{
                            flex: 1, padding: '12px', background: 'var(--ink)',
                            color: '#fff', fontWeight: 800, borderRadius: '12px',
                            border: 'none', cursor: 'pointer', fontSize: '13px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            fontFamily: "'Outfit', sans-serif",
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                    </button>

                    {/* Send */}
                    {!readOnly && (
                        <button
                            onClick={onSend}
                            className="rx-footer-btn"
                            style={{
                                flex: 1, padding: '12px', background: 'var(--crimson)',
                                color: '#fff', fontWeight: 800, borderRadius: '12px',
                                border: 'none', cursor: 'pointer', fontSize: '13px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontFamily: "'Outfit', sans-serif",
                                boxShadow: '0 4px 18px rgba(26,122,74,0.35)',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Send
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default MobilePrescriptionInput;
