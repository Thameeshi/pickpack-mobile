import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Image, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { useOfflineTasks } from '../../src/hooks/useOfflineTasks';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import { useNotifications } from '../../src/hooks/useNotifications';
import { offlineGetActiveTrip } from '../../src/services/tripService';
import { getFuelExpensesByDriver } from '../../src/services/fuelService';
import { Task, TaskStatus, TripSession, TASK_STATUS_LABELS, FuelExpense } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';
import { offlineAcceptTask, offlineGetTaskById, offlineRejectTask } from '../../src/services/taskService';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/services/firebase';

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
  const { isOnline, pendingCount, isSyncing, syncNow, refreshCounts } = useOfflineSync();
  const { tasks, loading, refetch } = useOfflineTasks(user?.uid || '', isOnline);
  const { unreadCount } = useNotifications(user?.uid || '');
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatusVisible, setSyncStatusVisible] = useState(false);
  const wasSyncingRef = useRef(false);
  const [activeTrip2, setActiveTrip2] = useState<TripSession | null>(null);
  const [nextProofTask, setNextProofTask] = useState<{ taskId: string; supervisorId?: string } | null>(null);
  const [fuelExpenses, setFuelExpenses] = useState<FuelExpense[]>([]);
  const [currentAddress, setCurrentAddress] = useState<string>('Locating...');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [lastMessageSender, setLastMessageSender] = useState('');
  const [lastMessageText, setLastMessageText] = useState('');

  // Reusable callback to load active trip session & fuel expenses
  const loadActiveTripAndExpenses = useCallback(() => {
    if (user?.uid) {
      offlineGetActiveTrip(user.uid).then(async (trip) => {
        setActiveTrip2(trip);
        if (trip?.taskIds && trip.taskIds.length > 0) {
          try {
            for (const tid of trip.taskIds) {
              const t = await offlineGetTaskById(tid);
              if (!t) continue;
              const missingProof = !t.proofOfDeliveryUrl || !t.signatureUrl || !t.deliveryDocumentUrl;
              const needsDelivery = t.status !== 'delivered';
              if (needsDelivery || missingProof) {
                setNextProofTask({ taskId: tid, supervisorId: t.supervisorId });
                return;
              }
            }
          } catch { }
        }
        setNextProofTask(null);
      }).catch(() => { });
      getFuelExpensesByDriver(user.uid).then(setFuelExpenses).catch(() => { });
    }
  }, [user?.uid]);

  // Load active trip session & fuel expenses on focus
  useFocusEffect(useCallback(() => {
    loadActiveTripAndExpenses();
  }, [loadActiveTripAndExpenses]));

  // Refetch tasks when screen is focused
  useFocusEffect(useCallback(() => { refetch(); refreshCounts(); }, [refetch, refreshCounts]));

  // Listen for unread chat messages
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      let totalUnread = 0;
      let latestSender = '';
      let latestText = '';
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.lastSenderId && data.lastSenderId !== user.uid) {
          totalUnread++;
          if (!latestSender) {
            latestSender = data.lastSenderName || 'Supervisor';
            latestText = data.lastMessage || '';
          }
        }
      });
      setUnreadMessages(totalUnread);
      setLastMessageSender(latestSender);
      setLastMessageText(latestText);
    }, () => { });
    return unsub;
  }, [user?.uid]);

  const activeTrip = tasks.find(t => t.status === 'in_progress' || t.status === 'arrived');

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
              } catch (e) { }
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        loadActiveTripAndExpenses(),
        refreshCounts(),
      ]);
    } catch (e) {
      console.log('handleRefresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Offline actions can affect trip/task state. Once syncing completes, refetch so UI updates.
    if (isSyncing) wasSyncingRef.current = true;
    if (wasSyncingRef.current && !isSyncing && isOnline) {
      wasSyncingRef.current = false;
      // Small delay to let AsyncStorage settle after sync engine finishes
      const timer = setTimeout(() => {
        refetch();
        loadActiveTripAndExpenses();
        refreshCounts();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSyncing, refetch, loadActiveTripAndExpenses, refreshCounts]);

  const openSyncStatus = () => {
    setSyncStatusVisible(true);
    if (isOnline && pendingCount > 0 && !isSyncing) {
      syncNow();
    }
  };

  const handleAccept = async (taskId: string) => {
    try {
      const res = await offlineAcceptTask(taskId);
      if (res.offline) {
        Alert.alert('Offline Mode', 'Trip accepted locally! It will sync once you are online.');
      } else {
        Alert.alert('Success', 'Trip accepted!');
      }
      refetch();
      refreshCounts();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept trip.');
    }
  };

  const handleReject = async (taskId: string) => {
    Alert.alert('Reject Trip', 'Are you sure you want to reject this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await offlineRejectTask(taskId, 'Driver rejected from dashboard');
            if (res.offline) {
              Alert.alert('Offline Mode', 'Trip rejected locally! It will sync once you are online.');
            } else {
              Alert.alert('Success', 'Trip rejected.');
            }
            refetch();
            refreshCounts();
          } catch (error) {
            Alert.alert('Error', 'Failed to reject trip.');
          }
        }
      }
    ]);
  };

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
            {/* Cloud Sync Status Icon */}
            <TouchableOpacity 
              style={[styles.notifBtn, !isOnline && { backgroundColor: COLORS.WARNING + '15' }]} 
              onPress={openSyncStatus}
            >
              <Ionicons
                name={
                  !isOnline
                    ? 'cloud-offline-outline'
                    : isSyncing || pendingCount > 0
                      ? 'refresh-outline'
                      : 'cloud-done-outline'
                }
                size={18}
                color={COLORS.WHITE}
              />
              {pendingCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: isOnline ? COLORS.PRIMARY : COLORS.WARNING }]}>
                  <Text style={styles.notifBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/driver/chatList')}>
              <Text style={styles.notifBtnText}>💬</Text>
              {unreadMessages > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>
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

        {/* Offline/Online text under the red header */}
        <TouchableOpacity style={styles.headerStatusRow} activeOpacity={0.85} onPress={openSyncStatus}>
          <View style={[styles.statusPill, !isOnline ? styles.statusPillOffline : styles.statusPillOnline]}>
            <Ionicons
              name={!isOnline ? 'flash-outline' : isSyncing ? 'sync-outline' : 'cloud-outline'}
              size={14}
              color={!isOnline ? COLORS.WARNING : COLORS.WHITE}
            />
            <Text style={[styles.statusPillText, !isOnline ? styles.statusTextOffline : undefined]}>
              {!isOnline ? 'Offline mode — working locally' : isSyncing ? 'Syncing updates…' : pendingCount > 0 ? 'Online — pending sync' : 'Online — all synced'}
            </Text>
          </View>

          {pendingCount > 0 && (
            <View style={styles.statusCountPill}>
              <Text style={styles.statusCountText}>{pendingCount} pending</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* ═══ ONGOING TRIP (EXPANDED CARD) ═══ */}
            {activeTrip && !activeTrip2 && (
              <TouchableOpacity
                style={styles.ongoingTripExpandedCard}
                onPress={() => router.push(`/driver/taskDetails?taskId=${activeTrip.id}`)}
                activeOpacity={0.85}
              >
                {/* Header row: Status + Priority */}
                <View style={styles.ongoingTripTopRow}>
                  <View style={styles.ongoingStatusBadge}>
                    <View style={styles.ongoingStatusDot} />
                    <Text style={styles.ongoingStatusText}>
                      {activeTrip.status === 'in_progress' ? 'In Progress' : 'Arrived'}
                    </Text>
                  </View>
                  <View style={[styles.ongoingPriorityBadge, {
                    backgroundColor: activeTrip.priority === 'HIGH' ? COLORS.DANGER
                      : activeTrip.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS
                  }]}>
                    <Text style={styles.ongoingPriorityText}>{activeTrip.priority}</Text>
                  </View>
                </View>

                {/* Current Location */}
                <View style={styles.ongoingCurrentLocRow}>
                  <View style={styles.ongoingCurrentLocIcon}>
                    <Text style={{ fontSize: 16 }}>📍</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ongoingCurrentLocLabel}>CURRENT LOCATION</Text>
                    <Text style={styles.ongoingCurrentLocText} numberOfLines={1}>{currentAddress}</Text>
                  </View>
                </View>

                {/* Route: Pickup -> Delivery */}
                <View style={styles.ongoingRouteContainer}>
                  <View style={styles.ongoingRouteStop}>
                    <View style={[styles.ongoingRouteDot, { backgroundColor: COLORS.PRIMARY }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ongoingRouteLabel}>PICKUP</Text>
                      <Text style={styles.ongoingRouteAddress} numberOfLines={1}>{activeTrip.pickupLocation}</Text>
                    </View>
                  </View>
                  <View style={styles.ongoingRouteLine} />
                  <View style={styles.ongoingRouteStop}>
                    <View style={[styles.ongoingRouteDot, { backgroundColor: COLORS.SUCCESS }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ongoingRouteLabel}>DELIVERY</Text>
                      <Text style={styles.ongoingRouteAddress} numberOfLines={1}>{activeTrip.deliveryLocation}</Text>
                    </View>
                  </View>
                </View>


                {/* Tap to view arrow */}
                <View style={styles.ongoingTapRow}>
                  <Text style={styles.ongoingTapText}>Tap to view details</Text>
                  <Text style={styles.ongoingTapArrow}>→</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ═══ ASSIGNED TRIPS (waiting to start) ═══ */}
            {assignedTrips.length > 0 && (
              <View style={{ marginTop: activeTrip ? 0 : SPACING.MD, marginBottom: SPACING.LG }}>
                <Text style={[styles.sectionTitle, { marginTop: 0 }]}>📌 Assigned Trips</Text>
                {assignedTrips.map(trip => {
                  const deadlineRemaining = trip.approvalDeadline
                    ? Math.max(0, Math.floor((trip.approvalDeadline - Date.now()) / 1000))
                    : null;
                  const deadlineMin = deadlineRemaining !== null ? Math.floor(deadlineRemaining / 60) : null;
                  const deadlineSec = deadlineRemaining !== null ? deadlineRemaining % 60 : null;
                  const isUrgent = deadlineRemaining !== null && deadlineRemaining < 300;

                  return (
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

                      {deadlineRemaining !== null && deadlineRemaining > 0 && (
                        <View style={[
                          styles.deadlineBanner,
                          isUrgent && { backgroundColor: COLORS.DANGER + '12', borderColor: COLORS.DANGER + '30' },
                        ]}>
                          <Text style={{ fontSize: 12 }}>{isUrgent ? '🔴' : '⏱️'}</Text>
                          <Text style={[
                            styles.deadlineText,
                            isUrgent && { color: COLORS.DANGER },
                          ]}>
                            Accept within {deadlineMin}:{String(deadlineSec).padStart(2, '0')}
                          </Text>
                        </View>
                      )}

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
                        <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => trip.id && handleReject(trip.id)}
                          >
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => trip.id && handleAccept(trip.id)}
                          >
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ═══ TODAY'S STATS ═══ */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: COLORS.PRIMARY }]}>{assignedTrips.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => {
                  if (activeTrip) {
                    router.push(`/driver/taskDetails?taskId=${activeTrip.id}`);
                  }
                }}
                activeOpacity={activeTrip ? 0.7 : 1}
              >
                <Text style={[styles.statNumber, { color: activeTrip ? COLORS.SUCCESS : COLORS.GRAY_400 }]}>
                  {activeTrip ? 1 : 0}
                </Text>
                <Text style={styles.statLabel}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => router.push('/driver/taskHistory')}
                activeOpacity={0.7}
              >
                <Text style={[styles.statNumber, { color: COLORS.SUCCESS }]}>{completedToday}</Text>
                <Text style={styles.statLabel}>Done Today</Text>
              </TouchableOpacity>
            </View>

            {/* ═══ ACTIVE TRIP DETAILS ═══ */}
            {activeTrip2 && (
              <TouchableOpacity
                style={styles.activeTripCard}
                onPress={() => router.push('/driver/tripEnd')}
                activeOpacity={0.85}
              >
                <View style={styles.activeTripHeader}>
                  <View style={styles.activeTripBadge}>
                    <View style={styles.activeTripDot} />
                    <Text style={styles.activeTripBadgeText}>Ongoing Trip</Text>
                  </View>
                  <Text style={styles.activeTripTime}>
                    {(() => {
                      const dur = Date.now() - activeTrip2.startTime;
                      const h = Math.floor(dur / 3600000);
                      const m = Math.floor((dur % 3600000) / 60000);
                      return h > 0 ? `${h}h ${m}m` : `${m}m`;
                    })()}
                  </Text>
                </View>

                {/* Route */}
                <View style={styles.activeTripRoute}>
                  {/* Start */}
                  <View style={styles.activeTripStop}>
                    <View style={[styles.activeTripStopDot, { backgroundColor: COLORS.SUCCESS }]} />
                    <View style={styles.activeTripStopInfo}>
                      <Text style={styles.activeTripStopLabel}>PICKUP</Text>
                      <Text style={styles.activeTripStopName} numberOfLines={1}>
                        {activeTrip2.startLocation || 'Not set'}
                      </Text>
                    </View>
                  </View>

                  {/* Middle stops */}
                  {activeTrip2.middleLocations && activeTrip2.middleLocations.length > 0 && (
                    activeTrip2.middleLocations.map((loc, i) => (
                      <View key={i} style={styles.activeTripStop}>
                        <View style={[styles.activeTripStopDot, { backgroundColor: COLORS.WARNING }]} />
                        <View style={styles.activeTripStopInfo}>
                          <Text style={styles.activeTripStopLabel}>STOP {i + 1}</Text>
                          <Text style={styles.activeTripStopName} numberOfLines={1}>{loc}</Text>
                        </View>
                      </View>
                    ))
                  )}

                  {/* End */}
                  <View style={styles.activeTripStop}>
                    <View style={[styles.activeTripStopDot, { backgroundColor: COLORS.DANGER }]} />
                    <View style={styles.activeTripStopInfo}>
                      <Text style={styles.activeTripStopLabel}>DELIVERY</Text>
                      <Text style={styles.activeTripStopName} numberOfLines={1}>
                        {activeTrip2.endLocation || 'Not set'}
                      </Text>
                    </View>
                  </View>

                  {/* Vertical line connector */}
                  <View style={styles.activeTripLine} />
                </View>

                {/* Bottom stats row */}
                <View style={styles.activeTripFooter}>
                  <View style={styles.activeTripStat}>
                    <Text style={styles.activeTripStatIcon}></Text>
                    <Text style={styles.activeTripStatText}>{activeTrip2.startOdometer?.toLocaleString()} km</Text>
                  </View>
                  <View style={styles.activeTripStat}>
                    <Text style={styles.activeTripStatIcon}></Text>
                    <Text style={styles.activeTripStatText}>{activeTrip2.taskIds?.length || 0} tasks</Text>
                  </View>
                  <View style={styles.activeTripStat}>
                    <Text style={styles.activeTripStatIcon}></Text>
                    <Text style={styles.activeTripStatText}>{activeTrip2.fuelExpenseIds?.length || 0} fuel</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

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
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/map')}>
                <Image source={require('../../assets/icons/track.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Map View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/repairRequest')}>
                <Image source={require('../../assets/icons/repair.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Repair</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/driver/chatList')}>
                <Image source={require('../../assets/icons/chat.png')} style={styles.gridImageIcon} />
                <Text style={styles.gridCardLabel}>Messages</Text>
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

          </>
        }
        keyExtractor={() => 'header'}
        ListFooterComponent={
          <>
            {/* Empty block, recent trips moved to its own screen */}

            <View style={{ height: SPACING.XXXL * 2 }} />
          </>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Clean cloud sync modal */}
      <Modal
        visible={syncStatusVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSyncStatusVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopRow}>
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name={
                    !isOnline
                      ? 'cloud-offline-outline'
                      : isSyncing
                        ? 'sync-outline'
                        : pendingCount > 0
                          ? 'cloud-upload-outline'
                          : 'cloud-done-outline'
                  }
                  size={20}
                  color={COLORS.PRIMARY}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Cloud Sync Status</Text>
                <Text style={styles.modalSubtitle}>
                  {!isOnline
                    ? 'You are offline. Changes are saved locally.'
                    : isSyncing
                      ? 'Syncing updates…'
                      : pendingCount > 0
                        ? 'Pending offline actions will sync now.'
                        : 'All actions are synced.'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSyncStatusVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={20} color={COLORS.GRAY_700} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Mode</Text>
                <Text style={styles.modalStatValue}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Pending actions</Text>
                <Text style={styles.modalStatValue}>{pendingCount}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                activeOpacity={0.85}
                onPress={() => setSyncStatusVisible(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>OK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  (!isOnline || pendingCount === 0 || isSyncing) && { opacity: 0.5 },
                ]}
                activeOpacity={0.85}
                disabled={!isOnline || pendingCount === 0 || isSyncing}
                onPress={() => syncNow()}
              >
                <Text style={styles.modalBtnPrimaryText}>{isSyncing ? 'Syncing…' : 'Sync now'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // ═══ Ongoing Trip Expanded Card ═══
  ongoingTripExpandedCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.LG,
    ...SHADOWS.MD, borderWidth: 1.5, borderColor: COLORS.SUCCESS + '40',
  },
  ongoingTripTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  ongoingStatusBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.SUCCESS + '15',
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.XS,
    borderRadius: RADIUS.FULL,
  },
  ongoingStatusDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.SUCCESS, marginRight: SPACING.XS,
  },
  ongoingStatusText: { fontSize: FONT_SIZES.XS, fontWeight: '700', color: COLORS.SUCCESS },
  ongoingPriorityBadge: {
    paddingHorizontal: SPACING.SM, paddingVertical: SPACING.XS,
    borderRadius: RADIUS.SM,
  },
  ongoingPriorityText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XS, fontWeight: '700' },
  ongoingCurrentLocRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.PRIMARY + '08', borderRadius: RADIUS.MD,
    padding: SPACING.MD, marginBottom: SPACING.MD,
  },
  ongoingCurrentLocIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.PRIMARY + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  ongoingCurrentLocLabel: {
    fontSize: 9, fontWeight: '800', color: COLORS.PRIMARY,
    letterSpacing: 0.5, marginBottom: 2,
  },
  ongoingCurrentLocText: {
    fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900,
  },
  ongoingRouteContainer: {
    marginBottom: SPACING.MD, paddingLeft: SPACING.XS,
  },
  ongoingRouteStop: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS,
  },
  ongoingRouteDot: {
    width: 10, height: 10, borderRadius: 5, marginRight: SPACING.MD,
  },
  ongoingRouteLabel: {
    fontSize: 9, fontWeight: '800', color: COLORS.GRAY_400,
    letterSpacing: 0.8, marginBottom: 1,
  },
  ongoingRouteAddress: {
    fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900,
  },
  ongoingRouteLine: {
    width: 2, height: 16, backgroundColor: COLORS.GRAY_200,
    marginLeft: 4, marginBottom: SPACING.XS,
  },
  ongoingDeliveryInfo: {
    borderTopWidth: 1, borderTopColor: COLORS.GRAY_100,
    paddingTop: SPACING.MD,
  },
  ongoingInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.XS,
  },
  ongoingInfoLabel: {
    fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500,
    marginLeft: SPACING.SM, flex: 1,
  },
  ongoingInfoValue: {
    fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_900,
    textAlign: 'right', maxWidth: '55%',
  },
  ongoingTapRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    marginTop: SPACING.MD, paddingTop: SPACING.SM,
    borderTopWidth: 1, borderTopColor: COLORS.GRAY_100,
  },
  ongoingTapText: {
    fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, fontWeight: '600',
    marginRight: SPACING.XS,
  },
  ongoingTapArrow: {
    fontSize: FONT_SIZES.MD, color: COLORS.SUCCESS, fontWeight: '700',
  },

  // ═══ Stats ═══
  statsRow: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG },
  statCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    paddingVertical: SPACING.MD, alignItems: 'center', ...SHADOWS.SM,
  },
  statNumber: { fontSize: FONT_SIZES.XXL, fontWeight: '800' },
  statLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2, fontWeight: '600' },

  // ═══ Active Trip Card ═══
  activeTripCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    marginTop: SPACING.LG,
    borderWidth: 1.5,
    borderColor: COLORS.SUCCESS + '40',
    ...SHADOWS.MD,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  activeTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS + '15',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.FULL,
  },
  activeTripDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.SUCCESS,
    marginRight: SPACING.XS,
  },
  activeTripBadgeText: {
    fontSize: FONT_SIZES.XS, fontWeight: '700', color: COLORS.SUCCESS,
  },
  activeTripTime: {
    fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.GRAY_500,
  },
  activeTripRoute: {
    position: 'relative',
    paddingLeft: 4,
  },
  activeTripStop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    zIndex: 1,
  },
  activeTripStopDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2.5, borderColor: COLORS.WHITE,
    marginRight: SPACING.MD,
    ...SHADOWS.SM,
  },
  activeTripStopInfo: { flex: 1 },
  activeTripStopLabel: {
    fontSize: 9, fontWeight: '800', color: COLORS.GRAY_400,
    letterSpacing: 0.8, marginBottom: 1,
  },
  activeTripStopName: {
    fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900,
  },
  activeTripLine: {
    position: 'absolute',
    left: 10, top: 14, bottom: 14 + SPACING.MD,
    width: 2, backgroundColor: COLORS.GRAY_200,
    zIndex: 0,
  },
  activeTripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_100,
    paddingTop: SPACING.MD,
    marginTop: SPACING.XS,
  },
  activeTripStat: {
    flexDirection: 'row', alignItems: 'center',
  },
  activeTripStatIcon: { fontSize: 14, marginRight: 4 },
  activeTripStatText: {
    fontSize: FONT_SIZES.XS, fontWeight: '600', color: COLORS.GRAY_600,
  },

  // ═══ Action Grid ═══
  gridContainer: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginTop: SPACING.XL, marginBottom: SPACING.XL,
  },
  gridCard: {
    width: '48%', backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, alignItems: 'center', marginBottom: SPACING.MD,
    justifyContent: 'center', ...SHADOWS.MD, minHeight: 125,
  },
  gridIcon: { fontSize: 28, marginBottom: SPACING.SM },
  gridImageIcon: { width: 56, height: 56, marginBottom: SPACING.SM, resizeMode: 'contain' },
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
  acceptBtn: { backgroundColor: COLORS.SUCCESS, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, minWidth: 80, alignItems: 'center' },
  acceptBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.SM },
  rejectBtn: { backgroundColor: COLORS.WHITE, borderWidth: 1, borderColor: COLORS.GRAY_300, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, minWidth: 80, alignItems: 'center' },
  rejectBtnText: { color: COLORS.GRAY_700, fontWeight: '700', fontSize: FONT_SIZES.SM },

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

  // Deadline timer on assigned cards
  deadlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.INFO + '10', borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.SM, paddingVertical: 4,
    marginBottom: SPACING.SM, borderWidth: 1, borderColor: COLORS.INFO + '25',
  },
  deadlineText: {
    fontSize: FONT_SIZES.XS, fontWeight: '700', color: COLORS.INFO,
  },

  // ═══ Message Banner ═══
  messageBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.LG,
    borderWidth: 1.5, borderColor: COLORS.INFO + '40',
    ...SHADOWS.MD,
  },
  messageBannerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.INFO + '15',
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.MD, position: 'relative',
  },
  messageBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: COLORS.DANGER, borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  messageBadgeText: { color: COLORS.WHITE, fontSize: 9, fontWeight: '800' },
  messageBannerContent: { flex: 1 },
  messageBannerTitle: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: 2 },
  messageBannerText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },
  messageBannerArrow: { fontSize: FONT_SIZES.LG, color: COLORS.INFO, fontWeight: '700', marginLeft: SPACING.SM },

  // ═══ Offline & Sync Banners ═══
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.DANGER + '15',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.DANGER + '40',
  },
  offlineBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  offlineIcon: {
    fontSize: FONT_SIZES.MD,
  },
  offlineText: {
    fontSize: FONT_SIZES.SM,
    fontWeight: '700',
    color: COLORS.DANGER,
  },
  pendingBadge: {
    backgroundColor: COLORS.DANGER,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: RADIUS.SM,
  },
  pendingBadgeText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZES.XS,
    fontWeight: '700',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.INFO + '15',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.INFO + '40',
  },
  syncIcon: {
    fontSize: FONT_SIZES.MD,
  },
  syncText: {
    fontSize: FONT_SIZES.SM,
    fontWeight: '700',
    color: COLORS.INFO,
  },
  syncActionText: {
    fontSize: FONT_SIZES.SM,
    fontWeight: '800',
    color: COLORS.PRIMARY,
  },

  headerStatusRow: {
    marginTop: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.SM,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOnline: {
    backgroundColor: COLORS.WHITE + '15',
    borderColor: COLORS.WHITE + '25',
  },
  statusPillOffline: {
    backgroundColor: COLORS.WARNING + '15',
    borderColor: COLORS.WARNING + '35',
  },
  statusPillText: {
    fontSize: FONT_SIZES.XS,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  statusTextOffline: { color: COLORS.WARNING },
  statusCountPill: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.WHITE,
    ...SHADOWS.SM,
  },
  statusCountText: {
    fontSize: FONT_SIZES.XS,
    fontWeight: '800',
    color: COLORS.PRIMARY,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: SPACING.XL,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    padding: SPACING.LG,
    ...SHADOWS.LG,
  },
  modalTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: FONT_SIZES.LG, fontWeight: '900', color: COLORS.GRAY_900 },
  modalSubtitle: { marginTop: 2, fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.GRAY_100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    marginTop: SPACING.LG,
    backgroundColor: COLORS.GRAY_50,
    borderRadius: RADIUS.LG,
    padding: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.GRAY_100,
  },
  modalStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  modalStatLabel: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600, fontWeight: '600' },
  modalStatValue: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_900, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING.MD,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSecondary: { backgroundColor: COLORS.GRAY_100, borderWidth: 1, borderColor: COLORS.GRAY_200 },
  modalBtnSecondaryText: { fontSize: FONT_SIZES.MD, fontWeight: '800', color: COLORS.GRAY_800 },
  modalBtnPrimary: { backgroundColor: COLORS.PRIMARY },
  modalBtnPrimaryText: { fontSize: FONT_SIZES.MD, fontWeight: '800', color: COLORS.WHITE },
});
