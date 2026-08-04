import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

export type DepartmentMetricsProfileKey = 'nephrology' | 'unconfigured';
export type QueueMetricsAvailability = 'empty' | 'partial' | 'complete';

export interface QueuePatientMetricsCard {
  key: string;
  label: string;
  value: string;
  unit?: string;
}

export interface QueuePatientMetricsSection {
  key: string;
  title: string;
  cards: QueuePatientMetricsCard[];
}

export interface QueuePatientMetricsSnapshot {
  patientId: string;
  profileKey: DepartmentMetricsProfileKey;
  profileLabel: string;
  profileConfigured: boolean;
  availability: QueueMetricsAvailability;
  lastUpdatedAt: string | null;
  lastVisitDate: string | null;
  timelineStartDate: string;
  timelineEndDate: string;
  timelineDays: QueuePatientMetricsTimelineDay[];
  sections: QueuePatientMetricsSection[];
}

export interface QueuePatientMetricsTimelineDay {
  date: string;
  bloodPressure: string;
  bloodGlucose: string;
  bloodGlucoseType: string;
  weight: string;
  heartRate: string;
  spo2: string;
  temperature: string;
  fluidIntake: string;
  saltIntake: string;
  urineOutput: string;
  hasAnyData: boolean;
  /** Raw numerics for charting (null when not recorded that day). */
  raw?: {
    systole: number | null;
    diastole: number | null;
    glucose: number | null;
    weight: number | null;
    heartRate: number | null;
    spo2: number | null;
    /** Always normalised to °F for charting so mixed-unit days plot on one axis. */
    temperatureF: number | null;
    fluidMl: number | null;
    saltGm: number | null;
    urineMl: number | null;
  };
}

/** Values a doctor/assistant can record for a patient on a given date. */
export interface QueueMetricsEntryInput {
  hospitalId: string;
  patientId: string;
  /** YYYY-MM-DD — defaults to today on the caller side. */
  recordedDate: string;
  systole?: number | null;
  diastole?: number | null;
  glucose?: number | null;
  glucoseType?: 'fasting' | 'post_meal' | 'random' | null;
  weight?: number | null;
  heartRate?: number | null;
  spo2?: number | null;
  temperature?: number | null;
  /** Unit the temperature was measured in — stored as entered, never converted on write. */
  temperatureUnit?: 'F' | 'C' | null;
  fluidMl?: number | null;
  saltGm?: number | null;
  urineMl?: number | null;
}

/**
 * Save clinician-entered metrics for a patient.
 *
 * Vitals and intakes are upserted per (patient_id, recorded_date) — re-saving
 * the same day corrects that day's row rather than duplicating it. Urine output
 * is append-only by design (multiple voids per day), so a positive value adds a
 * new row. Fields left blank are ignored, never written as null over existing data.
 */
