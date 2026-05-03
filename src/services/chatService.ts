import {
  collection, addDoc, getDocs, query, where, orderBy, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage } from '../types';

// ─── Send a message ───────────────────────────────────────────────
export async function sendMessage(
  taskId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp' | 'readBy'>
): Promise<string> {
  const data: Omit<ChatMessage, 'id'> = {
    ...message,
    timestamp: Date.now(),
    readBy: [message.senderId],
  };
  const docRef = await addDoc(
    collection(db, 'chats', taskId, 'messages'),
    data
  );
  return docRef.id;
}

// ─── Get messages for a task ──────────────────────────────────────
export async function getMessages(taskId: string): Promise<ChatMessage[]> {
  const q = query(
    collection(db, 'chats', taskId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
}

// ─── Real-time message listener ───────────────────────────────────
export function subscribeToMessages(
  taskId: string,
  onMessages: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'chats', taskId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
    onMessages(messages);
  });
}
