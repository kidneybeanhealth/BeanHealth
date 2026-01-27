import React, { useState, useEffect } from 'react';
import { Prescription } from '../../types';
import { PrescriptionService } from '../../services/prescriptionService';
import { PDFGenerator } from '../../utils/pdfGenerator';
import { showErrorToast, showSuccessToast } from '../../utils/toastUtils';
import { DocumentIcon } from '../icons/DocumentIcon';
import { XIcon } from '../icons/XIcon';
import { RefreshIcon } from '../icons/RefreshIcon';

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

          <div className="inline-block align-bottom bg-white dark:bg-[#1a1a1a] rounded-[32px] text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-4xl animate-scaleIn border border-gray-100 dark:border-[#8AC43C]/20">
            {/* Header */}
            <div className="bg-white dark:bg-[#1a1a1a] px-8 py-7 border-b border-gray-100 dark:border-[#8AC43C]/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-[#222222] dark:text-white tracking-tight">E-Prescriptions</h3>
                  <p className="text-sm text-[#717171] dark:text-[#888] font-medium mt-1">
                    {isDoctor ? 'History of prescriptions sent' : 'List of prescribed medications'}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={loadPrescriptions}
                    className="p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                    aria-label="Refresh prescriptions"
                  >
                    <RefreshIcon className="h-5 w-5 text-[#222222] dark:text-white" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                  >
                    <XIcon className="h-5 w-5 text-[#222222] dark:text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-gray-50/30 dark:bg-[#1a1a1a]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-800 border-t-[#8AC43C] animate-spin"></div>
                  </div>
                  <p className="text-sm font-bold text-[#717171] mt-4 uppercase tracking-widest">Loading Records</p>
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#252525] rounded-[32px] border border-gray-100 dark:border-[#8AC43C]/10 shadow-sm">
                  <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-3xl inline-block mb-4">
                    <DocumentIcon className="h-10 w-10 text-gray-300" />
                  </div>
                  <h4 className="text-lg font-bold text-[#222222] dark:text-white">No Prescriptions Yet</h4>
                  <p className="text-xs text-[#717171] dark:text-[#888] font-medium mt-1 max-w-[240px] mx-auto">
                    {isDoctor ? 'Start by sending a prescription through the chat interface.' : 'Your prescribed medical records will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {prescriptions.map((prescription) => (
                    <div
                      key={prescription.id}
                      className="group relative bg-white dark:bg-[#252525] rounded-[24px] p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 dark:border-[#8AC43C]/10 transition-all duration-300 cursor-pointer"
                      onClick={() => setSelectedPrescription(prescription)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 rounded-xl">
                            <DocumentIcon className="h-5 w-5 text-[#8AC43C]" />
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold text-[#222222] dark:text-white truncate max-w-[140px]">
                              {isDoctor ? prescription.patientName : `Dr. ${prescription.doctorName}`}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider">{formatDate(prescription.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border ${prescription.status === 'active'
                          ? 'bg-[#8AC43C]/10 text-[#8AC43C] border-[#8AC43C]/20'
                          : 'bg-gray-100 text-[#717171] border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                          }`}>
                          {prescription.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {prescription.medications.slice(0, 3).map((med, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-[#8AC43C]"></div>
                            <p className="text-xs font-bold text-[#222222] dark:text-white truncate">{med.name}</p>
                            <span className="text-[10px] text-[#717171] font-medium ml-auto">{med.dosage}</span>
                          </div>
                        ))}
                        {prescription.medications.length > 3 && (
                          <p className="text-[10px] font-bold text-[#8AC43C] pl-3">+{prescription.medications.length - 3} more items</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPrescription(prescription);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-[#717171] hover:text-[#8AC43C] transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PDF
                        </button>
                        <div className="p-1 px-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-[10px] font-bold text-[#717171] opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details
                        </div>
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

            <div className="inline-block align-bottom bg-white dark:bg-[#1a1a1a] rounded-[40px] text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full animate-scaleIn border border-gray-100 dark:border-[#8AC43C]/20">
              {/* Header */}
              <div className="bg-white dark:bg-[#1a1a1a] px-10 py-8 border-b border-gray-100 dark:border-[#8AC43C]/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-3xl font-bold text-[#222222] dark:text-white tracking-tight">Prescription Details</h3>
                    <p className="text-sm text-[#717171] dark:text-[#888] font-medium mt-1">
                      Issued on {formatDate(selectedPrescription.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPrescription(null)}
                    className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                  >
                    <XIcon className="h-6 w-6 text-[#222222] dark:text-white" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-10 py-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Doctor and Patient Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                  <div className="bg-[#8AC43C]/5 dark:bg-[#8AC43C]/10 border border-[#8AC43C]/20 dark:border-[#8AC43C]/30 rounded-3xl p-6">
                    <h4 className="text-[10px] font-bold text-[#8AC43C] uppercase tracking-widest mb-3">Healthcare Professional</h4>
                    <p className="text-xl font-bold text-[#222222] dark:text-white">
                      Dr. {selectedPrescription.doctorName}
                    </p>
                    {selectedPrescription.doctorSpecialty && (
                      <p className="text-xs text-[#717171] dark:text-[#888] font-medium mt-1">
                        {selectedPrescription.doctorSpecialty}
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800 rounded-3xl p-6">
                    <h4 className="text-[10px] font-bold text-[#717171] uppercase tracking-widest mb-3">Patient Record</h4>
                    <p className="text-xl font-bold text-[#222222] dark:text-white">
                      {selectedPrescription.patientName}
                    </p>
                    <p className="text-xs text-[#717171] dark:text-[#888] font-medium mt-1">
                      Electronic Health Record
                    </p>
                  </div>
                </div>

                {/* Medications */}
                <div className="mb-10">
                  <h4 className="text-xs font-bold text-[#222222] dark:text-white uppercase tracking-widest mb-4">
                    Prescribed Medications
                  </h4>
                  <div className="space-y-4">
                    {selectedPrescription.medications.map((med, index) => (
                      <div
                        key={index}
                        className="border border-gray-100 dark:border-[#8AC43C]/20 rounded-3xl p-6 bg-white dark:bg-[#252525] shadow-sm"
                      >
                        <div className="flex items-center gap-3 mb-5">
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#8AC43C]/10 text-[#8AC43C] text-[10px] font-bold">
                            {index + 1}
                          </span>
                          <h5 className="text-lg font-bold text-[#222222] dark:text-white">
                            {med.name}
                          </h5>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
                          <div>
                            <span className="text-[10px] font-bold text-[#717171] uppercase tracking-widest block mb-1">Dosage</span>
                            <span className="text-[#222222] dark:text-white font-bold">{med.dosage}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#717171] uppercase tracking-widest block mb-1">Frequency</span>
                            <span className="text-[#222222] dark:text-white font-bold">{med.frequency}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#717171] uppercase tracking-widest block mb-1">Duration</span>
                            <span className="text-[#222222] dark:text-white font-bold">{med.duration}</span>
                          </div>
                          {med.timing && (
                            <div>
                              <span className="text-[10px] font-bold text-[#717171] uppercase tracking-widest block mb-1">Timing</span>
                              <span className="text-[#222222] dark:text-white font-bold">{med.timing}</span>
                            </div>
                          )}
                        </div>
                        {med.instructions && (
                          <div className="mt-5 p-4 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-[#717171] uppercase tracking-widest block mb-1">Special Instructions</span>
                            <p className="text-xs text-[#717171] dark:text-[#888] font-medium leading-relaxed">{med.instructions}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedPrescription.notes && (
                  <div className="bg-[#8AC43C]/5 dark:bg-[#8AC43C]/10 border border-[#8AC43C]/20 dark:border-[#8AC43C]/30 rounded-3xl p-6">
                    <h4 className="text-[10px] font-bold text-[#8AC43C] uppercase tracking-widest mb-2">
                      Clinical Notes
                    </h4>
                    <p className="text-xs text-[#717171] dark:text-[#888] font-medium leading-relaxed">
                      {selectedPrescription.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-white dark:bg-[#1a1a1a] px-10 py-8 flex items-center justify-end gap-4 border-t border-gray-100 dark:border-[#8AC43C]/10">
                <button
                  onClick={() => handlePreviewPrescription(selectedPrescription)}
                  className="flex-1 sm:flex-none px-8 py-3.5 text-sm font-bold text-[#222222] dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all"
                >
                  Preview PDF
                </button>
                <button
                  onClick={() => handleDownloadPrescription(selectedPrescription)}
                  className="flex-1 sm:flex-none px-8 py-3.5 text-sm font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-[#8AC43C]/20"
                >
                  Download Record
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
