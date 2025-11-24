import React, { useState } from 'react';
import { PrescriptionMedication, Doctor, Patient, Prescription } from '../types';
import { XIcon } from './icons/XIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PrescriptionService } from '../services/prescriptionService';
import { PDFGenerator } from '../utils/pdfGenerator';
import { uploadPrescriptionPDF } from '../services/storageService';
import { ChatService } from '../services/chatService';
import { showSuccessToast, showErrorToast } from '../utils/toastUtils';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor;
  patient: Patient;
  onPrescriptionSent?: () => void; // Callback after sending prescription
}

const emptyMedication: PrescriptionMedication = {
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  timing: '',
  instructions: ''
};

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  isOpen,
  onClose,
  doctor,
  patient,
  onPrescriptionSent
}) => {
  const [medications, setMedications] = useState<PrescriptionMedication[]>([{ ...emptyMedication }]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [createdPrescription, setCreatedPrescription] = useState<Prescription | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const handleAddMedication = () => {
    setMedications([...medications, { ...emptyMedication }]);
  };

  const handleRemoveMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const handleMedicationChange = (index: number, field: keyof PrescriptionMedication, value: string) => {
    const updatedMedications = [...medications];
    updatedMedications[index] = { ...updatedMedications[index], [field]: value };
    setMedications(updatedMedications);
  };

  const validateForm = (): boolean => {
    // Check if at least one medication has required fields
    const hasValidMedication = medications.some(
      med => med.name.trim() && med.dosage.trim() && med.frequency.trim() && med.duration.trim()
    );

    if (!hasValidMedication) {
      showErrorToast('Please fill in at least one complete medication (name, dosage, frequency, and duration)');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Filter out incomplete medications
      const validMedications = medications.filter(
        med => med.name.trim() && med.dosage.trim() && med.frequency.trim() && med.duration.trim()
      );

      // Create prescription in database
      const { data: prescription, error } = await PrescriptionService.createPrescription(
        doctor.id,
        patient.id,
        validMedications,
        notes.trim() || undefined
      );

      if (error || !prescription) {
        throw new Error('Failed to create prescription');
      }

      // Calculate patient age
      const patientAge = patient.dateOfBirth 
        ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toString()
        : undefined;

      // Generate PDF blob (don't download yet)
      const blob = PDFGenerator.getPrescriptionPDFBlob({
        prescription,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty,
        patientName: patient.name,
        patientAge
      });

      // Store prescription and PDF blob for preview
      setCreatedPrescription(prescription);
      setPdfBlob(blob);
      setShowPreview(true);

      showSuccessToast('Prescription created! Review and send to patient.');
    } catch (error) {
      console.error('Error creating prescription:', error);
      showErrorToast('Failed to create prescription. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToPatient = async () => {
    if (!createdPrescription || !pdfBlob) return;

    setIsSubmitting(true);

    try {
      // Upload PDF to storage
      const fileData = await uploadPrescriptionPDF(
        pdfBlob,
        createdPrescription.id,
        doctor.id,
        patient.id
      );

      // Send as file message in chat
      await ChatService.sendFileMessage(
        doctor.id,
        patient.id,
        fileData.fileUrl,
        fileData.fileName,
        'pdf',
        fileData.fileSize,
        fileData.mimeType,
        undefined, // No text message, just the prescription PDF
        false // not urgent
      );

      showSuccessToast('Prescription sent to patient successfully!');
      
      // Call callback if provided
      if (onPrescriptionSent) {
        onPrescriptionSent();
      }
      
      handleClose();
    } catch (error) {
      console.error('Error sending prescription:', error);
      showErrorToast('Failed to send prescription. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadOnly = () => {
    if (!createdPrescription || !pdfBlob) return;

    // Download the PDF
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prescription_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccessToast('Prescription downloaded!');
    handleClose();
  };

  const handlePreviewPDF = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  };

  const handleClose = () => {
    setMedications([{ ...emptyMedication }]);
    setNotes('');
    setShowPreview(false);
    setCreatedPrescription(null);
    setPdfBlob(null);
    onClose();
  };

  const handleBackToEdit = () => {
    setShowPreview(false);
  };

  if (!isOpen) return null;

  // Preview Modal
  if (showPreview && createdPrescription) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          {/* Background overlay */}
          <div
            className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
            onClick={handleClose}
          ></div>

          {/* Modal panel */}
          <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">✅ Prescription Created!</h3>
                  <p className="text-secondary-100 text-sm mt-1">
                    Review and send to {patient.name}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white hover:text-secondary-100 transition-colors p-2 hover:bg-white/20 rounded-lg"
                >
                  <XIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-secondary-200 dark:border-secondary-800 rounded-xl p-6 mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <svg className="h-12 w-12 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      Prescription Ready
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      {createdPrescription.medications.length} medication{createdPrescription.medications.length > 1 ? 's' : ''} prescribed
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {createdPrescription.medications.map((med, index) => (
                    <div key={index} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{index + 1}.</span>
                      <span className="font-medium">{med.name}</span>
                      <span className="text-gray-500">•</span>
                      <span>{med.dosage}</span>
                      <span className="text-gray-500">•</span>
                      <span>{med.frequency}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center mb-6">
                <button
                  onClick={handlePreviewPDF}
                  className="text-rose-900 dark:text-rose-400 hover:text-rose-900 dark:hover:text-secondary-300 font-medium underline"
                >
                  👁️ Preview PDF in new tab
                </button>
              </div>

              <div className="bg-rose-50 dark:bg-rose-900/20 border border-secondary-200 dark:border-secondary-800 rounded-xl p-4 mb-6">
                <h4 className="font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
                  What would you like to do?
                </h4>
                <ul className="text-sm text-secondary-800 dark:text-secondary-200 space-y-1">
                  <li>• <strong>Send to Patient:</strong> Upload PDF and send directly in chat</li>
                  <li>• <strong>Download Only:</strong> Save PDF to your device</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0 sm:space-x-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleBackToEdit}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Back to Edit
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleDownloadOnly}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 Download Only
                </button>
                <button
                  onClick={handleSendToPatient}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-secondary-500 to-secondary-700 rounded-lg hover:from-secondary-600 hover:to-secondary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send to Patient</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={handleClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-500 to-rose-900 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">Create Prescription</h3>
                <p className="text-secondary-100 text-sm mt-1">
                  Patient: <span className="font-semibold">{patient.name}</span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-white hover:text-secondary-100 transition-colors p-2 hover:bg-white/20 rounded-lg"
              >
                <XIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-6 max-h-[70vh] overflow-y-auto">
            {/* Medications Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Medications
                </h4>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-rose-900 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                >
                  <PlusCircleIcon className="h-5 w-5" />
                  <span>Add Medication</span>
                </button>
              </div>

              {medications.map((medication, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50 space-y-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Medication {index + 1}
                    </span>
                    {medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Medication Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Medication Name *
                      </label>
                      <input
                        type="text"
                        value={medication.name}
                        onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                        placeholder="e.g., Amoxicillin"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Dosage */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dosage *
                      </label>
                      <input
                        type="text"
                        value={medication.dosage}
                        onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                        placeholder="e.g., 500mg"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Frequency *
                      </label>
                      <input
                        type="text"
                        value={medication.frequency}
                        onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                        placeholder="e.g., 3 times daily"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Duration *
                      </label>
                      <input
                        type="text"
                        value={medication.duration}
                        onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                        placeholder="e.g., 7 days"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Timing */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Timing
                      </label>
                      <input
                        type="text"
                        value={medication.timing}
                        onChange={(e) => handleMedicationChange(index, 'timing', e.target.value)}
                        placeholder="e.g., After meals"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors"
                      />
                    </div>

                    {/* Instructions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Instructions
                      </label>
                      <input
                        type="text"
                        value={medication.instructions}
                        onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                        placeholder="e.g., Take with water"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Notes */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any additional instructions or notes for the patient..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-rose-900 dark:focus:ring-rose-400 focus:border-transparent transition-colors resize-none"
              ></textarea>
            </div>
          </form>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-secondary-500 to-secondary-900 rounded-lg hover:from-secondary-600 hover:to-secondary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create & Download Prescription</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;

