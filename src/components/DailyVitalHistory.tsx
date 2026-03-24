import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface DailyRecord {
  date: string; // YYYY-MM-DD
  vitals: { bp: boolean; glucose: boolean; urine: boolean; weight: boolean };
  fluidLogged: boolean;
  fluidAmount: number;
  medsTaken: number;
  medsTotal: number;
}

interface DailyVitalHistoryProps {
  patientId: string;
}

const TAMIL_DAYS = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const TAMIL_MONTHS = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];

const formatDate = (dateStr: string, isTamil: boolean): string => {
  const d = new Date(dateStr + 'T00:00:00');
  if (isTamil) {
    return `${TAMIL_DAYS[d.getDay()]}, ${d.getDate()} ${TAMIL_MONTHS[d.getMonth()]}`;
  }
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const isToday = (dateStr: string) => {
  return dateStr === new Date().toLocaleDateString('en-CA');
};

const isYesterday = (dateStr: string) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dateStr === y.toLocaleDateString('en-CA');
};

const StatusIcon: React.FC<{ done: boolean | null }> = ({ done }) => {
  if (done === null) return <MinusCircle className="h-4 w-4 text-slate-300" />;
  if (done) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  return <XCircle className="h-4 w-4 text-rose-400" />;
};

const DailyVitalHistory: React.FC<DailyVitalHistoryProps> = ({ patientId }) => {
  const { t, isTamil } = useLanguage();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const sinceStr = since.toLocaleDateString('en-CA');

      // 1. Vitals — one row per date (most recent reading of each field)
      const { data: vitalsData } = await supabase
        .from('vitals')
        .select('recorded_at, blood_pressure_value, glucose_value, urine_output_value, weight_value')
        .eq('patient_id', patientId)
        .gte('recorded_at', sinceStr)
        .order('recorded_at', { ascending: false });

      // 2. Fluid intake
      const { data: fluidData } = await supabase
        .from('fluid_intake')
        .select('recorded_at, amount_ml')
        .eq('patient_id', patientId)
        .gte('recorded_at', sinceStr);

      // 3. Medication adherence
      const { data: medData } = await supabase
        .from('medication_adherence')
        .select('scheduled_date, taken')
        .eq('patient_id', patientId)
        .gte('scheduled_date', sinceStr);

      // Group vitals by date
      const vitalsByDate = new Map<string, { bp: boolean; glucose: boolean; urine: boolean; weight: boolean }>();
      for (const row of vitalsData || []) {
        const d = new Date(row.recorded_at).toLocaleDateString('en-CA');
        const existing = vitalsByDate.get(d) || { bp: false, glucose: false, urine: false, weight: false };
        vitalsByDate.set(d, {
          bp: existing.bp || !!row.blood_pressure_value,
          glucose: existing.glucose || !!row.glucose_value,
          urine: existing.urine || !!row.urine_output_value,
          weight: existing.weight || !!row.weight_value,
        });
      }

      // Group fluid by date
      const fluidByDate = new Map<string, number>();
      for (const row of fluidData || []) {
        const d = new Date(row.recorded_at).toLocaleDateString('en-CA');
        fluidByDate.set(d, (fluidByDate.get(d) || 0) + (row.amount_ml || 0));
      }

      // Group meds by date
      const medsByDate = new Map<string, { taken: number; total: number }>();
      for (const row of medData || []) {
        const d = row.scheduled_date;
        const cur = medsByDate.get(d) || { taken: 0, total: 0 };
        medsByDate.set(d, { taken: cur.taken + (row.taken ? 1 : 0), total: cur.total + 1 });
      }

      // Build last 29 days (excluding today)
      const result: DailyRecord[] = [];
      for (let i = 1; i <= 29; i++) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const d = dt.toLocaleDateString('en-CA');
        const v = vitalsByDate.get(d) || { bp: false, glucose: false, urine: false, weight: false };
        const f = fluidByDate.get(d) || 0;
        const m = medsByDate.get(d) || { taken: 0, total: 0 };
        const hasAnyData = v.bp || v.glucose || v.urine || v.weight || f > 0 || m.total > 0;
        if (hasAnyData || i <= 7) {
          result.push({
            date: d,
            vitals: v,
            fluidLogged: f > 0,
            fluidAmount: f,
            medsTaken: m.taken,
            medsTotal: m.total,
          });
        }
      }

      setRecords(result);
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoading(false);
    }
  };

  const visibleRecords = expanded ? records : records.slice(0, 7);

  const getRowScore = (r: DailyRecord) => {
    const vitalsLogged = [r.vitals.bp, r.vitals.glucose, r.vitals.urine, r.vitals.weight].filter(Boolean).length;
    const medScore = r.medsTotal > 0 ? r.medsTaken / r.medsTotal : null;
    return { vitalsLogged, medScore };
  };

  return (
    <div className="glass-panel skeuomorph-card rounded-[2rem] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
            {isTamil ? 'கடந்த பதிவுகள்' : 'Past Records'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isTamil ? 'கடந்த 7 நாட்கள்' : 'Last 7 days'}
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{isTamil ? 'பதிவு செய்யப்பட்டது' : 'Logged'}</span>
          <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-rose-400" />{isTamil ? 'தவிர்க்கப்பட்டது' : 'Missed'}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-6">
          {isTamil ? 'இன்னும் பதிவுகள் இல்லை' : 'No records yet'}
        </p>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-3 mb-2 px-1">
            <span className="text-[10px] font-semibold text-slate-400">{isTamil ? 'தேதி' : 'Date'}</span>
            <span className="text-[10px] font-semibold text-slate-400 text-center w-7">BP</span>
            <span className="text-[10px] font-semibold text-slate-400 text-center w-7">{isTamil ? 'சர்' : 'Glu'}</span>
            <span className="text-[10px] font-semibold text-slate-400 text-center w-7">{isTamil ? 'சிறு' : 'Urin'}</span>
            <span className="text-[10px] font-semibold text-slate-400 text-center w-7">{isTamil ? 'எடை' : 'Wt'}</span>
            <span className="text-[10px] font-semibold text-slate-400 text-center w-7">{isTamil ? 'திரவ' : 'Fluid'}</span>
            <span className="text-[10px] font-semibold text-slate-400 text-center w-10">{isTamil ? 'மருந்து' : 'Meds'}</span>
          </div>

          <div className="space-y-1.5">
            {visibleRecords.map((r) => {
              const { vitalsLogged, medScore } = getRowScore(r);
              const allVitals = vitalsLogged === 4;
              const someVitals = vitalsLogged > 0 && vitalsLogged < 4;
              const rowBg = allVitals && r.fluidLogged
                ? 'bg-emerald-50/60 border-emerald-100'
                : someVitals
                ? 'bg-amber-50/40 border-amber-100'
                : 'bg-rose-50/30 border-rose-100';

              return (
                <div
                  key={r.date}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-3 items-center rounded-2xl border px-3 py-2.5 ${rowBg}`}
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-700">
                      {isYesterday(r.date)
                        ? (isTamil ? 'நேற்று' : 'Yesterday')
                        : formatDate(r.date, isTamil)}
                    </span>
                  </div>
                  <StatusIcon done={r.vitals.bp} />
                  <StatusIcon done={r.vitals.glucose} />
                  <StatusIcon done={r.vitals.urine} />
                  <StatusIcon done={r.vitals.weight} />
                  <StatusIcon done={r.fluidLogged} />
                  {/* Meds */}
                  <div className="flex items-center justify-center w-10">
                    {r.medsTotal === 0 ? (
                      <MinusCircle className="h-4 w-4 text-slate-300" />
                    ) : (
                      <span className={`text-[11px] font-bold ${medScore === 1 ? 'text-emerald-600' : medScore && medScore >= 0.5 ? 'text-amber-600' : 'text-rose-500'}`}>
                        {r.medsTaken}/{r.medsTotal}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {records.length > 7 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {expanded
                ? <><ChevronUp className="h-3.5 w-3.5" />{isTamil ? 'குறைக்கவும்' : 'Show less'}</>
                : <><ChevronDown className="h-3.5 w-3.5" />{isTamil ? `மேலும் ${records.length - 7} நாட்கள்` : `Show ${records.length - 7} more days`}</>
              }
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default DailyVitalHistory;
