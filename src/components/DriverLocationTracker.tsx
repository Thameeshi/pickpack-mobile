import { useAuth } from '../hooks/useAuth';
import {
  useDriverLocationTracking,
  useShouldTrackDriverLocation,
} from '../hooks/useDriverLocationTracking';

/** App-wide GPS publisher for drivers (mounted in root layout). */
export function DriverLocationTracker() {
  const { user, profile } = useAuth();
  const isDriver = profile?.role === 'driver';
  const driverId = isDriver ? user?.uid : undefined;
  const shouldTrack = useShouldTrackDriverLocation(driverId);

  useDriverLocationTracking(driverId, shouldTrack);

  return null;
}
