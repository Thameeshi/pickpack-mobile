import { useState, useEffect } from 'react';
import { subscribeToNotifications } from '../services/notificationService';
import { AppNotification } from '../types';

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToNotifications(userId, (data) => {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    });
    return unsubscribe;
  }, [userId]);

  return { notifications, unreadCount };
}
