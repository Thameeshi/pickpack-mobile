import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Driver } from '../types';

export function useDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to be ready before subscribing
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'driver')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(d => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email || '',
            name: data.name || data.displayName || '',
            displayName: data.displayName || data.name || '',
            phoneNumber: data.phone || data.phoneNumber || '',
            role: 'driver' as const,
            status: data.status || 'pending',
            vehicleType: data.vehicleType,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            isOnline: data.isOnline,
          } as Driver;
        }).filter(d => d.status === 'approved');
        setDrivers(list);
        setLoading(false);
      },
      (error) => {
        // Permission denied is expected for driver role — they can't read all users
        if (error.code === 'permission-denied') {
          setDrivers([]);
        } else {
          console.log('useDrivers snapshot error:', error.code);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [auth.currentUser?.uid]);

  return { drivers, loading };
}

// Real-time driver location subscription
export function useDriverLocations() {
  const [locations, setLocations] = useState<Record<string, { lat: number; lng: number; speed?: number; heading?: number; accuracy?: number }>>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(
      collection(db, 'drivers'),
      (snap) => {
        const locs: Record<string, { lat: number; lng: number; speed?: number; heading?: number; accuracy?: number }> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.location) {
            locs[d.id] = {
              lat: data.location.lat,
              lng: data.location.lng,
              speed: data.location.speed ?? undefined,
              heading: data.location.heading ?? undefined,
              accuracy: data.location.accuracy ?? undefined,
            };
          }
        });
        setLocations(locs);
      },
      (error) => {
        console.log('useDriverLocations error:', error.code);
      }
    );
    return unsubscribe;
  }, [auth.currentUser?.uid]);

  return locations;
}

