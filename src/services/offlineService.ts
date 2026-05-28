/**
 * OfflineService — Core offline engine for the PickPack driver app.
 *
 * Manages three concerns:
 * 1. OfflineQueue — Persists pending actions in AsyncStorage
 * 2. OfflineTaskCache — Caches driver tasks locally
 * 3. OfflineSyncEngine — Processes the queue when internet returns
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem, OfflineActionType, Task, TaskStatus } from '../types';
import {
  acceptTask,
  rejectTask,
  updateTaskStatus,
  completeTask,
  uploadProofOfDelivery,
  uploadSignature,
  uploadDeliveryDocument,
} from './taskService';

// ─── AsyncStorage Keys ───────────────────────────────────────────
const QUEUE_KEY = '@pickpack_offline_queue';
const TASK_CACHE_KEY = '@pickpack_task_cache';
const LAST_SYNC_KEY = '@pickpack_last_sync';

// ═══════════════════════════════════════════════════════════════════
// 1. OFFLINE QUEUE — manages pending actions
// ═══════════════════════════════════════════════════════════════════

/** Add an action to the offline queue */
export async function addToQueue(
  action: OfflineActionType,
  taskId: string,
  payload: Record<string, unknown> = {},
): Promise<OfflineQueueItem> {
  const queue = await getQueue();
  const item: OfflineQueueItem = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    taskId,
    payload,
    createdAt: Date.now(),
    synced: false,
    retryCount: 0,
    maxRetries: 5,
  };
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

/** Get all pending (unsynced) actions from the queue */
export async function getQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueueItem[];
    return parsed.filter(item => !item.synced);
  } catch {
    return [];
  }
}

/** Remove a specific item from the queue (after successful sync) */
export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter(item => item.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

/** Mark an item as failed with an error message */
export async function markQueueItemFailed(id: string, error: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw) as OfflineQueueItem[];
    const updated = queue.map(item =>
      item.id === id
        ? { ...item, retryCount: item.retryCount + 1, lastError: error }
        : item,
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch {}
}

/** Clear the entire queue (use on logout) */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Get the count of pending items */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

// ═══════════════════════════════════════════════════════════════════
// 2. OFFLINE TASK CACHE — caches driver tasks locally
// ═══════════════════════════════════════════════════════════════════

/** Cache a list of tasks to local storage */
export async function cacheTasks(tasks: Task[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TASK_CACHE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.log('cacheTasks error:', e);
  }
}

/** Get cached tasks from local storage */
export async function getCachedTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASK_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

/** Optimistically update a single cached task (when offline action is taken) */
export async function updateCachedTask(
  taskId: string,
  updates: Partial<Task>,
): Promise<void> {
  try {
    const tasks = await getCachedTasks();
    const updated = tasks.map(t =>
      t.id === taskId ? { ...t, ...updates, updatedAt: Date.now() } : t,
    );
    await AsyncStorage.setItem(TASK_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.log('updateCachedTask error:', e);
  }
}

/** Clear the task cache (use on logout) */
export async function clearTaskCache(): Promise<void> {
  await AsyncStorage.removeItem(TASK_CACHE_KEY);
}

/** Get the last successful sync timestamp */
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

/** Set the last successful sync timestamp */
export async function setLastSyncTime(timestamp: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(timestamp));
}

// ═══════════════════════════════════════════════════════════════════
// 3. OFFLINE SYNC ENGINE — processes the queue when online
// ═══════════════════════════════════════════════════════════════════

export interface SyncReport {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ id: string; action: string; error: string }>;
}

