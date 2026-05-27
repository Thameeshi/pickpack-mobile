import {
  collection, addDoc, getDoc, getDocs, updateDoc, doc, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { TripSession, TripStatus, LocationData, Task } from '../types';
import { notifyTripStarted } from './notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { addToQueue, getCachedTasks, updateCachedTask } from './offlineService';

// Notify all supervisors when a driver starts a trip
async function notifyAllSupervisorsOfTripStart(tripId: string, driverName: string) {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'supervisor'));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      try {
        await notifyTripStarted(d.id, driverName, tripId);
      } catch (e) {
        console.log('Failed to notify supervisor', d.id, e);
      }
    }
  } catch (e) {
    console.log('Failed to fetch supervisors for notifications', e);
  }
}

// ─── Start a new trip session ─────────────────────────────────────
export async function startTrip(
  driverId: string,
  driverName: string,
  startOdometer: number,
  startLocation?: string,
  endLocation?: string,
  middleLocations?: string[],
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
    startLocation: startLocation || '',
    endLocation: endLocation || '',
    middleLocations: middleLocations || [],
  };

  const docRef = await addDoc(collection(db, 'tripSessions'), tripData);
  const tripId = docRef.id;

  // Notify supervisors that a trip has started (best-effort)
  try {
    await notifyAllSupervisorsOfTripStart(tripId, driverName);
  } catch (e) {
    console.log('notifyAllSupervisorsOfTripStart error:', e);
  }

  return tripId;
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

// ─── Check if a driver is currently on an active trip ─────────────
export async function isDriverOnTrip(driverId: string): Promise<boolean> {
  if (!driverId) return false;
  const trip = await getActiveTrip(driverId);
  return trip !== null;
}

// ─── Get active trip status for multiple drivers (batch) ──────────
export async function getDriversTripStatus(
  driverIds: string[]
): Promise<Record<string, boolean>> {
  if (!driverIds.length) return {};
  const q = query(
    collection(db, 'tripSessions'),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  const activeDriverIds = new Set(snap.docs.map(d => d.data().driverId));
  const result: Record<string, boolean> = {};
  driverIds.forEach(id => { result[id] = activeDriverIds.has(id); });
  return result;
}
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

// ─── Subscribe to trip sessions (real-time) ───────────────────────
export function subscribeToTrips(callback: (trips: TripSession[]) => void): () => void {
  const q = collection(db, 'tripSessions');
  const unsub = onSnapshot(q, (snap) => {
    const trips = snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSession))
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    callback(trips);
  }, (err) => {
    console.log('subscribeToTrips error', err);
  });
  return unsub;
}

