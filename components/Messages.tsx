import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { User, ChatMessage, Doctor, Patient } from '../types';
import { EmptyMessagesIcon } from './icons/EmptyMessagesIcon';
import { PaperAirplaneIcon } from './icons/PaperAirplaneIcon';
import { AlertIcon } from './icons/AlertIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { DocumentUploadIcon } from './icons/DocumentUploadIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { MenuIcon } from './icons/MenuIcon';
import { getInitials, getInitialsColor, getInitialsAvatarClasses } from '../utils/avatarUtils';
import { useRealTimeChat } from '../hooks/useRealTimeChatV2';
import { RealTimeStatus, TypingIndicator, MessageStatus } from './RealTimeComponents';
import { ChatFilePicker } from './ChatFilePicker';
import { AudioRecorder } from './AudioRecorder';
import { FileMessage } from './FileMessage';
import { FileUploadProgress } from './FileUploader';
import { uploadChatFile, uploadAudioRecording } from '../services/storageService';
import { ChatService } from '../services/chatService';
import { showErrorToast, showSuccessToast, showWarningToast } from '../utils/toastUtils';
import PrescriptionModal from './PrescriptionModal';
import PrescriptionListModal from './PrescriptionListModal';
import { DocumentIcon } from './icons/DocumentIcon';

type Contact = Doctor | Patient;

interface MessagesProps {
  currentUser: User;
  contacts: Contact[];
  messages: ChatMessage[]; // This will be ignored in favor of real-time messages
  onSendMessage: (message: Omit<ChatMessage, 'id' | 'timestamp' | 'isRead'>) => void; // This will be ignored
  onMarkMessagesAsRead: (contactId: string) => void; // This will be ignored
  preselectedContactId: string | null;
  clearPreselectedContact: () => void;
  onNavigateToBilling: () => void;
  onMenuClick?: () => void;
}

