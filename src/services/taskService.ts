import {
  collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where,
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Task, TaskCreatePayload, TaskStatus } from '../types';
import { notifyTaskAssigned } from './notificationService';
import { isDriverOnTrip } from './tripService';

const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── Generate unique QR code for a task ────────────────────────────
function generateQRCode(taskId: string): string {
  const short = taskId.slice(0, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `PPCK-${short}-${ts}`;
}

// ─── Create a new task ─────────────────────────────────────────────
export async function createTask(payload: TaskCreatePayload): Promise<string> {
  const now = Date.now();
  const taskData: Omit<Task, 'id'> = {
    ...payload,
    status: payload.assignedDriverId ? 'assigned' : 'pending',
    priority: payload.priority || 'MEDIUM',
    qrCode: '', // Will be set after we get the doc ID
    driverAccepted: false,
    assignedAt: payload.assignedDriverId ? now : undefined,
    approvalDeadline: payload.assignedDriverId ? now + APPROVAL_TIMEOUT_MS : undefined,
    offlineSynced: true,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, 'tasks'), taskData);

  // Now set the QR code with the real doc ID
  const qrCode = generateQRCode(docRef.id);
  await updateDoc(doc(db, 'tasks', docRef.id), { qrCode });

  // Send notification to assigned driver
  if (payload.assignedDriverId) {
    try {
      // Auto-link to active trip if driver is currently on one
      const { getActiveTrip, addTaskToTrip } = require('./tripService');
      const activeTrip = await getActiveTrip(payload.assignedDriverId);
      if (activeTrip?.id) {
        await updateDoc(doc(db, 'tasks', docRef.id), { tripId: activeTrip.id });
        await addTaskToTrip(activeTrip.id, docRef.id);
      }
    } catch (e) {
      console.log('Failed to link new task to active trip:', e);
    }

    try {
      await notifyTaskAssigned(
        payload.assignedDriverId,
        docRef.id,
        `${payload.pickupLocation} → ${payload.deliveryLocation}`,
        payload.supervisorId,
        payload.supervisorName || 'Supervisor',
      );
    } catch (e) {
      console.log('Failed to send notification:', e);
    }
  }

  return docRef.id;
}

