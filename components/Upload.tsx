import React, { useState, useRef } from "react";
import { DocumentUploadIcon } from "./icons/DocumentUploadIcon";
import { CameraIcon } from "./icons/CameraIcon";
import CameraCapture from "./CameraCapture";

interface UploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

const Upload: React.FC<UploadProps> = ({ onUpload, isLoading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | null) => {
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files?.[0] || null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileSelect(event.dataTransfer.files?.[0] || null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please select a file.");
      return;
    }
    onUpload(selectedFile);
  };

  const handlePhotoTaken = (file: File) => {
    setSelectedFile(file);
    setIsCameraOpen(false);
  };

  const isSubmitDisabled = !selectedFile || isLoading;

  return (
    <>
      <div className="space-y-6 pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#222222] dark:text-white tracking-tight">
              Upload Records
            </h1>
            <p className="text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-1">AI will automatically categorize and analyze your files</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e1e1e] p-8 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] transition-all">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Select your medical record
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf,image/*"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`flex-1 border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${selectedFile
                    ? "border-[#222222] dark:border-white bg-gray-50 dark:bg-gray-800"
                    : "border-gray-200 dark:border-gray-700 hover:border-[#222222] dark:hover:border-white hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                >
                  {selectedFile ? (
                    <div className="space-y-3">
                      <DocumentUploadIcon className="h-8 w-8 sm:h-10 sm:w-10 text-gray-700 dark:text-gray-300 mx-auto" />
                      <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base break-all">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Click to change file</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <DocumentUploadIcon className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 dark:text-gray-500 mx-auto" />
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-medium">
                        Drag & drop or click to select
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">PDF or Image files</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:w-auto w-full p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-[#222222] dark:hover:border-white rounded-3xl text-[#717171] dark:text-[#a0a0a0] hover:text-[#222222] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 group"
                >
                  <div className="bg-[#222222] dark:bg-white p-3 rounded-full transition-all duration-200 shadow-md">
                    <CameraIcon className="h-6 w-6 text-white dark:text-[#222222]" />
                  </div>
                  <span className="font-bold text-sm sm:text-base">Use Camera</span>
                </button>
              </div>
            </div>

            {selectedFile && (
              <div className="animate-slideUp">
                <div className="flex items-center gap-2 sm:gap-3 p-4 sm:p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-blue-900 dark:text-blue-200">
                      AI will automatically categorize this document
                    </p>
                    <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mt-1">
                      No manual categorization needed
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="w-full py-4 bg-[#222222] dark:bg-white text-white dark:text-[#222222] font-bold text-lg rounded-full hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {isLoading && (
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isLoading ? "Processing & Analyzing..." : "Submit Record"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {isCameraOpen && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <CameraCapture
            onPhotoTaken={handlePhotoTaken}
            onClose={() => setIsCameraOpen(false)}
          />
        </div>
      )}
    </>
  );
};

export default Upload;
