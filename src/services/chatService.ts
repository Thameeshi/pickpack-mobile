import {
  collection, addDoc, getDocs, query, where, orderBy, onSnapshot, Unsubscribe,
  doc, updateDoc, serverTimestamp, getDoc, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage } from '../types';

// ─── Helper: generate a consistent conversation ID ────────────────
// Always sorts the two UIDs so both parties get the same conversation.
export function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

// ─── Send a direct message ────────────────────────────────────────
export async function sendDirectMessage(
  conversationId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp' | 'readBy'>
): Promise<string> {
  const data: Omit<ChatMessage, 'id'> = {
    ...message,
    timestamp: Date.now(),
    readBy: [message.senderId],
  };
  const docRef = await addDoc(
    collection(db, 'conversations', conversationId, 'messages'),
    data
  );

  // Update the conversation metadata (last message preview)
  await setDoc(doc(db, 'conversations', conversationId), {
    lastMessage: message.text,
    lastMessageTime: Date.now(),
    lastSenderId: message.senderId,
    lastSenderName: message.senderName,
    participants: conversationId.split('_'),
    updatedAt: Date.now(),
  }, { merge: true });

  return docRef.id;
}

// ─── Subscribe to direct messages (real-time) ─────────────────────
export function subscribeToDirectMessages(
  conversationId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      onMessages(messages);
    },
    (error) => {
      console.error('[Chat] Firestore subscription error:', error.message);
      if (onError) onError(error);
    }
  );
}

// ─── Task-based chat (legacy) ─────────────────────────────────────

// Send a message (task-based)
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

// Get messages for a task
export async function getMessages(taskId: string): Promise<ChatMessage[]> {
  const q = query(
    collection(db, 'chats', taskId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
}

// Real-time message listener (task-based)
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
