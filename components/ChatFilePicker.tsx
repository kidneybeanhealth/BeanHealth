import React, { useState } from 'react';
import { FileUploader, FileUploadProgress } from './FileUploader';
import { CameraIcon } from './icons/CameraIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

export interface ChatFileType {
  type: 'pdf' | 'image' | 'audio';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  acceptedTypes: string[];
  maxSizeBytes: number;
}

const CHAT_FILE_TYPES: ChatFileType[] = [
  {
    type: 'pdf',
    label: 'PDF Document',
    icon: DocumentIcon,
    acceptedTypes: ['application/pdf'],
    maxSizeBytes: 10 * 1024 * 1024 // 10MB
  },
  {
    type: 'image',
    label: 'Image',
    icon: CameraIcon,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSizeBytes: 5 * 1024 * 1024 // 5MB
  },
  {
    type: 'audio',
    label: 'Audio File',
    icon: MicrophoneIcon,
    acceptedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
    maxSizeBytes: 25 * 1024 * 1024 // 25MB
  }
];

interface ChatFilePickerProps {
  onFileSelect: (file: File, fileType: 'pdf' | 'image' | 'audio') => void;
  onUploadProgress?: (progress: FileUploadProgress) => void;
  disabled?: boolean;
  className?: string;
}

export const ChatFilePicker: React.FC<ChatFilePickerProps> = ({
  onFileSelect,
  onUploadProgress,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ChatFileType | null>(null);

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0 && selectedType) {
      onFileSelect(files[0], selectedType.type);
      setIsOpen(false);
      setSelectedType(null);
    }
  };

  const handleTypeSelect = (fileType: ChatFileType) => {
    setSelectedType(fileType);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedType(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`
          p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors
          ${className}
        `}
        title="Attach file"
      >
        <DocumentIcon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Attach File
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!selectedType ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Choose the type of file you want to attach:
            </p>
            {CHAT_FILE_TYPES.map((fileType) => {
              const IconComponent = fileType.icon;
              return (
                <button
                  key={fileType.type}
                  onClick={() => handleTypeSelect(fileType)}
                  className="w-full flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 
                    rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <IconComponent className="w-6 h-6 text-secondary-500" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {fileType.label}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Max {(fileType.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <button
                onClick={() => setSelectedType(null)}
                className="flex items-center text-secondary-500 hover:text-secondary-600 text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>
            
            <FileUploader
              acceptedTypes={selectedType.acceptedTypes}
              maxSizeBytes={selectedType.maxSizeBytes}
              onFileSelect={handleFileSelect}
              onUploadProgress={onUploadProgress}
              multiple={false}
              disabled={disabled}
            >
              <div className="flex flex-col items-center space-y-2">
                <selectedType.icon className="w-12 h-12 text-gray-400" />
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Click to upload {selectedType.label}</span> or drag and drop
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Max {(selectedType.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB
                </div>
              </div>
            </FileUploader>
          </div>
        )}
      </div>
    </div>
  );
};
