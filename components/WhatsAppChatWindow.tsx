import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { User, ChatMessage, Doctor, Patient } from '../types';
import { EmptyMessagesIcon } from './icons/EmptyMessagesIcon';
import { AlertIcon } from './icons/AlertIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { DocumentUploadIcon } from './icons/DocumentUploadIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { getInitials, getInitialsColor } from '../utils/avatarUtils';
import { useRealTimeChat } from '../hooks/useRealTimeChatV2';
import { TypingIndicator, MessageStatus } from './RealTimeComponents';
import { ChatFilePicker } from './ChatFilePicker';
import { InlineAudioRecorder } from './InlineAudioRecorder';
import { FileMessage } from './FileMessage';
import { FileUploadProgress } from './FileUploader';
import { uploadChatFile, uploadAudioRecording } from '../services/storageService';
import { ChatService } from '../services/chatService';
import { showErrorToast, showSuccessToast, showWarningToast } from '../utils/toastUtils';
import { useUrgentCredits } from '../contexts/UrgentCreditsContext';
import PrescriptionModal from './PrescriptionModal';
import PrescriptionListModal from './PrescriptionListModal';

type Contact = Doctor | Patient;

interface WhatsAppChatWindowProps {
  currentUser: User;
  contacts: Contact[];
  messages: ChatMessage[];
  onSendMessage: (message: Omit<ChatMessage, 'id' | 'timestamp' | 'isRead'>) => void;
  onMarkMessagesAsRead: (contactId: string) => void;
  preselectedContactId: string | null;
  clearPreselectedContact: () => void;
  onNavigateToBilling: () => void;
  onClose?: () => void;
  isFullScreen?: boolean;
}

