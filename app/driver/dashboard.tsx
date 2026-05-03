import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useTasksByDriver } from '../../src/hooks/useTasks';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getActiveTrip } from '../../src/services/tripService';
import { Task, TaskStatus, TripSession, TASK_STATUS_LABELS } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';
import { startTrackingDriverLocation, stopTrackingDriverLocation } from '../../src/services/locationService';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

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

  // Load active trip session
  useFocusEffect(useCallback(() => {
    if (user?.uid) {
      getActiveTrip(user.uid).then(setActiveTrip2).catch(() => {});
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

  const handleRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const completedToday = tasks.filter(t => {
    if (t.status !== 'delivered' || !t.completedAt) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return t.completedAt >= today.getTime();
  }).length;

  const assignedTrips = tasks.filter(t => t.status === 'assigned');
  const historyTrips = tasks.filter(t => t.status === 'delivered' || t.status === 'failed');

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

        {/* Trip Start/End Controls */}
        {!activeTrip2 ? (
          <TouchableOpacity
            style={styles.tripStartBtn}
            onPress={() => router.push('/driver/tripStart')}
          >
            <Text style={styles.tripStartBtnText}>🚀 Start Trip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.tripActiveBar}>
            <View style={styles.tripActiveInfo}>
              <View style={styles.tripActiveDot} />
              <Text style={styles.tripActiveText}>Trip Active • {activeTrip2.startOdometer} km</Text>
            </View>
            <TouchableOpacity
              style={styles.tripEndBtn}
              onPress={() => router.push('/driver/tripEnd')}
            >
              <Text style={styles.tripEndBtnText}>🏁 End</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* ═══ ACTIVE TRIP CARD ═══ */}
            {activeTrip ? (
              <TouchableOpacity
                style={styles.activeTripCard}
                onPress={() => router.push(`/driver/taskDetails?taskId=${activeTrip.id}`)}
                activeOpacity={0.85}
              >
                <View style={styles.activeTripHeader}>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>ACTIVE TRIP</Text>
                  </View>
                  <Text style={styles.activeTripTime}>
                    Started {activeTrip.arrivedAt ? formatDateTime(activeTrip.arrivedAt) : ''}
                  </Text>
                </View>

                <View style={styles.activeTripRoute}>
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDotLarge, { backgroundColor: COLORS.PRIMARY }]} />
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeLabel}>FROM</Text>
                      <Text style={styles.routeAddress} numberOfLines={1}>{activeTrip.pickupLocation}</Text>
                    </View>
                  </View>
                  <View style={styles.routeLineActive} />
                  <View style={styles.routePoint}>
                    <View style={[styles.routeDotLarge, { backgroundColor: COLORS.SUCCESS }]} />
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeLabel}>TO</Text>
                      <Text style={styles.routeAddress} numberOfLines={1}>{activeTrip.deliveryLocation}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.activeTripFooter}>
                  <View style={styles.activeTripDetail}>
                    <Text style={styles.activeTripDetailIcon}>👤</Text>
                    <Text style={styles.activeTripDetailText}>{activeTrip.recipientName}</Text>
                  </View>
                  {activeTrip.itemCount && (
                    <View style={styles.activeTripDetail}>
                      <Text style={styles.activeTripDetailIcon}>📦</Text>
                      <Text style={styles.activeTripDetailText}>{activeTrip.itemCount} items</Text>
                    </View>
                  )}
                </View>

                {/* Action buttons on active trip */}
                <View style={styles.activeTripActions}>
                  {activeTrip.status === 'in_progress' && (
                    <TouchableOpacity
                      style={[styles.tripActionBtn, { backgroundColor: COLORS.SUCCESS }]}
                      onPress={() => router.push(`/driver/proofOfDelivery?taskId=${activeTrip.id}`)}
                    >
                      <Text style={styles.tripActionText}>✅ Complete Delivery</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.tripActionBtn, { backgroundColor: COLORS.PRIMARY }]}
                    onPress={() => router.push(`/driver/taskDetails?taskId=${activeTrip.id}`)}
                  >
                    <Text style={styles.tripActionText}>📋 Trip Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ) : (
              /* ═══ NO ACTIVE TRIP — START NEW ═══ */
              <View style={styles.noTripCard}>
                <Text style={styles.noTripIcon}>🚚</Text>
                <Text style={styles.noTripTitle}>No Active Trip</Text>
                <Text style={styles.noTripSubtext}>
                  {assignedTrips.length > 0
                    ? `You have ${assignedTrips.length} trip(s) waiting to start`
                    : 'Wait for a supervisor to assign you a trip'}
                </Text>
              </View>
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

            {/* ═══ QUICK ACTIONS ═══ */}
            <View style={styles.quickActionsBar}>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/driver/odometer')}>
                <Text style={styles.quickActionIcon}>🔢</Text>
                <Text style={styles.quickActionLabel}>Odometer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/driver/fuelExpense')}>
                <Text style={styles.quickActionIcon}>⛽</Text>
                <Text style={styles.quickActionLabel}>Fuel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/driver/qrScanner')}>
                <Text style={styles.quickActionIcon}>📷</Text>
                <Text style={styles.quickActionLabel}>QR Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/driver/fuelHistory')}>
                <Text style={styles.quickActionIcon}>📊</Text>
                <Text style={styles.quickActionLabel}>History</Text>
              </TouchableOpacity>
            </View>

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

            {/* Recent completed */}
            {historyTrips.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>📜 Recent Trips</Text>
                {historyTrips.slice(0, 5).map(trip => (
                  <TouchableOpacity
                    key={trip.id}
                    style={styles.historyCard}
                    onPress={() => router.push(`/driver/taskDetails?taskId=${trip.id}`)}
                  >
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyIcon}>{trip.status === 'delivered' ? '✅' : '❌'}</Text>
                      <View>
                        <Text style={styles.historyAddr} numberOfLines={1}>{trip.deliveryLocation}</Text>
                        <Text style={styles.historyDate}>
                          {trip.completedAt ? formatDateTime(trip.completedAt) : 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyRecipient}>{trip.recipientName}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

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
    borderBottomLeftRadius: RADIUS.XL, borderBottomRightRadius: RADIUS.XL,
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

  // ═══ Active Trip Card ═══
  activeTripCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.XL,
    marginTop: SPACING.XL, borderLeftWidth: 4, borderLeftColor: COLORS.SUCCESS,
    ...SHADOWS.LG,
  },
  activeTripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.LG },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.SUCCESS + '15', paddingHorizontal: SPACING.MD, paddingVertical: SPACING.XS, borderRadius: RADIUS.FULL },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.SUCCESS, marginRight: SPACING.SM },
  liveText: { fontSize: FONT_SIZES.XS, fontWeight: '800', color: COLORS.SUCCESS, letterSpacing: 1 },
  activeTripTime: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400 },
  activeTripRoute: { marginBottom: SPACING.LG },
  routePoint: { flexDirection: 'row', alignItems: 'center' },
  routeDotLarge: { width: 14, height: 14, borderRadius: 7, marginRight: SPACING.MD },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 10, fontWeight: '700', color: COLORS.GRAY_400, letterSpacing: 0.8 },
  routeAddress: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900, marginTop: 2 },
  routeLineActive: { width: 3, height: 24, backgroundColor: COLORS.GRAY_200, marginLeft: 6, marginVertical: SPACING.XS, borderRadius: 2 },
  activeTripFooter: { flexDirection: 'row', gap: SPACING.XL, marginBottom: SPACING.LG },
  activeTripDetail: { flexDirection: 'row', alignItems: 'center' },
  activeTripDetailIcon: { fontSize: 14, marginRight: SPACING.XS },
  activeTripDetailText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600 },
  activeTripActions: { gap: SPACING.SM },
  tripActionBtn: { paddingVertical: SPACING.MD, borderRadius: RADIUS.LG, alignItems: 'center' },
  tripActionText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },

  // ═══ No Trip Card ═══
  noTripCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.XXL,
    marginTop: SPACING.XL, alignItems: 'center', ...SHADOWS.MD,
  },
  noTripIcon: { fontSize: 48, marginBottom: SPACING.MD },
  noTripTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_800 },
  noTripSubtext: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.SM, textAlign: 'center' },

  // ═══ Stats ═══
  statsRow: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG },
  statCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    paddingVertical: SPACING.MD, alignItems: 'center', ...SHADOWS.SM,
  },
  statNumber: { fontSize: FONT_SIZES.XXL, fontWeight: '800' },
  statLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2, fontWeight: '600' },

  // ═══ Quick Actions ═══
  quickActionsBar: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG },
  quickActionBtn: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    paddingVertical: SPACING.MD, alignItems: 'center', ...SHADOWS.SM,
  },
  quickActionIcon: { fontSize: 24 },
  quickActionLabel: { fontSize: FONT_SIZES.XS, fontWeight: '600', color: COLORS.GRAY_600, marginTop: SPACING.XS },

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
    backgroundColor: COLORS.DANGER, borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.PRIMARY,
  },
  notifBadgeText: { color: COLORS.WHITE, fontSize: 9, fontWeight: '800' },

  // ═══ Trip Controls ═══
  tripStartBtn: {
    backgroundColor: COLORS.SUCCESS, paddingVertical: SPACING.MD,
    borderRadius: RADIUS.LG, alignItems: 'center', marginTop: SPACING.MD,
  },
  tripStartBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },
  tripActiveBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.SUCCESS + '20', borderRadius: RADIUS.LG,
    padding: SPACING.MD, marginTop: SPACING.MD,
  },
  tripActiveInfo: { flexDirection: 'row', alignItems: 'center' },
  tripActiveDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.SUCCESS,
    marginRight: SPACING.SM,
  },
  tripActiveText: { color: COLORS.SUCCESS, fontWeight: '700', fontSize: FONT_SIZES.SM },
  tripEndBtn: {
    backgroundColor: COLORS.DANGER, paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM, borderRadius: RADIUS.MD,
  },
  tripEndBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.SM },
});
