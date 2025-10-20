import React from 'react';
import { Medication } from '../types';
import { PillIcon } from './icons/PillIcon';

interface MedicationTimelineProps {
    medications: Medication[];
}

const MedicationTimeline: React.FC<MedicationTimelineProps> = ({ medications }) => {
    const timelineEvents = [
        { time: '8:00 AM', medication: medications[0] },
        { time: '12:00 PM', medication: medications[1] },
        { time: '8:00 PM', medication: medications[0] },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Today's Schedule</h3>
            <div>
                {timelineEvents.map((event, index) => (
                    <div key={index} className="flex items-center">
                        <div className="flex flex-col items-center mr-4">
                            <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/50' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            {index < timelineEvents.length - 1 && <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-600"></div>}
                        </div>
                        <div className="flex-1 pb-10">
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{event.time}</p>
                            <div className="mt-1 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-center">
                                <PillIcon className="h-5 w-5 text-rose-900 dark:text-rose-400 mr-3" />
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">{event.medication?.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{event.medication?.dosage}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MedicationTimeline;
