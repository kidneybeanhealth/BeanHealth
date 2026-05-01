import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Scale, Droplet, FlaskConical, Check, ChevronRight, Pill } from 'lucide-react';
import { Button } from '../ui/button';
import WheelPicker from './WheelPicker';
import { usePatientApp } from '../../contexts/PatientAppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { PatientAppService, DailyVitals } from '../../services/patientAppService';

// ── Value ranges ───────────────────────────────────────────────────────────
const SYS_VALS  = Array.from({ length: 141 }, (_, i) => i + 60);
const DIA_VALS  = Array.from({ length: 91  }, (_, i) => i + 40);
const WT_VALS   = Array.from({ length: 241 }, (_, i) => parseFloat((30 + i * 0.5).toFixed(1)));
const GLU_VALS  = Array.from({ length: 351 }, (_, i) => i + 50);
const URN_VALS  = Array.from({ length: 81  }, (_, i) => i * 50);

type VitalType = 'bp' | 'weight' | 'glucose' | 'urine';

const VITAL_META: Record<VitalType, { labelKey: string; Icon: React.ElementType; unit: string }> = {
  bp:      { labelKey: 'bloodPressure', Icon: Activity,     unit: 'mmHg' },
  weight:  { labelKey: 'bodyWeight',    Icon: Scale,        unit: 'kg' },
  glucose: { labelKey: 'bloodGlucose',  Icon: Droplet,      unit: 'mg/dL' },
  urine:   { labelKey: 'urineOutput',   Icon: FlaskConical, unit: 'mL/24h' },
};

const T = {
  en: {
    goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
    bloodPressure: 'Blood Pressure', bodyWeight: 'Body Weight',
    bloodGlucose: 'Blood Glucose', urineOutput: 'Urine Output',
    systolic: 'SYS', diastolic: 'DIA',
    tapToRecord: 'Tap to record', vsYesterday: 'vs yesterday',
    takenToday: "Today's medications", recordVital: 'Record Vitals',
    record: 'Record', cancel: 'Cancel', morning: 'Morning',
    afternoon: 'Afternoon', night: 'Night', viewHistory: 'View History',
    noMedications: 'No prescriptions. Your doctor will add them once connected.',
  },
  ta: {
    goodMorning: 'காலை வணக்கம்', goodAfternoon: 'மதிய வணக்கம்', goodEvening: 'மாலை வணக்கம்',
    bloodPressure: 'இரத்த அழுத்தம்', bodyWeight: 'உடல் எடை',
    bloodGlucose: 'இரத்த சர்க்கரை', urineOutput: 'சிறுநீர் வெளியீடு',
    systolic: 'SYS', diastolic: 'DIA',
    tapToRecord: 'தொட்டு பதிவு செய்யவும்', vsYesterday: 'நேற்றுடன்',
    takenToday: 'இன்றைய மருந்துகள்', recordVital: 'உடல் நிலை பதிவு',
    record: 'பதிவு செய்', cancel: 'ரத்து', morning: 'காலை',
    afternoon: 'மதியம்', night: 'இரவு', viewHistory: 'வரலாறு காண்',
    noMedications: 'மருந்து சீட்டு இல்லை. மருத்துவர் சேர்ப்பார்.',
  },
};

function getMedSlots(med: { morning: string; noon: string; evening: string; night: string }) {
  const slots: string[] = [];
  if (med.morning && med.morning !== '0') slots.push('morning');
  if (med.noon    && med.noon    !== '0') slots.push('afternoon');
  if (med.evening && med.evening !== '0') slots.push('afternoon');
  if (med.night   && med.night   !== '0') slots.push('night');
  return slots.length > 0 ? slots : ['morning'];
}

function CircularProgress({ taken, total }: { taken: number; total: number }) {
  const pct = total > 0 ? taken / total : 0;
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <svg width={68} height={68} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="white" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="32" y="36" textAnchor="middle" fill="white" fontSize="11" fontWeight="700"
        style={{ fontFamily: 'Outfit, sans-serif' }}>{Math.round(pct * 100)}%</text>
    </svg>
  );
}

