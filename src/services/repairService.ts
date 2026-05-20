import {
  collection, addDoc, getDocs, updateDoc, doc, query, where,
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RepairRequest, ExpenseStatus } from '../types';

// ═══════════════════════════════════════════════════════════════════
// REPAIR REQUESTS
// ═══════════════════════════════════════════════════════════════════

export async function addRepairRequest(
  request: Omit<RepairRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const data = { ...request, createdAt: now, updatedAt: now };
  const docRef = await addDoc(collection(db, 'repairRequests'), data);
  return docRef.id;
}

export async function getRepairsByDriver(driverId: string): Promise<RepairRequest[]> {
  if (!driverId) return [];
  const q = query(collection(db, 'repairRequests'), where('driverId', '==', driverId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as RepairRequest))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getAllRepairRequests(): Promise<RepairRequest[]> {
  const snap = await getDocs(collection(db, 'repairRequests'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as RepairRequest))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getRepairsByTrip(tripId: string): Promise<RepairRequest[]> {
  if (!tripId) return [];
  const q = query(collection(db, 'repairRequests'), where('tripId', '==', tripId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as RepairRequest))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function updateRepairStatus(
  requestId: string,
  status: ExpenseStatus,
  approvedBy?: string,
  rejectionReason?: string
): Promise<void> {
  const updates: Partial<RepairRequest> = {
    status,
    updatedAt: Date.now(),
  };
  if (approvedBy) {
    updates.approvedBy = approvedBy;
    updates.approvedAt = Date.now();
  }
  if (rejectionReason) updates.rejectionReason = rejectionReason;
  await updateDoc(doc(db, 'repairRequests', requestId), updates);
}

export async function updateRepairCost(
  requestId: string,
  actualCost: number
): Promise<void> {
  await updateDoc(doc(db, 'repairRequests', requestId), {
    actualCost,
    updatedAt: Date.now(),
  });
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

export async function uploadRepairPhoto(
  requestId: string, imageUri: string
): Promise<string> {
  const blob = await uriToBlob(imageUri);
  const storageRef = ref(storage, `repairs/${requestId}/${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
