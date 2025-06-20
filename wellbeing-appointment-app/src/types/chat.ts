export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender: {
    first_name: string;
    last_name: string;
    profile_picture_url: string | null;
  };
}

export interface ChatUser {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  user_type: string;
} 