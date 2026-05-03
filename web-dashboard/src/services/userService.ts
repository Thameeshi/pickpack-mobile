import { collection, getDocs, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AccountStatus, Driver } from '../types';

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function getDrivers(): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), where('role', '==', 'driver'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function updateUserStatus(uid: string, status: AccountStatus, approvedBy?: string): Promise<void> {
  const updates: Partial<UserProfile> = { status };
  if (status === 'approved' && approvedBy) {
    updates.approvedBy = approvedBy;
    updates.approvedAt = new Date().toISOString();
  }
  await updateDoc(doc(db, 'users', uid), updates);
}

export async function updateUserRole(uid: string, role: UserProfile['role']): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role });
}

// Real-time driver locations
export function subscribeToDriverLocations(callback: (drivers: Driver[]) => void): () => void {
  return onSnapshot(collection(db, 'drivers'), (snap) => {
    const drivers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Driver));
    callback(drivers);
  });
}
