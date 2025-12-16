import React, { useState } from 'react';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';
import { UserIcon } from './icons/UserIcon';
import { PatientAdditionService } from '../services/patientInvitationService';
import { User } from '../types';
import { getInitials, getInitialsColor, getInitialsAvatarClasses } from '../utils/avatarUtils';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onPatientAdded: () => void;
}

const AddPatientModal: React.FC<AddPatientModalProps> = ({ 
  isOpen, 
  onClose, 
  doctorId, 
  onPatientAdded 
}) => {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addedPatient, setAddedPatient] = useState<User | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      setError('Please enter an email to search');
      return;
    }

    setSearching(true);
    setError('');
    setSearchResults([]);

    try {
      const results = await PatientAdditionService.searchPatients(searchEmail.trim());
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('No patients found with that email. Please make sure the patient has registered on BeanHealth.');
      }
    } catch (err) {
      console.error('Error searching patients:', err);
      setError('Failed to search for patients');
    } finally {
      setSearching(false);
    }
  };

  const handleAddPatient = async (patient: User) => {
    setAdding(true);
    setError('');

    try {
      await PatientAdditionService.addPatientToDoctor(patient.id, doctorId);
      setSuccess(true);
      setAddedPatient(patient);
      onPatientAdded();
      
      // Reset form after short delay
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error adding patient:', err);
      setError(err instanceof Error ? err.message : 'Failed to add patient');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSearchEmail('');
    setSearchResults([]);
    setError('');
    setSuccess(false);
    setAddedPatient(null);
    setSearching(false);
    setAdding(false);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Existing Patient
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
                <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Patient Added Successfully!
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {addedPatient?.name} has been added to your patient roster. 
                You can now start communicating and managing their health data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search Section */}
              <div>
                <label htmlFor="searchEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search by Email Address
                </label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    id="searchEmail"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="patient@example.com"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  💡 Search for patients who have already registered on BeanHealth. 
                  Once added, they'll appear in your patient roster and chat will be available immediately.
                </p>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Found {searchResults.length} patient{searchResults.length > 1 ? 's' : ''}:
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((patient) => (
                      <div 
                        key={patient.id}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`h-10 w-10 ${getInitialsColor(patient.name, patient.email)} rounded-full flex items-center justify-center`}>
                              <span className="text-white text-sm font-medium">
                                {getInitials(patient.name, patient.email)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {patient.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {patient.email}
                            </p>
                            {patient.condition && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {patient.condition}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddPatient(patient)}
                          disabled={adding}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {adding ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPatientModal;