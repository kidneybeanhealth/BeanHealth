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
}

const Messages: React.FC<MessagesProps> = ({ 
    currentUser, 
    contacts, 
    messages: _messages, 
    onSendMessage: _onSendMessage, 
    onMarkMessagesAsRead: _onMarkMessagesAsRead,
    preselectedContactId, 
    clearPreselectedContact,
    onNavigateToBilling
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
    <div className="flex flex-col md:flex-row h-full bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Contact List Panel */}
      <div className={`w-full md:w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900 ${selectedContactId ? 'hidden md:flex' : 'flex'} min-h-0`}>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg sm:text-xl font-display font-bold text-gray-900 dark:text-gray-100">Messages</h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{sortedContacts.length} conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-3 space-y-2">
            {sortedContacts.map(contact => {
               const unreadMessages = messages.filter(m => m.senderId === contact.id && m.recipientId === currentUser.id && !m.isRead);
               const hasUnreadUrgent = unreadMessages.some(m => m.isUrgent);
              return (
                  <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact.id)}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-3 rounded-xl transition-all duration-200 ${
                        selectedContactId === contact.id 
                          ? 'bg-gradient-to-r from-rose-500 to-rose-900 text-white shadow-lg scale-[1.02]' 
                          : 'hover:bg-white dark:hover:bg-gray-800 hover:shadow-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                  >
                      <div className="relative flex-shrink-0">
                          <InitialsAvatar contact={contact} size="md" />
                          {hasUnreadUrgent && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 ring-2 ring-white dark:ring-gray-800"></span>
                            </span>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate text-sm ${
                          selectedContactId === contact.id 
                            ? 'text-white' 
                            : 'text-gray-800 dark:text-gray-100'
                        }`}>
                          {contact.name}
                        </p>
                        <p className={`text-xs truncate ${
                          selectedContactId === contact.id 
                            ? 'text-sky-100' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {(contact as Doctor).specialty || (contact as Patient).condition}
                        </p>
                      </div>
                      {unreadMessages.length > 0 && !hasUnreadUrgent && (
                          <span className={`text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 ${
                            selectedContactId === contact.id
                              ? 'bg-white/20 text-white'
                              : 'bg-gradient-to-r from-rose-500 to-rose-900 text-white'
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
            {/* Chat Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center flex-shrink-0 bg-white dark:bg-gray-800">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <button 
                  onClick={() => setSelectedContactId(null)} 
                  className="md:hidden p-2 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all duration-200 flex-shrink-0"
                >
                  <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300"/>
                </button>
                <div className="relative flex-shrink-0">
                  <InitialsAvatar contact={selectedContact} size="md" />
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-800"></span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-display font-bold text-gray-900 dark:text-gray-100 truncate">{selectedContact.name}</h3>
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
              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                {/* E-Prescriptions List Button - For both doctors and patients */}
                <button
                  onClick={() => setShowPrescriptionListModal(true)}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-rose-900 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg sm:rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap"
                  aria-label="View prescriptions"
                  title="View E-Prescriptions"
                >
                  <DocumentIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="hidden lg:inline">E-Prescriptions</span>
                  <span className="lg:hidden">Rx</span>
                </button>

                {/* Create Prescription Button - Only for doctors */}
                {isDoctor && selectedContact.role === 'patient' && (
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="flex items-center space-x-1 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-900 rounded-lg sm:rounded-xl hover:from-sky-600 hover:to-indigo-700 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap"
                    aria-label="Create prescription"
                  >
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">Create Rx</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Messages Area - Fixed Height Scrollable Window */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 min-h-0 scrollbar-thin"
            >
              <div className="px-4 sm:px-6 py-4 max-w-4xl mx-auto">
                <div className="space-y-4">
                  {currentConversationMessages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-4">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Start the conversation</p>
                    </div>
                  ) : (
                    currentConversationMessages.map((msg, index) => (
                      <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-slide-up`} style={{ animationDelay: `${index * 20}ms` }}>
                        <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-md ${msg.senderId === currentUser.id ? 'ml-4 sm:ml-12' : 'mr-4 sm:mr-12'}`}>
                          <div className={`group relative px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-sm break-words shadow-sm ${
                            msg.senderId === currentUser.id
                              ? 'bg-gradient-to-br from-rose-500 to-rose-900 text-white rounded-br-md'
                              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700'
                          } ${msg.isUrgent ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-slate-900' : ''} ${
                            pendingMessages.has(msg.id) ? 'opacity-70' : ''
                          } hover:shadow-lg transition-all duration-200`}>
                            {msg.isUrgent && (
                              <div className="inline-flex items-center px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full mb-2">
                                <AlertIcon className="h-3 w-3 mr-1"/>
                                URGENT
                              </div>
                            )}
                            {msg.fileUrl ? (
                              <FileMessage 
                                message={msg}
                                isCurrentUser={msg.senderId === currentUser.id}
                              />
                            ) : msg.text && (
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            )}
                          </div>
                          <div className={`text-xs text-gray-400 dark:text-gray-500 mt-1.5 px-2 flex items-center space-x-2 ${
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
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

              {/* Scroll to Bottom Button - appears when user scrolls up */}
              {!shouldAutoScroll && currentConversationMessages.length > 0 && (
                <button
                  onClick={() => {
                    setShouldAutoScroll(true);
                    scrollToBottom(true);
                  }}
                  className="fixed bottom-24 sm:bottom-32 right-4 sm:right-8 p-2.5 sm:p-3 bg-gradient-to-r from-rose-500 to-rose-900 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 z-10 animate-slideUp"
                  aria-label="Scroll to bottom"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Message Input Area */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
               {showCreditWarning && (
                <div className="absolute bottom-full left-4 right-4 sm:left-6 sm:right-6 mb-3 p-3 sm:p-4 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/50 dark:to-orange-900/50 text-yellow-900 dark:text-yellow-200 text-xs sm:text-sm rounded-xl shadow-xl border border-yellow-200 dark:border-yellow-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-slide-up">
                    <div className="flex items-center">
                      <AlertIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                      <span className="font-semibold">You are about to use your last urgent credit.</span>
                    </div>
                    <button 
                        onClick={onNavigateToBilling}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-lg hover:from-yellow-600 hover:to-orange-600 text-xs flex-shrink-0 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 w-full sm:w-auto text-center"
                    >
                        Purchase More
                    </button>
                </div>
               )}

               {/* Upload Progress */}
               {uploadProgress && (
                 <div className="mb-4 p-4 bg-gradient-to-r from-rose-50 to-rose-50 dark:from-rose-900/20 dark:to-indigo-900/20 rounded-xl border border-sky-200 dark:border-sky-800">
                   <div className="flex items-center justify-between text-sm text-sky-800 dark:text-sky-200 mb-2 font-semibold">
                     <span className="flex items-center">
                       <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Uploading {uploadProgress.fileName}
                     </span>
                     <span>{Math.round(uploadProgress.progress)}%</span>
                   </div>
                   <div className="w-full bg-sky-200 dark:bg-sky-700 rounded-full h-2 overflow-hidden">
                     <div 
                       className="bg-gradient-to-r from-rose-500 to-rose-900 h-2 rounded-full transition-all duration-300"
                       style={{ width: `${uploadProgress.progress}%` }}
                     ></div>
                   </div>
                 </div>
               )}
              <form onSubmit={handleSendMessage} className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:space-x-2">
                {/* Top Row - Action Buttons on Mobile */}
                <div className="flex items-center space-x-1 sm:hidden">
                  <div className="relative group flex-shrink-0">
                    <button
                        type="button"
                        onClick={handleToggleUrgent}
                        disabled={cannotTurnOnUrgent}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          isUrgent 
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label="Toggle urgent message"
                    >
                        <AlertIcon className="h-5 w-5" />
                    </button>
                    {isPatient && (
                      <span className="absolute -top-1 -right-1 text-[10px] bg-gradient-to-r from-rose-500 to-rose-900 text-white font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-lg">
                        {patientData?.urgentCredits}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 flex-shrink-0"
                    aria-label="Attach file"
                  >
                    <DocumentUploadIcon className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAudioRecorder(true)}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 flex-shrink-0"
                    aria-label="Record audio"
                  >
                    <MicrophoneIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Desktop Action Buttons */}
                <div className="hidden sm:flex items-center space-x-2">
                  <div className="relative group flex-shrink-0">
                    <button
                        type="button"
                        onClick={handleToggleUrgent}
                        disabled={cannotTurnOnUrgent}
                        className={`p-2.5 rounded-lg transition-all duration-200 ${
                          isUrgent 
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 scale-110' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95'
                        } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                        aria-label="Toggle urgent message"
                    >
                        <AlertIcon className="h-5 w-5" />
                    </button>
                    {isPatient && (
                      <span className="absolute -top-1 -right-1 text-xs bg-gradient-to-r from-rose-500 to-rose-900 text-white font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-lg">
                        {patientData?.urgentCredits}
                      </span>
                    )}
                    {cannotTurnOnUrgent && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          You have no urgent credits. Please purchase more from the Billing page.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900"></div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="p-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95 transition-all duration-200 flex-shrink-0"
                    aria-label="Attach file"
                  >
                    <DocumentUploadIcon className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAudioRecorder(true)}
                    className="p-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-110 active:scale-95 transition-all duration-200 flex-shrink-0"
                    aria-label="Record audio"
                  >
                    <MicrophoneIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Bottom Row - Input and Send Button */}
                <div className="flex items-center space-x-2 flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      // Trigger typing indicator
                      if (selectedContactId && realTimeChat.startTyping) {
                        realTimeChat.startTyping(selectedContactId);
                      }
                    }}
                    onBlur={() => {
                      // Stop typing when losing focus
                      if (selectedContactId && realTimeChat.stopTyping) {
                        realTimeChat.stopTyping(selectedContactId);
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 px-3 sm:px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="group relative bg-gradient-to-r from-rose-500 to-rose-900 text-white p-2.5 sm:p-3 rounded-xl font-semibold hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex-shrink-0 overflow-hidden"
                    aria-label="Send message"
                  >
                    <span className="relative z-10">
                      <PaperAirplaneIcon className="h-5 w-5"/>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-900 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50 dark:bg-gray-900">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-xl border border-gray-200 dark:border-gray-700">
              <EmptyMessagesIcon className="h-24 w-24 text-gray-400 dark:text-gray-500 mb-6 mx-auto" />
              <h3 className="text-2xl font-display font-bold text-gray-900 dark:text-gray-100 mb-3">Select a Conversation</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">Choose a contact from the list to start chatting and stay connected with your healthcare team.</p>
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