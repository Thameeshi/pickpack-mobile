import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  getAuth,
} from 'firebase/auth';
import { setDoc, doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { UserProfile, UserRole, AccountStatus } from '../types';
import { firebaseConfig } from './firebase';

// ─── Register a new user ───────────────────────────────────────────
export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone: string,
  role: UserRole,
  extraFields?: Partial<UserProfile>
): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const profile: UserProfile = {
    uid: user.uid,
    email,
    name,
    displayName: name,
    phone,
    role,
    status: role === 'driver' ? 'pending' : 'approved', // Drivers need approval
    language: 'en',
    createdAt: new Date().toISOString(),
    ...extraFields,
  };

  await setDoc(doc(db, 'users', user.uid), profile);
  return profile;
}

// ─── Register a new driver (Supervisor action) ─────────────────────
// Uses secondary app to avoid signing out the current supervisor
export async function createPendingDriver(
  email: string,
  password: string,
  name: string,
  phone: string,
  vehiclePlate: string,
  supervisorId: string
): Promise<UserProfile> {
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);
  
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const user = cred.user;

  const profile: UserProfile = {
    uid: user.uid,
    email,
    name,
    displayName: name,
    phone,
    role: 'driver',
    status: 'pending', // Requires superadmin approval
    language: 'en',
    createdAt: new Date().toISOString(),
    vehiclePlate,
    supervisorId, // Link driver to this supervisor
  };

  // Use secondaryDb so the write is authenticated as the new driver (satisfies isOwner rule)
  await setDoc(doc(secondaryDb, 'users', user.uid), profile);
  
  // Clean up secondary auth and app
  await signOut(secondaryAuth);
  await secondaryApp.delete?.();
  
  return profile;
}

// ─── Login ─────────────────────────────────────────────────────────
export async function loginUser(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ─── Logout ────────────────────────────────────────────────────────
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// ─── Get current user profile ──────────────────────────────────────
export async function getCurrentUser(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  // Auto-create a minimal profile if missing (edge case)
  const fallback: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'User',
    phone: '',
    role: 'driver',
    status: 'pending',
    language: 'en',
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', user.uid), fallback);
  return fallback;
}

// ─── Get profile by UID ────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// ─── Update user profile ──────────────────────────────────────────
export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), updates);
}

// ─── Approve / Reject a driver (superadmin action) ────────────────
export async function setAccountStatus(
  uid: string,
  status: AccountStatus,
  approvedByUid?: string
): Promise<void> {
  const updates: Partial<UserProfile> = { status };
  if (status === 'approved' && approvedByUid) {
    updates.approvedBy = approvedByUid;
    updates.approvedAt = new Date().toISOString();
  }
  await updateDoc(doc(db, 'users', uid), updates);
}

// ─── Auth state listener ──────────────────────────────────────────
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
