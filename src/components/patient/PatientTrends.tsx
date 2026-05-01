import React, { useState, useEffect, useRef } from 'react';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { PatientAppService, DailyVitals, DailyIntakes } from '../../services/patientAppService';
import { supabase } from '../../lib/supabase';
import WheelPicker from './WheelPicker';
import { Button } from '../ui/button';
import TrendChart from './TrendChart';

type Period = 7 | 30 | 90;
type View = 'list' | 'trends';

const SYS_VALS  = Array.from({ length: 141 }, (_, i) => i + 60);
const DIA_VALS  = Array.from({ length: 91  }, (_, i) => i + 40);
const WT_VALS   = Array.from({ length: 241 }, (_, i) => parseFloat((30 + i * 0.5).toFixed(1)));
const GLU_VALS  = Array.from({ length: 351 }, (_, i) => i + 50);

const PERIODS: { value: Period; label: string }[] = [
  { value: 7,  label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
];

interface MergedRecord {
  date: string;
  vitals: DailyVitals | null;
  urineTotal: number | null;
}

// ── Edit sheet ──────────────────────────────────────────────────────────────
function EditVitalsSheet({
  record,
  onClose,
  onSave,
  lang,
}: {
  record: DailyVitals;
  onClose: () => void;
  onSave: (updated: Partial<DailyVitals>) => Promise<void>;
  lang: string;
}) {
  const [vals, setVals] = useState({
    sys:     record.bp_systole     ?? 120,
    dia:     record.bp_diastole    ?? 80,
    weight:  Number(record.weight  ?? 70),
    glucose: Number(record.blood_glucose ?? 100),
  });
  const [activeField, setActiveField] = useState<'bp' | 'weight' | 'glucose'>('bp');
  const [saving, setSaving] = useState(false);

  const up = (k: keyof typeof vals, v: number) => setVals(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      bp_systole: vals.sys,
      bp_diastole: vals.dia,
      weight: vals.weight,
      blood_glucose: vals.glucose,
      blood_glucose_type: record.blood_glucose_type || 'random',
    });
    setSaving(false);
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return d; }
  };

  const fields: { id: 'bp' | 'weight' | 'glucose'; label: string }[] = [
    { id: 'bp',      label: lang === 'ta' ? 'இரத்த அழுத்தம்' : 'Blood Pressure' },
    { id: 'weight',  label: lang === 'ta' ? 'உடல் எடை' : 'Body Weight' },
    { id: 'glucose', label: lang === 'ta' ? 'இரத்த சர்க்கரை' : 'Blood Glucose' },
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="py-3 flex justify-center"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>

        <div className="px-5 pb-2">
          <p className="text-sm font-semibold text-muted-foreground">{lang === 'ta' ? 'திருத்து' : 'Edit'}</p>
          <p className="text-lg font-bold text-foreground" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            {fmtDate(record.recorded_date)}
          </p>
        </div>

        {/* Field tabs */}
        <div className="flex gap-2 px-5 mb-4 overflow-x-auto">
          {fields.map(f => (
            <button key={f.id} onClick={() => setActiveField(f.id)}
              className="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
              style={{
                background: activeField === f.id ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                color: activeField === f.id ? 'white' : 'hsl(var(--muted-foreground))',
                border: 'none', cursor: 'pointer',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Pickers */}
        <div className="px-6 py-2">
          {activeField === 'bp' ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">SYS</p>
                <WheelPicker values={SYS_VALS} value={vals.sys} onChange={v => up('sys', v as number)} />
              </div>
              <span className="text-3xl text-gray-200 font-light" style={{ fontFamily: 'Outfit, sans-serif' }}>/</span>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">DIA</p>
                <WheelPicker values={DIA_VALS} value={vals.dia} onChange={v => up('dia', v as number)} />
              </div>
            </div>
          ) : activeField === 'weight' ? (
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">kg</p>
              <WheelPicker values={WT_VALS} value={vals.weight} onChange={v => up('weight', v as number)} />
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">mg/dL</p>
              <WheelPicker values={GLU_VALS} value={vals.glucose} onChange={v => up('glucose', v as number)} />
            </div>
          )}
        </div>

        <div className="px-6 pt-4 flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onClose}>
            {lang === 'ta' ? 'ரத்து' : 'Cancel'}
          </Button>
          <Button className="flex-1 h-12 rounded-xl" disabled={saving} onClick={handleSave}
            style={{ background: 'hsl(var(--primary))', color: 'white' }}>
            {saving ? '…' : lang === 'ta' ? 'சேமி' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function PatientTrends() {
  const { session } = usePatientApp();
  const { lang, t } = useLanguage();
  const [view, setView]       = useState<View>('list');
  const [period, setPeriod]   = useState<Period>(30);
  const [vitalsHistory, setVitalsHistory]   = useState<DailyVitals[]>([]);
  const [intakesHistory, setIntakesHistory] = useState<DailyIntakes[]>([]);
  const [urineHistory, setUrineHistory]     = useState<{ date: string; total_ml: number }[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editRecord, setEditRecord]         = useState<DailyVitals | null>(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);
  const [chartVisible, setChartVisible]     = useState(true);

  const fetchHistory = async () => {
    if (!session?.patient.id) return;
    setLoading(true);
    const [v, i, u] = await Promise.all([
      PatientAppService.getVitalsHistory(session.patient.id, period),
      PatientAppService.getIntakesHistory(session.patient.id, period),
      PatientAppService.getUrineOutputHistory(session.patient.id, period),
    ]);
    setVitalsHistory(v);
    setIntakesHistory(i);
    setUrineHistory(u);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [session?.patient.id, period]);

  const handlePeriodChange = (p: Period) => {
    if (p === period) return;
    setChartVisible(false);
    setTimeout(() => { setPeriod(p); setTimeout(() => setChartVisible(true), 100); }, 200);
  };

  const handleDeleteVitals = async (date: string) => {
    const rec = vitalsHistory.find(v => v.recorded_date === date);
    if (!rec?.id) return;
    await (supabase as any).from('hospital_patient_vitals').delete().eq('id', rec.id);
    setConfirmDeleteDate(null);
    await fetchHistory();
  };

  const handleSaveEdit = async (updated: Partial<DailyVitals>) => {
    if (!editRecord) return;
    await PatientAppService.saveDailyVitals({
      patient_id: editRecord.patient_id,
      hospital_id: editRecord.hospital_id,
      recorded_date: editRecord.recorded_date,
      bp_systole: updated.bp_systole ?? editRecord.bp_systole,
      bp_diastole: updated.bp_diastole ?? editRecord.bp_diastole,
      blood_glucose: updated.blood_glucose ?? editRecord.blood_glucose,
      blood_glucose_type: updated.blood_glucose_type ?? editRecord.blood_glucose_type,
      weight: updated.weight ?? editRecord.weight,
    });
    setEditRecord(null);
    await fetchHistory();
  };

  // Merge vitals + urine by date, latest first
  const merged: MergedRecord[] = (() => {
    const dateSet = new Set<string>();
    vitalsHistory.forEach(v => dateSet.add(v.recorded_date));
    urineHistory.forEach(u => dateSet.add(u.date));
    const urineMap = new Map(urineHistory.map(u => [u.date, u.total_ml]));
    return Array.from(dateSet)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        vitals: vitalsHistory.find(v => v.recorded_date === date) || null,
        urineTotal: urineMap.get(date) || null,
      }));
  })();

  const fmtDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return d; }
  };

  // Chart data
  const bpData      = vitalsHistory.filter(v => v.bp_systole).map(v => ({ date: v.recorded_date, value: v.bp_systole || 0, value2: v.bp_diastole || 0 }));
  const weightData  = vitalsHistory.filter(v => v.weight).map(v => ({ date: v.recorded_date, value: Number(v.weight) || 0 }));
  const glucoseData = vitalsHistory.filter(v => v.blood_glucose).map(v => ({ date: v.recorded_date, value: Number(v.blood_glucose) || 0 }));
  const urineData   = urineHistory.map(u => ({ date: u.date, value: u.total_ml }));

  const TX = {
    en: { history: 'History', list: 'List', trends: 'Trends', bp: 'Blood Pressure', wt: 'Body Weight', glu: 'Blood Glucose', urine: 'Urine Output', mmhg: 'mmHg', kg: 'kg', mgdl: 'mg/dL', ml: 'mL', noRecords: 'No records in this period', deleteConfirm: 'Delete this record?', delete: 'Delete', cancel: 'Cancel', systolic: 'Systolic', diastolic: 'Diastolic' },
    ta: { history: 'வரலாறு', list: 'பட்டியல்', trends: 'போக்குகள்', bp: 'இரத்த அழுத்தம்', wt: 'உடல் எடை', glu: 'இரத்த சர்க்கரை', urine: 'சிறுநீர் வெளியீடு', mmhg: 'mmHg', kg: 'கிலோ', mgdl: 'mg/dL', ml: 'mL', noRecords: 'இந்த காலகட்டத்தில் பதிவுகள் இல்லை', deleteConfirm: 'இந்த பதிவை நீக்கவா?', delete: 'நீக்கு', cancel: 'ரத்து', systolic: 'சிஸ்டோலிக்', diastolic: 'டயஸ்டோலிக்' },
  };
  const tx = TX[lang as 'en' | 'ta'] ?? TX.en;

  return (
    <div className="pa-content" style={{ paddingBottom: '6rem' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--foreground))', fontFamily: 'Fraunces, Georgia, serif', marginBottom: 16 }}>
        {tx.history}
      </h1>

      {/* List / Trends toggle */}
      <div style={{
        display: 'flex', background: 'hsl(var(--muted))', borderRadius: 28,
        padding: 4, marginBottom: 16, gap: 4,
      }}>
        {(['list', 'trends'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '10px 0', borderRadius: 24, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
            background: view === v ? 'white' : 'transparent',
            color: view === v ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            boxShadow: view === v ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s ease',
          }}>
            {v === 'list' ? tx.list : tx.trends}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => handlePeriodChange(p.value)} style={{
            padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
            background: period === p.value ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
            color: period === p.value ? 'white' : 'hsl(var(--muted-foreground))',
            transition: 'all 0.2s ease',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="pa-spinner large" />
        </div>
      ) : view === 'list' ? (
        merged.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: '48px 0', fontSize: 14 }}>{tx.noRecords}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {merged.map(rec => (
              <div key={rec.date} style={{
                background: 'white', borderRadius: 20, padding: '18px 20px',
                boxShadow: '0 1px 12px rgba(0,0,0,0.06)', border: '1px solid hsl(var(--border))',
              }}>
                {/* Date + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--foreground))', fontFamily: 'Fraunces, Georgia, serif' }}>
                    {fmtDate(rec.date)}
                  </span>
                  {rec.vitals && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditRecord(rec.vitals!)} style={{
                        width: 32, height: 32, borderRadius: 8, border: '1px solid hsl(var(--border))',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button onClick={() => setConfirmDeleteDate(rec.date)} style={{
                        width: 32, height: 32, borderRadius: 8, border: '1px solid #FEE2E2',
                        background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: 'hsl(var(--border))', marginBottom: 14 }} />

                {/* 2×2 vital values */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 16, columnGap: 12 }}>
                  {[
                    { label: tx.bp,    value: rec.vitals?.bp_systole ? `${rec.vitals.bp_systole}/${rec.vitals.bp_diastole}` : null, unit: tx.mmhg },
                    { label: tx.wt,    value: rec.vitals?.weight     ? String(rec.vitals.weight)     : null, unit: tx.kg    },
                    { label: tx.glu,   value: rec.vitals?.blood_glucose ? String(rec.vitals.blood_glucose) : null, unit: tx.mgdl  },
                    { label: tx.urine, value: rec.urineTotal ? String(rec.urineTotal) : null, unit: tx.ml    },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 500, marginBottom: 3, lineHeight: 1.2 }}>{item.label}</p>
                      {item.value ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--foreground))', fontFamily: 'Fraunces, Georgia, serif', lineHeight: 1 }}>{item.value}</span>
                          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{item.unit}</span>
                        </div>
                      ) : (
                        <div style={{ width: 20, height: 2, background: '#D1D5DB', borderRadius: 2, marginTop: 6 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Trends / Charts view */
        <div style={{ opacity: chartVisible ? 1 : 0, transform: chartVisible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
          <TrendChart title={`${tx.bp} (mmHg)`} data={bpData} color="#EF4444" color2="#F9A8D4"
            unit="mmHg" label1={tx.systolic} label2={tx.diastolic} referenceMax={140} referenceMin={60} />
          <TrendChart title={`${tx.wt} (kg)`} data={weightData} color="#3B82F6" unit="kg" />
          <TrendChart title={`${tx.glu} (mg/dL)`} data={glucoseData} color="#F59E0B" unit="mg/dL" referenceMax={140} referenceMin={70} />
          <TrendChart title={`${tx.urine} (mL)`} data={urineData} color="#06B6D4" unit="mL" />
        </div>
      )}

      {/* Edit sheet */}
      {editRecord && (
        <EditVitalsSheet
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSave={handleSaveEdit}
          lang={lang}
        />
      )}

      {/* Delete confirm */}
      {confirmDeleteDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <p style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 20, fontFamily: 'Outfit, sans-serif' }}>{tx.deleteConfirm}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmDeleteDate(null)} style={{
                flex: 1, height: 48, borderRadius: 12, border: '1px solid hsl(var(--border))',
                background: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              }}>{tx.cancel}</button>
              <button onClick={() => handleDeleteVitals(confirmDeleteDate)} style={{
                flex: 1, height: 48, borderRadius: 12, border: 'none',
                background: '#EF4444', color: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
              }}>{tx.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
