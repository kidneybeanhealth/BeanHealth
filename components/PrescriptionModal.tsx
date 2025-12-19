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
          <div className="inline-block align-bottom bg-white dark:bg-[#1a1a1a] rounded-[32px] text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full animate-scaleIn border border-gray-100 dark:border-[#8AC43C]/20">
            {/* Header */}
            <div className="bg-white dark:bg-[#1a1a1a] px-8 py-7 border-b border-gray-100 dark:border-[#8AC43C]/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-[#222222] dark:text-white">Prescription Ready!</h3>
                  <p className="text-sm text-[#717171] dark:text-[#888] font-medium mt-1">
                    Review and send to <span className="text-[#222222] dark:text-white font-bold">{patient.name}</span>
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
                >
                  <XIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 space-y-6">
              <div className="bg-[#8AC43C]/5 dark:bg-[#8AC43C]/10 border border-[#8AC43C]/20 dark:border-[#8AC43C]/30 rounded-3xl p-6">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="p-3 bg-[#8AC43C]/10 dark:bg-[#8AC43C]/20 rounded-2xl">
                    <svg className="h-8 w-8 text-[#8AC43C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#222222] dark:text-white">
                      Prescription Finalized
                    </h4>
                    <p className="text-xs text-[#717171] dark:text-[#888] font-medium">
                      {createdPrescription.medications.length} items included
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {createdPrescription.medications.map((med, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-[#252525] border border-gray-100 dark:border-[#8AC43C]/10 rounded-2xl">
                      <span className="w-6 h-6 flex items-center justify-center bg-[#8AC43C]/10 text-[#8AC43C] text-[10px] font-bold rounded-full">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#222222] dark:text-white truncate">{med.name}</p>
                        <p className="text-[10px] text-[#717171] font-medium uppercase tracking-wider mt-0.5">{med.dosage} • {med.frequency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handlePreviewPDF}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#8AC43C] hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview Document
                </button>
              </div>

              <div className="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800 rounded-3xl p-5">
                <h4 className="text-xs font-bold text-[#222222] dark:text-white uppercase tracking-wider mb-3">
                  Next Steps
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8AC43C] mt-1.5 shrink-0"></div>
                    <p className="text-xs text-[#717171] dark:text-[#888] leading-relaxed"><span className="text-[#222222] dark:text-white font-bold">Send to Patient:</span> Instantly shares the prescription in your chat conversation.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mt-1.5 shrink-0"></div>
                    <p className="text-xs text-[#717171] dark:text-[#888] leading-relaxed"><span className="text-[#222222] dark:text-white font-bold">Download Only:</span> Saves the PDF to your device for printing or external sharing.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white dark:bg-[#1a1a1a] px-8 py-6 flex items-center gap-3 border-t border-gray-100 dark:border-[#8AC43C]/10">
              <button
                onClick={handleBackToEdit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3.5 text-sm font-bold text-[#222222] dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all disabled:opacity-50"
              >
                Back to Edit
              </button>

              <button
                onClick={handleDownloadOnly}
                disabled={isSubmitting}
                className="p-3.5 text-[#222222] dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all disabled:opacity-50"
                title="Download Only"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              <button
                onClick={handleSendToPatient}
                disabled={isSubmitting}
                className="flex-[2] px-8 py-3.5 text-sm font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-[#8AC43C]/20 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Send to Patient</span>
                  </>
                )}
              </button>
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
        <div className="inline-block align-bottom bg-white dark:bg-[#1a1a1a] rounded-[32px] text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full animate-scaleIn border border-gray-100 dark:border-[#8AC43C]/20">
          {/* Header */}
          <div className="bg-white dark:bg-[#1a1a1a] px-8 py-7 border-b border-gray-100 dark:border-[#8AC43C]/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-bold text-[#222222] dark:text-white tracking-tight">Create Prescription</h3>
                <p className="text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-1">
                  For: <span className="font-bold text-[#222222] dark:text-white">{patient.name}</span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-[#717171] hover:text-[#222222] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
              >
                <XIcon className="h-7 w-7" />
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-8 py-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Medications Section */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-bold text-[#222222] dark:text-white">
                    Medications
                  </h4>
                  <p className="text-xs text-[#717171] font-medium mt-0.5">List all medications to include in this prescription</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center space-x-2 px-6 py-3 text-sm font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-2xl hover:opacity-90 transition-all shadow-md shadow-[#8AC43C]/20"
                >
                  <PlusCircleIcon className="h-5 w-5" />
                  <span>Add Item</span>
                </button>
              </div>

              {medications.map((medication, index) => (
                <div
                  key={index}
                  className="relative group border border-gray-100 dark:border-[#8AC43C]/10 rounded-[24px] p-6 bg-gray-50/50 dark:bg-[#8AC43C]/5"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#8AC43C]/20 text-xs font-bold text-[#8AC43C] shadow-sm">
                      {index + 1}
                    </span>
                    <span className="text-sm font-bold text-[#222222] dark:text-white uppercase tracking-wider">
                      Medication Details
                    </span>
                    {medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(index)}
                        className="ml-auto text-gray-400 hover:text-rose-500 hover:bg-white dark:hover:bg-[#1a1a1a] p-2 rounded-xl transition-all"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Medication Name */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                        Medication Name
                      </label>
                      <input
                        type="text"
                        value={medication.name}
                        onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                        placeholder="e.g. Amoxicillin"
                        className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                      />
                    </div>

                    {/* Dosage */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                        Dosage
                      </label>
                      <input
                        type="text"
                        value={medication.dosage}
                        onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                        placeholder="e.g. 500mg"
                        className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                      />
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                        Frequency
                      </label>
                      <input
                        type="text"
                        value={medication.frequency}
                        onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                        placeholder="e.g. 3 times daily"
                        className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={medication.duration}
                        onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                        placeholder="e.g. 7 days"
                        className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                      />
                    </div>

                    {/* Timing */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                        Timing
                      </label>
                      <input
                        type="text"
                        value={medication.timing}
                        onChange={(e) => handleMedicationChange(index, 'timing', e.target.value)}
                        placeholder="e.g. After meals"
                        className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                      />
                    </div>

                    {/* Instructions */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-1.5 ml-1">
                        Instructions
                      </label>
                      <input
                        type="text"
                        value={medication.instructions}
                        onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                        placeholder="e.g. Take with water"
                        className="w-full px-4 py-3 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#8AC43C]/20 rounded-2xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Notes */}
            <div className="mt-8">
              <label className="block text-[10px] font-bold text-[#717171] dark:text-[#888] uppercase tracking-wider mb-2.5 ml-1">
                Clinical Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Include any specific advice, warnings, or follow-up instructions..."
                className="w-full px-5 py-4 bg-gray-50/50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#8AC43C]/20 rounded-3xl text-sm text-[#222222] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8AC43C]/50 transition-all font-medium resize-none shadow-inner"
              ></textarea>
            </div>
          </form>

          {/* Footer */}
          <div className="bg-white dark:bg-[#1a1a1a] px-8 py-7 flex justify-end items-center gap-4 border-t border-gray-100 dark:border-[#8AC43C]/10">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-8 py-3.5 text-sm font-bold text-[#222222] dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-10 py-3.5 text-sm font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-[#8AC43C]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Finalize Prescription</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;
