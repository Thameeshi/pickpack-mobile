import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useTasksByDriver } from '../../src/hooks/useTasks';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getActiveTrip } from '../../src/services/tripService';
import { getFuelExpensesByDriver } from '../../src/services/fuelService';
import { Task, TaskStatus, TripSession, TASK_STATUS_LABELS, FuelExpense } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';
import { startTrackingDriverLocation, stopTrackingDriverLocation } from '../../src/services/locationService';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import * as Location from 'expo-location';

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: COLORS.GRAY_400,
  assigned: COLORS.PRIMARY_LIGHT,
  accepted: COLORS.INFO,
  in_progress: COLORS.SECONDARY,
  arrived: COLORS.WARNING,
  delivered: COLORS.SUCCESS,
  failed: COLORS.DANGER,
};

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const { tasks, loading, refetch } = useTasksByDriver(user?.uid || '');
  const { unreadCount } = useNotifications(user?.uid || '');
  const [refreshing, setRefreshing] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [activeTrip2, setActiveTrip2] = useState<TripSession | null>(null);
  const [fuelExpenses, setFuelExpenses] = useState<FuelExpense[]>([]);
  const [currentAddress, setCurrentAddress] = useState<string>('Locating...');

  // Load active trip session & fuel expenses
  useFocusEffect(useCallback(() => {
    if (user?.uid) {
      getActiveTrip(user.uid).then(setActiveTrip2).catch(() => {});
      getFuelExpensesByDriver(user.uid).then(setFuelExpenses).catch(() => {});
    }
  }, [user?.uid]));

  // Refetch when screen is focused
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  // Start location tracking when driver has an active trip
  const activeTrip = tasks.find(t => t.status === 'in_progress' || t.status === 'arrived');
  useEffect(() => {
    if (activeTrip && user?.uid && !trackingActive) {
      startTrackingDriverLocation(user.uid).then(() => setTrackingActive(true)).catch(() => {});
    } else if (!activeTrip && trackingActive) {
      stopTrackingDriverLocation();
      setTrackingActive(false);
    }
    return () => { stopTrackingDriverLocation(); };
  }, [activeTrip?.id, user?.uid]);

  // Track driver's current location for UI display
  useEffect(() => {
    let subscription: Location.LocationSubscription;
    if (activeTrip) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setCurrentAddress('Location permission denied');
            return;
          }
          subscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 50 },
            async (location) => {
              try {
                const geocode = await Location.reverseGeocodeAsync({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude
                });
                if (geocode.length > 0) {
                  const place = geocode[0];
                  setCurrentAddress(`${place.street || ''} ${place.city || ''}`.trim() || 'Unknown Location');
                }
              } catch (e) {}
            }
          );
        } catch (error) {
          setCurrentAddress('Error getting location');
        }
      })();
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [activeTrip?.id]);

  const handleRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const completedToday = tasks.filter(t => {
    if (t.status !== 'delivered' || !t.completedAt) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return t.completedAt >= today.getTime();
  }).length;

  const assignedTrips = tasks.filter(t => t.status === 'assigned');
  const historyTrips = tasks.filter(t => t.status === 'delivered' || t.status === 'failed');

  const totalFuelSpent = fuelExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.totalCost, 0);
  const totalLitres = fuelExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.litres, 0);

  if (loading && !refreshing && tasks.length === 0) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hello, {profile?.name || 'Driver'} 👋</Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/driver/notifications')}>
              <Text style={styles.notifBtnText}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/driver/profile')}>
              <Text style={styles.profileBtnText}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ width: 40, height: 3, backgroundColor: COLORS.ACCENT, borderRadius: 2, marginTop: SPACING.SM }} />
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* ═══ ONGOING TRIP (SMALL CARD) ═══ */}
            {activeTrip && (
              <TouchableOpacity 
                style={styles.smallActiveTaskCard}
                onPress={() => router.push(`/driver/taskDetails?taskId=${activeTrip.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.smallTaskIconContainer}>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                </View>
                <View style={styles.smallTaskInfo}>
                  <View style={{ marginBottom: SPACING.SM }}>
                    <Text style={[styles.smallTaskLabel, { color: COLORS.PRIMARY }]}>CURRENT LOCATION</Text>
                    <Text style={styles.smallTaskAddress} numberOfLines={1}>{currentAddress}</Text>
                  </View>
                  <View>
                    <Text style={styles.smallTaskLabel}>ONGOING TRIP TO</Text>
                    <Text style={styles.smallTaskAddress} numberOfLines={1}>{activeTrip.deliveryLocation}</Text>
                  </View>
                </View>
                <Text style={styles.smallTaskArrow}>➔</Text>
              </TouchableOpacity>
            )}

            {/* ═══ TODAY'S STATS ═══ */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: COLORS.PRIMARY }]}>{assignedTrips.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: activeTrip ? COLORS.SUCCESS : COLORS.GRAY_400 }]}>
                  {activeTrip ? 1 : 0}
                </Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: COLORS.SUCCESS }]}>{completedToday}</Text>
                <Text style={styles.statLabel}>Done Today</Text>
              </View>
            </View>

            {/* ═══ QUICK ACTIONS (GRID) ═══ */}
            <View style={styles.gridContainer}>
              {!activeTrip2 ? (
                <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/tripStart')}>
                  <Image source={require('../../assets/icons/new-trip.png')} style={styles.gridImageIcon} />
                  <Text style={styles.gridCardLabel}>Start Trip</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.gridCard, { borderWidth: 2, borderColor: COLORS.SUCCESS }]} onPress={() => router.push('/driver/tripEnd')}>
                  <Image source={require('../../assets/icons/end-trip.png')} style={styles.gridImageIcon} />
                  <Text style={styles.gridCardLabel}>End Trip</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/odometer')}>
                <Image source={require('../../assets/icons/odometer.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Odometer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/fuelExpense')}>
                <Image source={require('../../assets/icons/fuel.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Fuel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/taskHistory')}>
                <Image source={require('../../assets/icons/recent-trip.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Recent Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/qrScanner')}>
                <Image source={require('../../assets/icons/qr-scan.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>QR Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridCard} onPress={() => console.log('Navigate to Map')}>
                <Image source={require('../../assets/icons/track.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Map View</Text>
              </TouchableOpacity>
            </View>

            {/* ═══ FUEL SUMMARY ═══ */}
            <TouchableOpacity 
              style={styles.fuelSummaryCard} 
              onPress={() => router.push('/driver/fuelHistory')}
              activeOpacity={0.8}
            >
              <View style={styles.fuelSummaryHeader}>
                <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0, fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 }]}>⛽ Fuel Summary</Text>
                <Text style={styles.fuelSummaryLink}>View History →</Text>
              </View>
              <View style={styles.fuelSummaryStats}>
                <View style={styles.fuelStat}>
                  <Text style={styles.fuelStatValue}>LKR {totalFuelSpent.toFixed(0)}</Text>
                  <Text style={styles.fuelStatLabel}>Total Spent</Text>
                </View>
                <View style={styles.fuelStatDivider} />
                <View style={styles.fuelStat}>
                  <Text style={styles.fuelStatValue}>{totalLitres.toFixed(1)} L</Text>
                  <Text style={styles.fuelStatLabel}>Total Litres</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* ═══ ASSIGNED TRIPS (waiting to start) ═══ */}
            {assignedTrips.length > 0 && (
              <Text style={styles.sectionTitle}>📌 Assigned Trips</Text>
            )}
          </>
        }
        keyExtractor={() => 'header'}
        ListFooterComponent={
          <>
            {/* Assigned trips list */}
            {assignedTrips.map(trip => (
              <TouchableOpacity
                key={trip.id}
                style={styles.tripCard}
                onPress={() => router.push(`/driver/taskDetails?taskId=${trip.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.tripCardHeader}>
                  <View style={[styles.priorityBadge, {
                    backgroundColor: trip.priority === 'HIGH' ? COLORS.DANGER
                      : trip.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS
                  }]}>
                    <Text style={styles.priorityText}>{trip.priority}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: COLORS.PRIMARY_LIGHT + '20' }]}>
                    <Text style={[styles.statusChipText, { color: COLORS.PRIMARY_LIGHT }]}>📌 Assigned</Text>
                  </View>
                </View>

                <View style={styles.tripCardRoute}>
                  <View style={styles.tripRouteRow}>
                    <View style={[styles.routeDotSmall, { backgroundColor: COLORS.PRIMARY }]} />
                    <Text style={styles.tripRouteText} numberOfLines={1}>{trip.pickupLocation}</Text>
                  </View>
                  <View style={styles.tripRouteDivider} />
                  <View style={styles.tripRouteRow}>
                    <View style={[styles.routeDotSmall, { backgroundColor: COLORS.SUCCESS }]} />
                    <Text style={styles.tripRouteText} numberOfLines={1}>{trip.deliveryLocation}</Text>
                  </View>
                </View>

                <View style={styles.tripCardFooter}>
                  <Text style={styles.tripCardRecipient}>👤 {trip.recipientName}</Text>
                  <TouchableOpacity
                    style={styles.startTripBtn}
                    onPress={() => router.push(`/driver/taskDetails?taskId=${trip.id}`)}
                  >
                    <Text style={styles.startTripBtnText}>Start →</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {/* Empty block, recent trips moved to its own screen */}

            <View style={{ height: SPACING.XXXL * 2 }} />
          </>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.XL,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    marginBottom: SPACING.MD,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  headerSubtitle: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.7, marginTop: SPACING.XS },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileBtnText: { fontSize: 20 },
  listContent: { paddingHorizontal: SPACING.XL },

  // ═══ Small Ongoing Trip Card ═══
  smallActiveTaskCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG, padding: SPACING.LG, marginBottom: SPACING.LG,
    ...SHADOWS.MD, borderWidth: 1, borderColor: COLORS.GRAY_200,
  },
  smallTaskIconContainer: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.SUCCESS + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  smallTaskInfo: { flex: 1 },
  smallTaskLabel: { fontSize: 10, fontWeight: '800', color: COLORS.SUCCESS, letterSpacing: 0.5, marginBottom: 2 },
  smallTaskAddress: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900 },
  smallTaskArrow: { fontSize: FONT_SIZES.LG, color: COLORS.GRAY_400, marginLeft: SPACING.SM },

  // ═══ Stats ═══
  statsRow: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG },
  statCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    paddingVertical: SPACING.MD, alignItems: 'center', ...SHADOWS.SM,
  },
  statNumber: { fontSize: FONT_SIZES.XXL, fontWeight: '800' },
  statLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2, fontWeight: '600' },

  // ═══ Action Grid ═══
  gridContainer: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginTop: SPACING.XL, marginBottom: SPACING.XL,
  },
  gridCard: {
    width: '48%', backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.XL, alignItems: 'center', marginBottom: SPACING.MD,
    justifyContent: 'center', ...SHADOWS.MD, minHeight: 120,
  },
  gridIcon: { fontSize: 32, marginBottom: SPACING.SM },
  gridImageIcon: { width: 64, height: 64, marginBottom: SPACING.SM, resizeMode: 'contain' },
  gridCardLabel: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.GRAY_800 },

  // ═══ Fuel Summary ═══
  fuelSummaryCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.XL,
    marginBottom: SPACING.XL, ...SHADOWS.MD, borderWidth: 1, borderColor: COLORS.GRAY_100,
  },
  fuelSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.LG },
  fuelSummaryLink: { fontSize: FONT_SIZES.SM, color: COLORS.PRIMARY, fontWeight: '700' },
  fuelSummaryStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  fuelStat: { alignItems: 'center', flex: 1 },
  fuelStatValue: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900 },
  fuelStatLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600', marginTop: SPACING.XS },
  fuelStatDivider: { width: 1, height: 40, backgroundColor: COLORS.GRAY_200 },

  // ═══ Section ═══
  sectionTitle: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900, marginTop: SPACING.XL, marginBottom: SPACING.MD },

  // ═══ Trip Card (assigned) ═══
  tripCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.MD, ...SHADOWS.MD,
  },
  tripCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.MD },
  priorityBadge: { paddingHorizontal: SPACING.SM, paddingVertical: SPACING.XS, borderRadius: RADIUS.SM },
  priorityText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XS, fontWeight: '700' },
  statusChip: { paddingHorizontal: SPACING.SM, paddingVertical: SPACING.XS, borderRadius: RADIUS.FULL },
  statusChipText: { fontSize: FONT_SIZES.XS, fontWeight: '600' },
  tripCardRoute: { marginBottom: SPACING.MD },
  tripRouteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS },
  routeDotSmall: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.MD },
  tripRouteText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_800, flex: 1 },
  tripRouteDivider: { width: 2, height: 16, backgroundColor: COLORS.GRAY_200, marginLeft: 3, marginBottom: SPACING.XS },
  tripCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripCardRecipient: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600 },
  startTripBtn: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD },
  startTripBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.SM },

  // ═══ History ═══
  historyCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.SM, ...SHADOWS.SM,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  historyIcon: { fontSize: 20, marginRight: SPACING.MD },
  historyAddr: { fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800, maxWidth: 180 },
  historyDate: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, marginTop: 2 },
  historyRecipient: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },

  // ═══ Notifications ═══
  notifBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.WHITE + '20',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  notifBtnText: { fontSize: 20 },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: COLORS.ACCENT, borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.PRIMARY,
  },
  notifBadgeText: { color: COLORS.PRIMARY_DARK, fontSize: 9, fontWeight: '800' },
});
