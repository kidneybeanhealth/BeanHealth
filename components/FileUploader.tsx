import React, { useRef, useState, useCallback } from 'react';
import { DocumentUploadIcon } from './icons/DocumentUploadIcon';

export interface FileUploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface FileUploaderProps {
  acceptedTypes: string[];
  maxSizeBytes: number;
  onFileSelect: (files: File[]) => void;
  onUploadProgress?: (progress: FileUploadProgress) => void;
  multiple?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  acceptedTypes,
  maxSizeBytes,
  onFileSelect,
  onUploadProgress,
  multiple = false,
  disabled = false,
  children,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      return `File size must be less than ${maxSizeMB}MB`;
    }

    // Check file type
    const isValidType = acceptedTypes.some(type => {
      if (type.includes('/*')) {
        // Handle wildcards like 'image/*'
        const mainType = type.split('/')[0];
        return file.type.startsWith(mainType + '/');
      }
      return file.type === type;
    });

    if (!isValidType) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }

    return null;
  }, [acceptedTypes, maxSizeBytes]);

  const handleFileSelection = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        if (onUploadProgress) {
          onUploadProgress({
            fileName: file.name,
            progress: 0,
            status: 'error',
            error: error
          });
        }
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      console.error('File validation errors:', errors);
    }

    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }
  }, [validateFile, onFileSelect, onUploadProgress]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(event.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelection]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragOver(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFileSelection(files);
  }, [disabled, handleFileSelection]);

  const formatFileTypes = () => {
    return acceptedTypes.map(type => {
      if (type === 'application/pdf') return 'PDF';
      if (type.startsWith('image/')) return 'Images';
      if (type.startsWith('audio/')) return 'Audio';
      return type;
    }).join(', ');
  };

  const formatMaxSize = () => {
    const sizeMB = maxSizeBytes / (1024 * 1024);
    return sizeMB >= 1 ? `${sizeMB}MB` : `${maxSizeBytes / 1024}KB`;
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragOver 
            ? 'border-secondary-500 bg-secondary-50 dark:bg-secondary-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {children || (
          <div className="flex flex-col items-center space-y-2">
            <DocumentUploadIcon className="w-12 h-12 text-gray-400" />
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileTypes()} (max {formatMaxSize()})
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
