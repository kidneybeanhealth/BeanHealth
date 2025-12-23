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
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showPrescriptionListModal, setShowPrescriptionListModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPatient = currentUser.role === 'patient';
  const isDoctor = currentUser.role === 'doctor';
  const patientData = isPatient ? currentUser : null;

  // Use urgent credits from context (real-time updates) with fallback to user prop
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

      // If urgent was used, trigger optimistic UI update
      if (isUrgent && isPatient) {
        urgentCreditsContext.useCredit();
      }
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
    setIsRecordingAudio(false); // Close the recorder
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

  const getFileType = (file: File): 'pdf' | 'image' | 'audio' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'pdf'; // fallback
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = getFileType(file);
      handleFileUpload(file, type);
    }
    // Reset input so the same file can be chose again
    e.target.value = '';
  };

  // Create initials avatar component
  const InitialsAvatar = ({ contact, size = 'md', inverted = false }: { contact: Contact; size?: 'sm' | 'md' | 'lg'; inverted?: boolean }) => {
    const initials = getInitials(contact.name, contact.email);
    const colorClass = getInitialsColor(contact.name, contact.email);
    const sizeClasses = getInitialsAvatarClasses(size);

    // Build size classes without the text-white from base (we'll set our own text color)
    const baseSizeClasses = {
      sm: 'h-8 w-8 text-sm',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base'
    };

    return (
      <div className={`${baseSizeClasses[size]} rounded-full flex items-center justify-center font-medium ${inverted
        ? 'bg-white dark:bg-[#222] text-[#222] dark:text-white'
        : 'bg-[#222222] dark:bg-white text-white dark:text-[#222222]'
        }`}>
        <span className="font-bold">
          {initials}
        </span>
      </div>
    );
  };

  const selectedContact = contacts.find(d => d.id === selectedContactId);

  const cannotTurnOnUrgent = isPatient && !hasCredits && !isUrgent;

  return (
    <div className="flex flex-col h-full md:flex-row bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md md:rounded-3xl overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_0_20px_rgba(138,196,60,0.1)] border-0 md:border border-gray-200/60 dark:border-[#8AC43C]/20">
      {/* Mobile-only Header */}
      {!selectedContactId && onMenuClick && (
        <div className="md:hidden sticky top-0 z-20 px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 flex items-center bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md">
          <h1 className="text-lg font-bold text-[#222] dark:text-white">Messages</h1>
        </div>
      )}

      {/* Contact List Panel */}
      <div className={`w-full md:w-72 lg:w-80 border-r border-gray-200 dark:border-[#8AC43C]/25 flex flex-col ${selectedContactId ? 'hidden md:flex' : 'flex'} min-h-0 bg-white dark:bg-[#8AC43C]/[0.02]`}>
        {/* Sidebar Header */}
        <div className="hidden md:flex px-5 py-3.5 border-b border-gray-200 dark:border-[#8AC43C]/25 flex-shrink-0 bg-white dark:bg-transparent h-[73px] flex-col justify-center">
          <h3 className="text-xl font-bold text-[#222] dark:text-white tracking-tight">Messages</h3>
          <p className="text-[10px] text-[#717171] dark:text-[#888] font-medium uppercase tracking-wider mt-0.5">{sortedContacts.length} {sortedContacts.length === 1 ? 'conversation' : 'conversations'}</p>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          <div className="py-3 px-3 space-y-1">
            {sortedContacts.map(contact => {
              const unreadMessages = messages.filter(m => m.senderId === contact.id && m.recipientId === currentUser.id && !m.isRead);
              const hasUnreadUrgent = unreadMessages.some(m => m.isUrgent);
              const hasUnread = unreadMessages.length > 0;

              // Get last message for preview
              const contactMessages = messages.filter(m =>
                (m.senderId === contact.id && m.recipientId === currentUser.id) ||
                (m.senderId === currentUser.id && m.recipientId === contact.id)
              ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              const lastMessage = contactMessages[0];
              const lastMessageText = lastMessage?.text || (lastMessage?.audioUrl ? '🎤 Voice message' : (lastMessage?.fileUrl ? '📎 Attachment' : ''));
              const isOwnMessage = lastMessage?.senderId === currentUser.id;

              // Format timestamp
              const formatTime = (timestamp: string) => {
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

              return (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact.id)}
                  className={`group w-full text-left px-3.5 py-3 flex items-center gap-3 rounded-2xl transition-all duration-200 ${selectedContactId === contact.id
                    ? 'bg-[#222] dark:bg-white shadow-md'
                    : hasUnread
                      ? 'bg-[#8AC43C]/5 dark:bg-[#8AC43C]/10 hover:bg-[#8AC43C]/10 dark:hover:bg-[#8AC43C]/15 border border-[#8AC43C]/20'
                      : 'bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#8AC43C]/20 shadow-sm'
                    }`}
                >
                  <div className="relative flex-shrink-0">
                    <InitialsAvatar contact={contact} size="md" inverted={selectedContactId === contact.id} />
                    <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-[#8AC43C] ring-2 ${selectedContactId === contact.id ? 'ring-[#222] dark:ring-white' : 'ring-white dark:ring-[#1e1e1e]'}`}></span>
                    {hasUnreadUrgent && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 ring-2 ring-white dark:ring-[#1e1e1e]"></span>
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${selectedContactId === contact.id
                        ? 'text-white dark:text-[#222] font-semibold'
                        : hasUnread
                          ? 'text-[#222] dark:text-white font-bold'
                          : 'text-[#222] dark:text-white font-medium'
                        }`}>
                        {contact.name}
                      </p>
                      {lastMessage && (
                        <span className={`text-[10px] flex-shrink-0 ${selectedContactId === contact.id
                          ? 'text-gray-300 dark:text-gray-500'
                          : hasUnread
                            ? 'text-[#8AC43C] font-semibold'
                            : 'text-[#717171] dark:text-[#888]'
                          }`}>
                          {formatTime(lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${selectedContactId === contact.id
                      ? 'text-gray-300 dark:text-gray-500'
                      : hasUnread
                        ? 'text-[#222] dark:text-white font-medium'
                        : 'text-[#717171] dark:text-[#888]'
                      }`}>
                      {lastMessageText ? (
                        <>
                          {isOwnMessage && <span className="text-[#717171] dark:text-[#666]">You: </span>}
                          {lastMessageText.substring(0, 35)}{lastMessageText.length > 35 ? '...' : ''}
                        </>
                      ) : (
                        (contact as Doctor).specialty || (contact as Patient).condition
                      )}
                    </p>
                  </div>

                  {hasUnread && !hasUnreadUrgent && (
                    <span className={`text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center flex-shrink-0 ${selectedContactId === contact.id
                      ? 'bg-white/20 text-white dark:bg-[#222]/20 dark:text-[#222]'
                      : 'bg-[#8AC43C] text-white'
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
      <div className={`w-full md:flex-1 flex flex-col ${selectedContactId ? 'flex' : 'hidden md:flex'} min-h-0 bg-white dark:bg-transparent`}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-gray-200 dark:border-[#8AC43C]/25 flex items-center flex-shrink-0 bg-white dark:bg-[#8AC43C]/[0.02] h-[73px]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => setSelectedContactId(null)}
                  className="md:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <ArrowLeftIcon className="h-5 w-5 text-[#222] dark:text-white" />
                </button>

                <div className="relative flex-shrink-0">
                  <InitialsAvatar contact={selectedContact} size="md" />
                  {isConnected && (
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-[#8AC43C] ring-2 ring-white dark:ring-[#1a1a1a]"></span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#222] dark:text-white truncate">{selectedContact.name}</h3>
                  {typingUsers.has(selectedContact.id) && (
                    <TypingIndicator isTyping={true} userName={selectedContact.name} />
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setShowPrescriptionListModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#222] dark:text-white bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="View E-Prescriptions"
                >
                  <DocumentIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Rx</span>
                </button>

                {isDoctor && selectedContact.role === 'patient' && (
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-[#8AC43C] rounded-full hover:opacity-90 transition-opacity"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">New Rx</span>
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto min-h-0 bg-gray-50 dark:bg-transparent flex flex-col"
            >
              <div className="flex-1"></div>
              <div className="px-3 py-4">
                <div className="space-y-4">
                  {currentConversationMessages.length === 0 ? (
                    <div className="text-center py-16 animate-fade-in">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                        <svg className="w-8 h-8 text-[#717171] dark:text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h4 className="text-base font-bold text-[#222] dark:text-white mb-1">Start a conversation</h4>
                      <p className="text-xs text-[#717171] dark:text-[#888]">Send a message to begin</p>
                    </div>
                  ) : (
                    currentConversationMessages.map((msg, index) => {
                      const isCurrentUser = msg.senderId === currentUser.id;
                      const messageContact = isCurrentUser ? currentUser : selectedContact;

                      return (
                        <div key={msg.id} className={`flex items-start gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`} style={{ animationDelay: `${index * 15}ms` }}>
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrentUser
                              ? 'bg-[#222] dark:bg-white text-white dark:text-[#222]'
                              : 'bg-gray-200 dark:bg-gray-700 text-[#222] dark:text-white'
                              }`}>
                              {messageContact ? getInitials(messageContact.name, messageContact.email) : '?'}
                            </div>
                          </div>

                          {/* Message Content */}
                          <div className={`max-w-[75%] sm:max-w-[65%]`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm break-words ${isCurrentUser
                              ? 'bg-[#8AC43C] text-white rounded-br-sm shadow-sm'
                              : 'bg-gray-100 dark:bg-[#2a2a2a] text-[#222] dark:text-white rounded-bl-sm'
                              } ${msg.isUrgent ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-[#141414]' : ''} ${pendingMessages.has(msg.id) ? 'opacity-60' : ''
                              }`}>
                              {msg.isUrgent && (
                                <div className="inline-flex items-center px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full mb-1.5 uppercase tracking-wide">
                                  <AlertIcon className="h-2.5 w-2.5 mr-1" />
                                  Urgent
                                </div>
                              )}
                              {msg.fileUrl ? (
                                <FileMessage message={msg} isCurrentUser={isCurrentUser} />
                              ) : msg.text && (
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              )}
                            </div>
                            <div className={`text-[10px] text-[#999] mt-1 px-1 flex items-center gap-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                              {isCurrentUser && (
                                <MessageStatus isRead={msg.isRead} timestamp={msg.timestamp} isUrgent={msg.isUrgent} />
                              )}
                              {!isCurrentUser && (
                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                              {pendingMessages.has(msg.id) && (
                                <span className="inline-flex items-center">
                                  <svg className="animate-spin h-2.5 w-2.5 mr-0.5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Scroll to Bottom Button */}
              {!shouldAutoScroll && currentConversationMessages.length > 0 && (
                <button
                  onClick={() => {
                    setShouldAutoScroll(true);
                    scrollToBottom(true);
                  }}
                  className="fixed bottom-28 right-4 p-2.5 bg-[#8AC43C] text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform z-10"
                  aria-label="Scroll to bottom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}
            </div>

            {/* Message Input Area */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-[#8AC43C]/25 bg-white dark:bg-[#8AC43C]/[0.02] flex-shrink-0">
              {showCreditWarning && (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">Last urgent credit</span>
                  </div>
                  <button
                    onClick={onNavigateToBilling}
                    className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full hover:bg-amber-600 transition-colors uppercase tracking-wide"
                  >
                    Buy More
                  </button>
                </div>
              )}

              {uploadProgress && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50">
                  <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 mb-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {uploadProgress.fileName}
                    </span>
                    <span className="font-bold">{Math.round(uploadProgress.progress)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress.progress}%` }} />
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                {isRecordingAudio ? (
                  <InlineAudioRecorder
                    onRecordingComplete={handleAudioRecording}
                    onCancel={() => setIsRecordingAudio(false)}
                  />
                ) : (
                  <div className="flex-1 flex items-center bg-gray-100 dark:bg-[#252525] rounded-full px-1">
                    {/* Urgent Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleToggleUrgent}
                        disabled={cannotTurnOnUrgent}
                        className={`p-2 rounded-full transition-colors ${isUrgent
                          ? 'bg-red-500 text-white'
                          : 'text-[#717171] hover:text-red-500'
                          } disabled:opacity-40`}
                        aria-label="Toggle urgent"
                      >
                        <AlertIcon className="h-4 w-4" />
                      </button>
                      {isPatient && patientData && (
                        <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-[#8AC43C] text-white font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center ring-2 ring-gray-100 dark:ring-[#252525]">
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
                      placeholder="Message"
                      className="flex-1 px-3 py-2.5 text-sm bg-transparent border-0 focus:outline-none text-[#222] dark:text-white placeholder-[#999]"
                    />

                    {/* Attach Menu */}
                    <div className="relative attach-menu-container">
                      <button
                        type="button"
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className="p-2 rounded-full text-[#717171] hover:text-[#222] dark:hover:text-white transition-colors"
                        aria-label="Attach"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>

                      {showAttachMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-40 bg-white dark:bg-[#252525] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50">
                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click();
                              setShowAttachMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-[#222] dark:text-white"
                          >
                            <DocumentUploadIcon className="h-4 w-4 text-[#8AC43C]" />
                            <span>Upload File</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAttachMenu(false)}
                            className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-[#222] dark:text-white border-t border-gray-100 dark:border-gray-800"
                          >
                            <svg className="h-4 w-4 text-[#8AC43C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Camera</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Send/Voice Button - Only show when not recording */}
                {!isRecordingAudio && (
                  input.trim() ? (
                    <button
                      type="submit"
                      className="p-2.5 rounded-full bg-[#8AC43C] text-white hover:opacity-90 active:scale-95 transition-all"
                      aria-label="Send"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRecordingAudio(true)}
                      className="p-2.5 rounded-full bg-[#8AC43C] text-white hover:opacity-90 active:scale-95 transition-all"
                      aria-label="Record voice"
                    >
                      <MicrophoneIcon className="h-5 w-5" />
                    </button>
                  )
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50/30 dark:bg-[#141414]">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl p-10 border border-gray-200/60 dark:border-gray-700/60 max-w-sm shadow-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <EmptyMessagesIcon className="h-8 w-8 text-[#717171] dark:text-[#888]" />
              </div>
              <h3 className="text-lg font-bold text-[#222] dark:text-white mb-2">Select a conversation</h3>
              <p className="text-xs text-[#717171] dark:text-[#888] leading-relaxed">Choose a contact from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,image/*,audio/*"
      />

      {/* Prescription Modal - Only for doctors */}
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

export default Messages;