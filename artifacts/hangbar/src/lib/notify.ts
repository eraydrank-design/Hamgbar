import { supabase } from './supabase';

type NotificationType = 'follow' | 'like' | 'comment' | 'message';

interface CreateNotificationParams {
  /** The user who receives the notification */
  userId: string;
  /** The user who triggered the action (current user) */
  senderId: string;
  type: NotificationType;
  postId?: string;
  message: string;
}

/**
 * Insert a notification row. Silently no-ops when userId === senderId
 * (you don't notify yourself) and logs warnings on errors without throwing.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  if (!params.userId || !params.senderId) return;
  if (params.userId === params.senderId) return;

  const { error } = await supabase.from('notifications').insert({
    user_id:   params.userId,
    sender_id: params.senderId,
    type:      params.type,
    post_id:   params.postId ?? null,
    message:   params.message,
    is_read:   false,
  });

  if (error) {
    console.warn('[notify] createNotification error:', error.message);
  }
}
