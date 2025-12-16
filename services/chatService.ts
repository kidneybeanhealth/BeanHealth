import { supabase } from '../lib/supabase'
import { ChatMessage } from '../types'

export class ChatService {
  static async getConversation(userId: string, otherUserId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('timestamp', { ascending: true })

    if (error) throw error

    return data.map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      recipientId: msg.recipient_id,
      text: msg.text,
      audioUrl: msg.audio_url,
      timestamp: msg.timestamp,
      isRead: msg.is_read,
      isUrgent: msg.is_urgent,
      fileUrl: msg.file_url,
      fileName: msg.file_name,
      fileType: msg.file_type,
      fileSize: msg.file_size,
      mimeType: msg.mime_type
    }))
  }

  static async getAllConversations(userId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('timestamp', { ascending: false })

    if (error) throw error

    return data.map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      recipientId: msg.recipient_id,
      text: msg.text,
      audioUrl: msg.audio_url,
      timestamp: msg.timestamp,
      isRead: msg.is_read,
      isUrgent: msg.is_urgent,
      fileUrl: msg.file_url,
      fileName: msg.file_name,
      fileType: msg.file_type,
      fileSize: msg.file_size,
      mimeType: msg.mime_type
    }))
  }

  static async sendMessage(senderId: string, recipientId: string, text: string, isUrgent: boolean = false) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        text,
        is_urgent: isUrgent,
        is_read: false
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      senderId: data.sender_id,
      recipientId: data.recipient_id,
      text: data.text,
      audioUrl: data.audio_url,
      timestamp: data.timestamp,
      isRead: data.is_read,
      isUrgent: data.is_urgent,
      fileUrl: data.file_url,
      fileName: data.file_name,
      fileType: data.file_type,
      fileSize: data.file_size,
      mimeType: data.mime_type
    } as ChatMessage
  }

  static async sendFileMessage(
    senderId: string, 
    recipientId: string, 
    fileUrl: string,
    fileName: string,
    fileType: 'pdf' | 'image' | 'audio',
    fileSize: number,
    mimeType: string,
    text?: string,
    isUrgent: boolean = false
  ) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        text: text || null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        mime_type: mimeType,
        is_urgent: isUrgent,
        is_read: false
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      senderId: data.sender_id,
      recipientId: data.recipient_id,
      text: data.text,
      audioUrl: data.audio_url,
      timestamp: data.timestamp,
      isRead: data.is_read,
      isUrgent: data.is_urgent,
      fileUrl: data.file_url,
      fileName: data.file_name,
      fileType: data.file_type,
      fileSize: data.file_size,
      mimeType: data.mime_type
    } as ChatMessage
  }

  static async markMessageAsRead(messageId: string) {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('id', messageId)

    if (error) throw error
  }

  static async markMessagesAsRead(userId: string, senderId: string) {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('sender_id', senderId)
      .eq('is_read', false)

    if (error) throw error
  }

  static async markConversationAsRead(userId: string, otherUserId: string) {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (error) throw error
  }

  static subscribeToMessages(userId: string, callback: (message: ChatMessage) => void) {
    const channelName = `chat_messages_${userId}_${Date.now()}`;
    console.log(`[ChatService] Creating subscription channel: ${channelName}`);
    
    const transformMessage = (msg: any): ChatMessage => ({
      id: msg.id,
      senderId: msg.sender_id,
      recipientId: msg.recipient_id,
      text: msg.text || null,
      audioUrl: msg.audio_url || null,
      timestamp: msg.timestamp,
      isRead: msg.is_read || false,
      isUrgent: msg.is_urgent || false,
      fileUrl: msg.file_url || undefined,
      fileName: msg.file_name || undefined,
      fileType: msg.file_type || undefined,
      fileSize: msg.file_size || undefined,
      mimeType: msg.mime_type || undefined
    });
    
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: userId }
        }
      })
      // Listen for messages where user is RECIPIENT
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          console.log('[ChatService] Real-time RECEIVED message:', payload.new);
          try {
            const message = transformMessage(payload.new);
            callback(message);
          } catch (error) {
            console.error('[ChatService] Error processing received message:', error);
          }
        }
      )
      // Listen for messages where user is SENDER (for confirmation)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `sender_id=eq.${userId}`
        },
        (payload) => {
          console.log('[ChatService] Real-time SENT message confirmation:', payload.new);
          try {
            const message = transformMessage(payload.new);
            callback(message);
          } catch (error) {
            console.error('[ChatService] Error processing sent message:', error);
          }
        }
      )
      // Listen for message updates (read receipts)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `sender_id=eq.${userId}`
        },
        (payload) => {
          console.log('[ChatService] Real-time message UPDATE (read receipt):', payload.new);
          // Handle read status updates for messages we sent
        }
      )
      .subscribe((status, err) => {
        console.log(`[ChatService] Subscription status for ${channelName}:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log('[ChatService] ✅ Successfully subscribed to real-time messages');
        } else if (status === 'TIMED_OUT') {
          console.error('[ChatService] ⏱️ Subscription timed out');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[ChatService] ❌ Channel error:', err);
        } else if (status === 'CLOSED') {
          console.warn('[ChatService] 🔒 Channel closed');
        }
      });
    
    return channel;
  }

  // Subscribe to typing indicators
  static subscribeToTyping(userId: string, callback: (data: { userId: string, isTyping: boolean, conversationId: string }) => void) {
    const channelName = `typing_${userId}`;
    console.log(`[ChatService] Creating typing channel: ${channelName}`);

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false, ack: false }
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        console.log('[ChatService] Typing event received:', payload);
        try {
          callback(payload.payload);
        } catch (error) {
          console.error('[ChatService] Error processing typing event:', error);
        }
      })
      .subscribe((status, err) => {
        console.log(`[ChatService] Typing subscription status:`, status);

        if (status === 'SUBSCRIBED') {
          console.log('[ChatService] ✅ Successfully subscribed to typing indicators');
        } else if (status === 'TIMED_OUT') {
          console.error('[ChatService] ⏱️ Typing subscription timed out');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[ChatService] ❌ Typing channel error:', err);
        }
      });

    return channel;
  }

  // Broadcast typing status
  static async broadcastTyping(recipientId: string, isTyping: boolean, senderId: string) {
    const conversationId = [senderId, recipientId].sort().join('_');
    const channelName = `typing_${recipientId}`;

    console.log(`[ChatService] Broadcasting typing to channel: ${channelName}`, { senderId, isTyping });

    try {
      const channel = supabase.channel(channelName);

      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: senderId,
          isTyping,
          conversationId
        }
      });

      console.log(`[ChatService] ✅ Typing broadcast sent successfully`);
    } catch (error) {
      console.error('[ChatService] ❌ Error broadcasting typing:', error);
    }
  }

  static async getUnreadMessageCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  }

  static async getUrgentMessageCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_urgent', true)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  }
}