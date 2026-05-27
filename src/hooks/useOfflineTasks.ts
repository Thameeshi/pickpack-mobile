/**
 * useOfflineTasks — Drop-in replacement for useTasksByDriver that is offline-aware.
 *
 * - Online: Fetches from Firestore AND caches to AsyncStorage
 * - Offline: Returns cached tasks from AsyncStorage
 * - Applies pending offline queue actions as optimistic updates
 *
 * Exposes: { tasks, loading, refetch, isOfflineData }
 */
import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getTasksByDriver } from '../services/taskService';
import {
  cacheTasks,
  getCachedTasks,
  getQueue,
} from '../services/offlineService';
import { Task, OfflineQueueItem, TaskStatus } from '../types';

export function useOfflineTasks(driverId: string, passedIsOnline?: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [internalIsOnline, setInternalIsOnline] = useState(true);

  // Monitor connectivity internally if not passed from above
  useEffect(() => {
    if (passedIsOnline !== undefined) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      setInternalIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    NetInfo.fetch().then((state) => {
      setInternalIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, [passedIsOnline]);

  const activeIsOnline = passedIsOnline !== undefined ? passedIsOnline : internalIsOnline;

  const refetch = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);

    try {
      // Determine online state at the moment of fetching
      const online = passedIsOnline !== undefined 
        ? passedIsOnline 
        : await NetInfo.fetch().then(state => !!(state.isConnected && state.isInternetReachable !== false));

      if (online) {
        // ── ONLINE: fetch from Firestore, cache locally ──
        const data = await getTasksByDriver(driverId);
        setTasks(data);
        setIsOfflineData(false);

        // Cache for offline use (fire-and-forget)
        cacheTasks(data).catch(() => {});
      } else {
        // ── OFFLINE: load from cache and apply queue ──
        const cached = await getCachedTasks();
        const withOptimistic = await applyOptimisticUpdates(cached);
        setTasks(withOptimistic);
        setIsOfflineData(true);
      }
    } catch (e) {
      console.log('useOfflineTasks fetch error, falling back to cache:', e);
      // If Firestore fails (e.g. flaky connection), fall back to cache
      try {
        const cached = await getCachedTasks();
        const withOptimistic = await applyOptimisticUpdates(cached);
        setTasks(withOptimistic);
        setIsOfflineData(true);
      } catch {
        setTasks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [driverId, passedIsOnline]);

  useEffect(() => {
    refetch();
  }, [refetch, activeIsOnline]);

  return { tasks, loading, refetch, isOfflineData };
}

/**
 * Apply pending offline queue actions to cached tasks so the UI
 * reflects what the driver did while offline (optimistic updates).
 */
async function applyOptimisticUpdates(tasks: Task[]): Promise<Task[]> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) return tasks;

    // Clone to avoid mutation
    let updated = tasks.map(t => ({ ...t }));

    for (const item of queue) {
      updated = updated.map(t => {
        if (t.id !== item.taskId) return t;
        return applyQueueItemToTask(t, item);
      });
    }

    return updated;
  } catch {
    return tasks;
  }
}

/** Apply a single offline queue action to a task */
function applyQueueItemToTask(task: Task, item: OfflineQueueItem): Task {
  switch (item.action) {
    case 'accept_task':
      return {
        ...task,
        status: 'accepted' as TaskStatus,
        driverAccepted: true,
        acceptedAt: item.createdAt,
        offlineSynced: false,
        updatedAt: item.createdAt,
      };

    case 'reject_task':
      return {
        ...task,
        status: 'pending' as TaskStatus,
        assignedDriverId: undefined,
        assignedDriverName: undefined,
        driverAccepted: false,
        rejectedReason: (item.payload.reason as string) || '',
        offlineSynced: false,
        updatedAt: item.createdAt,
      };

    case 'update_status': {
      const status = item.payload.status as TaskStatus;
      const extras = (item.payload.extras as Partial<Task>) || {};
      return {
        ...task,
        ...extras,
        status,
        offlineSynced: false,
        updatedAt: item.createdAt,
        ...(status === 'arrived' ? { arrivedAt: item.createdAt } : {}),
        ...(status === 'in_progress' ? { updatedAt: item.createdAt } : {}),
        ...(status === 'delivered' ? { completedAt: item.createdAt } : {}),
      };
    }

    case 'complete_task':
      return {
        ...task,
        status: 'delivered' as TaskStatus,
        proofOfDeliveryUrl: (item.payload.proofUrl as string) || undefined,
        signatureUrl: (item.payload.signatureUrl as string) || undefined,
        deliveryDocumentUrl: (item.payload.documentUrl as string) || undefined,
        recipientConfirmedName: (item.payload.recipientConfirmedName as string) || undefined,
        deliveryLatitude: (item.payload.lat as number) || undefined,
        deliveryLongitude: (item.payload.lng as number) || undefined,
        completedAt: item.createdAt,
        offlineSynced: false,
        updatedAt: item.createdAt,
      };

    default:
      return task;
  }
}
