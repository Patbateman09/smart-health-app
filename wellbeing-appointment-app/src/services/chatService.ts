import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ChatUser } from '@/types/chat';

export const chatService = {
  async sendMessage(senderId: string, receiverId: string, content: string): Promise<ChatMessage | null> {
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          is_read: false,
        },
      ])
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          first_name,
          last_name,
          profile_picture_url
        )
      `)
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return null;
    }

    return data;
  },

  async getMessages(userId: string, otherUserId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          first_name,
          last_name,
          profile_picture_url
        )
      `)
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Mark all messages as read from fromUserId (the other user) to toUserId (the logged-in user).
   * Usage: markMessagesAsRead(otherUserId, myUserId)
   */
  async markMessagesAsRead(fromUserId: string, toUserId: string): Promise<void> {
    // Warn if the arguments look swapped (e.g., both are the same)
    if (fromUserId === toUserId) {
      console.warn('[markMessagesAsRead] fromUserId and toUserId are the same! This is likely a bug.');
    }
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .match({ sender_id: fromUserId, receiver_id: toUserId, is_read: false });

    if (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  subscribeToMessages(userId: string, callback: (message: ChatMessage) => void) {
    return supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as ChatMessage);
        }
      )
      .subscribe();
  },
}; 