// ─── Get task by ID ────────────────────────────────────────────────
export async function getTaskById(taskId: string): Promise<Task | null> {
  const snap = await getDoc(doc(db, 'tasks', taskId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Task : null;
}

// ─── Get ALL tasks (no composite index needed) ────────────────────
export async function getAllTasks(): Promise<Task[]> {
  try {
    const snap = await getDocs(collection(db, 'tasks'));
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
    return tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    console.log('getAllTasks error:', e);
    return [];
  }
}

// ─── Get tasks by supervisor ───────────────────────────────────────
export async function getTasksBySupervisor(supervisorId: string): Promise<Task[]> {
  if (!supervisorId) return [];
  const q = query(collection(db, 'tasks'), where('supervisorId', '==', supervisorId));
  const snap = await getDocs(q);
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
  return tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─── Get tasks by driver ──────────────────────────────────────────
export async function getTasksByDriver(driverId: string): Promise<Task[]> {
  if (!driverId) return [];
  const q = query(collection(db, 'tasks'), where('assignedDriverId', '==', driverId));
  const snap = await getDocs(q);
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
  return tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─── Update task ──────────────────────────────────────────────────
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  await updateDoc(doc(db, 'tasks', taskId), { ...updates, updatedAt: Date.now() });
}

// ─── Assign task to driver (with notification) ────────────────────
export async function assignTaskToDriver(
  taskId: string, driverId: string, driverName?: string,
  supervisorId?: string, supervisorName?: string,
): Promise<void> {
  const now = Date.now();
  const task = await getTaskById(taskId);
  
  const updates: Partial<Task> = {
    assignedDriverId: driverId,
    assignedDriverName: driverName || '',
    status: 'assigned' as TaskStatus,
    driverAccepted: false,
    assignedAt: now,
    approvalDeadline: now + APPROVAL_TIMEOUT_MS,
    updatedAt: now,
  };

  try {
    const { getActiveTrip, addTaskToTrip } = require('./tripService');
    const activeTrip = await getActiveTrip(driverId);
    if (activeTrip?.id) {
      updates.tripId = activeTrip.id;
      await addTaskToTrip(activeTrip.id, taskId);
    }
  } catch (e) {
    console.log('Failed to auto-link task to trip:', e);
  }

  await updateDoc(doc(db, 'tasks', taskId), updates);

  // Send notification
  try {
    await notifyTaskAssigned(
      driverId,
      taskId,
      task ? `${task.pickupLocation} → ${task.deliveryLocation}` : 'New delivery',
      supervisorId || '',
      supervisorName || 'Supervisor',
    );
  } catch {}
}

// ─── Driver accepts a task ────────────────────────────────────────
export async function acceptTask(taskId: string): Promise<void> {
  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'accepted' as TaskStatus,
    driverAccepted: true,
    acceptedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// ─── Driver rejects a task ────────────────────────────────────────
export async function rejectTask(taskId: string, reason?: string): Promise<void> {
  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'pending' as TaskStatus,
    assignedDriverId: null,
    assignedDriverName: null,
    driverAccepted: false,
    rejectedReason: reason || '',
    updatedAt: Date.now(),
  });
}

// ─── Update task status ───────────────────────────────────────────
export async function updateTaskStatus(
  taskId: string, status: TaskStatus, extras?: Partial<Task>
): Promise<void> {
  const updates: Partial<Task> = { status, updatedAt: Date.now(), ...extras };
  if (status === 'arrived') updates.arrivedAt = Date.now();
  if (status === 'delivered') updates.completedAt = Date.now();
  
  // Auto-link task to active trip when starting delivery
  if (status === 'in_progress') {
    const task = await getTaskById(taskId);
    if (task?.assignedDriverId && !task.tripId) {
      try {
        // Import dynamically to avoid circular deps
        const { getActiveTrip, addTaskToTrip } = require('./tripService');
        const activeTrip = await getActiveTrip(task.assignedDriverId);
        if (activeTrip?.id) {
          updates.tripId = activeTrip.id;
          await addTaskToTrip(activeTrip.id, taskId);
        }
      } catch (e) {
        console.log('Auto-link task to trip failed:', e);
      }
    }
  }
  
  await updateDoc(doc(db, 'tasks', taskId), updates);
}

// ─── Helper: convert local URI to blob (React Native compatible) ──
async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Failed to convert image to blob'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

// ─── Upload proof of delivery ─────────────────────────────────────
export async function uploadProofOfDelivery(
  taskId: string, imageUri: string, fileName: string
): Promise<string> {
  const blob = await uriToBlob(imageUri);
  const storageRef = ref(storage, `proofOfDelivery/${taskId}/${fileName}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// ─── Upload signature ─────────────────────────────────────────────
export async function uploadSignature(
  taskId: string, signatureUri: string,
): Promise<string> {
  const blob = await uriToBlob(signatureUri);
  const storageRef = ref(storage, `signatures/${taskId}/${Date.now()}.png`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// ─── Upload delivery document ─────────────────────────────────────
export async function uploadDeliveryDocument(
  taskId: string, imageUri: string,
): Promise<string> {
  const blob = await uriToBlob(imageUri);
  const storageRef = ref(storage, `documents/${taskId}/${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// ─── Complete task with full POD ──────────────────────────────────
export async function completeTask(
  taskId: string,
  proofUrl: string,
  lat: number,
  lng: number,
  signatureUrl?: string,
  documentUrl?: string,
  recipientConfirmedName?: string,
  odometerReading?: number,
): Promise<void> {
  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'delivered' as TaskStatus,
    proofOfDeliveryUrl: proofUrl,
    signatureUrl: signatureUrl || null,
    deliveryDocumentUrl: documentUrl || null,
    recipientConfirmedName: recipientConfirmedName || null,
    deliveryLatitude: lat,
    deliveryLongitude: lng,
    odometerAtDelivery: odometerReading || null,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// ─── Delete task ──────────────────────────────────────────────────
export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, 'tasks', taskId));
}

// ─── Verify QR code scan ─────────────────────────────────────────
export async function verifyQRScan(taskId: string, scannedCode: string): Promise<boolean> {
  const task = await getTaskById(taskId);
  if (!task || task.qrCode !== scannedCode) return false;
  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'arrived' as TaskStatus,
    arrivedAt: Date.now(),
    scannedAt: Date.now(),
    updatedAt: Date.now(),
  });
  return true;
}