/** Process the entire offline queue, executing each action against Firestore */
export async function processQueue(): Promise<SyncReport> {
  const queue = await getQueue();
  const report: SyncReport = {
    total: queue.length,
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (queue.length === 0) return report;

  console.log(`🔄 Processing offline queue: ${queue.length} items`);

  for (const item of queue) {
    // Skip items that exceeded max retries
    if (item.retryCount >= item.maxRetries) {
      report.failed++;
      report.errors.push({
        id: item.id,
        action: item.action,
        error: `Max retries exceeded (${item.maxRetries})`,
      });
      continue;
    }

    try {
      await executeSyncAction(item);
      await removeFromQueue(item.id);
      report.synced++;
      console.log(`✅ Synced: ${item.action} for task ${item.taskId}`);
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      await markQueueItemFailed(item.id, errorMsg);
      report.failed++;
      report.errors.push({
        id: item.id,
        action: item.action,
        error: errorMsg,
      });
      console.log(`❌ Sync failed: ${item.action} for task ${item.taskId}: ${errorMsg}`);
    }
  }

  if (report.synced > 0) {
    await setLastSyncTime(Date.now());
  }

  console.log(`🔄 Sync complete: ${report.synced}/${report.total} synced, ${report.failed} failed`);
  return report;
}

/** Execute a single offline action against Firestore */
async function executeSyncAction(item: OfflineQueueItem): Promise<void> {
  const { action, taskId, payload } = item;

  switch (action) {
    case 'accept_task':
      await acceptTask(taskId);
      break;

    case 'reject_task':
      await rejectTask(taskId, (payload.reason as string) || undefined);
      break;

    case 'update_status': {
      const status = payload.status as TaskStatus;
      const extras = (payload.extras as Partial<Task>) || undefined;
      await updateTaskStatus(taskId, status, extras);
      break;
    }

    case 'complete_task': {
      // If there are local file URIs, upload them first
      let proofUrl = payload.proofUrl as string;
      let signatureUrl = payload.signatureUrl as string | undefined;
      let documentUrl = payload.documentUrl as string | undefined;

      // Upload proof photo if it's a local URI
      if (proofUrl && (proofUrl.startsWith('file://') || proofUrl.startsWith('/'))) {
        try {
          proofUrl = await uploadProofOfDelivery(
            taskId,
            proofUrl,
            `${taskId}-${Date.now()}.jpg`,
          );
        } catch (e: any) {
          throw new Error(`Proof photo upload failed: ${e?.message}`);
        }
      }

      // Upload signature if it's a local URI
      if (signatureUrl && (signatureUrl.startsWith('file://') || signatureUrl.startsWith('/'))) {
        try {
          signatureUrl = await uploadSignature(taskId, signatureUrl);
        } catch (e: any) {
          throw new Error(`Signature upload failed: ${e?.message}`);
        }
      }

      // Upload document if it's a local URI
      if (documentUrl && (documentUrl.startsWith('file://') || documentUrl.startsWith('/'))) {
        try {
          documentUrl = await uploadDeliveryDocument(taskId, documentUrl);
        } catch {
          // Document is optional, don't fail the whole sync
          documentUrl = undefined;
        }
      }

      await completeTask(
        taskId,
        proofUrl,
        (payload.lat as number) || 0,
        (payload.lng as number) || 0,
        signatureUrl,
        documentUrl,
        (payload.recipientConfirmedName as string) || undefined,
        (payload.odometerReading as number) || undefined,
      );
      break;
    }

    case 'start_trip': {
      const { startTrip, linkAcceptedTasksToTrip } = require('./tripService');
      const { addOdometerReading, uploadOdometerPhoto } = require('./fuelService');

      const tempTripId = taskId; // taskId holds the tempTripId we generated
      const {
        driverId,
        driverName,
        startOdometer,
        startLocation,
        endLocation,
        middleLocations,
        photoUri,
        location,
      } = payload;

      // 1. Start the trip on Firestore
      const realTripId = await startTrip(
        driverId as string,
        driverName as string,
        startOdometer as number,
        startLocation as string,
        endLocation as string,
        middleLocations as string[],
      );

      // 2. Link accepted tasks
      try {
        await linkAcceptedTasksToTrip(driverId as string, realTripId);
      } catch (e) {
        console.log('Sync: failed to link tasks:', e);
      }

      // 3. Create start odometer reading
      try {
        const readingId = await addOdometerReading({
          driverId: driverId as string,
          driverName: driverName as string,
          reading: startOdometer as number,
          type: 'trip_start',
          location: (location as any) || undefined,
          tripId: realTripId,
          timestamp: Date.now(),
          verified: false,
        });

        if (photoUri && ((photoUri as string).startsWith('file://') || (photoUri as string).startsWith('/'))) {
          try {
            await uploadOdometerPhoto(readingId, photoUri as string);
          } catch (e) {
            console.log('Sync: failed to upload start odometer photo:', e);
          }
        }
      } catch (e) {
        console.log('Sync: failed to create start odometer reading:', e);
      }

      // 4. Update the active trip local cache if it is still active and matches this temp ID
      try {
        const rawActive = await AsyncStorage.getItem('@pickpack_active_trip');
        if (rawActive) {
          const activeTrip = JSON.parse(rawActive);
          if (activeTrip.id === tempTripId) {
            activeTrip.id = realTripId;
            await AsyncStorage.setItem('@pickpack_active_trip', JSON.stringify(activeTrip));
          }
        }
      } catch {}

      // 5. CRITICAL: Remap any subsequent offline queue actions that refer to tempTripId!
      try {
        const rawQueue = await AsyncStorage.getItem(QUEUE_KEY);
        if (rawQueue) {
          const queue = JSON.parse(rawQueue) as OfflineQueueItem[];
          const mappedQueue = queue.map(qItem => {
            let updated = false;
            let newTaskId = qItem.taskId;
            let newPayload = { ...qItem.payload };

            if (qItem.taskId === tempTripId) {
              newTaskId = realTripId;
              updated = true;
            }

            if (qItem.payload && qItem.payload.tripId === tempTripId) {
              newPayload.tripId = realTripId;
              updated = true;
            }

            if (updated) {
              return { ...qItem, taskId: newTaskId, payload: newPayload };
            }
            return qItem;
          });
          await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(mappedQueue));
        }
      } catch (e) {
        console.log('Sync: error remapping tempTripId:', e);
      }

      break;
    }

    case 'end_trip': {
      const { endTrip } = require('./tripService');
      const { addOdometerReading, uploadOdometerPhoto } = require('./fuelService');
      const { db } = require('./firebase');
      const { doc, setDoc } = require('firebase/firestore');

      const realTripId = taskId; // This will already be remapped to the real ID by step 5 above!
      const { endOdometer, photoUri, location } = payload;

      let driverId = '';
      let driverName = '';
      try {
        const { getTripById } = require('./tripService');
        const tripObj = await getTripById(realTripId);
        if (tripObj) {
          driverId = tripObj.driverId;
          driverName = tripObj.driverName;
        }
      } catch {}

      // 1. Create end odometer reading
      try {
        const readingId = await addOdometerReading({
          driverId: driverId,
          driverName: driverName,
          reading: endOdometer as number,
          type: 'trip_end',
          location: (location as any) || undefined,
          tripId: realTripId,
          timestamp: Date.now(),
          verified: false,
        });

        if (photoUri && ((photoUri as string).startsWith('file://') || (photoUri as string).startsWith('/'))) {
          try {
            await uploadOdometerPhoto(readingId, photoUri as string);
          } catch (e) {
            console.log('Sync: failed to upload end odometer photo:', e);
          }
        }
      } catch (e) {
        console.log('Sync: failed to create end odometer reading:', e);
      }

      // 2. End the trip session on Firestore
      await endTrip(realTripId, endOdometer as number);

      // 3. Mark driver as offline
      if (driverId) {
        try {
          await setDoc(
            doc(db, 'drivers', driverId),
            { isOnline: false },
            { merge: true }
          );
        } catch {}
      }

      break;
    }

    case 'add_odometer_reading': {
      const { addOdometerReading, uploadOdometerPhoto } = require('./fuelService');
      const { reading, photoUri } = payload as any;

      const readingId = await addOdometerReading(reading);

      if (photoUri && (photoUri.startsWith('file://') || photoUri.startsWith('/'))) {
        try {
          await uploadOdometerPhoto(readingId, photoUri);
        } catch (e) {
          console.log('Sync: standalone odometer photo upload failed:', e);
        }
      }
      break;
    }

    default:
      throw new Error(`Unknown offline action: ${action}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. CLEANUP — call on logout
// ═══════════════════════════════════════════════════════════════════

/** Clear all offline data (call on logout) */
export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    clearQueue(),
    clearTaskCache(),
    AsyncStorage.removeItem(LAST_SYNC_KEY),
  ]);
}
