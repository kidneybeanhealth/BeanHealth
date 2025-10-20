import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatService } from '../services/chatService';
import { ChatMessage } from '../types';

export interface UseRealTimeChatOptions {
  currentUserId: string;
  selectedContactId?: string;
  onNewMessage?: (message: ChatMessage) => void;
  onMessageRead?: (messageId: string) => void;
}

export function useRealTimeChat({
  currentUserId,
  selectedContactId,
  onNewMessage,
  onMessageRead
}: UseRealTimeChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set());
  
  const messageChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial messages with retry logic
  const loadMessages = useCallback(async () => {
    try {
      console.log('[Chat] Loading messages for user:', currentUserId);
      
      // Add timeout to prevent hanging
      const loadPromise = ChatService.getAllConversations(currentUserId);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Message load timeout after 10s')), 10000);
      });
      
      const allMessages = await Promise.race([loadPromise, timeoutPromise]);
      
      console.log('[Chat] Loaded messages:', allMessages.length);
      setMessages(allMessages);
      
      // Update unread count (don't let this block)
      ChatService.getUnreadMessageCount(currentUserId)
        .then(unread => {
          setUnreadCount(unread);
          console.log('[Chat] Unread count:', unread);
        })
        .catch(err => {
          console.warn('[Chat] Failed to get unread count:', err);
          setUnreadCount(0);
        });
        
    } catch (error) {
      console.error('[Chat] Error loading messages:', error);
      // Set empty array so UI doesn't hang
      setMessages([]);
      setUnreadCount(0);
    }
  }, [currentUserId]);

  // Send a message with real-time broadcast
  const sendMessage = useCallback(async (
    recipientId: string, 
    text: string, 
    isUrgent: boolean = false
  ): Promise<ChatMessage> => {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    try {
      console.log('[useRealTimeChat] Sending message to:', recipientId, 'Text:', text.substring(0, 50));
      
      // Add optimistic message immediately
      const optimisticMessage: ChatMessage = {
        id: tempId,
        senderId: currentUserId,
        recipientId,
        text,
        audioUrl: null,
        timestamp: new Date().toISOString(),
        isRead: false,
        isUrgent,
        fileUrl: undefined,
        fileName: undefined,
        fileType: undefined,
        fileSize: undefined,
        mimeType: undefined
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setPendingMessages(prev => new Set([...prev, tempId]));
      
      // Set a timeout to clear pending status even if something goes wrong
      const pendingTimeout = setTimeout(() => {
        console.warn('[useRealTimeChat] Message send timeout, clearing pending status');
        setPendingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
      }, 10000); // 10 second timeout
      
      // Send message to database
      const newMessage = await ChatService.sendMessage(currentUserId, recipientId, text, isUrgent);
      console.log('[useRealTimeChat] Message saved to database:', newMessage.id);
      
      // Clear the timeout since we succeeded
      clearTimeout(pendingTimeout);
      
      // Replace optimistic message with real message AND remove from pending
      setMessages(prev => {
        // Remove the temp message and add the real one if not already there
        const withoutTemp = prev.filter(msg => msg.id !== tempId);
        const exists = withoutTemp.find(msg => msg.id === newMessage.id);
        
        if (exists) {
          console.log('[useRealTimeChat] Real message already in state (from subscription)');
          return withoutTemp;
        }
        
        console.log('[useRealTimeChat] Adding real message to state');
        return [...withoutTemp, newMessage];
      });
      
      // Clear pending status
      setPendingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
      
      // Stop typing since we're sending a message
      if (typingChannelRef.current && selectedContactId) {
        await ChatService.broadcastTyping(recipientId, false, currentUserId);
      }
      
      console.log('[useRealTimeChat] Message sent successfully:', newMessage.id);
      return newMessage;
    } catch (error) {
      console.error('[useRealTimeChat] Error sending message:', error);
      
      // Remove failed optimistic message
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setPendingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
      
      throw error;
    }
  }, [currentUserId, selectedContactId]);

  // Mark messages as read
  const markConversationAsRead = useCallback(async (contactId: string) => {
    try {
      await ChatService.markMessagesAsRead(currentUserId, contactId);
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.senderId === contactId && msg.recipientId === currentUserId
          ? { ...msg, isRead: true }
          : msg
      ));
      
      // Update unread count
      const unread = await ChatService.getUnreadMessageCount(currentUserId);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUserId]);

  // Start typing indicator with debouncing
  const startTyping = useCallback(async (recipientId: string) => {
    if (!typingChannelRef.current) return;
    
    try {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Broadcast typing status
      await ChatService.broadcastTyping(recipientId, true, currentUserId);
      console.log('Broadcasting typing to:', recipientId);
      
      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(async () => {
        await ChatService.broadcastTyping(recipientId, false, currentUserId);
        console.log('Auto-stopped typing to:', recipientId);
      }, 3000);
    } catch (error) {
      console.error('Error broadcasting typing:', error);
    }
  }, [currentUserId]);

  // Stop typing indicator
  const stopTyping = useCallback(async (recipientId?: string) => {
    if (!typingChannelRef.current || !recipientId) return;
    
    try {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      await ChatService.broadcastTyping(recipientId, false, currentUserId);
      console.log('Stopped typing to:', recipientId);
    } catch (error) {
      console.error('Error stopping typing:', error);
    }
  }, [currentUserId]);

  // Get conversation messages for selected contact
  const getConversationMessages = useCallback((contactId?: string) => {
    if (!contactId) return [];
    
    return messages
      .filter(msg => 
        (msg.senderId === currentUserId && msg.recipientId === contactId) ||
        (msg.senderId === contactId && msg.recipientId === currentUserId)
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, currentUserId]);

  // Setup real-time message subscription
  useEffect(() => {
    console.log('[Chat] Setting up real-time subscriptions for user:', currentUserId);
    
    const setupMessageSubscription = () => {
      if (messageChannelRef.current) {
        try {
          messageChannelRef.current.unsubscribe();
        } catch (e) {
          console.warn('[Chat] Error unsubscribing from previous channel:', e);
        }
        messageChannelRef.current = null;
      }
      
      try {
        console.log('[Chat] Creating message subscription');
        messageChannelRef.current = ChatService.subscribeToMessages(currentUserId, (newMessage) => {
          console.log('[Chat] Real-time message received:', {
            id: newMessage.id,
            from: newMessage.senderId,
            to: newMessage.recipientId,
            isOwnMessage: newMessage.senderId === currentUserId
          });
          
          // Add new message to state (avoid duplicates)
          setMessages(prev => {
            const exists = prev.find(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('[Chat] Message already exists, skipping duplicate:', newMessage.id);
              return prev;
            }
            
            // Also check if we have a pending temp message that should be replaced
            const hasPending = prev.some(msg => msg.id.startsWith('temp_'));
            if (hasPending && newMessage.senderId === currentUserId) {
              console.log('[Chat] Received own message, replacing any pending temps');
              // Remove temp messages from this user and add the real one
              const withoutTemps = prev.filter(msg => !msg.id.startsWith('temp_'));
              return [...withoutTemps, newMessage];
            }
            
            const updated = [...prev, newMessage];
            console.log('[Chat] Added new message to state, total:', updated.length);
            return updated;
          });
          
          // Clear any pending status since the message came through
          setPendingMessages(prev => {
            if (prev.size > 0) {
              console.log('[Chat] Clearing pending messages');
              return new Set();
            }
            return prev;
          });
          
          // Update unread count only if not from current user
          if (newMessage.senderId !== currentUserId) {
            setUnreadCount(prev => prev + 1);
          }
          
          // Call callback if provided
          if (onNewMessage) {
            onNewMessage(newMessage);
          }
          
          // Auto-mark as read if the conversation is currently open
          if (selectedContactId === newMessage.senderId) {
            setTimeout(() => {
              markConversationAsRead(newMessage.senderId).catch(console.error);
            }, 1000);
          }
        });
        
        setIsConnected(true);
        console.log('[Chat] Message subscription established successfully');
      } catch (error) {
        console.error('[Chat] Failed to setup message subscription:', error);
        setIsConnected(false);
        
        // Retry after 5 seconds
        setTimeout(() => {
          console.log('[Chat] Retrying message subscription...');
          setupMessageSubscription();
        }, 5000);
      }
    };

    const setupTypingSubscription = () => {
      if (typingChannelRef.current) {
        try {
          typingChannelRef.current.unsubscribe();
        } catch (e) {
          console.warn('[Chat] Error unsubscribing from typing channel:', e);
        }
        typingChannelRef.current = null;
      }
      
      try {
        console.log('[Chat] Creating typing subscription');
        typingChannelRef.current = ChatService.subscribeToTyping(currentUserId, (data) => {
          console.log('[Chat] Typing event received:', data);
          
          const { userId, isTyping: userIsTyping, conversationId } = data;
          
          // Don't process typing events from self
          if (userId === currentUserId) {
            return;
          }
          
          // Update typing users
          setTypingUsers(prev => {
            const newTypingUsers = new Set(prev);
            if (userIsTyping) {
              newTypingUsers.add(userId);
              console.log('[Chat] User started typing:', userId);
            } else {
              newTypingUsers.delete(userId);
              console.log('[Chat] User stopped typing:', userId);
            }
            return newTypingUsers;
          });
          
          // Auto-clear typing after 5 seconds as fallback
          if (userIsTyping) {
            setTimeout(() => {
              setTypingUsers(prev => {
                const newTypingUsers = new Set(prev);
                newTypingUsers.delete(userId);
                return newTypingUsers;
              });
            }, 5000);
          }
        });
        
        console.log('[Chat] Typing subscription established successfully');
      } catch (error) {
        console.error('[Chat] Failed to setup typing subscription:', error);
        
        // Retry after 5 seconds (less critical than messages)
        setTimeout(() => {
          console.log('[Chat] Retrying typing subscription...');
          setupTypingSubscription();
        }, 5000);
      }
    };

    // Setup subscriptions immediately
    setupMessageSubscription();
    setupTypingSubscription();

    return () => {
      console.log('[Chat] Cleaning up real-time subscriptions');
      
      // Cleanup message channel
      if (messageChannelRef.current) {
        try {
          messageChannelRef.current.unsubscribe();
        } catch (e) {
          console.warn('[Chat] Error unsubscribing message channel on cleanup:', e);
        }
        messageChannelRef.current = null;
      }
      
      // Cleanup typing channel
      if (typingChannelRef.current) {
        try {
          typingChannelRef.current.unsubscribe();
        } catch (e) {
          console.warn('[Chat] Error unsubscribing typing channel on cleanup:', e);
        }
        typingChannelRef.current = null;
      }
      
      setIsConnected(false);
    };
  }, [currentUserId, selectedContactId, onNewMessage, markConversationAsRead]);

  // Load initial messages on mount
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedContactId) {
      // Small delay to allow UI to update first
      const timer = setTimeout(() => {
        markConversationAsRead(selectedContactId).catch(console.error);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [selectedContactId, markConversationAsRead]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Manually add a message to the state (for file uploads)
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const exists = prev.find(msg => msg.id === message.id);
      if (exists) {
        console.log('Message already exists, skipping duplicate');
        return prev;
      }
      
      const updated = [...prev, message];
      console.log('Manually added message to state, total messages:', updated.length);
      return updated;
    });
  }, []);

  return {
    // State
    messages,
    isConnected,
    unreadCount,
    isTyping,
    typingUsers,
    pendingMessages,
    
    // Actions
    sendMessage,
    markConversationAsRead,
    startTyping,
    stopTyping,
    loadMessages,
    getConversationMessages,
    addMessage,
    
    // Computed values
    conversationMessages: getConversationMessages(selectedContactId)
  };
}