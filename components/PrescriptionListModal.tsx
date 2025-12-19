import React, { useState, useEffect } from 'react';
import { Prescription } from '../types';
import { PrescriptionService } from '../services/prescriptionService';
import { PDFGenerator } from '../utils/pdfGenerator';
import { showErrorToast, showSuccessToast } from '../utils/toastUtils';
import { DocumentIcon } from './icons/DocumentIcon';
import { XIcon } from './icons/XIcon';
import { RefreshIcon } from './icons/RefreshIcon';

/**
 * E-Prescription List Modal Component
 * Displays prescriptions between a doctor and patient in a date-wise list
 * Available for both doctors and patients
 */
interface PrescriptionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  contactId: string;
  isDoctor: boolean;
}

const PrescriptionListModal: React.FC<PrescriptionListModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  contactId,
  isDoctor
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPrescriptions();
    }
  }, [isOpen, currentUserId, contactId]);

  const loadPrescriptions = async () => {
    setIsLoading(true);
    try {
      let result;

      if (isDoctor) {
        // Doctor viewing prescriptions for this patient
        result = await PrescriptionService.getPrescriptionsForPatient(currentUserId, contactId);
      } else {
        // Patient viewing prescriptions from this doctor
        result = await PrescriptionService.getPrescriptionsForPatient(contactId, currentUserId);
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
      PDFGenerator.downloadPrescriptionPDF({
        prescription,
        doctorName: prescription.doctorName || 'Unknown Doctor',
        doctorSpecialty: prescription.doctorSpecialty || 'General Practitioner',
        patientName: prescription.patientName || 'Patient'
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

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal - Prescription List */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 py-4 sm:py-8 text-center">
          <div
            className="fixed inset-0 transition-opacity bg-gray-900/60 backdrop-blur-sm"
            onClick={onClose}
          ></div>

          <div className="inline-block align-bottom bg-white dark:bg-[#1e1e1e] rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-4xl animate-scaleIn">
            {/* Header */}
            <div className="bg-white dark:bg-[#1e1e1e] px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-3xl font-extrabold text-[#222222] dark:text-white truncate">E-Prescriptions</h3>
                  <p className="text-[#717171] dark:text-[#a0a0a0] font-medium mt-1">
                    {isDoctor ? 'Sent to patient' : 'From doctor'}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={loadPrescriptions}
                    className="p-2 bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                    aria-label="Refresh prescriptions"
                  >
                    <RefreshIcon className="h-5 w-5 text-[#222222] dark:text-white" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <XIcon className="h-5 w-5 text-[#222222] dark:text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-900"></div>
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="text-center py-8 sm:py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700">
                  <DocumentIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-3 sm:mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-medium">
                    No prescriptions found
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2 px-4">
                    {isDoctor ? 'Send a prescription from the chat' : 'Your doctor will send prescriptions here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {prescriptions.map((prescription) => (
                    <div
                      key={prescription.id}
                      className="bg-white dark:bg-[#2a2a2a] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] hover:shadow-xl transition-all duration-300 cursor-pointer border border-transparent dark:border-gray-800"
                      onClick={() => setSelectedPrescription(prescription)}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 sm:gap-3 mb-2">
                            <div className="bg-rose-100 dark:bg-rose-900/30 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                              <DocumentIcon className="h-3 w-3 sm:h-4 sm:w-4 text-rose-900 dark:text-rose-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">
                                {isDoctor ? prescription.patientName : `Dr. ${prescription.doctorName}`}
                              </h4>
                              {prescription.doctorSpecialty && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {prescription.doctorSpecialty}
                                </p>
                              )}
                            </div>
                            <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${prescription.status === 'active'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : prescription.status === 'completed'
                                  ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400'
                              }`}>
                              {prescription.status}
                            </span>
                          </div>

                          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                            <svg className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{formatDate(prescription.createdAt)}</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {prescription.medications.slice(0, 2).map((med, index) => (
                              <span
                                key={index}
                                className="text-[10px] sm:text-xs bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-rose-200 dark:border-rose-800 truncate max-w-[120px] sm:max-w-none"
                              >
                                {med.name}
                              </span>
                            ))}
                            {prescription.medications.length > 2 && (
                              <span className="text-[10px] sm:text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                                +{prescription.medications.length - 2}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPrescription(prescription);
                          }}
                          className="p-2 sm:p-2.5 text-rose-900 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg sm:rounded-xl transition-all active:scale-95 flex-shrink-0"
                          aria-label="Download prescription"
                        >
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Detail Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-900/75 backdrop-blur-sm"
              onClick={() => setSelectedPrescription(null)}
            ></div>

            <div className="inline-block align-bottom bg-white dark:bg-[#1e1e1e] rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full animate-scaleIn">
              {/* Header */}
              <div className="bg-white dark:bg-[#1e1e1e] px-8 py-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-extrabold text-[#222222] dark:text-white truncate">Prescription Details</h3>
                    <p className="text-[#717171] dark:text-[#a0a0a0] text-sm font-medium mt-1 truncate">
                      Issued {formatDate(selectedPrescription.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPrescription(null)}
                    className="p-2 bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                  >
                    <XIcon className="h-5 w-5 text-[#222222] dark:text-white" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-8 py-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Doctor and Patient Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">Doctor</h4>
                    <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">
                      Dr. {selectedPrescription.doctorName}
                    </p>
                    {selectedPrescription.doctorSpecialty && (
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                        {selectedPrescription.doctorSpecialty}
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">Patient</h4>
                    <p className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">
                      {selectedPrescription.patientName}
                    </p>
                  </div>
                </div>

                {/* Medications */}
                <div className="mb-3 sm:mb-6">
                  <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 sm:mb-3">
                    Medications
                  </h4>
                  <div className="space-y-2 sm:space-y-3">
                    {selectedPrescription.medications.map((med, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/30"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base">
                            {index + 1}. {med.name}
                          </h5>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 block">Dosage:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">{med.dosage}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 block">Frequency:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">{med.frequency}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400 block">Duration:</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">{med.duration}</span>
                          </div>
                          {med.timing && (
                            <div>
                              <span className="text-gray-600 dark:text-gray-400 block">Timing:</span>
                              <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">{med.timing}</span>
                            </div>
                          )}
                        </div>
                        {med.instructions && (
                          <div className="mt-2 sm:mt-3 text-xs sm:text-sm">
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
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
                    <h4 className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-400 mb-1 sm:mb-2">
                      Additional Notes
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                      {selectedPrescription.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-[#2a2a2a] px-8 py-6 flex flex-col sm:flex-row justify-end gap-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => handlePreviewPrescription(selectedPrescription)}
                  className="px-6 py-3 text-sm font-bold text-[#222222] dark:text-white bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  Preview PDF
                </button>
                <button
                  onClick={() => handleDownloadPrescription(selectedPrescription)}
                  className="px-6 py-3 text-sm font-bold text-white bg-[#222222] dark:bg-white dark:text-[#222222] rounded-full hover:opacity-90 transition-all shadow-lg"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrescriptionListModal;
