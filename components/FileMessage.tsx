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

  const handleDownload = () => {
    if (message.fileUrl) {
      const link = document.createElement('a');
      link.href = message.fileUrl;
      link.download = message.fileName || 'file';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
                className="text-blue-500 hover:text-blue-600 text-xs font-medium"
              >
                Download
              </button>
            </div>
          );
        }

        return (
          <div className="space-y-2">
            <img
              src={message.fileUrl}
              alt={message.fileName || 'Shared image'}
              className="max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
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
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
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
              className="text-blue-500 hover:text-blue-600 text-xs font-medium"
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
          <div className="flex items-center space-x-3 p-3">
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
              onClick={handleDownload}
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium"
            >
              Download
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