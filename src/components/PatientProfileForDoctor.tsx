import React, { useState } from 'react';
import { Patient, Vitals, Medication, MedicalRecord } from '../types';
import Dashboard from './Dashboard';
import Records from './Records';
import Progress from './ui/Progress';
import Doctors from './Doctors';
import Notes from './Notes';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

type PatientView = 'dashboard' | 'records' | 'progress' | 'doctors' | 'notes';

interface PatientProfileForDoctorProps {
    patient: Patient;
    onBack: () => void;
    handlers: {
        onVitalsChange: (patientId: string, vitalKey: keyof Vitals, newValue: string) => void;
        onMedicationChange: (patientId: string, medication: Medication) => void;
        onMedicationRemove: (patientId: string, medicationId: string) => void;
        onMedicationAdd: (patientId: string, medication: Omit<Medication, 'id'>) => void;
        onRemoveRecord: (patientId: string, recordId: string) => void;
        onRefreshSummary: (patientId: string, records: MedicalRecord[]) => void;
        onSummaryChange: (patientId: string, newSummary: string) => void;
        onSummaryNoteChange: (patientId: string, newNote: string) => void;
        onPatientNotesChange: (patientId: string, newNotes: string) => void;
    };
    aiSummaries: Record<string, string>;
    summaryNotes: Record<string, string>;
    isSummaryLoading: Record<string, boolean>;
}

const PatientProfileForDoctor: React.FC<PatientProfileForDoctorProps> = ({ patient, onBack, handlers, aiSummaries, summaryNotes, isSummaryLoading }) => {
    const [activeView, setActiveView] = useState<PatientView>('dashboard');
    
    const patientDashboardProps = {
        patient,
        aiSummary: aiSummaries[patient.id] || '',
        isSummaryLoading: isSummaryLoading[patient.id] || false,
        summaryNote: summaryNotes[patient.id] || '',
        onRefreshSummary: () => handlers.onRefreshSummary(patient.id, patient.records),
        onSummaryChange: (newSummary: string) => handlers.onSummaryChange(patient.id, newSummary),
        onSummaryNoteChange: (newNote: string) => handlers.onSummaryNoteChange(patient.id, newNote),
        onVitalsChange: async (key: keyof Vitals, val: string) => {
            handlers.onVitalsChange(patient.id, key, val);
        },
        onMedicationAdd: (med: Omit<Medication, 'id'>) => handlers.onMedicationAdd(patient.id, med),
        onMedicationChange: (med: Medication) => handlers.onMedicationChange(patient.id, med),
        onMedicationRemove: (medId: string) => handlers.onMedicationRemove(patient.id, medId),
      };

    const renderContent = () => {
        switch(activeView) {
            case 'dashboard':
                return <Dashboard {...patientDashboardProps} />;
            case 'records':
                return <Records records={patient.records} onRemoveRecord={(recordId) => handlers.onRemoveRecord(patient.id, recordId)} />;
            case 'progress':
                return <Progress patient={patient} />;
            case 'doctors':
                return <Doctors doctors={patient.doctors} messagingEnabled={false} />;
            case 'notes':
                return <Notes notes={patient.notes || ''} onNotesChange={(newNotes) => handlers.onPatientNotesChange(patient.id, newNotes)} />;
            default:
                return null;
        }
    }
    
    const TabButton: React.FC<{view: PatientView, label: string}> = ({ view, label }) => (
        <button
          onClick={() => setActiveView(view)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeView === view
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ArrowLeftIcon className="h-6 w-6 text-gray-600 dark:text-gray-300"/>
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{patient.name}</h2>
                        <p className="text-gray-500 dark:text-gray-400">Viewing patient profile</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm flex items-center space-x-2 flex-wrap">
                <TabButton view="dashboard" label="Dashboard" />
                <TabButton view="records" label="Records" />
                <TabButton view="progress" label="Progress" />
                <TabButton view="doctors" label="Doctors" />
                <TabButton view="notes" label="Notes" />
            </div>

            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default PatientProfileForDoctor;