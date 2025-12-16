import React from 'react';
import { Doctor } from '../types';
import { DoctorIcon } from './icons/DoctorIcon';
import { EmptyDoctorsIcon } from './icons/EmptyDoctorsIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';

interface DoctorsProps {
    doctors: Doctor[];
    onSelectDoctor?: (doctorId: string) => void;
    messagingEnabled?: boolean;
}

const Doctors: React.FC<DoctorsProps> = ({ doctors, onSelectDoctor, messagingEnabled = true }) => {
    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center mb-2 md:mb-0">
                    <DoctorIcon className="mr-3 h-8 w-8 text-indigo-600" />
                    My Care Team
                </h2>
                <button className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Add New Doctor
                </button>
            </div>
            {doctors.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <EmptyDoctorsIcon className="mx-auto h-24 w-24 text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100">No Doctors Found</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Add a doctor to your care team to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {doctors.map(doctor => (
                        <div key={doctor.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm text-center flex flex-col items-center">
                            <div className={`w-24 h-24 ${getInitialsColor(doctor.name, doctor.email)} rounded-full mb-4 ring-4 ring-indigo-200 dark:ring-indigo-800 flex items-center justify-center`}>
                              <span className="text-white text-2xl font-bold">
                                {getInitials(doctor.name, doctor.email)}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{doctor.name}</h3>
                            <p className="text-indigo-600 dark:text-indigo-400 font-medium">{doctor.specialty}</p>
                            <div className="mt-4 flex space-x-2">
                                <button 
                                    onClick={() => messagingEnabled && onSelectDoctor?.(doctor.id)} 
                                    disabled={!messagingEnabled}
                                    className="flex-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Message
                                </button>
                                <button className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Profile</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Doctors;