interface VitalCardData {
  type: VitalType;
  today: { val: string; raw: number | null } | null;
  yesterday: { raw: number | null } | null;
}

function VitalSummaryCard({ data, t, onTap }: { data: VitalCardData; t: typeof T['en']; onTap: (tp: VitalType) => void }) {
  const meta = VITAL_META[data.type];
  const Icon = meta.Icon;
  const isRecorded = !!data.today;

  const delta = (() => {
    if (!data.today?.raw || !data.yesterday?.raw) return null;
    const d = data.today.raw - data.yesterday.raw;
    const abs = data.type === 'weight' ? Math.abs(parseFloat(d.toFixed(1))) : Math.abs(Math.round(d));
    if (d === 0) return { text: `0 ${t.vsYesterday}`, color: 'text-muted-foreground', arrow: '' };
    return { text: `${abs} ${t.vsYesterday}`, arrow: d > 0 ? '↗' : '↘', color: d > 0 ? 'text-red-500' : 'text-emerald-600' };
  })();

  return (
    <button
      className="bg-white rounded-2xl p-4 text-left w-full border border-gray-100 active:scale-[0.97] transition-transform"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
      onClick={() => onTap(data.type)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          <span className="text-xs text-gray-500 font-medium leading-tight">{(t as any)[meta.labelKey]}</span>
        </div>
        {isRecorded && (
          <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 ml-1">
            <Check className="w-3 h-3 text-emerald-600" />
          </div>
        )}
      </div>
      {isRecorded ? (
        <>
          <div className="mb-1 flex items-baseline gap-1">
            <span className="font-bold text-foreground leading-none" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(24px, 6vw, 32px)' }}>
              {data.today!.val}
            </span>
            <span className="text-xs text-gray-400">{meta.unit}</span>
          </div>
          {delta && (
            <div className={`text-xs font-medium flex items-center gap-0.5 ${delta.color}`}>
              {delta.arrow && <span>{delta.arrow}</span>}
              <span>{delta.text}</span>
            </div>
          )}
        </>
      ) : (
        <div className="py-1">
          <span className="text-2xl font-light text-gray-300" style={{ fontFamily: 'Outfit, sans-serif' }}>—</span>
          <p className="text-xs text-gray-400 mt-1">{t.tapToRecord}</p>
        </div>
      )}
    </button>
  );
}

interface RecordSheetProps {
  initialType: VitalType;
  onClose: () => void;
  onSaved: () => void;
  saveVitals: (v: Partial<DailyVitals>) => Promise<boolean>;
  addUrineOutput: (amount: number) => Promise<void>;
  t: typeof T['en'];
}

function RecordSheet({ initialType, onClose, onSaved, saveVitals, addUrineOutput, t }: RecordSheetProps) {
  const types: VitalType[] = ['bp', 'weight', 'glucose', 'urine'];
  const [activeType, setActiveType] = useState<VitalType>(initialType);
  const [vals, setVals] = useState({ sys: 120, dia: 80, weight: 70, glucose: 100, urine: 1500 });
  const [saving, setSaving] = useState(false);

  const up = (field: keyof typeof vals, v: number) => setVals(p => ({ ...p, [field]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeType === 'bp') {
        await saveVitals({ bp_systole: vals.sys, bp_diastole: vals.dia });
      } else if (activeType === 'weight') {
        await saveVitals({ weight: vals.weight });
      } else if (activeType === 'glucose') {
        await saveVitals({ blood_glucose: vals.glucose, blood_glucose_type: 'random' });
      } else if (activeType === 'urine') {
        await addUrineOutput(vals.urine);
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="py-3 flex justify-center"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <p className="text-center text-sm font-semibold text-foreground mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>{t.recordVital}</p>

        {/* Type tabs */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-0.5">
          {types.map((tp) => {
            const { Icon, labelKey } = VITAL_META[tp];
            return (
              <button key={tp} onClick={() => setActiveType(tp)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeType === tp ? 'text-white' : 'text-muted-foreground'
                }`}
                style={activeType === tp ? { background: 'hsl(var(--primary))' } : { background: 'hsl(var(--muted))' }}
              >
                <Icon className="w-3.5 h-3.5" />
                {(t as any)[labelKey]}
              </button>
            );
          })}
        </div>

        {/* Pickers */}
        <div className="px-6 py-2">
          {activeType === 'bp' ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">{t.systolic}</p>
                <WheelPicker values={SYS_VALS} value={vals.sys} onChange={v => up('sys', v as number)} />
              </div>
              <span className="text-3xl text-gray-200 font-light" style={{ fontFamily: 'Outfit, sans-serif' }}>/</span>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">{t.diastolic}</p>
                <WheelPicker values={DIA_VALS} value={vals.dia} onChange={v => up('dia', v as number)} />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">{VITAL_META[activeType].unit}</p>
              <WheelPicker
                values={activeType === 'weight' ? WT_VALS : activeType === 'glucose' ? GLU_VALS : URN_VALS}
                value={activeType === 'weight' ? vals.weight : activeType === 'glucose' ? vals.glucose : vals.urine}
                onChange={v => {
                  if (activeType === 'weight') up('weight', v as number);
                  else if (activeType === 'glucose') up('glucose', v as number);
                  else up('urine', v as number);
                }}
              />
            </div>
          )}
        </div>

        <div className="px-6 pt-4 flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onClose}>{t.cancel}</Button>
          <Button className="flex-1 h-12 rounded-xl" disabled={saving} onClick={handleSave}
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {saving ? '…' : t.record}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function PatientDashboard({
  recordSheetOpen,
  onRecordSheetClose,
}: {
  recordSheetOpen?: boolean;
  onRecordSheetClose?: () => void;
}) {
  const { session, vitals, urineOutputs, medications, saveVitals, refreshVitals } = usePatientApp() as any;
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const t = T[lang as 'en' | 'ta'] ?? T.en;

  const [yesterdayVitals, setYesterdayVitals] = useState<DailyVitals | null>(null);
  const [sheetType, setSheetType] = useState<VitalType | null>(null);
  const [takenSet, setTakenSet] = useState<Set<string>>(new Set());

  // Open sheet from parent FAB
  useEffect(() => {
    if (recordSheetOpen && !sheetType) setSheetType('bp');
  }, [recordSheetOpen]);

  // Fetch yesterday's vitals for delta
  useEffect(() => {
    if (!session?.patient?.id) return;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    PatientAppService.getDailyVitals(session.patient.id, yest.toISOString().split('T')[0])
      .then(setYesterdayVitals);
  }, [session?.patient?.id]);

  const addUrineOutput = useCallback(async (amount: number) => {
    if (!session?.patient?.id || !session?.patient?.hospital_id) return;
    await PatientAppService.addUrineOutput(session.patient.id, session.patient.hospital_id, amount, '');
    if (typeof refreshVitals === 'function') refreshVitals();
  }, [session, refreshVitals]);

  const handleSaved = useCallback(() => {
    setSheetType(null);
    onRecordSheetClose?.();
    if (typeof refreshVitals === 'function') refreshVitals();
  }, [refreshVitals, onRecordSheetClose]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t.goodMorning;
    if (h < 17) return t.goodAfternoon;
    return t.goodEvening;
  })();

  const patientFirstName = session?.patient?.name
    ?.replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '')
    ?.split(' ')[0] ?? '';

  // Build vital card data
  const todayUrine = urineOutputs?.reduce((s: number, u: any) => s + (u.amount_ml || 0), 0) || null;
  const yesterdayUrine = null; // not fetched separately for simplicity

  const vitalCards: VitalCardData[] = [
    {
      type: 'bp',
      today: vitals?.bp_systole ? { val: `${vitals.bp_systole}/${vitals.bp_diastole}`, raw: vitals.bp_systole } : null,
      yesterday: yesterdayVitals?.bp_systole ? { raw: yesterdayVitals.bp_systole } : null,
    },
    {
      type: 'weight',
      today: vitals?.weight ? { val: String(vitals.weight), raw: vitals.weight } : null,
      yesterday: yesterdayVitals?.weight ? { raw: yesterdayVitals.weight } : null,
    },
    {
      type: 'glucose',
      today: vitals?.blood_glucose ? { val: String(vitals.blood_glucose), raw: vitals.blood_glucose } : null,
      yesterday: yesterdayVitals?.blood_glucose ? { raw: yesterdayVitals.blood_glucose } : null,
    },
    {
      type: 'urine',
      today: todayUrine ? { val: String(todayUrine), raw: todayUrine } : null,
      yesterday: yesterdayUrine ? { raw: yesterdayUrine } : null,
    },
  ];

  // Medication groups
  const medGroups: Record<string, typeof medications> = { morning: [], afternoon: [], night: [] };
  (medications || []).forEach((med: any) => {
    const slots = getMedSlots(med);
    slots.forEach((slot: string) => { if (medGroups[slot]) medGroups[slot].push(med); });
  });
  const totalMeds = medications?.length ?? 0;
  const takenCount = takenSet.size;

  const slotLabels = [
    { key: 'morning', label: t.morning },
    { key: 'afternoon', label: t.afternoon },
    { key: 'night', label: t.night },
  ];

  return (
    <div className="pa-content" style={{ paddingBottom: '6rem' }}>
      {/* Greeting */}
      <div className="mb-5 px-1">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {greeting}{patientFirstName ? `, ${patientFirstName}` : ''}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Adherence hero */}
      <div className="rounded-2xl px-5 py-4 mb-5 flex items-center justify-between"
        style={{ background: 'hsl(var(--primary))', boxShadow: '0 4px 20px hsl(151 22% 31% / 0.35)' }}>
        <div>
          <p className="text-4xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {takenCount} <span className="text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>of {totalMeds}</span>
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{t.takenToday}</p>
        </div>
        <CircularProgress taken={takenCount} total={totalMeds} />
      </div>

      {/* 2×2 vital cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {vitalCards.map(data => (
          <VitalSummaryCard key={data.type} data={data} t={t} onTap={setSheetType} />
        ))}
      </div>

      {/* Medications */}
      {totalMeds > 0 ? (
        <div>
          {slotLabels.map(({ key, label }) => {
            const meds: any[] = medGroups[key];
            if (!meds?.length) return null;
            return (
              <div key={key} className="mb-4">
                <p className="text-xs font-bold text-gray-400 tracking-widest mb-2 uppercase px-1"
                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{label}</p>
                <div className="space-y-2.5">
                  {meds.map((med: any, i: number) => {
                    const medKey = `${med.name}-${key}-${i}`;
                    const taken = takenSet.has(medKey);
                    return (
                      <div key={medKey}
                        className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border transition-colors ${taken ? 'border-emerald-100' : 'border-gray-100'}`}
                        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                          <Pill className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-base leading-tight ${taken ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                            style={{ fontFamily: 'Outfit, sans-serif' }}>{med.name}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{med.dosage_value} {med.dose && `• ${med.dose}`}</p>
                        </div>
                        <button
                          onClick={() => setTakenSet(prev => {
                            const next = new Set(prev);
                            next.has(medKey) ? next.delete(medKey) : next.add(medKey);
                            return next;
                          })}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                            taken ? 'border-primary' : 'bg-white border-gray-300'
                          }`}
                          style={taken ? { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))' } : {}}
                        >
                          {taken && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button onClick={() => navigate('/patient-app/history')}
            className="w-full bg-gray-100 hover:bg-gray-200 transition-colors rounded-2xl px-5 py-4 flex items-center justify-between mt-2">
            <span className="text-base font-semibold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>{t.viewHistory}</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      ) : (
        <p className="text-sm text-center text-muted-foreground py-8">{t.noMedications}</p>
      )}

      {/* Record Sheet */}
      {sheetType && (
        <RecordSheet
          initialType={sheetType}
          onClose={() => { setSheetType(null); onRecordSheetClose?.(); }}
          onSaved={handleSaved}
          saveVitals={saveVitals}
          addUrineOutput={addUrineOutput}
          t={t}
        />
      )}
    </div>
  );
}
