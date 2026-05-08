import {
  collection, addDoc, getDocs, updateDoc, doc, query, where,
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FuelExpense, OdometerReading, ExpenseStatus, OdometerType } from '../types';

// ═══════════════════════════════════════════════════════════════════
// FUEL EXPENSES
// ═══════════════════════════════════════════════════════════════════

export async function addFuelExpense(expense: Omit<FuelExpense, 'id' | 'createdAt'>): Promise<string> {
  const data = { ...expense, createdAt: Date.now() };
  const docRef = await addDoc(collection(db, 'fuelExpenses'), data);
  return docRef.id;
}

export async function getFuelExpensesByDriver(driverId: string): Promise<FuelExpense[]> {
  if (!driverId) return [];
  const q = query(collection(db, 'fuelExpenses'), where('driverId', '==', driverId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FuelExpense)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getAllFuelExpenses(): Promise<FuelExpense[]> {
  const snap = await getDocs(collection(db, 'fuelExpenses'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FuelExpense)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function updateFuelExpenseStatus(
  expenseId: string, status: ExpenseStatus, approvedBy?: string
): Promise<void> {
  const updates: Partial<FuelExpense> = { status };
  if (approvedBy) updates.approvedBy = approvedBy;
  await updateDoc(doc(db, 'fuelExpenses', expenseId), updates);
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

export async function uploadFuelReceipt(
  expenseId: string, imageUri: string
): Promise<string> {
  const blob = await uriToBlob(imageUri);
  const storageRef = ref(storage, `receipts/${expenseId}/${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// ═══════════════════════════════════════════════════════════════════
// ODOMETER READINGS
// ═══════════════════════════════════════════════════════════════════

export async function addOdometerReading(reading: Omit<OdometerReading, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'odometerReadings'), reading);
  return docRef.id;
}

export async function getOdometerReadingsByDriver(driverId: string): Promise<OdometerReading[]> {
  if (!driverId) return [];
  const q = query(collection(db, 'odometerReadings'), where('driverId', '==', driverId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as OdometerReading)).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export async function getTodayOdometerReadings(driverId: string): Promise<OdometerReading[]> {
  if (!driverId) return [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const q = query(collection(db, 'odometerReadings'), where('driverId', '==', driverId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as OdometerReading))
    .filter(r => r.timestamp >= startOfDay.getTime())
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function uploadOdometerPhoto(
  readingId: string, imageUri: string
): Promise<string> {
  const blob = await uriToBlob(imageUri);
  const storageRef = ref(storage, `odometer/${readingId}/${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// Calculate daily distance from odometer readings
export function calculateDailyDistance(readings: OdometerReading[]): number {
  if (readings.length < 2) return 0;
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0].reading;
  const last = sorted[sorted.length - 1].reading;
  return Math.max(0, last - first);
}
