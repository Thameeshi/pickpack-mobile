import {
  collection, addDoc, getDocs, updateDoc, doc, query, where,
} from 'firebase/firestore';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { addToQueue } from './offlineService';
import { FuelExpense, OdometerReading, ExpenseStatus, OdometerType } from '../types';
import { uploadFileToStorage } from './storageUpload';

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

export async function uploadFuelReceipt(
  expenseId: string, imageUri: string
): Promise<string> {
  const downloadUrl = await uploadFileToStorage(
    imageUri,
    `receipts/${expenseId}/${Date.now()}.jpg`,
    'image/jpeg',
  );
  await updateDoc(doc(db, 'fuelExpenses', expenseId), { receiptUrl: downloadUrl });
  return downloadUrl;
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
  const downloadUrl = await uploadFileToStorage(
    imageUri,
    `odometer/${readingId}/${Date.now()}.jpg`,
    'image/jpeg',
  );
  await updateDoc(doc(db, 'odometerReadings', readingId), { photoUrl: downloadUrl });
  return downloadUrl;
}

// Calculate daily distance from odometer readings
export function calculateDailyDistance(readings: OdometerReading[]): number {
  if (readings.length < 2) return 0;
  const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0].reading;
  const last = sorted[sorted.length - 1].reading;
  return Math.max(0, last - first);
}

async function checkOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Offline-aware add odometer reading.
 */
export async function offlineAddOdometerReading(reading: Omit<OdometerReading, 'id'>): Promise<string> {
  const online = await checkOnline();
  if (online) {
    return addOdometerReading(reading);
  }

  const tempId = `temp_odo_${Date.now()}`;
  // Queue a standalone odometer reading
  await addToQueue('add_odometer_reading', tempId, {
    reading,
  });

  return tempId;
}

/**
 * Offline-aware upload odometer photo.
 */
export async function offlineUploadOdometerPhoto(
  readingId: string,
  imageUri: string,
): Promise<string> {
  const online = await checkOnline();
  if (online) {
    return uploadOdometerPhoto(readingId, imageUri);
  }

  try {
    const raw = await AsyncStorage.getItem('@pickpack_offline_queue');
    if (raw) {
      const queue = JSON.parse(raw) as any[];
      const updated = queue.map(item => {
        if (item.action === 'add_odometer_reading' && item.taskId === readingId) {
          return {
            ...item,
            payload: {
              ...item.payload,
              photoUri: imageUri,
            },
          };
        }
        return item;
      });
      await AsyncStorage.setItem('@pickpack_offline_queue', JSON.stringify(updated));
    }
  } catch (e) {
    console.log('offlineUploadOdometerPhoto error:', e);
  }

  return imageUri;
}
