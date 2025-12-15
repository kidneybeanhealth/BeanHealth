import React from 'react';

interface RealTimeStatusProps {
  isConnected: boolean;
  className?: string;
}

export const RealTimeStatus: React.FC<RealTimeStatusProps> = ({ 
  isConnected, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div 
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        } ${isConnected ? 'animate-pulse' : ''}`}
      />
      <span className={`text-xs ${
        isConnected 
          ? 'text-green-600 dark:text-green-400' 
          : 'text-red-600 dark:text-red-400'
      }`}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
};

interface TypingIndicatorProps {
  isTyping: boolean;
  userName?: string;
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isTyping,
  userName = 'Someone',
  className = ''
}) => {
  if (!isTyping) return null;

  return (
    <div className={`flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-slate-600 dark:text-slate-400">typing...</span>
    </div>
  );
};

interface MessageStatusProps {
  isRead: boolean;
  timestamp: string;
  isUrgent?: boolean;
  className?: string;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({ 
  isRead, 
  timestamp, 
  isUrgent = false,
  className = '' 
}) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  return (
    <div className={`flex items-center space-x-1 text-xs ${className}`}>
      <span className="text-gray-400 dark:text-gray-500">
        {formatTime(timestamp)}
      </span>
      {isUrgent && (
        <span className="text-red-500 font-bold">!</span>
      )}
      <div className={`w-4 h-4 flex items-center justify-center ${
        isRead ? 'text-blue-500' : 'text-gray-400'
      }`}>
        {isRead ? (
          // Double checkmark for read
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
            <path d="M18.707 3.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-1-1a1 1 0 011.414-1.414l.293.293 7.293-7.293a1 1 0 011.414 0z"/>
          </svg>
        ) : (
          // Single checkmark for sent
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
          </svg>
        )}
      </div>
    </div>
  );
};