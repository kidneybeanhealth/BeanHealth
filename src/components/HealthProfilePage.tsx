import React from 'react';
import PatientInfoCard from './PatientInfoCard';
import CaseDetailsCard from './CaseDetailsCard';
import LabResultsCard from './LabResultsCard';
import PatientVisitHistoryView from './PatientVisitHistoryView';
import { CKDStage } from '../types';
import '@/styles/beanhealth-landing.css';
import { useLanguage } from '../contexts/LanguageContext';

interface HealthProfilePageProps {
  patientId: string;
  age?: number;
  ckdStage?: CKDStage;
  comorbidities?: string[];
  baselineWeight?: number;
  onUpdatePatientInfo: (updates: {
    age?: number;
    ckdStage?: string;
    comorbidities?: string[];
    baselineWeight?: number;
  }) => Promise<void>;
}

const HealthProfilePage: React.FC<HealthProfilePageProps> = ({
  patientId,
  age,
  ckdStage,
  comorbidities = [],
  baselineWeight,
  onUpdatePatientInfo,
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-5 pb-10 max-w-[1440px] mx-auto pt-0 animate-fade-in">
      {/* Header */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 mb-1.5">{t.healthProfilePage.eyebrow}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">{t.healthProfilePage.title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{t.healthProfilePage.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-5">
          <PatientInfoCard
            patientId={patientId}
            age={age}
            ckdStage={ckdStage}
            comorbidities={comorbidities}
            baselineWeight={baselineWeight}
            onUpdate={onUpdatePatientInfo}
          />
          <CaseDetailsCard patientId={patientId} />
          <LabResultsCard patientId={patientId} />
          <PatientVisitHistoryView patientId={patientId} readOnly={true} />
        </div>

        {/* Right column — sticky summary placeholder on desktop */}
        <div className="xl:col-span-1 xl:sticky xl:top-28 h-fit">
          <div className="glass-panel skeuomorph-card rounded-[2rem] p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{t.healthProfilePage.quickSummary}</p>
            <div className="space-y-3">
              {ckdStage && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t.healthProfilePage.ckdStage}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{ckdStage}</span>
                </div>
              )}
              {age && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t.healthProfilePage.age}</span>
                  <span className="text-sm font-semibold text-slate-800">{age} {t.healthProfilePage.yrs}</span>
                </div>
              )}
              {baselineWeight && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t.healthProfilePage.baselineWeight}</span>
                  <span className="text-sm font-semibold text-slate-800">{baselineWeight} {t.healthProfilePage.kg}</span>
                </div>
              )}
              {comorbidities.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 block mb-2">{t.healthProfilePage.comorbidities}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {comorbidities.map((c) => (
                      <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {!ckdStage && !age && !baselineWeight && comorbidities.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">{t.healthProfilePage.fillInfo}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthProfilePage;
