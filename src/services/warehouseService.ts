import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocationType = 'warehouse' | 'supermarket';

export interface LocationRecord {
  id: string;
  name: string;
  type: LocationType;
  address?: string;
  contact?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

const CACHE_KEY_WAREHOUSES = '@cached_warehouses';
const CACHE_KEY_SUPERMARKETS = '@cached_supermarkets';

/**
 * Fetch locations by type from Firestore. Falls back to cache when offline.
 */
export async function getLocationsByType(type: LocationType): Promise<LocationRecord[]> {
  const cacheKey = type === 'warehouse' ? CACHE_KEY_WAREHOUSES : CACHE_KEY_SUPERMARKETS;

  try {
    const q = query(collection(db, 'locations'), where('type', '==', type));
    const snap = await getDocs(q);
    const locations = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as LocationRecord))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Cache for offline use
    await AsyncStorage.setItem(cacheKey, JSON.stringify(locations));
    return locations;
  } catch (error) {
    console.log(`Failed to fetch ${type} locations from Firestore, using cache:`, error);
    return getCachedLocations(cacheKey);
  }
}

/**
 * Convenience wrappers
 */
export function getWarehouses(): Promise<LocationRecord[]> {
  return getLocationsByType('warehouse');
}

export function getSupermarkets(): Promise<LocationRecord[]> {
  return getLocationsByType('supermarket');
}

/**
 * Read cached locations from AsyncStorage
 */
async function getCachedLocations(cacheKey: string): Promise<LocationRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (stored) {
      return JSON.parse(stored) as LocationRecord[];
    }
  } catch (e) {
    console.log('Error reading cached locations:', e);
  }
  return [];
}
