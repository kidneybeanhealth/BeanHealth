import React, { useState, useEffect } from 'react';
import { Prescription, User } from '../types';
import { PrescriptionService } from '../services/prescriptionService';
import { PDFGenerator } from '../utils/pdfGenerator';
import { showErrorToast, showSuccessToast } from '../utils/toastUtils';
import { DocumentIcon } from './icons/DocumentIcon';
import { XIcon } from './icons/XIcon';
import { RefreshIcon } from './icons/RefreshIcon';

interface PrescriptionListProps {
  user: User;
  patientId?: string; // Optional - if provided, shows prescriptions for specific patient (doctor view)
}

const PrescriptionList: React.FC<PrescriptionListProps> = ({ user, patientId }) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  const isDoctor = user.role === 'doctor';

  useEffect(() => {
    loadPrescriptions();
  }, [user.id, patientId]);

  const loadPrescriptions = async () => {
    setIsLoading(true);
    try {
      let result;
      
      if (isDoctor && patientId) {
        // Doctor viewing specific patient's prescriptions
        result = await PrescriptionService.getPrescriptionsForPatient(user.id, patientId);
      } else if (isDoctor) {
        // Doctor viewing all their prescriptions
        result = await PrescriptionService.getDoctorPrescriptions(user.id);
      } else {
        // Patient viewing their own prescriptions
        result = await PrescriptionService.getPatientPrescriptions(user.id);
      }

      if (result.error) {
        throw result.error;
      }

      setPrescriptions(result.data);
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      showErrorToast('Failed to load prescriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPrescription = (prescription: Prescription) => {
    try {
      // Calculate patient age if date of birth is available
      const patientAge = undefined; // We would need patient data to calculate this

      PDFGenerator.downloadPrescriptionPDF({
        prescription,
        doctorName: prescription.doctorName || 'Unknown Doctor',
        doctorSpecialty: prescription.doctorSpecialty || 'General Practitioner',
        patientName: prescription.patientName || 'Patient',
        patientAge
      });

      showSuccessToast('Prescription downloaded successfully');
    } catch (error) {
      console.error('Error downloading prescription:', error);
      showErrorToast('Failed to download prescription');
    }
  };

  const handlePreviewPrescription = (prescription: Prescription) => {
    try {
      PDFGenerator.previewPrescriptionPDF({
        prescription,
        doctorName: prescription.doctorName || 'Unknown Doctor',
        doctorSpecialty: prescription.doctorSpecialty || 'General Practitioner',
        patientName: prescription.patientName || 'Patient'
      });
    } catch (error) {
      console.error('Error previewing prescription:', error);
      showErrorToast('Failed to preview prescription');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {isDoctor && patientId ? 'Patient Prescriptions' : 'Prescriptions'}
        </h3>
        <button
          onClick={loadPrescriptions}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Refresh prescriptions"
        >
          <RefreshIcon className="h-5 w-5" />
        </button>
      </div>

      {prescriptions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
          <DocumentIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            No prescriptions found
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            {isDoctor ? 'Create prescriptions from patient chats' : 'Your doctor will send prescriptions here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((prescription) => (
            <div
              key={prescription.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedPrescription(prescription)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <DocumentIcon className="h-5 w-5 text-rose-900" />
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                      {isDoctor ? prescription.patientName : `Dr. ${prescription.doctorName}`}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      prescription.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {prescription.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {isDoctor && prescription.doctorSpecialty && (
                      <p className="mb-1">{prescription.doctorSpecialty}</p>
                    )}
                    <p>{formatDate(prescription.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {prescription.medications.slice(0, 3).map((med, index) => (
                      <span
                        key={index}
                        className="text-xs bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-400 px-3 py-1 rounded-full"
                      >
                        {med.name}
                      </span>
                    ))}
                    {prescription.medications.length > 3 && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full">
                        +{prescription.medications.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPrescription(prescription);
                  }}
                  className="ml-4 p-2 text-rose-900 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                  aria-label="Download prescription"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prescription Detail Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
              onClick={() => setSelectedPrescription(null)}
            ></div>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-500 to-rose-900 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white">Prescription Details</h3>
                    <p className="text-secondary-100 text-sm mt-1">
                      {formatDate(selectedPrescription.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPrescription(null)}
                    className="text-white hover:text-secondary-100 transition-colors p-2 hover:bg-white/20 rounded-lg"
                  >
                    <XIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                {/* Doctor and Patient Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Doctor</h4>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      Dr. {selectedPrescription.doctorName}
                    </p>
                    {selectedPrescription.doctorSpecialty && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedPrescription.doctorSpecialty}
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Patient</h4>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      {selectedPrescription.patientName}
                    </p>
                  </div>
                </div>

                {/* Medications */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
                    Medications
                  </h4>
                  <div className="space-y-3">
                    {selectedPrescription.medications.map((med, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">
                            {index + 1}. {med.name}
                          </h5>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 block">Dosage:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium">{med.dosage}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 block">Frequency:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium">{med.frequency}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 block">Duration:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium">{med.duration}</span>
                          </div>
                          {med.timing && (
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 block">Timing:</span>
                              <span className="text-gray-800 dark:text-gray-200 font-medium">{med.timing}</span>
                            </div>
                          )}
                        </div>
                        {med.instructions && (
                          <div className="mt-3 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Instructions: </span>
                            <span className="text-gray-800 dark:text-gray-200">{med.instructions}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedPrescription.notes && (
                  <div className="bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-secondary-800 dark:text-secondary-400 mb-2">
                      Additional Notes
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      {selectedPrescription.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handlePreviewPrescription(selectedPrescription)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Preview PDF
                </button>
                <button
                  onClick={() => handleDownloadPrescription(selectedPrescription)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-secondary-500 to-secondary-900 rounded-lg hover:from-secondary-600 hover:to-secondary-800 transition-all shadow-lg hover:shadow-xl"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionList;

