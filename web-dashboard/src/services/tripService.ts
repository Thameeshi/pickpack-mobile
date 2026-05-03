import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TripSession } from '../types';

export async function getAllTrips(): Promise<TripSession[]> {
  const snap = await getDocs(collection(db, 'tripSessions'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSession))
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
}

export async function getTripsByDriver(driverId: string): Promise<TripSession[]> {
  const q = query(collection(db, 'tripSessions'), where('driverId', '==', driverId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSession))
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
}

export function subscribeToTrips(callback: (trips: TripSession[]) => void): () => void {
  return onSnapshot(collection(db, 'tripSessions'), (snap) => {
    const trips = snap.docs.map(d => ({ id: d.id, ...d.data() } as TripSession))
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    callback(trips);
  });
}
