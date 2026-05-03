import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

let subscription: Location.LocationSubscription | null = null;

// ─── Start GPS tracking (driver) ──────────────────────────────────
export async function startTrackingDriverLocation(
  driverId: string,
  onError?: (error: unknown) => void
): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    async (loc) => {
      try {
        await setDoc(
          doc(db, 'drivers', driverId),
          {
            location: {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              heading: loc.coords.heading ?? null,
              speed: loc.coords.speed ?? null,
              accuracy: loc.coords.accuracy ?? null,
            },
            isOnline: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        onError?.(e);
      }
    }
  );
}

// ─── Stop GPS tracking ────────────────────────────────────────────
export function stopTrackingDriverLocation(): void {
  try { subscription?.remove(); } catch {}
  subscription = null;
}

// ─── Get current location (one-shot) ──────────────────────────────
export async function getCurrentLocation(): Promise<Location.LocationObject> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission not granted');
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

// ─── Haversine distance (km) ──────────────────────────────────────
export function calculateDistance(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
