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
        return <MicrophoneIcon className="w-6 h-6 text-blue-500" />;
      default:
        return <DocumentIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  // Helper to check if this is an audio message - broader detection
  const isAudioMessage = () => {
    if (message.fileType === 'audio') return true;
    if (message.mimeType?.startsWith('audio/')) return true;
    if (message.fileName?.includes('voice-message')) return true;
    if (message.fileName?.endsWith('.webm') || message.fileName?.endsWith('.mp3') || message.fileName?.endsWith('.wav') || message.fileName?.endsWith('.ogg')) return true;
    return false;
  };

  const handleDownload = async () => {
    if (!message.fileUrl) {
      console.error('No file URL provided');
      return;
    }

    if (isDownloading) return;

    setIsDownloading(true);
    console.log('Downloading file:', message.fileUrl, message.fileName);

    try {
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
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = message.fileName || 'prescription.pdf';
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setIsDownloading(false);
      }, 100);
    } catch (error) {
      console.error('Download error:', error);
      try {
        const newWindow = window.open(message.fileUrl, '_blank');
        if (!newWindow) {
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

    // Check for audio first with broader detection
    if (isAudioMessage()) {
      return (
        <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
          {/* WhatsApp-style Play/Pause Button */}
          <button
            onClick={handleAudioPlayPause}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-md bg-[#00A884] hover:bg-[#008f6d]"
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Waveform and Progress Area */}
          <div className="flex-1 flex flex-col justify-center gap-1">
            {/* WhatsApp-style Waveform Visualization */}
            <div className="flex items-center gap-[2px] h-6">
              {[3, 5, 8, 4, 10, 6, 12, 5, 8, 11, 4, 7, 9, 5, 6, 10, 4, 8, 6, 5, 9, 7, 4, 6, 8, 5, 10, 7, 4, 6].map((height, i) => (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-all duration-150 ${isPlaying
                      ? (i % 3 === 0 ? 'bg-[#00A884]' : 'bg-[#7BB97F]')
                      : 'bg-gray-400 dark:bg-gray-500'
                    }`}
                  style={{
                    height: `${height * 2}px`,
                    opacity: isPlaying ? 1 : 0.6
                  }}
                />
              ))}
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 dark:text-gray-400" id={`duration-${message.id}`}>
                {message.audioDuration
                  ? `${Math.floor(message.audioDuration / 60)}:${String(Math.floor(message.audioDuration % 60)).padStart(2, '0')}`
                  : '0:00'
                }
              </span>
              <svg className="w-4 h-4 text-[#8696A0]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          </div>

          {/* Hidden audio element */}
          <audio
            id={`audio-${message.id}`}
            src={message.fileUrl}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={(e) => {
              const audio = e.target as HTMLAudioElement;
              const durationEl = document.getElementById(`duration-${message.id}`);
              if (durationEl && !isNaN(audio.currentTime)) {
                const remaining = audio.duration - audio.currentTime;
                if (!isNaN(remaining)) {
                  durationEl.textContent = `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`;
                }
              }
            }}
            className="hidden"
          />
        </div>
      );
    }

    // Handle image case
    if (message.fileType === 'image') {
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
              className="text-blue-500 hover:text-blue-600 text-xs font-medium"
            >
              Download
            </button>
          </div>
        );
      }

      return (
        <div className="space-y-2 w-full">
          <img
            src={message.fileUrl}
            alt={message.fileName || 'Shared image'}
            className="max-w-full sm:max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onError={() => setImageError(true)}
            onClick={() => window.open(message.fileUrl, '_blank')}
          />
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 gap-2">
            <span className="truncate">{message.fileName}</span>
            {message.fileSize && <span className="flex-shrink-0">{formatFileSize(message.fileSize)}</span>}
          </div>
        </div>
      );
    }

    // Default case - PDF and other files
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 relative z-10 w-full">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 w-full">
          <div className="flex-shrink-0">{getFileIcon()}</div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="text-xs sm:text-sm font-medium truncate">
              {message.fileName}
            </div>
            <div className="text-[10px] sm:text-xs opacity-70">
              {message.fileSize ? formatFileSize(message.fileSize) : 'Document'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDownload();
          }}
          disabled={isDownloading}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer relative z-20 flex-shrink-0 w-full sm:w-auto justify-center"
          title={isDownloading ? "Downloading..." : "Download prescription"}
          style={{ pointerEvents: 'auto' }}
        >
          {isDownloading ? (
            <>
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download</span>
            </>
          )}
        </button>
      </div>
    );
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