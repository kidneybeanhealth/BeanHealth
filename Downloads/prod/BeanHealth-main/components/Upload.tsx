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
      <div className="max-w-3xl mx-auto animate-fadeIn">
        <div className="card">
            <div className="text-center mb-8">
            <div className="p-6 rounded-3xl inline-block mb-4">
              <DocumentUploadIcon className="h-20 w-20 text-rose-700 dark:text-rose-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Upload New Medical Record
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Upload your file and our AI will automatically categorize and analyze it.
            </p>
          </div>          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-rose-900 text-white text-sm font-bold mr-3">📄</span>
                Select your medical record
              </label>
              <div className="flex flex-col lg:flex-row gap-4">
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
                  className={`flex-1 border-2 border-dashed rounded-2xl p-8 lg:p-10 text-center cursor-pointer transition-all duration-300 ${
                    selectedFile
                      ? "border-rose-900 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/20 shadow-lg"
                      : "border-gray-300 dark:border-gray-600 hover:border-rose-900 dark:hover:border-rose-400 hover:shadow-md"
                  }`}
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      <DocumentUploadIcon className="h-10 w-10 text-rose-900 dark:text-rose-400 mx-auto" />
                      <p className="font-bold text-rose-900 dark:text-rose-400 text-lg">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Click to change file</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <DocumentUploadIcon className="h-12 w-12 text-gray-400 mx-auto" />
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Drag & drop or click to select
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">PDF or Image files</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex flex-col lg:flex-row items-center justify-center gap-3 lg:w-auto w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-rose-900 dark:hover:border-rose-400 rounded-2xl text-gray-600 dark:text-gray-400 hover:text-rose-900 dark:hover:text-rose-400 hover:shadow-md transition-all duration-300 group"
                >
                  <div className="p-3 rounded-xl">
                    <CameraIcon className="h-7 w-7 text-rose-700 dark:text-rose-400" />
                  </div>
                  <span className="font-bold">Use Camera</span>
                </button>
              </div>
            </div>

            {selectedFile && (
              <div className="animate-slideUp">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border-2 border-purple-200 dark:border-purple-800">
                  <div className="animate-pulse flex-shrink-0">
                    <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="font-bold text-purple-900 dark:text-purple-200">
                      🤖 AI will automatically categorize this document
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                      No manual categorization needed!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="btn-primary w-full flex justify-center items-center text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
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