const Messages: React.FC<MessagesProps> = ({ 
    currentUser, 
    contacts, 
    messages: _messages, 
    onSendMessage: _onSendMessage, 
    onMarkMessagesAsRead: _onMarkMessagesAsRead,
    preselectedContactId, 
    clearPreselectedContact,
    onNavigateToBilling,
    onMenuClick
}) => {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showPrescriptionListModal, setShowPrescriptionListModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPatient = currentUser.role === 'patient';
  const isDoctor = currentUser.role === 'doctor';
  const patientData = isPatient ? (currentUser as Patient) : null;
  const hasCredits = patientData ? patientData.urgentCredits > 0 : false;
  
  // Real-time chat hook
  const realTimeChat = useRealTimeChat({
    currentUserId: currentUser.id,
    selectedContactId: selectedContactId || undefined
  });
  
  const {
    messages,
    unreadCount,
    isConnected,
    typingUsers,
    pendingMessages,
    sendMessage: sendRealTimeMessage,
    markConversationAsRead
  } = realTimeChat;
  
  // Get messages for the current conversation
  const currentConversationMessages = selectedContactId 
    ? realTimeChat.getConversationMessages(selectedContactId)
    : [];

  const sortedContacts = useMemo(() => {
    if (currentUser.role !== 'doctor') return contacts;
    
    const getUnreadInfo = (contactId: string) => {
        const unreadMessages = messages.filter(m => m.senderId === contactId && m.recipientId === currentUser.id && !m.isRead);
        const hasUrgent = unreadMessages.some(m => m.isUrgent);
        return { count: unreadMessages.length, hasUrgent };
    };

    return [...contacts].sort((a, b) => {
        const aInfo = getUnreadInfo(a.id);
        const bInfo = getUnreadInfo(b.id);

        if (aInfo.hasUrgent && !bInfo.hasUrgent) return -1;
        if (!aInfo.hasUrgent && bInfo.hasUrgent) return 1;
        if (aInfo.count > 0 && bInfo.count === 0) return -1;
        if (aInfo.count === 0 && bInfo.count > 0) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [contacts, messages, currentUser.id, currentUser.role]);
  
  useEffect(() => {
    if (preselectedContactId) {
      setSelectedContactId(preselectedContactId);
      markConversationAsRead(preselectedContactId);
      clearPreselectedContact();
    } else if (sortedContacts.length > 0 && !selectedContactId) {
      // On desktop, pre-select the first contact. On mobile, show the list.
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        const firstContactId = sortedContacts[0].id;
        setSelectedContactId(firstContactId);
        markConversationAsRead(firstContactId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedContactId, clearPreselectedContact, sortedContacts]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const previousMessagesLength = useRef(0);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto', 
        block: 'end',
        inline: 'nearest'
      });
    }
  }, []);

  // Check if user is near bottom of chat
  const checkIfNearBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Consider "near bottom" if within 100px
      return distanceFromBottom < 100;
    }
    return true;
  }, []);

  // Handle scroll events to determine if we should auto-scroll
  const handleScroll = useCallback(() => {
    const isNearBottom = checkIfNearBottom();
    setShouldAutoScroll(isNearBottom);
  }, [checkIfNearBottom]);

  // Auto-scroll when new messages arrive (only if user was already at bottom)
  useEffect(() => {
    const currentLength = currentConversationMessages.length;
    const isNewMessage = currentLength > previousMessagesLength.current;
    
    if (isNewMessage && shouldAutoScroll) {
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => scrollToBottom(true), 100);
      return () => clearTimeout(timer);
    }
    
    previousMessagesLength.current = currentLength;
  }, [currentConversationMessages.length, shouldAutoScroll, scrollToBottom]);

  // Always scroll to bottom when changing conversations
  useEffect(() => {
    if (selectedContactId) {
      setShouldAutoScroll(true);
      previousMessagesLength.current = 0;
      // Immediate scroll without animation for conversation change
      const timer = setTimeout(() => scrollToBottom(false), 50);
      return () => clearTimeout(timer);
    }
  }, [selectedContactId, scrollToBottom]);

  const handleSelectContact = (contactId: string) => {
      setSelectedContactId(contactId);
      markConversationAsRead(contactId);
  }
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedContactId) return;

    if (isPatient && isUrgent && !hasCredits) {
      showErrorToast("You don't have any urgent credits left. Please purchase more from the Billing page.");
      return;
    }

    try {
      await sendRealTimeMessage(selectedContactId, input, isUrgent);
      setInput('');
      setIsUrgent(false);
      
      // Stop typing indicator after sending
      if (realTimeChat.stopTyping) {
        realTimeChat.stopTyping(selectedContactId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showErrorToast('Failed to send message. Please try again.');
    }
  };

  const handleToggleUrgent = () => {
    if (isPatient && patientData) {
        if (!hasCredits && !isUrgent) {
          showWarningToast('You have no urgent credits left. Purchase more from the Billing page.');
          return;
        }
        if(patientData.urgentCredits === 1 && !isUrgent) {
            setShowCreditWarning(true);
            showWarningToast('This is your last urgent credit!');
            setTimeout(() => setShowCreditWarning(false), 5000);
        }
    }
    setIsUrgent(prev => !prev);
  };

  const handleFileUpload = async (file: File, fileType: 'pdf' | 'image' | 'audio') => {
    if (!selectedContactId) {
      showErrorToast('Please select a conversation first');
      return;
    }

    setIsUploading(true);
    setShowFilePicker(false); // Close the picker
    setUploadProgress({
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    });

    try {
      // Upload file to storage
      const fileData = await uploadChatFile(file, currentUser.id, selectedContactId, fileType);
      
      setUploadProgress({
        fileName: file.name,
        progress: 100,
        status: 'success'
      });

      // Send file message
      const sentMessage = await ChatService.sendFileMessage(
        currentUser.id,
        selectedContactId,
        fileData.fileUrl,
        fileData.fileName,
        fileType,
        fileData.fileSize,
        fileData.mimeType,
        undefined, // no text with file
        isUrgent
      );

      // Manually add the sent message to real-time chat to show immediately
      if (realTimeChat.addMessage) {
        realTimeChat.addMessage(sentMessage);
      }

      // Reset urgent flag if it was set
      setIsUrgent(false);
      
      showSuccessToast('File sent successfully');
      
      // Clear upload progress after a delay
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);

    } catch (error) {
      console.error('File upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      showErrorToast(`File upload failed: ${errorMessage}`);
      
      setUploadProgress({
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: errorMessage
      });
      
      // Clear error after delay
      setTimeout(() => {
        setUploadProgress(null);
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAudioRecording = async (audioBlob: Blob, duration: number) => {
    if (!selectedContactId) {
      showErrorToast('Please select a conversation first');
      return;
    }

    setIsUploading(true);
    setShowAudioRecorder(false); // Close the recorder
    setUploadProgress({
      fileName: 'Voice message',
      progress: 0,
      status: 'uploading'
    });

    try {
      // Upload audio recording
      const audioData = await uploadAudioRecording(audioBlob, currentUser.id, selectedContactId, duration);
      
      setUploadProgress({
        fileName: 'Voice message',
        progress: 100,
        status: 'success'
      });

      // Send audio message
      const sentMessage = await ChatService.sendFileMessage(
        currentUser.id,
        selectedContactId,
        audioData.fileUrl,
        audioData.fileName,
        'audio',
        audioData.fileSize,
        audioData.mimeType,
        undefined, // no text with audio
        isUrgent
      );

      // Manually add the sent message to real-time chat to show immediately
      if (realTimeChat.addMessage) {
        realTimeChat.addMessage(sentMessage);
      }

      // Reset urgent flag if it was set
      setIsUrgent(false);
      
      showSuccessToast('Voice message sent successfully');
      
      // Clear upload progress after a delay
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);

    } catch (error) {
      console.error('Audio upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      showErrorToast(`Voice message failed: ${errorMessage}`);
      
      setUploadProgress({
        fileName: 'Voice message',
        progress: 0,
        status: 'error',
        error: errorMessage
      });
      
      // Clear error after delay
      setTimeout(() => {
        setUploadProgress(null);
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const getAvatarSrc = (contact: Contact) => {
    // No longer use external images - this function is deprecated
    // We now use initials avatars only
    return null;
  };

  // Create initials avatar component
  const InitialsAvatar = ({ contact, size = 'md' }: { contact: Contact; size?: 'sm' | 'md' | 'lg' }) => {
    const initials = getInitials(contact.name, contact.email);
    const colorClass = getInitialsColor(contact.name, contact.email);
    const sizeClasses = getInitialsAvatarClasses(size);
    
    return (
      <div className={`${sizeClasses} ${colorClass}`}>
        <span className="text-white font-medium">
          {initials}
        </span>
      </div>
    );
  };

  const selectedContact = contacts.find(d => d.id === selectedContactId);
  
  const cannotTurnOnUrgent = isPatient && !hasCredits && !isUrgent;

  return (
    <div className="flex flex-col h-screen md:h-full md:flex-row bg-gradient-to-br from-gray-50 via-white to-rose-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 md:rounded-xl md:shadow-2xl overflow-hidden border-0 md:border border-gray-200/50 dark:border-gray-700/50">
      {/* Mobile-only Header - Shows only when no contact selected */}
      {!selectedContactId && onMenuClick && (
        <div className="md:hidden sticky top-0 z-20 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center bg-gradient-to-r from-white via-white to-rose-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 backdrop-blur-md shadow-sm">
          <button 
            onClick={onMenuClick}
            className="p-2 -ml-1 rounded-xl bg-white/80 dark:bg-gray-700/80 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-gray-200 dark:border-gray-600 hover:border-rose-300 dark:hover:border-rose-600 hover:scale-110 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md"
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="ml-3 text-lg font-display font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-rose-900 dark:from-gray-100 dark:via-gray-200 dark:to-rose-400 bg-clip-text text-transparent">Messages</h1>
        </div>
      )}
      
      {/* Contact List Panel - Modern Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200/80 dark:border-gray-700/80 flex flex-col backdrop-blur-sm ${selectedContactId ? 'hidden md:flex' : 'flex'} min-h-0`}>
        {/* Sidebar Header with Gradient - Hidden on mobile, use mobile header instead */}
        <div className="hidden md:block relative px-4 sm:px-5 lg:px-6 py-4 sm:py-5 border-b border-gray-200/80 dark:border-gray-700/80 flex-shrink-0 bg-gradient-to-br from-white via-white to-rose-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-purple-500/5 dark:from-rose-900/10 dark:to-purple-900/10"></div>
          <div className="relative">
            <div className="flex items-center space-x-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse"></div>
              <h3 className="text-lg sm:text-xl font-display font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-rose-900 dark:from-gray-100 dark:via-gray-200 dark:to-rose-400 bg-clip-text text-transparent">Messages</h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">{sortedContacts.length} {sortedContacts.length === 1 ? 'conversation' : 'conversations'}</p>
          </div>
        </div>

        {/* Contact List with Enhanced Design */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-2 sm:p-3 space-y-1.5">
            {sortedContacts.map(contact => {
               const unreadMessages = messages.filter(m => m.senderId === contact.id && m.recipientId === currentUser.id && !m.isRead);
               const hasUnreadUrgent = unreadMessages.some(m => m.isUrgent);
              return (
                  <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact.id)}
                      className={`group relative w-full text-left px-3 sm:px-4 py-3 sm:py-3.5 flex items-center space-x-3 rounded-xl sm:rounded-2xl transition-all duration-300 overflow-hidden ${
                        selectedContactId === contact.id 
                          ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700 text-white shadow-xl shadow-rose-500/30 dark:shadow-rose-900/50 scale-[1.02] ring-2 ring-rose-400/50 dark:ring-rose-500/50' 
                          : 'bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg border border-gray-200/50 dark:border-gray-700/50 hover:border-rose-300 dark:hover:border-rose-700 hover:scale-[1.01]'
                      }`}
                  >
                      {/* Animated Background Gradient */}
                      {selectedContactId === contact.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-rose-600 via-purple-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-gradient-x"></div>
                      )}
                      
                      <div className="relative flex-shrink-0">
                          <InitialsAvatar contact={contact} size="md" />
                          {/* Online Status Indicator */}
                          <span className="absolute -bottom-0.5 -right-0.5 block h-3.5 w-3.5 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 ring-2 ring-white dark:ring-gray-800 shadow-lg"></span>
                          {hasUnreadUrgent && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-5 w-5 bg-gradient-to-br from-red-500 to-red-600 ring-2 ring-white dark:ring-gray-800 shadow-lg"></span>
                            </span>
                          )}
                      </div>
                      
                      <div className="relative flex-1 min-w-0">
                        <p className={`font-bold truncate text-sm sm:text-base mb-0.5 ${
                          selectedContactId === contact.id 
                            ? 'text-white drop-shadow-sm' 
                            : 'text-gray-900 dark:text-gray-100 group-hover:text-rose-900 dark:group-hover:text-rose-400'
                        }`}>
                          {contact.name}
                        </p>
                        <p className={`text-xs truncate font-medium ${
                          selectedContactId === contact.id 
                            ? 'text-rose-100' 
                            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                        }`}>
                          {(contact as Doctor).specialty || (contact as Patient).condition}
                        </p>
                      </div>
                      
                      {unreadMessages.length > 0 && !hasUnreadUrgent && (
                          <span className={`relative text-xs font-extrabold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 shadow-lg ${
                            selectedContactId === contact.id
                              ? 'bg-white/30 backdrop-blur-sm text-white ring-2 ring-white/50'
                              : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
                          }`}>
                              {unreadMessages.length > 9 ? '9+' : unreadMessages.length}
                          </span>
                      )}
                  </button>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Chat Panel */}
      <div className={`w-full md:flex-1 flex flex-col ${selectedContactId ? 'flex' : 'hidden md:flex'} min-h-0`}>
        {selectedContact ? (
          <>
            {/* Chat Header - Modern Design with Sticky Position */}
            <div className="sticky top-0 z-10 px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center flex-shrink-0 bg-gradient-to-r from-white via-white to-rose-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 backdrop-blur-md shadow-sm">
              {/* Subtle Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-purple-500/5 dark:from-rose-900/10 dark:to-purple-900/10"></div>
              
              <div className="relative flex items-center space-x-3 flex-1 min-w-0">
                <button 
                  onClick={() => setSelectedContactId(null)} 
                  className="md:hidden p-2 -ml-1 rounded-xl bg-white/80 dark:bg-gray-700/80 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-gray-200 dark:border-gray-600 hover:border-rose-300 dark:hover:border-rose-600 hover:scale-110 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
                >
                  <ArrowLeftIcon className="h-5 w-5 text-gray-700 dark:text-gray-300"/>
                </button>
                
                <div className="relative flex-shrink-0">
                  <div className="relative">
                    <InitialsAvatar contact={selectedContact} size="md" />
                    {/* Glow Effect on Avatar */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-400 to-purple-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"></div>
                  </div>
                  {/* Enhanced Status Indicator */}
                  <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-gradient-to-br from-emerald-400 to-green-500 ring-2 ring-white dark:ring-gray-800 shadow-lg"></span>
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-display font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-rose-900 dark:from-gray-100 dark:via-gray-200 dark:to-rose-400 bg-clip-text text-transparent truncate">{selectedContact.name}</h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    {typingUsers.has(selectedContact.id) ? (
                      <TypingIndicator 
                        isTyping={true} 
                        userName={selectedContact.name}
                      />
                    ) : (
                      <RealTimeStatus 
                        isConnected={isConnected}
                      />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action Buttons with Enhanced Design */}
              <div className="relative flex items-center space-x-2 flex-shrink-0 ml-2">
                {/* E-Prescriptions List Button */}
                <button
                  onClick={() => setShowPrescriptionListModal(true)}
                  className="group relative flex items-center space-x-1.5 px-2.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-400 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30 border-2 border-rose-200 dark:border-rose-700/50 rounded-xl hover:from-rose-100 hover:to-pink-100 dark:hover:from-rose-900/50 dark:hover:to-pink-900/50 hover:shadow-lg hover:shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all duration-300 whitespace-nowrap overflow-hidden"
                  aria-label="View prescriptions"
                  title="View E-Prescriptions"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <DocumentIcon className="relative h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 drop-shadow-sm" />
                  <span className="relative hidden lg:inline drop-shadow-sm">E-Prescriptions</span>
                  <span className="relative lg:hidden drop-shadow-sm">Rx</span>
                </button>

                {/* Create Prescription Button - Enhanced */}
                {isDoctor && selectedContact.role === 'patient' && (
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="group relative flex items-center space-x-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 rounded-xl hover:from-rose-600 hover:via-rose-700 hover:to-rose-800 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 hover:scale-105 active:scale-95 transition-all duration-300 whitespace-nowrap overflow-hidden"
                    aria-label="Create prescription"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-pink-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <svg className="relative h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="relative hidden sm:inline drop-shadow">Create Rx</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Messages Area - Enhanced Design */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-rose-50/20 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
              <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-5xl mx-auto">
                <div className="space-y-3 sm:space-y-4">
                  {currentConversationMessages.length === 0 ? (
                    <div className="text-center py-16 sm:py-20 animate-fade-in">
                      <div className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-rose-100 to-purple-100 dark:from-rose-900/30 dark:to-purple-900/30 mb-6 shadow-lg">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-400/20 to-purple-400/20 animate-pulse"></div>
                        <svg className="relative w-10 h-10 sm:w-12 sm:h-12 text-rose-500 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Start a Conversation</h4>
                      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Send a message to begin your healthcare conversation</p>
                    </div>
                  ) : (
                    currentConversationMessages.map((msg, index) => (
                      <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-slide-up`} style={{ animationDelay: `${index * 20}ms` }}>
                        <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-lg xl:max-w-xl ${msg.senderId === currentUser.id ? 'ml-4 sm:ml-12' : 'mr-4 sm:mr-12'}`}>
                          <div className={`group relative px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 lg:py-3.5 rounded-2xl sm:rounded-3xl text-sm sm:text-base break-words shadow-md transition-all duration-300 ${
                            msg.senderId === currentUser.id
                              ? 'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 text-white rounded-br-md hover:shadow-xl hover:shadow-rose-500/30'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border-2 border-gray-200/80 dark:border-gray-700/80 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-xl'
                          } ${msg.isUrgent ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-900 shadow-xl shadow-red-500/20' : ''} ${
                            pendingMessages.has(msg.id) ? 'opacity-70' : ''
                          }`}>
                            {/* Subtle Gradient Overlay */}
                            {msg.senderId === currentUser.id && (
                              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl sm:rounded-3xl transition-opacity duration-300"></div>
                            )}
                            
                            {msg.isUrgent && (
                              <div className="relative inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-extrabold rounded-full mb-2 shadow-lg">
                                <AlertIcon className="h-3 w-3 mr-1 animate-pulse"/>
                                URGENT
                              </div>
                            )}
                            {msg.fileUrl ? (
                              <FileMessage 
                                message={msg}
                                isCurrentUser={msg.senderId === currentUser.id}
                              />
                            ) : msg.text && (
                              <p className="relative whitespace-pre-wrap leading-relaxed font-medium">{msg.text}</p>
                            )}
                          </div>
                          <div className={`text-xs text-gray-400 dark:text-gray-500 mt-2 px-2 flex items-center space-x-2 ${
                            msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                          }`}>
                            {msg.senderId === currentUser.id && (
                                <MessageStatus 
                                  isRead={msg.isRead}
                                  timestamp={msg.timestamp}
                                  isUrgent={msg.isUrgent}
                                />
                            )}
                            {msg.senderId !== currentUser.id && (
                              <span className="font-medium">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            {pendingMessages.has(msg.id) && (
                              <span className="inline-flex items-center">
                                <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Scroll to Bottom Button - Enhanced */}
              {!shouldAutoScroll && currentConversationMessages.length > 0 && (
                <button
                  onClick={() => {
                    setShouldAutoScroll(true);
                    scrollToBottom(true);
                  }}
                  className="fixed bottom-24 sm:bottom-32 right-4 sm:right-8 p-3 bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 text-white rounded-2xl shadow-2xl shadow-rose-500/40 hover:shadow-rose-500/60 hover:scale-110 active:scale-95 transition-all duration-300 z-10 animate-slideUp ring-2 ring-rose-400/50 backdrop-blur-sm"
                  aria-label="Scroll to bottom"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-400"></span>
                  </span>
                </button>
              )}
            </div>
            
            {/* Message Input Area - Modern Design */}
            <div className="relative px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-t border-gray-200/80 dark:border-gray-700/80 bg-gradient-to-r from-white via-white to-rose-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 flex-shrink-0 overflow-visible">
               {/* Subtle Background Pattern */}
               <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-purple-500/5 dark:from-rose-900/10 dark:to-purple-900/10 pointer-events-none"></div>
               
               {showCreditWarning && (
                <div className="relative bottom-full left-0 right-0 mb-3 p-3 sm:p-4 bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 dark:from-yellow-900/50 dark:via-orange-900/50 dark:to-yellow-900/50 text-yellow-900 dark:text-yellow-200 text-xs sm:text-sm rounded-2xl shadow-2xl border-2 border-yellow-300 dark:border-yellow-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-up">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-2 bg-yellow-400 dark:bg-yellow-600 rounded-xl mr-3">
                        <AlertIcon className="h-5 w-5 text-yellow-900 dark:text-yellow-100" />
                      </div>
                      <span className="font-bold">You are about to use your last urgent credit.</span>
                    </div>
                    <button 
                        onClick={onNavigateToBilling}
                        className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 text-white font-extrabold rounded-xl hover:from-yellow-600 hover:via-orange-600 hover:to-yellow-600 text-xs shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto text-center"
                    >
                        Purchase More Credits
                    </button>
                </div>
               )}

               {/* Upload Progress - Enhanced */}
               {uploadProgress && (
                 <div className="relative mb-4 p-4 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/30 dark:via-pink-900/30 dark:to-rose-900/30 rounded-2xl border-2 border-rose-300 dark:border-rose-700 shadow-lg">
                   <div className="flex items-center justify-between text-sm text-rose-800 dark:text-rose-200 mb-3 font-bold">
                     <span className="flex items-center">
                       <svg className="animate-spin h-5 w-5 mr-2 text-rose-600 dark:text-rose-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Uploading {uploadProgress.fileName}
                     </span>
                     <span className="text-lg font-extrabold">{Math.round(uploadProgress.progress)}%</span>
                   </div>
                   <div className="relative w-full bg-rose-200 dark:bg-rose-800 rounded-full h-3 overflow-hidden shadow-inner">
                     <div 
                       className="absolute inset-0 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 h-3 rounded-full transition-all duration-300 shadow-lg"
                       style={{ width: `${uploadProgress.progress}%` }}
                     >
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                     </div>
                   </div>
                 </div>
               )}
               
              <form onSubmit={handleSendMessage} className="relative pr-16 sm:pr-16 z-10">
                {/* Single Input Container with All Buttons Inside */}
                <div className="relative flex items-center bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-3xl shadow-lg hover:border-rose-400 dark:hover:border-rose-500 focus-within:border-rose-500 dark:focus-within:border-rose-400 focus-within:ring-4 focus-within:ring-rose-500/20 transition-all duration-300">
                  {/* Left Side - Urgent Credit Button */}
                  <div className="flex items-center pl-2 sm:pl-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleToggleUrgent}
                        disabled={cannotTurnOnUrgent}
                        className={`p-2 rounded-full transition-all duration-200 ${
                          isUrgent 
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-red-600 dark:hover:text-red-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label="Toggle urgent message"
                      >
                        <AlertIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                      {isPatient && patientData && (
                        <span className="absolute -top-1 -right-1 text-[10px] sm:text-xs bg-gradient-to-br from-rose-500 to-rose-600 text-white font-extrabold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-lg">
                          {patientData.urgentCredits}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (selectedContactId && realTimeChat.startTyping) {
                        realTimeChat.startTyping(selectedContactId);
                      }
                    }}
                    onBlur={() => {
                      if (selectedContactId && realTimeChat.stopTyping) {
                        realTimeChat.stopTyping(selectedContactId);
                      }
                    }}
                    placeholder="Message"
                    className="flex-1 px-3 sm:px-4 py-3 sm:py-3.5 text-sm sm:text-base bg-transparent border-0 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-medium"
                  />

                  {/* Right Side Buttons - Inside Input */}
                  <div className="flex items-center pr-2 sm:pr-3 space-x-1">
                    {/* Attach File Button */}
                    <button
                      type="button"
                      onClick={() => setShowFilePicker(true)}
                      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200"
                      aria-label="Attach file"
                    >
                      <DocumentUploadIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>

                    {/* Camera Button */}
                    <button
                      type="button"
                      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200"
                      aria-label="Camera"
                    >
                      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Voice Message Button - Outside on Right (Green Circle) - Fully Visible */}
                <button
                  type="button"
                  onClick={() => setShowAudioRecorder(true)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full shadow-xl shadow-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/50 hover:scale-110 active:scale-95 transition-all duration-300"
                  aria-label="Record voice message"
                >
                  <MicrophoneIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>

                {/* Tooltip for Urgent Credits */}
                {cannotTurnOnUrgent && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold rounded-xl shadow-2xl opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10 border-2 border-gray-700 dark:border-gray-300">
                    ⚠️ You have no urgent credits. Please purchase more from the Billing page.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-gray-900 dark:border-t-gray-100"></div>
                  </div>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-br from-gray-50 via-white to-rose-50/30 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900">
            <div className="relative bg-gradient-to-br from-white to-rose-50/50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-12 sm:p-16 shadow-2xl border-2 border-gray-200/50 dark:border-gray-700/50 max-w-md animate-fade-in">
              {/* Decorative Background Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-400/10 to-purple-400/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-rose-400/10 to-pink-400/10 rounded-full blur-3xl"></div>
              
              <div className="relative">
                <div className="relative inline-flex items-center justify-center mb-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-400/20 to-purple-400/20 rounded-full blur-2xl animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-rose-100 to-purple-100 dark:from-rose-900/40 dark:to-purple-900/40 rounded-full p-8 shadow-xl">
                    <EmptyMessagesIcon className="h-20 w-20 sm:h-24 sm:w-24 text-rose-500 dark:text-rose-400" />
                  </div>
                </div>
                
                <h3 className="text-2xl sm:text-3xl font-display font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-rose-900 dark:from-gray-100 dark:via-gray-200 dark:to-rose-400 bg-clip-text text-transparent mb-4">Select a Conversation</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm font-medium leading-relaxed">Choose a contact from the list to start chatting and stay connected with your healthcare team.</p>
                
                <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-gray-400 dark:text-gray-500">
                  <div className="h-2 w-2 rounded-full bg-gradient-to-r from-rose-500 to-purple-500 animate-pulse"></div>
                  <span className="font-semibold">Ready to connect</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Modals */}
      {showFilePicker && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-display font-bold text-gray-900 dark:text-gray-100">
                Choose File Type
              </h3>
              <button
                onClick={() => setShowFilePicker(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95 transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ChatFilePicker
              onFileSelect={handleFileUpload}
              onUploadProgress={setUploadProgress}
              disabled={isUploading}
            />
          </div>
        </div>
      )}

      {showAudioRecorder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-display font-bold text-gray-900 dark:text-gray-100">
                Record Audio Message
              </h3>
              <button
                onClick={() => setShowAudioRecorder(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95 transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <AudioRecorder
              onRecordingComplete={handleAudioRecording}
              onRecordingCancel={() => setShowAudioRecorder(false)}
              disabled={isUploading}
            />
          </div>
        </div>
      )}

      {/* Prescription Modal - Only for doctors */}
      {isDoctor && selectedContact && selectedContact.role === 'patient' && (
        <PrescriptionModal
          isOpen={showPrescriptionModal}
          onClose={() => setShowPrescriptionModal(false)}
          doctor={currentUser as Doctor}
          patient={selectedContact as Patient}
          onPrescriptionSent={() => {
            // Message will automatically appear via real-time subscription
            // Just close the modal
            setShowPrescriptionModal(false);
          }}
        />
      )}

      {/* Prescription List Modal - For both doctors and patients */}
      {selectedContact && (
        <PrescriptionListModal
          isOpen={showPrescriptionListModal}
          onClose={() => setShowPrescriptionListModal(false)}
          currentUserId={currentUser.id}
          contactId={selectedContact.id}
          isDoctor={isDoctor}
        />
      )}
    </div>
  );
};

export default Messages;