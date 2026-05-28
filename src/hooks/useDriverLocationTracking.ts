import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  startTrackingDriverLocation,
  stopTrackingDriverLocation,
} from '../services/locationService';

/**
 * Keeps GPS → Firestore updates running while enabled.
 * Does not stop on screen unmount — only when `enabled` becomes false or driver signs out.
 */
export function useDriverLocationTracking(
  driverId: string | undefined,
  enabled: boolean
): void {
  const isTrackingRef = useRef(false);

  useEffect(() => {
    if (!driverId || !enabled) {
      if (isTrackingRef.current) {
        stopTrackingDriverLocation();
        isTrackingRef.current = false;
      }
      return;
    }

    let cancelled = false;
    startTrackingDriverLocation(driverId)
      .then(() => {
        if (!cancelled) isTrackingRef.current = true;
      })
      .catch(() => {
        isTrackingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [driverId, enabled]);

  useEffect(() => {
    return () => {
      stopTrackingDriverLocation();
      isTrackingRef.current = false;
    };
  }, [driverId]);
}

/** True when driver has an active trip session or a delivery in progress. */
export function useShouldTrackDriverLocation(driverId: string | undefined): boolean {
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [hasActiveTask, setHasActiveTask] = useState(false);

  useEffect(() => {
    if (!driverId) {
      setHasActiveSession(false);
      setHasActiveTask(false);
      return;
    }

    const sessionQ = query(
      collection(db, 'tripSessions'),
      where('driverId', '==', driverId),
      where('status', '==', 'active')
    );
    const unsubSession = onSnapshot(
      sessionQ,
      (snap) => setHasActiveSession(!snap.empty),
      () => setHasActiveSession(false)
    );

    const tasksQ = query(
      collection(db, 'tasks'),
      where('assignedDriverId', '==', driverId)
    );
    const unsubTasks = onSnapshot(
      tasksQ,
      (snap) => {
        const active = snap.docs.some((d) => {
          const status = d.data().status;
          return status === 'in_progress' || status === 'arrived';
        });
        setHasActiveTask(active);
      },
      () => setHasActiveTask(false)
    );

    return () => {
      unsubSession();
      unsubTasks();
    };
  }, [driverId]);

  return hasActiveSession || hasActiveTask;
}
