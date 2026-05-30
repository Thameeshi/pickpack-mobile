import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDrivers, useDriverLocations } from '../../src/hooks/useDrivers';
import { getDriversTripStatus } from '../../src/services/tripService';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');

// Colombo, Sri Lanka default region
const DEFAULT_REGION = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

// Color-coded based on whether they have recent movement
function getMarkerColor(speed?: number | null): string {
  if (!speed || speed < 1) return '#F59E0B'; // idle — amber
  if (speed < 10) return '#3B82F6'; // transit — blue
  return '#10B981'; // moving fast — green
}

export default function DriverTrackingScreen() {
  const router = useRouter();
  const { driverId: focusDriverId } = useLocalSearchParams<{ driverId?: string }>();
  const { drivers, loading } = useDrivers();
  const locations = useDriverLocations();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [driverTripStatus, setDriverTripStatus] = useState<Record<string, boolean>>({});
  const mapRef = useRef<MapView>(null);

  // Fetch trip status for all drivers
  useEffect(() => {
    if (drivers.length > 0) {
      const ids = drivers.map(d => d.uid);
      getDriversTripStatus(ids)
        .then(setDriverTripStatus)
        .catch(() => {});
    }
  }, [drivers]);

  // Deep link from driver details → focus that driver on the map
  useEffect(() => {
    if (!focusDriverId || loading) return;
    const id = Array.isArray(focusDriverId) ? focusDriverId[0] : focusDriverId;
    const loc = locations[id];
    if (!loc || !mapRef.current) return;
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
      setSelectedDriver(id);
    }, 400);
    return () => clearTimeout(timer);
  }, [focusDriverId, loading, locations]);

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  // Merge driver info with live locations
  const driversWithLocations = drivers.map(d => ({
    ...d,
    liveLocation: locations[d.uid],
    hasLocation: !!locations[d.uid],
  }));

  const onlineDrivers = driversWithLocations.filter(d => d.hasLocation);
  const offlineDrivers = driversWithLocations.filter(d => !d.hasLocation);

  // Fit map to show all online drivers
  const fitToDrivers = () => {
    if (onlineDrivers.length === 0 || !mapRef.current) return;
    const coords = onlineDrivers.map(d => ({
      latitude: d.liveLocation!.lat,
      longitude: d.liveLocation!.lng,
    }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  };

  const focusDriver = (driverId: string) => {
    const d = onlineDrivers.find(x => x.uid === driverId);
    if (d && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: d.liveLocation!.lat,
        longitude: d.liveLocation!.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
      setSelectedDriver(driverId);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🗺️ Live Tracking</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* View Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>📋 List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
          onPress={() => setViewMode('map')}
        >
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>🗺️ Map</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.SUCCESS }]}>{onlineDrivers.length}</Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.WARNING }]}>{Object.values(driverTripStatus).filter(Boolean).length}</Text>
          <Text style={styles.statLabel}>On Trip</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.GRAY_400 }]}>{offlineDrivers.length}</Text>
          <Text style={styles.statLabel}>Offline</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.PRIMARY }]}>{drivers.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={DEFAULT_REGION}
            showsUserLocation={false}
            showsCompass={true}
            showsScale={true}
            onMapReady={fitToDrivers}
          >
            {onlineDrivers.map(d => (
              <Marker
                key={d.uid}
                coordinate={{
                  latitude: d.liveLocation!.lat,
                  longitude: d.liveLocation!.lng,
                }}
                title={d.displayName}
                description={`${d.vehiclePlate || 'No plate'} • ${d.phoneNumber || ''}`}
                pinColor={getMarkerColor(d.liveLocation?.speed)}
                onPress={() => setSelectedDriver(d.uid)}
              >
                {/* Custom marker */}
                <View style={[styles.customMarker, { borderColor: getMarkerColor(d.liveLocation?.speed) }]}>
                  <Text style={styles.markerText}>{d.displayName[0]?.toUpperCase() || 'D'}</Text>
                </View>
                <Callout style={styles.callout}>
                  <View>
                    <Text style={styles.calloutTitle}>{d.displayName}</Text>
                    <Text style={styles.calloutSub}>{d.vehiclePlate || 'No plate'}</Text>
                    <Text style={styles.calloutSub}>📍 {d.liveLocation!.lat.toFixed(4)}, {d.liveLocation!.lng.toFixed(4)}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* Map legend overlay */}
          <View style={styles.legendOverlay}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Moving</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>Transit</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Idle</Text>
            </View>
          </View>

          {/* Fit all button */}
          <TouchableOpacity style={styles.fitBtn} onPress={fitToDrivers}>
            <Text style={styles.fitBtnText}>📍 Fit All</Text>
          </TouchableOpacity>

          {/* Bottom driver list (horizontal scroll) */}
          {onlineDrivers.length > 0 && (
            <FlatList
              horizontal
              data={onlineDrivers}
              keyExtractor={d => d.uid}
              style={styles.bottomList}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12 }}
              renderItem={({ item: d }) => (
                <TouchableOpacity
                  style={[styles.bottomCard, selectedDriver === d.uid && styles.bottomCardSelected]}
                  onPress={() => focusDriver(d.uid)}
                >
                  <View style={[styles.bottomAvatar, { backgroundColor: getMarkerColor(d.liveLocation?.speed) }]}>
                    <Text style={styles.bottomAvatarText}>{d.displayName[0]?.toUpperCase() || 'D'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bottomName} numberOfLines={1}>{d.displayName}</Text>
                    <Text style={styles.bottomSub}>
                      {d.vehiclePlate || 'No plate'}
                      {driverTripStatus[d.uid] ? ' • 🚚 On Trip' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={[...onlineDrivers, ...offlineDrivers]}
          keyExtractor={d => d.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item: d }) => (
            <TouchableOpacity
              style={styles.driverCard}
              onPress={() => {
                if (d.hasLocation) {
                  setViewMode('map');
                  setTimeout(() => focusDriver(d.uid), 300);
                }
              }}
            >
              <View style={styles.driverCardLeft}>
                <View style={[styles.avatar, { backgroundColor: d.hasLocation ? COLORS.SUCCESS : COLORS.GRAY_300 }]}>
                  <Text style={styles.avatarText}>{d.displayName[0]?.toUpperCase() || 'D'}</Text>
                </View>
                <View style={styles.driverInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.driverName}>{d.displayName}</Text>
                    <View style={[styles.onlineBadge, { backgroundColor: d.hasLocation ? COLORS.SUCCESS : COLORS.GRAY_300 }]}>
                      <Text style={styles.onlineText}>{d.hasLocation ? 'Online' : 'Offline'}</Text>
                    </View>
                    {driverTripStatus[d.uid] && (
                      <View style={[styles.onlineBadge, { backgroundColor: COLORS.WARNING }]}>
                        <Text style={styles.onlineText}>🚚 On Trip</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.driverDetail}>
                    {d.vehiclePlate || 'No plate'} • {d.phoneNumber || 'No phone'}
                  </Text>
                  {d.liveLocation && (
                    <Text style={styles.locationText}>
                      📍 {d.liveLocation.lat.toFixed(4)}, {d.liveLocation.lng.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
              {d.hasLocation && <Text style={styles.mapPinIcon}>📍</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚚</Text>
              <Text style={styles.emptyText}>No drivers registered yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  toggleRow: {
    flexDirection: 'row', marginHorizontal: SPACING.XL, marginTop: SPACING.LG,
    backgroundColor: COLORS.GRAY_100, borderRadius: RADIUS.LG, padding: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: COLORS.WHITE, ...SHADOWS.SM },
  toggleText: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_500 },
  toggleTextActive: { color: COLORS.PRIMARY },
  statsRow: {
    flexDirection: 'row', gap: SPACING.MD, paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.LG,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.MD, alignItems: 'center', ...SHADOWS.SM,
  },
  statNumber: { fontSize: FONT_SIZES.XXL, fontWeight: '800' },
  statLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600', marginTop: 2 },

  // Map styles
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  customMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.WHITE, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.MD,
  },
  markerText: { fontWeight: '800', fontSize: 16, color: COLORS.GRAY_800 },
  callout: { width: 160, padding: 4 },
  calloutTitle: { fontWeight: '700', fontSize: 14, color: COLORS.GRAY_900, marginBottom: 2 },
  calloutSub: { fontSize: 11, color: COLORS.GRAY_500 },

  // Legend
  legendOverlay: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: RADIUS.MD,
    padding: SPACING.SM, paddingHorizontal: SPACING.MD,
    flexDirection: 'row', gap: SPACING.MD,
    ...SHADOWS.SM,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, fontWeight: '600', color: COLORS.GRAY_600 },

  // Fit button
  fitBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.MD,
    paddingVertical: 8, paddingHorizontal: 14,
    ...SHADOWS.MD,
  },
  fitBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.PRIMARY },

  // Bottom horizontal list
  bottomList: {
    position: 'absolute', bottom: 16, left: 0, right: 0,
    maxHeight: 90,
  },
  bottomCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.MD, marginHorizontal: 5, width: 180,
    ...SHADOWS.MD,
  },
  bottomCardSelected: {
    borderWidth: 2, borderColor: COLORS.PRIMARY,
  },
  bottomAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.SM,
  },
  bottomAvatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: 14 },
  bottomName: { fontSize: 13, fontWeight: '700', color: COLORS.GRAY_900 },
  bottomSub: { fontSize: 11, color: COLORS.GRAY_500 },

  // List view
  list: { paddingHorizontal: SPACING.XL, paddingBottom: SPACING.XXXL },
  driverCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  driverCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  avatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.LG },
  driverInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
  driverName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  onlineBadge: { paddingHorizontal: SPACING.SM, paddingVertical: 2, borderRadius: RADIUS.FULL },
  onlineText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XS, fontWeight: '600' },
  driverDetail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  locationText: { fontSize: FONT_SIZES.XS, color: COLORS.PRIMARY, marginTop: 2 },
  mapPinIcon: { fontSize: 20 },
  empty: { alignItems: 'center', paddingVertical: SPACING.XXXL },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.MD },
  emptyText: { fontSize: FONT_SIZES.LG, fontWeight: '600', color: COLORS.GRAY_500 },
});
