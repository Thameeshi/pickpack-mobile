/**
 * useOfflineSync — Monitors network connectivity and auto-syncs offline queue.
 *
 * Exposes: { isOnline, pendingCount, syncNow, lastSyncTime, isSyncing }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  processQueue,
  getPendingCount,
  getLastSyncTime,
  SyncReport,
} from '../services/offlineService';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  // Subscribe to connectivity changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      // Auto-sync when coming back online
      if (online && !isSyncingRef.current) {
        syncNow();
      }
    });

    // Initial check
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });

    // Load initial pending count and last sync time
    refreshCounts();

    return () => unsubscribe();
  }, []);

  const refreshCounts = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
    const syncTime = await getLastSyncTime();
    setLastSyncTime(syncTime);
  }, []);

  const syncNow = useCallback(async (): Promise<SyncReport | null> => {
    if (isSyncingRef.current) return null;

    const count = await getPendingCount();
    if (count === 0) return null;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const report = await processQueue();
      await refreshCounts();
      return report;
    } catch (e) {
      console.log('syncNow error:', e);
      return null;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshCounts]);

  return {
    isOnline,
    pendingCount,
    lastSyncTime,
    isSyncing,
    syncNow,
    refreshCounts,
  };
}