const WhatsAppChatWindow: React.FC<WhatsAppChatWindowProps> = ({
  currentUser,
  contacts,
  messages: _messages,
  onSendMessage: _onSendMessage,
  onMarkMessagesAsRead: _onMarkMessagesAsRead,
  preselectedContactId,
  clearPreselectedContact,
  onNavigateToBilling,
  onClose,
  isFullScreen = true
}) => {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showPrescriptionListModal, setShowPrescriptionListModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Swipe to close
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchY, setTouchY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const isPatient = currentUser.role === 'patient';
  const isDoctor = currentUser.role === 'doctor';
  const patientData = isPatient ? currentUser : null;

  // Use urgent credits from context
  const urgentCreditsContext = useUrgentCredits();
  const urgentCredits = isPatient ? (urgentCreditsContext.credits ?? currentUser.urgentCredits ?? 0) : 0;
  const hasCredits = urgentCredits > 0;

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

  // Store contacts in local state to ensure persistence
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);

  // Update local contacts when prop changes
  useEffect(() => {
    if (contacts && contacts.length > 0) {
      setLocalContacts(contacts);
    }
  }, [contacts]);

  const sortedContacts = useMemo(() => {
    const contactsToSort = localContacts.length > 0 ? localContacts : contacts;
    if (!contactsToSort || contactsToSort.length === 0) return [];
    
    if (currentUser.role !== 'doctor') return contactsToSort;

    const getUnreadInfo = (contactId: string) => {
      const unreadMessages = messages.filter(m => m.senderId === contactId && m.recipientId === currentUser.id && !m.isRead);
      const hasUrgent = unreadMessages.some(m => m.isUrgent);
      return { count: unreadMessages.length, hasUrgent };
    };

    return [...contactsToSort].sort((a, b) => {
      const aInfo = getUnreadInfo(a.id);
      const bInfo = getUnreadInfo(b.id);

      if (aInfo.hasUrgent && !bInfo.hasUrgent) return -1;
      if (!aInfo.hasUrgent && bInfo.hasUrgent) return 1;
      if (aInfo.count > 0 && bInfo.count === 0) return -1;
      if (aInfo.count === 0 && bInfo.count > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [localContacts, contacts, messages, currentUser.id, currentUser.role]);

  useEffect(() => {
    if (preselectedContactId) {
      setSelectedContactId(preselectedContactId);
      markConversationAsRead(preselectedContactId);
      clearPreselectedContact();
    } else if (sortedContacts.length > 0 && !selectedContactId) {
      const firstContactId = sortedContacts[0].id;
      setSelectedContactId(firstContactId);
      markConversationAsRead(firstContactId);
    }
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

  const checkIfNearBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom < 100;
    }
    return true;
  }, []);

  const handleScroll = useCallback(() => {
    const isNearBottom = checkIfNearBottom();
    setShouldAutoScroll(isNearBottom);
  }, [checkIfNearBottom]);

  useEffect(() => {
    const currentLength = currentConversationMessages.length;
    const isNewMessage = currentLength > previousMessagesLength.current;

    if (isNewMessage && shouldAutoScroll) {
      const timer = setTimeout(() => scrollToBottom(true), 100);
      return () => clearTimeout(timer);
    }

    previousMessagesLength.current = currentLength;
  }, [currentConversationMessages.length, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    if (selectedContactId) {
      setShouldAutoScroll(true);
      previousMessagesLength.current = 0;
      const timer = setTimeout(() => scrollToBottom(false), 50);
      return () => clearTimeout(timer);
    }
  }, [selectedContactId, scrollToBottom]);

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAttachMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.attach-menu-container')) {
          setShowAttachMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachMenu]);

  // Swipe down to close handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isFullScreen) return;
    const touch = e.touches[0];
    setTouchStart(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isFullScreen) return;
    const touch = e.touches[0];
    const diff = touch.clientY - touchStart;
    if (diff > 0) {
      setTouchY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isFullScreen) return;
    if (touchY > 150) {
      handleClose();
    }
    setTouchStart(null);
    setTouchY(0);
    setIsDragging(false);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    markConversationAsRead(contactId);
  };

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

      if (isUrgent && isPatient) {
        urgentCreditsContext.useCredit();
      }
      setIsUrgent(false);

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
      if (urgentCredits === 1 && !isUrgent) {
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
    setUploadProgress({
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    });

    try {
      const fileData = await uploadChatFile(file, currentUser.id, selectedContactId, fileType);

      setUploadProgress({
        fileName: file.name,
        progress: 100,
        status: 'success'
      });

      const sentMessage = await ChatService.sendFileMessage(
        currentUser.id,
        selectedContactId,
        fileData.fileUrl,
        fileData.fileName,
        fileType,
        fileData.fileSize,
        fileData.mimeType,
        undefined,
        isUrgent
      );

      if (realTimeChat.addMessage) {
        realTimeChat.addMessage(sentMessage);
      }

      setIsUrgent(false);
      showSuccessToast('File sent successfully');

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
    setIsRecordingAudio(false);
    setUploadProgress({
      fileName: 'Voice message',
      progress: 0,
      status: 'uploading'
    });

    try {
      const audioData = await uploadAudioRecording(audioBlob, currentUser.id, selectedContactId, duration);

      setUploadProgress({
        fileName: 'Voice message',
        progress: 100,
        status: 'success'
      });

      const sentMessage = await ChatService.sendFileMessage(
        currentUser.id,
        selectedContactId,
        audioData.fileUrl,
        audioData.fileName,
        'audio',
        audioData.fileSize,
        audioData.mimeType,
        undefined,
        isUrgent
      );

      if (realTimeChat.addMessage) {
        realTimeChat.addMessage(sentMessage);
      }

      setIsUrgent(false);
      showSuccessToast('Voice message sent successfully');

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

      setTimeout(() => {
        setUploadProgress(null);
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const getFileType = (file: File): 'pdf' | 'image' | 'audio' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'pdf';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = getFileType(file);
      handleFileUpload(file, type);
    }
    e.target.value = '';
  };

  const selectedContact = contacts.find(d => d.id === selectedContactId);
  const cannotTurnOnUrgent = isPatient && !hasCredits && !isUrgent;

  // Format time for messages
  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format time for contact list
  const formatContactTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Initials Avatar
  const InitialsAvatar = ({ contact, size = 'md', showOnlineStatus = false }: { contact: Contact; size?: 'sm' | 'md' | 'lg'; inverted?: boolean; showOnlineStatus?: boolean }) => {
    const initials = getInitials(contact.name, contact.email);
    const sizeClasses = {
      sm: 'h-10 w-10 text-sm',
      md: 'h-12 w-12 text-base',
      lg: 'h-14 w-14 text-lg'
    };

    return (
      <div className="relative">
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold bg-gradient-to-br from-[#8AC43C] to-[#6B9F2E] text-white shadow-lg`}>
          {initials}
        </div>
        {showOnlineStatus && isConnected && (
          <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-[#25D366] ring-2 ring-white dark:ring-[#1a1a1a]"></span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] flex flex-col transition-all duration-300 ease-out ${isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        }`}
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available',
        transform: isDragging && touchY > 0 ? `translateY(${touchY}px)` : undefined,
        transition: isDragging ? 'none' : undefined
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'
          }`}
        onClick={handleClose}
      />

      {/* Chat Container - with safe area padding inside */}
      <div
        className="relative flex flex-col w-full h-full max-h-full bg-gray-50 dark:bg-[#111B21] overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Contact List - Hidden on mobile when contact selected */}
          <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-[#2A3942] flex flex-col ${selectedContactId ? 'hidden md:flex' : 'flex'
            } bg-white dark:bg-[#111B21]`}>
            {/* Contact List Header */}
            <div className="px-3 py-2.5 bg-[#F0F2F5] dark:bg-[#202C33] flex items-center justify-between border-b border-gray-100 dark:border-[#2A3942] flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="p-1.5 -ml-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#374045] transition-colors"
                >
                  <ArrowLeftIcon className="h-5 w-5 text-[#54656F] dark:text-[#AEBAC1]" />
                </button>
                <h2 className="text-base font-semibold text-[#111B21] dark:text-[#E9EDEF]">Chats</h2>
              </div>
              <span className="text-[11px] text-[#667781] dark:text-[#8696A0] font-medium">
                {sortedContacts.length} {sortedContacts.length === 1 ? 'Patient' : 'Patients'}
              </span>
            </div>

            {/* Contact Search (simplified) */}
            <div className="px-3 py-2 bg-white dark:bg-[#111B21]">
              <div className="flex items-center gap-3 px-3 py-2 bg-[#F0F2F5] dark:bg-[#202C33] rounded-lg">
                <svg className="h-4 w-4 text-[#54656F] dark:text-[#AEBAC1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search or start new chat"
                  className="flex-1 bg-transparent text-sm text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none"
                />
              </div>
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto">
              {sortedContacts.map(contact => {
                const unreadMessages = messages.filter(m => m.senderId === contact.id && m.recipientId === currentUser.id && !m.isRead);
                const hasUnreadUrgent = unreadMessages.some(m => m.isUrgent);
                const hasUnread = unreadMessages.length > 0;

                const contactMessages = messages.filter(m =>
                  (m.senderId === contact.id && m.recipientId === currentUser.id) ||
                  (m.senderId === currentUser.id && m.recipientId === contact.id)
                ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const lastMessage = contactMessages[0];
                const lastMessageText = lastMessage?.text || (lastMessage?.audioUrl ? '🎤 Voice message' : (lastMessage?.fileUrl ? '📎 Attachment' : ''));
                const isOwnMessage = lastMessage?.senderId === currentUser.id;

                return (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact.id)}
                    className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors ${selectedContactId === contact.id
                      ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
                      : 'hover:bg-[#F5F6F6] dark:hover:bg-[#202C33]'
                      }`}
                  >
                    <InitialsAvatar contact={contact} size="md" showOnlineStatus />

                    <div className="flex-1 min-w-0 border-b border-gray-100 dark:border-[#2A3942] pb-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF] truncate">
                          {contact.name}
                        </p>
                        {lastMessage && (
                          <span className={`text-xs flex-shrink-0 ${hasUnread ? 'text-[#25D366] font-semibold' : 'text-[#667781] dark:text-[#8696A0]'
                            }`}>
                            {formatContactTime(lastMessage.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-sm text-[#667781] dark:text-[#8696A0] truncate flex items-center gap-1">
                          {isOwnMessage && (
                            <svg className={`h-4 w-4 flex-shrink-0 ${lastMessage?.isRead ? 'text-[#53BDEB]' : 'text-[#667781]'}`} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              {lastMessage?.isRead && <path d="M5 16.17L0.83 12l-1.42 1.41L5 19 17 7l-1.41-1.41z" style={{ transform: 'translateX(5px)' }} />}
                            </svg>
                          )}
                          {lastMessageText ? lastMessageText.substring(0, 40) + (lastMessageText.length > 40 ? '...' : '') : ((contact as Doctor).specialty || 'Tap to chat')}
                        </p>
                        {hasUnread && (
                          <span className={`text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center ${hasUnreadUrgent ? 'bg-red-500' : 'bg-[#25D366]'
                            } text-white`}>
                            {unreadMessages.length > 9 ? '9+' : unreadMessages.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Panel */}
          <div className={`flex-1 flex flex-col ${selectedContactId ? 'flex' : 'hidden md:flex'} min-h-0`}>
            {selectedContact ? (
              <>
                {/* Chat Header - WhatsApp Style */}
                <div className="px-2 sm:px-4 py-2 bg-[#F0F2F5] dark:bg-[#202C33] flex items-center gap-2 sm:gap-3 border-b border-gray-100 dark:border-[#2A3942] flex-shrink-0">
                  <button
                    onClick={() => setSelectedContactId(null)}
                    className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#374045] transition-colors flex-shrink-0"
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-[#54656F] dark:text-[#AEBAC1]" />
                  </button>

                  <InitialsAvatar contact={selectedContact} size="sm" showOnlineStatus />

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF] truncate">{selectedContact.name}</h3>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">
                      {typingUsers.has(selectedContact.id) ? (
                        <span className="text-[#25D366]">typing...</span>
                      ) : isConnected ? 'online' : 'offline'}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <button
                      onClick={() => setShowPrescriptionListModal(true)}
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#374045] transition-colors"
                      title="View Prescriptions"
                    >
                      <DocumentIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#54656F] dark:text-[#AEBAC1]" />
                    </button>

                    {isDoctor && selectedContact.role === 'patient' && (
                      <button
                        onClick={() => setShowPrescriptionModal(true)}
                        className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-[#25D366] text-white text-[11px] sm:text-xs font-bold rounded-full hover:bg-[#1EBE5A] transition-colors"
                      >
                        <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">New Rx</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Area - Clean Background */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-gray-100 dark:bg-[#0B141A]"
                >
                  <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-1">
                    {currentConversationMessages.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#25D366]/10 mb-4">
                          <svg className="w-10 h-10 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <h4 className="text-base font-semibold text-[#111B21] dark:text-[#E9EDEF] mb-1">Start a conversation</h4>
                        <p className="text-sm text-[#667781] dark:text-[#8696A0]">Send a message to {selectedContact.name}</p>
                      </div>
                    ) : (
                      currentConversationMessages.map((msg, index) => {
                        const isCurrentUser = msg.senderId === currentUser.id;
                        const showDate = index === 0 ||
                          new Date(currentConversationMessages[index - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();

                        return (
                          <React.Fragment key={msg.id}>
                            {showDate && (
                              <div className="flex justify-center py-2">
                                <span className="px-3 py-1 bg-white/80 dark:bg-[#1F2C34] text-xs text-[#667781] dark:text-[#8696A0] rounded-lg shadow-sm">
                                  {new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            )}

                            <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-0.5`}>
                              <div
                                className={`relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm ${isCurrentUser
                                  ? 'bg-[#D9FDD3] dark:bg-[#005C4B] rounded-tr-none'
                                  : 'bg-white dark:bg-[#202C33] rounded-tl-none'
                                  } ${msg.isUrgent ? 'ring-2 ring-red-500' : ''} ${pendingMessages.has(msg.id) ? 'opacity-70' : ''
                                  }`}
                              >
                                {/* WhatsApp-style tail */}
                                <div
                                  className={`absolute top-0 ${isCurrentUser ? '-right-2' : '-left-2'} w-0 h-0`}
                                  style={{
                                    borderTop: isCurrentUser
                                      ? '8px solid var(--tail-out, #D9FDD3)'
                                      : '8px solid var(--tail-in, white)',
                                    borderRight: isCurrentUser ? 'none' : '8px solid transparent',
                                    borderLeft: isCurrentUser ? '8px solid transparent' : 'none',
                                    ['--tail-out' as any]: '#D9FDD3',
                                    ['--tail-in' as any]: 'white',
                                  }}
                                />

                                {msg.isUrgent && (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full mb-1 uppercase">
                                    <AlertIcon className="h-2.5 w-2.5" />
                                    Urgent
                                  </div>
                                )}

                                {msg.fileUrl ? (
                                  <FileMessage message={msg} isCurrentUser={isCurrentUser} />
                                ) : msg.text && (
                                  <p className={`text-sm whitespace-pre-wrap break-words ${isCurrentUser ? 'text-[#111B21] dark:text-[#E9EDEF]' : 'text-[#111B21] dark:text-[#E9EDEF]'
                                    }`}>
                                    {msg.text}
                                  </p>
                                )}

                                <div className={`flex items-center justify-end gap-1 mt-0.5 -mb-0.5 ${isCurrentUser ? '' : ''}`}>
                                  <span className={`text-[10px] ${isCurrentUser ? 'text-[#667781] dark:text-[#8696A0]' : 'text-[#667781] dark:text-[#8696A0]'
                                    }`}>
                                    {formatMessageTime(msg.timestamp)}
                                  </span>
                                  {isCurrentUser && (
                                    <svg className={`h-4 w-4 ${msg.isRead ? 'text-[#53BDEB]' : 'text-[#667781]'}`} fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Scroll to Bottom FAB */}
                  {!shouldAutoScroll && currentConversationMessages.length > 0 && (
                    <button
                      onClick={() => {
                        setShouldAutoScroll(true);
                        scrollToBottom(true);
                      }}
                      className="fixed bottom-24 right-6 p-3 bg-white dark:bg-[#202C33] rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform z-10"
                      aria-label="Scroll to bottom"
                    >
                      <svg className="w-5 h-5 text-[#54656F] dark:text-[#AEBAC1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Message Input - WhatsApp Style */}
                <div className="px-3 sm:px-4 py-2 sm:py-3 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-gray-100 dark:border-[#2A3942] flex-shrink-0">
                  {showCreditWarning && (
                    <div className="mb-2 sm:mb-3 p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-[11px] sm:text-xs rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium">Last urgent credit</span>
                      </div>
                      <button
                        onClick={onNavigateToBilling}
                        className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full hover:bg-amber-600 transition-colors uppercase"
                      >
                        Buy More
                      </button>
                    </div>
                  )}

                  {uploadProgress && (
                    <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
                      <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 mb-1.5">
                        <span className="flex items-center gap-1.5 font-medium">
                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {uploadProgress.fileName}
                        </span>
                        <span className="font-bold">{Math.round(uploadProgress.progress)}%</span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1 overflow-hidden">
                        <div className="bg-blue-600 dark:bg-blue-400 h-1 rounded-full transition-all" style={{ width: `${uploadProgress.progress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {isRecordingAudio ? (
                      <div className="flex-1">
                        <InlineAudioRecorder
                          onRecordingComplete={handleAudioRecording}
                          onCancel={() => setIsRecordingAudio(false)}
                        />
                      </div>
                    ) : (
                      <>
                        {/* Input Container */}
                        <div className="flex-1 flex items-center bg-white dark:bg-[#2A3942] rounded-full px-2 sm:px-3 py-0.5 sm:py-1 min-h-[40px] sm:min-h-[44px]">
                          {/* Urgent Button */}
                          <div className="relative flex-shrink-0 mr-0.5 sm:mr-1">
                            <button
                              type="button"
                              onClick={handleToggleUrgent}
                              disabled={cannotTurnOnUrgent}
                              className={`p-1 sm:p-1.5 rounded-full transition-colors ${isUrgent
                                ? 'bg-red-500 text-white'
                                : 'text-[#54656F] dark:text-[#8696A0] hover:text-red-500'
                                } disabled:opacity-40`}
                              aria-label="Toggle urgent"
                            >
                              <AlertIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            {isPatient && (
                              <span className="absolute -top-1 -right-1 text-[8px] sm:text-[9px] bg-[#25D366] text-white font-bold rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 flex items-center justify-center ring-2 ring-white dark:ring-[#2A3942]">
                                {urgentCredits}
                              </span>
                            )}
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e as any);
                              }
                            }}
                            placeholder="Type a message"
                            className="flex-1 px-1.5 sm:px-2 py-2 text-[13px] sm:text-sm bg-transparent border-0 focus:outline-none text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0]"
                          />

                          {/* Attach Menu */}
                          <div className="relative attach-menu-container flex-shrink-0 ml-0.5 sm:ml-1">
                            <button
                              type="button"
                              onClick={() => setShowAttachMenu(!showAttachMenu)}
                              className="p-1 sm:p-1.5 rounded-full text-[#54656F] dark:text-[#8696A0] hover:text-[#111B21] dark:hover:text-[#E9EDEF] transition-colors"
                              aria-label="Attach"
                            >
                              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            </button>

                            {showAttachMenu && (
                              <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#233138] rounded-lg shadow-lg border border-gray-100 dark:border-[#2A3942] overflow-hidden z-50 min-w-[120px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    fileInputRef.current?.click();
                                    setShowAttachMenu(false);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#182229] transition-colors text-xs text-[#111B21] dark:text-[#E9EDEF]"
                                >
                                  <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                                    <DocumentUploadIcon className="h-3.5 w-3.5 text-white" />
                                  </div>
                                  <span>Document</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowAttachMenu(false)}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#182229] transition-colors text-xs text-[#111B21] dark:text-[#E9EDEF]"
                                >
                                  <div className="w-7 h-7 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </div>
                                  <span>Camera</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Send/Voice Button - Outside the input container */}
                        {input.trim() ? (
                          <button
                            type="button"
                            onClick={(e) => handleSendMessage(e as any)}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#25D366] text-white hover:bg-[#1EBE5A] active:scale-95 transition-all flex-shrink-0 flex items-center justify-center"
                            aria-label="Send"
                          >
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsRecordingAudio(true)}
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#25D366] text-white hover:bg-[#1EBE5A] active:scale-95 transition-all flex-shrink-0 flex items-center justify-center"
                            aria-label="Record voice"
                          >
                            <MicrophoneIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#F0F2F5] dark:bg-[#222E35]">
                <div className="text-center px-8 max-w-md">
                  <div className="w-64 h-64 mx-auto mb-6 opacity-40">
                    <svg viewBox="0 0 303 172" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M229.565 160.229C262.212 149.245 286.931 118.241 283.39 73.4194C278.009 5.31929 210.365 -7.82849 151.972 3.51189C93.5765 14.8523 19.6984 28.2813 3.65728 80.1579C-12.3839 132.034 34.6238 177.275 97.158 171.174C159.692 165.073 196.917 171.213 229.565 160.229Z" fill="#DAF7C3" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-light text-[#41525D] dark:text-[#E9EDEF] mb-4">BeanHealth Chat</h3>
                  <p className="text-sm text-[#667781] dark:text-[#8696A0] leading-relaxed">
                    Send and receive messages securely with your healthcare providers. Select a chat to get started.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,image/*,audio/*"
      />

      {/* Prescription Modal */}
      {isDoctor && selectedContact && selectedContact.role === 'patient' && (
        <PrescriptionModal
          isOpen={showPrescriptionModal}
          onClose={() => setShowPrescriptionModal(false)}
          doctor={currentUser as Doctor}
          patient={selectedContact as Patient}
          onPrescriptionSent={() => setShowPrescriptionModal(false)}
        />
      )}

      {/* Prescription List Modal */}
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

export default WhatsAppChatWindow;
