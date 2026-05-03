import {
  collection, addDoc, getDoc, getDocs, updateDoc, doc, query, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { TripSession, TripStatus, LocationData } from '../types';

// ─── Start a new trip session ─────────────────────────────────────
export async function startTrip(
  driverId: string,
  driverName: string,
  startOdometer: number,
): Promise<string> {
  // Check if there's already an active trip
  const existing = await getActiveTrip(driverId);
  if (existing) throw new Error('You already have an active trip. Please end it first.');

  const tripData: Omit<TripSession, 'id'> = {
    driverId,
    driverName,
    status: 'active',
    startOdometer,
    startTime: Date.now(),
    taskIds: [],
    fuelExpenseIds: [],
    routeBreadcrumbs: [],
  };

  const docRef = await addDoc(collection(db, 'tripSessions'), tripData);
  return docRef.id;
}

// ─── Get active trip for a driver ─────────────────────────────────
export async function getActiveTrip(driverId: string): Promise<TripSession | null> {
  if (!driverId) return null;
  const q = query(
    collection(db, 'tripSessions'),
    where('driverId', '==', driverId),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as TripSession;
}

// ─── End a trip session ───────────────────────────────────────────
export async function endTrip(
  tripId: string,
  endOdometer: number,
): Promise<TripSession> {
  const tripRef = doc(db, 'tripSessions', tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) throw new Error('Trip not found');

  const trip = { id: tripSnap.id, ...tripSnap.data() } as TripSession;
  const totalDistance = Math.max(0, endOdometer - trip.startOdometer);

  // Count completed/failed deliveries
  let deliveriesCompleted = 0;
  let deliveriesFailed = 0;
  if (trip.taskIds.length > 0) {
    for (const taskId of trip.taskIds) {
      try {
        const taskSnap = await getDoc(doc(db, 'tasks', taskId));
        if (taskSnap.exists()) {
          const status = taskSnap.data().status;
          if (status === 'delivered') deliveriesCompleted++;
          if (status === 'failed') deliveriesFailed++;
        }
      } catch {}
    }
  }

  // Calculate total fuel
  let totalFuelCost = 0;
  let totalFuelLitres = 0;
  if (trip.fuelExpenseIds.length > 0) {
    for (const fuelId of trip.fuelExpenseIds) {
      try {
        const fuelSnap = await getDoc(doc(db, 'fuelExpenses', fuelId));
        if (fuelSnap.exists()) {
          totalFuelCost += fuelSnap.data().totalCost || 0;
          totalFuelLitres += fuelSnap.data().litres || 0;
        }
      } catch {}
    }
  }

  const updates = {
    status: 'completed' as TripStatus,
    endOdometer,
    totalDistance,
    endTime: Date.now(),
    deliveriesCompleted,
    deliveriesFailed,
    totalFuelCost,
    totalFuelLitres,
  };

  await updateDoc(tripRef, updates);
  return { ...trip, ...updates };
}

// ─── Add a task to the active trip ────────────────────────────────
export async function addTaskToTrip(tripId: string, taskId: string): Promise<void> {
  const tripRef = doc(db, 'tripSessions', tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) return;

  const trip = tripSnap.data() as TripSession;
  const taskIds = [...(trip.taskIds || [])];
  if (!taskIds.includes(taskId)) {
    taskIds.push(taskId);
    await updateDoc(tripRef, { taskIds });
  }
}

// ─── Add a fuel expense to the active trip ────────────────────────
export async function addFuelExpenseToTrip(tripId: string, fuelExpenseId: string): Promise<void> {
  const tripRef = doc(db, 'tripSessions', tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) return;

  const trip = tripSnap.data() as TripSession;
  const fuelExpenseIds = [...(trip.fuelExpenseIds || [])];
  if (!fuelExpenseIds.includes(fuelExpenseId)) {
    fuelExpenseIds.push(fuelExpenseId);
    await updateDoc(tripRef, { fuelExpenseIds });
  }
}

// ─── Add route breadcrumb ─────────────────────────────────────────
export async function addBreadcrumb(tripId: string, location: LocationData): Promise<void> {
  const tripRef = doc(db, 'tripSessions', tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) return;

  const trip = tripSnap.data() as TripSession;
  const breadcrumbs = [...(trip.routeBreadcrumbs || [])];

  // Only add if moved significantly (>50m) to avoid bloat
  if (breadcrumbs.length > 0) {
    const last = breadcrumbs[breadcrumbs.length - 1];
    const dist = haversineDistance(last.lat, last.lng, location.lat, location.lng);
    if (dist < 0.05) return; // less than 50m, skip
  }

  breadcrumbs.push({ ...location, timestamp: Date.now() });

  // Keep max 500 breadcrumbs per trip
  if (breadcrumbs.length > 500) breadcrumbs.shift();

  await updateDoc(tripRef, { routeBreadcrumbs: breadcrumbs });
}

// ─── Get trip by ID ───────────────────────────────────────────────
export async function getTripById(tripId: string): Promise<TripSession | null> {
  const snap = await getDoc(doc(db, 'tripSessions', tripId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as TripSession : null;
}

// ─── Get trip history for a driver ────────────────────────────────
export async function getDriverTrips(driverId: string): Promise<TripSession[]> {
  if (!driverId) return [];
  const q = query(collection(db, 'tripSessions'), where('driverId', '==', driverId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TripSession))
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
}

// Alias for consistent naming
export const getTripsByDriver = getDriverTrips;

// ─── Cancel trip ──────────────────────────────────────────────────
export async function cancelTrip(tripId: string): Promise<void> {
  await updateDoc(doc(db, 'tripSessions', tripId), {
    status: 'cancelled' as TripStatus,
    endTime: Date.now(),
  });
}

// ─── Haversine distance helper (km) ──────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
