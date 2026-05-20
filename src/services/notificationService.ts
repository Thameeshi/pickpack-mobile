import {
  collection, addDoc, getDocs, updateDoc, doc, query, where, onSnapshot, deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification, NotificationType } from '../types';

// ─── Create a notification ────────────────────────────────────────
export async function createNotification(
  recipientId: string,
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, string>,
  senderId?: string,
  senderName?: string,
): Promise<string> {
  const notification: any = {
    recipientId,
    title,
    body,
    type,
    read: false,
    createdAt: Date.now(),
  };

  if (senderId) notification.senderId = senderId;
  if (senderName) notification.senderName = senderName;
  if (data) notification.data = data;

  const docRef = await addDoc(collection(db, 'notifications'), notification);
  return docRef.id;
}

// ─── Get notifications for a user ─────────────────────────────────
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  if (!userId) return [];
  const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as AppNotification))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─── Get unread count ─────────────────────────────────────────────
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  return snap.size;
}

// ─── Mark notification as read ────────────────────────────────────
export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

// ─── Mark all as read ─────────────────────────────────────────────
export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => updateDoc(d.ref, { read: true }));
  await Promise.all(promises);
}

// ─── Delete notification ──────────────────────────────────────────
export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

// ─── Clear all notifications ──────────────────────────────────────
export async function clearAllNotifications(userId: string): Promise<void> {
  const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(promises);
}

// ─── Subscribe to notifications (real-time) ───────────────────────
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void,
): () => void {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
  );

  return onSnapshot(q,
    (snap) => {
      const notifications = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AppNotification))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(notifications);
    },
    (error) => {
      if (error.code !== 'permission-denied') {
        console.log('Notification subscription error:', error.code);
      }
    },
  );
}

// ─── Helper: Send task assignment notification ────────────────────
export async function notifyTaskAssigned(
  driverId: string,
  taskId: string,
  taskDescription: string,
  supervisorId: string,
  supervisorName: string,
): Promise<void> {
  await createNotification(
    driverId,
    '📦 New Delivery Assigned',
    `${supervisorName} assigned you a new delivery: ${taskDescription}`,
    'task_assigned',
    { taskId },
    supervisorId,
    supervisorName,
  );
}

// ─── Helper: Notify task accepted/rejected ────────────────────────
export async function notifyTaskResponse(
  supervisorId: string,
  driverName: string,
  taskId: string,
  accepted: boolean,
  reason?: string,
): Promise<void> {
  await createNotification(
    supervisorId,
    accepted ? '✅ Delivery Accepted' : '❌ Delivery Rejected',
    accepted
      ? `${driverName} accepted the delivery assignment.`
      : `${driverName} rejected the delivery: ${reason || 'No reason given'}`,
    accepted ? 'task_accepted' : 'task_rejected',
    { taskId },
  );
}

// ─── Helper: Notify trip started ──────────────────────────────────
export async function notifyTripStarted(
  supervisorId: string,
  driverName: string,
  tripId: string,
): Promise<void> {
  await createNotification(
    supervisorId,
    '🚚 Trip Started',
    `${driverName} has started their trip.`,
    'trip_started',
    { tripId },
  );
}

// ─── Helper: Notify delivery completed ────────────────────────────
export async function notifyDeliveryCompleted(
  supervisorId: string,
  driverName: string,
  taskId: string,
  recipientName: string,
): Promise<void> {
  await createNotification(
    supervisorId,
    '✅ Delivery Completed',
    `${driverName} delivered to ${recipientName} successfully.`,
    'task_completed',
    { taskId },
  );
}

// ─── Helper: Notify fuel submitted ────────────────────────────────
export async function notifyFuelSubmitted(
  supervisorId: string,
  driverName: string,
  amount: number,
): Promise<void> {
  await createNotification(
    supervisorId,
    '⛽ Fuel Expense Submitted',
    `${driverName} submitted a fuel expense of LKR ${amount.toFixed(0)} for approval.`,
    'fuel_submitted',
  );
}
