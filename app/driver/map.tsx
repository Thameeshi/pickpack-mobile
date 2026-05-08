import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Dimensions, Platform, Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '../../src/services/firebase';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');

// Default region — Colombo, Sri Lanka
const DEFAULT_REGION = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

interface TaskLocation {
  id: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  recipientName: string;
  status: string;
}

export default function DriverMapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTasks, setActiveTasks] = useState<TaskLocation[]>([]);
  const [heading, setHeading] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(true);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // Watch driver location
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your map.');
        setLoading(false);
        return;
      }

      // Get initial position
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mounted) {
        setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setHeading(loc.coords.heading ?? null);
        setLoading(false);
      }

      // Watch position
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          if (mounted) {
            setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setHeading(loc.coords.heading ?? null);
          }
        }
      );
    })();

    return () => {
      mounted = false;
      locationSub.current?.remove();
    };
  }, []);

  // Subscribe to active tasks assigned to this driver
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, 'tasks'),
      where('assignedDriverId', '==', userId),
    );

    const unsub = onSnapshot(q, (snap) => {
      const tasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as TaskLocation))
        .filter(t => !['delivered', 'failed'].includes(t.status));
      setActiveTasks(tasks);
    }, () => {});

    return unsub;
  }, []);

  // Subscribe to active trip breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState<{ lat: number; lng: number }[]>([]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, 'tripSessions'),
      where('driverId', '==', userId),
      where('status', '==', 'active'),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const trip = snap.docs[0].data();
        const crumbs = (trip.routeBreadcrumbs || []).map((b: any) => ({
          lat: b.lat,
          lng: b.lng,
        }));
        setBreadcrumbs(crumbs);
      } else {
        setBreadcrumbs([]);
      }
    }, () => {});

    return unsub;
  }, []);

  const centerOnMe = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  const region = currentLocation
    ? { latitude: currentLocation.lat, longitude: currentLocation.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🗺️ My Map</Text>
        <TouchableOpacity onPress={centerOnMe}>
          <Text style={styles.centerBtn}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
          showsUserLocation={false}
          showsCompass={true}
          showsScale={true}
          followsUserLocation={tracking}
        >
          {/* Driver's current position */}
          {currentLocation && (
            <Marker
              coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.driverMarker}>
                <View style={styles.driverMarkerInner}>
                  <Text style={styles.driverMarkerIcon}>🚚</Text>
                </View>
                <View style={styles.driverMarkerPulse} />
              </View>
            </Marker>
          )}

          {/* Active task delivery markers */}
          {activeTasks.map(task => (
            <React.Fragment key={task.id}>
              {task.deliveryLatitude && task.deliveryLongitude && (
                <Marker
                  coordinate={{ latitude: task.deliveryLatitude, longitude: task.deliveryLongitude }}
                  title={`📦 ${task.recipientName}`}
                  description={task.deliveryLocation}
                  pinColor={task.status === 'in_progress' ? '#EF4444' : task.status === 'arrived' ? '#10B981' : '#3B82F6'}
                >
                  <View style={[styles.taskMarker, { borderColor: task.status === 'in_progress' ? '#EF4444' : '#3B82F6' }]}>
                    <Text style={styles.taskMarkerIcon}>📦</Text>
                  </View>
                </Marker>
              )}
              {task.pickupLatitude && task.pickupLongitude && (
                <Marker
                  coordinate={{ latitude: task.pickupLatitude, longitude: task.pickupLongitude }}
                  title={`🏪 Pickup`}
                  description={task.pickupLocation}
                  pinColor="#F59E0B"
                >
                  <View style={[styles.taskMarker, { borderColor: '#F59E0B' }]}>
                    <Text style={styles.taskMarkerIcon}>🏪</Text>
                  </View>
                </Marker>
              )}
            </React.Fragment>
          ))}

          {/* Route breadcrumb trail */}
          {breadcrumbs.length > 1 && (
            <Polyline
              coordinates={breadcrumbs.map(b => ({ latitude: b.lat, longitude: b.lng }))}
              strokeColor={COLORS.PRIMARY_LIGHT}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}

          {/* Line from current location to active delivery */}
          {currentLocation && activeTasks.filter(t => t.deliveryLatitude && t.status === 'in_progress').map(t => (
            <Polyline
              key={`route-${t.id}`}
              coordinates={[
                { latitude: currentLocation.lat, longitude: currentLocation.lng },
                { latitude: t.deliveryLatitude!, longitude: t.deliveryLongitude! },
              ]}
              strokeColor="#EF4444"
              strokeWidth={3}
              lineDashPattern={[10, 5]}
            />
          ))}
        </MapView>

        {/* Active Trip info overlay */}
        <View style={styles.infoOverlay}>
          {breadcrumbs.length > 0 && (
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🚚</Text>
              <Text style={[styles.infoText, { color: COLORS.SUCCESS, fontWeight: '700' }]}>Active Trip</Text>
            </View>
          )}
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>
              {currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Locating...'}
            </Text>
          </View>
          {activeTasks.length > 0 && (
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📦</Text>
              <Text style={styles.infoText}>{activeTasks.length} active {activeTasks.length === 1 ? 'task' : 'tasks'}</Text>
            </View>
          )}
          {breadcrumbs.length > 0 && (
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🛤️</Text>
              <Text style={styles.infoText}>{breadcrumbs.length} waypoints</Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Text style={{ fontSize: 12 }}>🚚</Text>
            <Text style={styles.legendText}>You</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={{ fontSize: 12 }}>📦</Text>
            <Text style={styles.legendText}>Delivery</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={{ fontSize: 12 }}>🏪</Text>
            <Text style={styles.legendText}>Pickup</Text>
          </View>
        </View>

        {/* Active tasks bottom cards */}
        {activeTasks.length > 0 && (
          <View style={styles.taskCards}>
            {activeTasks.slice(0, 3).map(t => (
              <TouchableOpacity
                key={t.id}
                style={styles.taskCard}
                onPress={() => router.push(`/driver/taskDetails?taskId=${t.id}`)}
              >
                <View style={[styles.taskCardStatus, { backgroundColor: t.status === 'in_progress' ? '#EF4444' : t.status === 'arrived' ? '#10B981' : '#3B82F6' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskCardTitle} numberOfLines={1}>📦 {t.recipientName}</Text>
                  <Text style={styles.taskCardSub} numberOfLines={1}>{t.deliveryLocation}</Text>
                </View>
                <Text style={styles.taskCardArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  loadingText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500, marginTop: SPACING.LG },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  centerBtn: { fontSize: 24 },

  // Map
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  // Driver marker
  driverMarker: { alignItems: 'center', justifyContent: 'center' },
  driverMarkerInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.PRIMARY, borderWidth: 3, borderColor: COLORS.WHITE,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.LG, zIndex: 2,
  },
  driverMarkerIcon: { fontSize: 22 },
  driverMarkerPulse: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(30,64,175,0.15)', zIndex: 1,
  },

  // Task markers
  taskMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.WHITE, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.MD,
  },
  taskMarkerIcon: { fontSize: 16 },

  // Info overlay
  infoOverlay: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: RADIUS.MD,
    padding: SPACING.SM, paddingHorizontal: SPACING.MD,
    ...SHADOWS.SM,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  infoIcon: { fontSize: 14 },
  infoText: { fontSize: 11, fontWeight: '600', color: COLORS.GRAY_700 },

  // Legend
  legend: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: RADIUS.MD,
    padding: SPACING.SM, ...SHADOWS.SM,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 1 },
  legendText: { fontSize: 10, fontWeight: '600', color: COLORS.GRAY_600 },

  // Bottom task cards
  taskCards: {
    position: 'absolute', bottom: 20, left: SPACING.LG, right: SPACING.LG,
    gap: 8,
  },
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.MD, ...SHADOWS.MD,
  },
  taskCardStatus: {
    width: 6, height: 36, borderRadius: 3, marginRight: SPACING.MD,
  },
  taskCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.GRAY_900 },
  taskCardSub: { fontSize: 11, color: COLORS.GRAY_500, marginTop: 2 },
  taskCardArrow: { fontSize: 18, color: COLORS.GRAY_400, fontWeight: '700' },
});
