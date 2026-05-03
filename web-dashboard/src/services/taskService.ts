import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Task, TaskStatus, TaskPriority } from '../types';

export async function getAllTasks(): Promise<Task[]> {
  const snap = await getDocs(collection(db, 'tasks'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getTasksBySupervisor(supervisorId: string): Promise<Task[]> {
  const q = query(collection(db, 'tasks'), where('supervisorId', '==', supervisorId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function subscribeToTasks(callback: (tasks: Task[]) => void): () => void {
  return onSnapshot(collection(db, 'tasks'), (snap) => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(tasks);
  });
}

export async function createTask(payload: {
  pickupLocation: string;
  deliveryLocation: string;
  recipientName: string;
  recipientPhone: string;
  description?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  supervisorId: string;
  supervisorName?: string;
  priority: TaskPriority;
}): Promise<string> {
  const taskData: Omit<Task, 'id'> = {
    ...payload,
    status: payload.assignedDriverId ? 'assigned' : 'pending',
    driverAccepted: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const docRef = await addDoc(collection(db, 'tasks'), taskData);
  return docRef.id;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  await updateDoc(doc(db, 'tasks', taskId), { ...updates, updatedAt: Date.now() });
}

export async function assignTaskToDriver(
  taskId: string, driverId: string, driverName: string
): Promise<void> {
  await updateDoc(doc(db, 'tasks', taskId), {
    assignedDriverId: driverId,
    assignedDriverName: driverName,
    status: 'assigned' as TaskStatus,
    driverAccepted: false,
    updatedAt: Date.now(),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, 'tasks', taskId));
}
