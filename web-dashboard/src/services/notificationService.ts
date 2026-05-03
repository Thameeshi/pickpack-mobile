import { collection, getDocs, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification } from '../types';

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
  return onSnapshot(q, (snap) => {
    const notifications = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as AppNotification))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(notifications);
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
}