export async function saveQueuePatientMetrics(input: QueueMetricsEntryInput): Promise<void> {
  const { hospitalId, patientId, recordedDate } = input;
  if (!hospitalId || !patientId || !recordedDate) {
    throw new Error('Missing hospital, patient, or date');
  }

  const has = (v: number | null | undefined) => v !== null && v !== undefined && !Number.isNaN(v);

  const vitalsPatch: Record<string, any> = {};
  if (has(input.systole)) vitalsPatch.bp_systole = input.systole;
  if (has(input.diastole)) vitalsPatch.bp_diastole = input.diastole;
  if (has(input.glucose)) {
    vitalsPatch.blood_glucose = input.glucose;
    vitalsPatch.blood_glucose_type = input.glucoseType || 'random';
  }
  if (has(input.weight)) vitalsPatch.weight = input.weight;
  if (has(input.heartRate)) vitalsPatch.heart_rate = Math.round(input.heartRate as number);
  if (has(input.spo2)) vitalsPatch.spo2 = Math.round(input.spo2 as number);
  if (has(input.temperature)) {
    vitalsPatch.temperature = input.temperature;
    vitalsPatch.temperature_unit = input.temperatureUnit || 'F';
  }

  const intakePatch: Record<string, any> = {};
  if (has(input.fluidMl)) intakePatch.fluid_intake_ml = input.fluidMl;
  if (has(input.saltGm)) intakePatch.salt_intake_gm = input.saltGm;

  if (Object.keys(vitalsPatch).length > 0) {
    const res = await withTimeout(
      ((supabase.from('hospital_patient_vitals' as any) as any).upsert({
        patient_id: patientId,
        hospital_id: hospitalId,
        recorded_date: recordedDate,
        ...vitalsPatch,
        source: 'opd',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'patient_id,recorded_date,source' })) as any,
      10000,
      'Timed out while saving vitals'
    ) as { error: any };
    if (res.error) throw res.error;
  }

  if (Object.keys(intakePatch).length > 0) {
    const res = await withTimeout(
      ((supabase.from('hospital_patient_intakes' as any) as any).upsert({
        patient_id: patientId,
        hospital_id: hospitalId,
        recorded_date: recordedDate,
        ...intakePatch,
        source: 'opd',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'patient_id,recorded_date,source' })) as any,
      10000,
      'Timed out while saving intake'
    ) as { error: any };
    if (res.error) throw res.error;
  }

  // amount_ml has a > 0 check constraint, so only insert real values
  if (has(input.urineMl) && (input.urineMl as number) > 0) {
    const res = await withTimeout(
      ((supabase.from('hospital_patient_urine_outputs' as any) as any).insert({
        patient_id: patientId,
        hospital_id: hospitalId,
        amount_ml: Math.round(input.urineMl as number),
        source: 'opd',
        recorded_at: new Date(`${recordedDate}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
      })) as any,
      10000,
      'Timed out while saving urine output'
    ) as { error: any };
    if (res.error) throw res.error;
  }
}

/** Which origin(s) of metrics to include. OPD = clinician-recorded in the queue. */
export type MetricsSource = 'opd' | 'patient_app';

interface FetchDepartmentQueueMetricsParams {
  hospitalId: string;
  patientIds: string[];
  doctorSpecialty: string | null;
  /** Defaults to OPD-only — the doctor's queue shows what was measured here. */
  sources?: MetricsSource[];
}

interface MetricsProfileInfo {
  key: DepartmentMetricsProfileKey;
  label: string;
  configured: boolean;
}

interface VitalsRow {
  patient_id: string;
  bp_systole: number | null;
  bp_diastole: number | null;
  blood_glucose: number | null;
  blood_glucose_type: 'fasting' | 'post_meal' | 'random' | null;
  weight: number | null;
  updated_at?: string | null;
}

interface IntakeRow {
  patient_id: string;
  salt_intake_gm: number | null;
  fluid_intake_ml: number | null;
  updated_at?: string | null;
}

interface UrineRow {
  patient_id: string;
  amount_ml: number | null;
  recorded_at: string;
}

interface UrineAggregate {
  totalMl: number;
  latestRecordedAt: string | null;
}

interface DailyVitalsRow extends VitalsRow {
  recorded_date: string;
}

interface DailyIntakeRow extends IntakeRow {
  recorded_date: string;
}

const PATIENT_CHUNK_SIZE = 100;
const QUERY_TIMEOUT_MS = 10000;

const toLocalISODate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDayBounds = (dateISO: string): { start: string; end: string } => ({
  start: `${dateISO}T00:00:00`,
  end: `${dateISO}T23:59:59`,
});

const chunkArray = <T,>(input: T[], size: number): T[][] => {
  if (input.length <= size) return [input];
  const chunks: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
};

const executeWithTimeout = async <T,>(query: Promise<T> | any, errorMessage: string): Promise<T> => {
  return withTimeout(Promise.resolve(query), QUERY_TIMEOUT_MS, errorMessage);
};

const formatNumber = (value: number | null | undefined, digits = 0): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return value.toFixed(digits);
};

const formatGlucoseType = (value: VitalsRow['blood_glucose_type']): string => {
  if (value === 'post_meal') return 'Post Meal';
  if (value === 'random') return 'Random';
  if (value === 'fasting') return 'Fasting';
  return 'Type N/A';
};

const buildAvailability = (sections: QueuePatientMetricsSection[]): QueueMetricsAvailability => {
  const totalCards = sections.reduce((sum, section) => sum + section.cards.length, 0);
  const filledCards = sections.reduce(
    (sum, section) => sum + section.cards.filter(card => card.value !== '--').length,
    0
  );

  if (filledCards === 0) return 'empty';
  if (filledCards === totalCards) return 'complete';
  return 'partial';
};

export const resolveDepartmentMetricsProfile = (doctorSpecialty: string | null): MetricsProfileInfo => {
  const specialty = (doctorSpecialty || '').toLowerCase();
  if (specialty.includes('neph') || specialty.includes('renal') || specialty.includes('kidney')) {
    return { key: 'nephrology', label: 'Nephrology Metrics', configured: true };
  }
  return { key: 'unconfigured', label: 'Custom Department Profile', configured: false };
};

const createEmptySnapshot = (
  patientId: string,
  profile: MetricsProfileInfo
): QueuePatientMetricsSnapshot => ({
  patientId,
  profileKey: profile.key,
  profileLabel: profile.label,
  profileConfigured: profile.configured,
  availability: 'empty',
  lastUpdatedAt: null,
  lastVisitDate: null,
  timelineStartDate: toLocalISODate(new Date()),
  timelineEndDate: toLocalISODate(new Date()),
  timelineDays: [],
  sections: [],
});

const fetchNephrologyMetrics = async (
  hospitalId: string,
  patientIds: string[],
  sourceFilter: MetricsSource[] = ['opd']
): Promise<Record<string, QueuePatientMetricsSnapshot>> => {
  const today = toLocalISODate(new Date());
  const todayBounds = getDayBounds(today);
  const vitalsDailyMap = new Map<string, DailyVitalsRow>();
  const intakesDailyMap = new Map<string, DailyIntakeRow>();
  const urineDailyMap = new Map<string, UrineAggregate>();
  const patientStoredDates = new Map<string, Set<string>>();

  const registerDate = (patientId: string, date: string) => {
    if (!patientStoredDates.has(patientId)) {
      patientStoredDates.set(patientId, new Set<string>());
    }
    patientStoredDates.get(patientId)?.add(date);
  };

  for (const chunk of chunkArray(patientIds, PATIENT_CHUNK_SIZE)) {
    const [vitalsResult, intakeResult, urineResult] = await Promise.all([
      executeWithTimeout<any>(
        supabase
          .from('hospital_patient_vitals' as any)
          .select('patient_id, recorded_date, bp_systole, bp_diastole, blood_glucose, blood_glucose_type, weight, heart_rate, spo2, temperature, temperature_unit, updated_at, source')
          .eq('hospital_id', hospitalId)
          .in('source', sourceFilter)
          .lte('recorded_date', today)
          .in('patient_id', chunk),
        'Timed out while loading queue vitals'
      ),
      executeWithTimeout<any>(
        supabase
          .from('hospital_patient_intakes' as any)
          .select('patient_id, recorded_date, salt_intake_gm, fluid_intake_ml, updated_at, source')
          .eq('hospital_id', hospitalId)
          .in('source', sourceFilter)
          .lte('recorded_date', today)
          .in('patient_id', chunk),
        'Timed out while loading queue intake data'
      ),
      executeWithTimeout<any>(
        supabase
          .from('hospital_patient_urine_outputs' as any)
          .select('patient_id, amount_ml, recorded_at, source')
          .eq('hospital_id', hospitalId)
          .in('source', sourceFilter)
          .lte('recorded_at', todayBounds.end)
          .in('patient_id', chunk),
        'Timed out while loading queue urine data'
      ),
    ]);

    if (vitalsResult.error) throw vitalsResult.error;
    if (intakeResult.error) throw intakeResult.error;
    if (urineResult.error) throw urineResult.error;

    for (const row of (vitalsResult.data || []) as DailyVitalsRow[]) {
      if (!row.patient_id || !row.recorded_date) continue;
      const dailyKey = `${row.patient_id}::${row.recorded_date}`;
      vitalsDailyMap.set(dailyKey, row);
      registerDate(row.patient_id, row.recorded_date);
    }

    for (const row of (intakeResult.data || []) as DailyIntakeRow[]) {
      if (!row.patient_id || !row.recorded_date) continue;
      const dailyKey = `${row.patient_id}::${row.recorded_date}`;
      intakesDailyMap.set(dailyKey, row);
      registerDate(row.patient_id, row.recorded_date);
    }

    for (const row of (urineResult.data || []) as UrineRow[]) {
      if (!row.patient_id) continue;
      const recordDate = row.recorded_at.split('T')[0];
      const dailyKey = `${row.patient_id}::${recordDate}`;
      const existingDaily = urineDailyMap.get(dailyKey) || { totalMl: 0, latestRecordedAt: null };
      const amount = row.amount_ml || 0;
      existingDaily.totalMl += amount;
      if (!existingDaily.latestRecordedAt || new Date(row.recorded_at).getTime() > new Date(existingDaily.latestRecordedAt).getTime()) {
        existingDaily.latestRecordedAt = row.recorded_at;
      }
      urineDailyMap.set(dailyKey, existingDaily);
      registerDate(row.patient_id, recordDate);
    }
  }

  const snapshots: Record<string, QueuePatientMetricsSnapshot> = {};
  const profile = resolveDepartmentMetricsProfile('nephrology');

  for (const patientId of patientIds) {
    const storedDates = Array.from(patientStoredDates.get(patientId) || []).sort((a, b) => b.localeCompare(a));
    const timelineDates = storedDates.length > 0 ? storedDates : [today];
    const latestDate = timelineDates[0];
    const earliestDate = timelineDates[timelineDates.length - 1];

    const latestKey = `${patientId}::${latestDate}`;
    const vitals = vitalsDailyMap.get(latestKey);
    const intake = intakesDailyMap.get(latestKey);
    const urine = urineDailyMap.get(latestKey);

    const bpValue = vitals?.bp_systole !== null && vitals?.bp_systole !== undefined
      && vitals?.bp_diastole !== null && vitals?.bp_diastole !== undefined
      ? `${vitals.bp_systole}/${vitals.bp_diastole}`
      : '--';
    const summaryGlucoseType = formatGlucoseType(vitals?.blood_glucose_type || null);
    const summaryGlucoseUnit = summaryGlucoseType === 'Type N/A'
      ? 'mg/dL'
      : `mg/dL (${summaryGlucoseType})`;

    const vitalsSection: QueuePatientMetricsSection = {
      key: 'vitals',
      title: 'Vitals',
      cards: [
        { key: 'bp', label: 'Blood Pressure', value: bpValue, unit: bpValue === '--' ? undefined : 'mmHg' },
        {
          key: 'glucose',
          label: 'Blood Glucose',
          value: formatNumber(vitals?.blood_glucose),
          unit: vitals?.blood_glucose !== null && vitals?.blood_glucose !== undefined ? summaryGlucoseUnit : undefined,
        },
        { key: 'weight', label: 'Weight', value: formatNumber(vitals?.weight, 1), unit: vitals?.weight !== null && vitals?.weight !== undefined ? 'kg' : undefined },
        {
          key: 'heart_rate',
          label: 'Heart Rate',
          value: formatNumber((vitals as any)?.heart_rate),
          unit: (vitals as any)?.heart_rate !== null && (vitals as any)?.heart_rate !== undefined ? 'bpm' : undefined,
        },
        {
          key: 'spo2',
          label: 'SpO₂',
          value: formatNumber((vitals as any)?.spo2),
          unit: (vitals as any)?.spo2 !== null && (vitals as any)?.spo2 !== undefined ? '%' : undefined,
        },
        {
          key: 'temperature',
          label: 'Temperature',
          value: formatNumber((vitals as any)?.temperature, 1),
          // Shown in the unit it was recorded in, so nothing is lost in conversion
          unit: (vitals as any)?.temperature !== null && (vitals as any)?.temperature !== undefined
            ? `°${(vitals as any)?.temperature_unit === 'C' ? 'C' : 'F'}`
            : undefined,
        },
      ],
    };

    const consumptionSection: QueuePatientMetricsSection = {
      key: 'consumption',
      title: 'Consumption',
      cards: [
        {
          key: 'fluid',
          label: 'Fluid Intake',
          value: formatNumber(intake?.fluid_intake_ml),
          unit: intake?.fluid_intake_ml !== null && intake?.fluid_intake_ml !== undefined ? 'ml' : undefined,
        },
        {
          key: 'salt',
          label: 'Salt Intake',
          value: formatNumber(intake?.salt_intake_gm, 1),
          unit: intake?.salt_intake_gm !== null && intake?.salt_intake_gm !== undefined ? 'g' : undefined,
        },
        {
          key: 'urine',
          label: 'Urine Output',
          value: urine ? formatNumber(urine.totalMl) : '--',
          unit: urine ? 'ml' : undefined,
        },
      ],
    };

    const sections = [vitalsSection, consumptionSection];
    const timelineDays = timelineDates.map(date => {
      const dailyKey = `${patientId}::${date}`;
      const dailyVitals = vitalsDailyMap.get(dailyKey);
      const dailyIntake = intakesDailyMap.get(dailyKey);
      const dailyUrine = urineDailyMap.get(dailyKey);

      const bloodPressure = dailyVitals?.bp_systole !== null && dailyVitals?.bp_systole !== undefined
        && dailyVitals?.bp_diastole !== null && dailyVitals?.bp_diastole !== undefined
        ? `${dailyVitals.bp_systole}/${dailyVitals.bp_diastole}`
        : '--';

      const bloodGlucose = formatNumber(dailyVitals?.blood_glucose);
      const bloodGlucoseType = dailyVitals?.blood_glucose !== null && dailyVitals?.blood_glucose !== undefined
        ? formatGlucoseType(dailyVitals.blood_glucose_type)
        : '--';

      const weight = formatNumber(dailyVitals?.weight, 1);
      const heartRate = formatNumber(dailyVitals?.heart_rate);
      const spo2 = formatNumber(dailyVitals?.spo2);
      const tempUnit = (dailyVitals as any)?.temperature_unit === 'C' ? 'C' : 'F';
      const tempRaw = (dailyVitals as any)?.temperature;
      const temperature = tempRaw === null || tempRaw === undefined
        ? '--'
        : `${formatNumber(tempRaw, 1)} °${tempUnit}`;
      const fluidIntake = formatNumber(dailyIntake?.fluid_intake_ml);
      const saltIntake = formatNumber(dailyIntake?.salt_intake_gm, 1);
      const urineOutput = dailyUrine ? formatNumber(dailyUrine.totalMl) : '--';

      const hasAnyData = [bloodPressure, bloodGlucose, weight, heartRate, spo2, temperature, fluidIntake, saltIntake, urineOutput]
        .some(value => value !== '--');

      const num = (v: any): number | null =>
        v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v);

      return {
        date,
        bloodPressure,
        bloodGlucose,
        bloodGlucoseType,
        weight,
        heartRate,
        spo2,
        temperature,
        fluidIntake,
        saltIntake,
        urineOutput,
        hasAnyData,
        raw: {
          systole: num(dailyVitals?.bp_systole),
          diastole: num(dailyVitals?.bp_diastole),
          glucose: num(dailyVitals?.blood_glucose),
          weight: num(dailyVitals?.weight),
          heartRate: num(dailyVitals?.heart_rate),
          spo2: num(dailyVitals?.spo2),
          temperatureF: (() => {
            const t = num(tempRaw);
            if (t === null) return null;
            return tempUnit === 'C' ? Number(((t * 9) / 5 + 32).toFixed(1)) : t;
          })(),
          fluidMl: num(dailyIntake?.fluid_intake_ml),
          saltGm: num(dailyIntake?.salt_intake_gm),
          urineMl: dailyUrine ? num(dailyUrine.totalMl) : null,
        },
      };
    });

    const timelineTimestamps = timelineDates.flatMap(date => {
      const dailyKey = `${patientId}::${date}`;
      const dailyVitals = vitalsDailyMap.get(dailyKey);
      const dailyIntake = intakesDailyMap.get(dailyKey);
      const dailyUrine = urineDailyMap.get(dailyKey);
      return [dailyVitals?.updated_at || null, dailyIntake?.updated_at || null, dailyUrine?.latestRecordedAt || null]
        .filter(Boolean) as string[];
    });

    const timestamps = [vitals?.updated_at || null, intake?.updated_at || null, urine?.latestRecordedAt || null, ...timelineTimestamps]
      .filter(Boolean) as string[];

    const lastUpdatedAt = timestamps.length > 0
      ? timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

    snapshots[patientId] = {
      patientId,
      profileKey: profile.key,
      profileLabel: profile.label,
      profileConfigured: profile.configured,
      availability: buildAvailability(sections),
      lastUpdatedAt,
      lastVisitDate: null,
      timelineStartDate: earliestDate,
      timelineEndDate: latestDate,
      timelineDays,
      sections,
    };
  }

  return snapshots;
};

export const fetchDepartmentQueueMetrics = async (
  params: FetchDepartmentQueueMetricsParams
): Promise<Record<string, QueuePatientMetricsSnapshot>> => {
  const { hospitalId, patientIds, doctorSpecialty, sources } = params;
  const sourceFilter: MetricsSource[] = sources && sources.length > 0 ? sources : ['opd'];
  const uniquePatientIds = Array.from(new Set(patientIds.filter(Boolean)));
  if (!hospitalId || uniquePatientIds.length === 0) return {};

  const profile = resolveDepartmentMetricsProfile(doctorSpecialty);

  if (profile.key === 'nephrology') {
    return fetchNephrologyMetrics(hospitalId, uniquePatientIds, sourceFilter);
  }

  return uniquePatientIds.reduce<Record<string, QueuePatientMetricsSnapshot>>((acc, patientId) => {
    acc[patientId] = createEmptySnapshot(patientId, profile);
    return acc;
  }, {});
};
