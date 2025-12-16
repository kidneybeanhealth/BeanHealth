import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { DocumentIcon } from './icons/DocumentIcon';
import { CameraIcon } from './icons/CameraIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

interface FileMessageProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  className?: string;
}

export const FileMessage: React.FC<FileMessageProps> = ({
  message,
  isCurrentUser,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    switch (message.fileType) {
      case 'pdf':
        return <DocumentIcon className="w-6 h-6 text-red-500" />;
      case 'image':
        return <CameraIcon className="w-6 h-6 text-green-500" />;
      case 'audio':
        return <MicrophoneIcon className="w-6 h-6 text-secondary-500" />;
      default:
        return <DocumentIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  const handleDownload = async () => {
    if (!message.fileUrl) {
      console.error('No file URL provided');
      return;
    }
    
    if (isDownloading) return; // Prevent multiple clicks
    
    setIsDownloading(true);
    console.log('Downloading file:', message.fileUrl, message.fileName);
    
    try {
      // Method 1: Try direct download with blob
      const response = await fetch(message.fileUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('Blob created:', blob.size, 'bytes');
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = message.fileName || 'prescription.pdf';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setIsDownloading(false);
      }, 100);
      
      console.log('Download initiated successfully');
    } catch (error) {
      console.error('Download error:', error);
      
      // Method 2: Fallback - open in new tab and let browser handle it
      try {
        const newWindow = window.open(message.fileUrl, '_blank');
        if (!newWindow) {
          // Method 3: If popup blocked, try iframe download
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = message.fileUrl;
          document.body.appendChild(iframe);
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 5000);
        }
      } catch (fallbackError) {
        console.error('Fallback download also failed:', fallbackError);
        alert('Unable to download file. Please try opening the link directly.');
      }
      
      setIsDownloading(false);
    }
  };

  const handleAudioPlayPause = () => {
    const audio = document.getElementById(`audio-${message.id}`) as HTMLAudioElement;
    if (audio) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  const renderFileContent = () => {
    if (!message.fileUrl) return null;

    switch (message.fileType) {
      case 'image':
        if (imageError) {
          return (
            <div className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              {getFileIcon()}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {message.fileName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {message.fileSize ? formatFileSize(message.fileSize) : 'Image file'}
                </div>
                <div className="text-xs text-red-500">Failed to load image</div>
              </div>
              <button
                onClick={handleDownload}
                className="text-secondary-500 hover:text-secondary-600 text-xs font-medium"
              >
                Download
              </button>
            </div>
          );
        }

        return (
          <div className="space-y-2 max-w-full">
            <img
              src={message.fileUrl}
              alt={message.fileName || 'Shared image'}
              className="max-w-full sm:max-w-xs max-h-64 w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
              onError={() => setImageError(true)}
              onClick={() => window.open(message.fileUrl, '_blank')}
            />
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{message.fileName}</span>
              {message.fileSize && <span>{formatFileSize(message.fileSize)}</span>}
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              onClick={handleAudioPlayPause}
              className="p-2 bg-secondary-500 text-white rounded-full hover:bg-secondary-600 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {message.fileName || 'Voice message'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {message.fileSize ? formatFileSize(message.fileSize) : 'Audio file'}
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="text-secondary-500 hover:text-secondary-600 text-xs font-medium"
            >
              Download
            </button>
            <audio
              id={`audio-${message.id}`}
              src={message.fileUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
        );

      case 'pdf':
      default:
        return (
          <div className="flex items-center space-x-3 p-3 relative z-10">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {message.fileName}
              </div>
              <div className="text-xs opacity-70">
                {message.fileSize ? formatFileSize(message.fileSize) : 'Document'}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Download button clicked!');
                handleDownload();
              }}
              disabled={isDownloading}
              className="flex items-center space-x-2 px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer relative z-20"
              title={isDownloading ? "Downloading..." : "Download prescription"}
              style={{ pointerEvents: 'auto' }}
            >
              {isDownloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                </>
              )}
            </button>
          </div>
        );
    }
  };

  return (
    <div className={`${className}`}>
      {renderFileContent()}
      {message.text && (
        <div className="mt-2 text-sm text-gray-900 dark:text-white">
          {message.text}
        </div>
      )}
    </div>
  );
};