// ─── Link all accepted/assigned tasks to a trip ──────────────────
export async function linkAcceptedTasksToTrip(
  driverId: string,
  tripId: string,
): Promise<string[]> {
  const q = query(
    collection(db, 'tasks'),
    where('assignedDriverId', '==', driverId),
  );
  const snap = await getDocs(q);
  const linkedTaskIds: string[] = [];

  for (const taskDoc of snap.docs) {
    const task = taskDoc.data() as Task;
    // Link accepted or assigned+accepted tasks
    if (['accepted', 'assigned'].includes(task.status) && task.status !== 'delivered' && task.status !== 'failed') {
      await updateDoc(doc(db, 'tasks', taskDoc.id), { tripId });
      linkedTaskIds.push(taskDoc.id);
    }
  }

  // Update the trip's taskIds array
  if (linkedTaskIds.length > 0) {
    const tripRef = doc(db, 'tripSessions', tripId);
    const tripSnap = await getDoc(tripRef);
    if (tripSnap.exists()) {
      const existingIds = (tripSnap.data() as TripSession).taskIds || [];
      const merged = [...new Set([...existingIds, ...linkedTaskIds])];
      await updateDoc(tripRef, { taskIds: merged });
    }
  }

  return linkedTaskIds;
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

async function checkOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Offline-aware start trip.
 * Saves active trip locally and queues firestore sync when online.
 */
export async function offlineStartTrip(
  driverId: string,
  driverName: string,
  startOdometer: number,
  startLocation?: string,
  endLocation?: string,
  middleLocations?: string[],
  photoUri?: string | null,
  location?: { lat: number; lng: number } | null,
): Promise<string> {
  const online = await checkOnline();
  if (online) {
    const tripId = await startTrip(driverId, driverName, startOdometer, startLocation, endLocation, middleLocations);
    const tripData: TripSession = {
      id: tripId,
      driverId,
      driverName,
      status: 'active',
      startOdometer,
      startTime: Date.now(),
      taskIds: [],
      fuelExpenseIds: [],
      routeBreadcrumbs: [],
      startLocation: startLocation || '',
      endLocation: endLocation || '',
      middleLocations: middleLocations || [],
    };
    await AsyncStorage.setItem('@pickpack_active_trip', JSON.stringify(tripData));
    return tripId;
  }

  const tempTripId = `temp_trip_${Date.now()}`;
  const tripData: TripSession = {
    id: tempTripId,
    driverId,
    driverName,
    status: 'active',
    startOdometer,
    startTime: Date.now(),
    taskIds: [],
    fuelExpenseIds: [],
    routeBreadcrumbs: [],
    startLocation: startLocation || '',
    endLocation: endLocation || '',
    middleLocations: middleLocations || [],
  };

  await AsyncStorage.setItem('@pickpack_active_trip', JSON.stringify(tripData));

  await addToQueue('start_trip', tempTripId, {
    driverId,
    driverName,
    startOdometer,
    startLocation: startLocation || '',
    endLocation: endLocation || '',
    middleLocations: middleLocations || [],
    photoUri: photoUri || null,
    location: location || null,
  });

  return tempTripId;
}

/**
 * Offline-aware end trip.
 */
export async function offlineEndTrip(
  tripId: string,
  endOdometer: number,
  photoUri?: string | null,
  location?: { lat: number; lng: number } | null,
): Promise<TripSession> {
  const online = await checkOnline();
  if (online) {
    const summary = await endTrip(tripId, endOdometer);
    await AsyncStorage.removeItem('@pickpack_active_trip');
    return summary;
  }

  const raw = await AsyncStorage.getItem('@pickpack_active_trip');
  if (!raw) throw new Error('No active trip session found in local cache.');
  const trip = JSON.parse(raw) as TripSession;

  const totalDistance = Math.max(0, endOdometer - trip.startOdometer);

  const updates = {
    status: 'completed' as TripStatus,
    endOdometer,
    totalDistance,
    endTime: Date.now(),
    deliveriesCompleted: trip.taskIds.length,
    deliveriesFailed: 0,
    totalFuelCost: 0,
    totalFuelLitres: 0,
  };

  const summary = { ...trip, ...updates };

  await addToQueue('end_trip', tripId, {
    endOdometer,
    photoUri: photoUri || null,
    location: location || null,
  });

  await AsyncStorage.removeItem('@pickpack_active_trip');

  return summary;
}

/**
 * Offline-aware get active trip.
 */
export async function offlineGetActiveTrip(driverId: string): Promise<TripSession | null> {
  try {
    const raw = await AsyncStorage.getItem('@pickpack_active_trip');
    if (raw) {
      const trip = JSON.parse(raw) as TripSession;
      if (trip.driverId === driverId && trip.status === 'active') {
        return trip;
      }
    }
  } catch {}

  const online = await checkOnline();
  if (online) {
    try {
      const trip = await getActiveTrip(driverId);
      if (trip) {
        await AsyncStorage.setItem('@pickpack_active_trip', JSON.stringify(trip));
        return trip;
      }
    } catch {}
  }

  return null;
}

/**
 * Offline-aware link accepted tasks to trip.
 */
export async function offlineLinkAcceptedTasksToTrip(
  driverId: string,
  tripId: string,
): Promise<string[]> {
  const online = await checkOnline();
  if (online) {
    return linkAcceptedTasksToTrip(driverId, tripId);
  }

  const cachedTasks = await getCachedTasks();
  const linkedTaskIds: string[] = [];

  for (const task of cachedTasks) {
    if (
      task.assignedDriverId === driverId &&
      ['accepted', 'assigned'].includes(task.status) &&
      task.status !== 'delivered' &&
      task.status !== 'failed'
    ) {
      if (task.id) {
        await updateCachedTask(task.id, { tripId });
        linkedTaskIds.push(task.id);
      }
    }
  }

  const raw = await AsyncStorage.getItem('@pickpack_active_trip');
  if (raw) {
    const trip = JSON.parse(raw) as TripSession;
    if (trip.id === tripId) {
      trip.taskIds = [...new Set([...(trip.taskIds || []), ...linkedTaskIds])];
      await AsyncStorage.setItem('@pickpack_active_trip', JSON.stringify(trip));
    }
  }

  return linkedTaskIds;
}
