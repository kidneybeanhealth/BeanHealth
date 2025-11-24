import React from 'react';
import { Patient } from '../types';
import { ProgressIcon } from './icons/ProgressIcon';
import LineChart from './LineChart';

interface ProgressProps {
  patient: Patient;
}

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
    {children}
  </div>
);


const Progress: React.FC<ProgressProps> = ({ patient }) => {
  const { vitalsHistory } = patient;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const bpData = vitalsHistory.map(record => {
      const [systolic, diastolic] = record.vitals.bloodPressure.value.split('/').map(Number);
      return {
          date: formatDate(record.date),
          systolic,
          diastolic,
      };
  });
  
  const hrData = vitalsHistory.map(record => ({
      date: formatDate(record.date),
      value: Number(record.vitals.heartRate.value),
  }));

  const tempData = vitalsHistory.map(record => ({
      date: formatDate(record.date),
      value: Number(record.vitals.temperature.value),
  }));

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center mb-2 md:mb-0">
          <ProgressIcon className="mr-3 h-8 w-8 text-secondary-600" />
          Health Progress
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Visualizing your key health metrics over time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title={`Blood Pressure (${patient.vitals.bloodPressure.unit})`}>
            <LineChart 
                data={bpData}
                lines={[
                { dataKey: 'systolic', color: '#ef4444' },
                { dataKey: 'diastolic', color: '#3b82f6' }
                ]}
                xAxisKey="date"
            />
        </ChartCard>
        <ChartCard title={`Heart Rate (${patient.vitals.heartRate.unit})`}>
           <LineChart 
            data={hrData}
            lines={[{ dataKey: 'value', color: '#0ea5e9' }]}
            xAxisKey="date"
          />
        </ChartCard>
        <ChartCard title={`Temperature (${patient.vitals.temperature.unit})`}>
            <LineChart 
                data={tempData}
                lines={[{ dataKey: 'value', color: '#f97316' }]}
                xAxisKey="date"
            />
        </ChartCard>
      </div>
    </div>
  );
};

export default Progress;

