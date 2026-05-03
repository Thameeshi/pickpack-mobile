import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useDrivers, useDriverLocations } from '../../src/hooks/useDrivers';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getAllTasks } from '../../src/services/taskService';
import { setAccountStatus } from '../../src/services/authService';
import { Task, Driver } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

type DriverWithTrip = Driver & {
  activeTrip?: Task;
  hasLocation: boolean;
  isOnTrip: boolean;
};

export default function SupervisorDashboardScreen() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const { drivers, loading: driversLoading } = useDrivers();
  const locations = useDriverLocations();
  const { unreadCount } = useNotifications(user?.uid || '');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'all' | 'trips'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTasks = async () => {
    try {
      const data = await getAllTasks();
      setAllTasks(data);
    } catch (e) {
      console.log('Tasks load error:', e);
    } finally {
      setTasksLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadTasks(); }, []));

  const handleRefresh = async () => { setRefreshing(true); await loadTasks(); setRefreshing(false); };

  // Build driver list with their active trips
  const driversWithTrips: DriverWithTrip[] = drivers.map(d => {
    const activeTrip = allTasks.find(
      t => t.assignedDriverId === d.uid && (t.status === 'in_progress' || t.status === 'arrived')
    );
    return {
      ...d,
      activeTrip,
      hasLocation: !!locations[d.uid],
      isOnTrip: !!activeTrip,
    };
  });

  // Filter by search
  const filtered = searchQuery.trim()
    ? driversWithTrips.filter(d =>
        (d.name || d.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : driversWithTrips;

  const activeDrivers = filtered.filter(d => d.isOnTrip || d.hasLocation);
  const idleDrivers = filtered.filter(d => !d.isOnTrip && !d.hasLocation);
  const pendingDrivers = filtered.filter(d => d.status === 'pending');
  const approvedDrivers = filtered.filter(d => d.status !== 'pending');

  const handleApproveDriver = (driverId: string, driverName: string) => {
    Alert.alert('Approve Driver', `Approve ${driverName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        try {
          await setAccountStatus(driverId, 'approved', user?.uid);
          Alert.alert('✅ Approved', `${driverName} can now receive tasks`);
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const activeTasks = allTasks.filter(t => t.status === 'in_progress' || t.status === 'arrived');
  const pendingTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'assigned');
  const completedTasks = allTasks.filter(t => t.status === 'delivered');

  const loading = driversLoading || tasksLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>📋 Supervisor</Text>
            <Text style={styles.headerSubtitle}>Welcome, {profile?.name || 'Supervisor'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/supervisor/notifications')}>
              <Text style={styles.notifBtnText}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/supervisor/profile')}>
              <Text style={styles.profileBtnText}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search drivers by name..."
          placeholderTextColor={COLORS.GRAY_400}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.SUCCESS }]}>{activeDrivers.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.WARNING }]}>{pendingTasks.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.SECONDARY }]}>{activeTasks.length}</Text>
          <Text style={styles.statLabel}>In Transit</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: COLORS.PRIMARY }]}>{completedTasks.length}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            🟢 Active ({activeDrivers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            👥 All ({drivers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'trips' && styles.tabBtnActive]}
          onPress={() => setActiveTab('trips')}
        >
          <Text style={[styles.tabText, activeTab === 'trips' && styles.tabTextActive]}>
            🚚 Trips ({allTasks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContent}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>
      ) : (
        <>
          {/* ═══ TAB: Active Drivers ═══ */}
          {activeTab === 'active' && (
            <FlatList
              data={[...activeDrivers, ...idleDrivers]}
              keyExtractor={d => d.uid}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />}
              renderItem={({ item: d }) => (
                <View style={[styles.driverCard, d.isOnTrip && styles.driverCardActive]}>
                  {/* Driver Info Row */}
                  <View style={styles.driverTopRow}>
                    <View style={styles.driverInfoRow}>
                      <View style={[styles.avatar, { backgroundColor: d.isOnTrip ? COLORS.SUCCESS : d.hasLocation ? COLORS.PRIMARY : COLORS.GRAY_300 }]}>
                        <Text style={styles.avatarText}>{d.displayName[0]?.toUpperCase() || 'D'}</Text>
                      </View>
                      <View style={styles.driverMeta}>
                        <View style={styles.driverNameRow}>
                          <Text style={styles.driverName}>{d.displayName}</Text>
                          <View style={[styles.statusDot, {
                            backgroundColor: d.isOnTrip ? COLORS.SUCCESS : d.hasLocation ? COLORS.PRIMARY : COLORS.GRAY_300
                          }]} />
                        </View>
                        <Text style={styles.driverDetail}>
                          {d.vehiclePlate || 'No plate'} • {d.phoneNumber || 'No phone'}
                        </Text>
                        <Text style={[styles.driverStatus, {
                          color: d.isOnTrip ? COLORS.SUCCESS : d.hasLocation ? COLORS.PRIMARY : COLORS.GRAY_400
                        }]}>
                          {d.isOnTrip ? '🚚 On Trip' : d.hasLocation ? '🟢 Online' : '⚪ Offline'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={() => router.push(`/supervisor/chat?driverId=${d.uid}`)}
                    >
                      <Text style={styles.chatIcon}>💬</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Active Trip Details */}
                  {d.activeTrip && (
                    <View style={styles.tripInfo}>
                      <View style={styles.tripInfoHeader}>
                        <Text style={styles.tripInfoTitle}>Current Trip</Text>
                        <View style={[styles.tripStatusBadge, {
                          backgroundColor: d.activeTrip.status === 'arrived' ? COLORS.WARNING + '20' : COLORS.SECONDARY + '20'
                        }]}>
                          <Text style={[styles.tripStatusText, {
                            color: d.activeTrip.status === 'arrived' ? COLORS.WARNING : COLORS.SECONDARY
                          }]}>
                            {d.activeTrip.status === 'arrived' ? '📍 Arrived' : '🚚 In Transit'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tripRoute}>
                        <View style={styles.tripRouteRow}>
                          <View style={[styles.routeDot, { backgroundColor: COLORS.PRIMARY }]} />
                          <Text style={styles.tripRouteText} numberOfLines={1}>{d.activeTrip.pickupLocation}</Text>
                        </View>
                        <View style={styles.tripRouteLine} />
                        <View style={styles.tripRouteRow}>
                          <View style={[styles.routeDot, { backgroundColor: COLORS.SUCCESS }]} />
                          <Text style={styles.tripRouteText} numberOfLines={1}>{d.activeTrip.deliveryLocation}</Text>
                        </View>
                      </View>
                      <View style={styles.tripMeta}>
                        <Text style={styles.tripMetaItem}>👤 {d.activeTrip.recipientName}</Text>
                        {d.activeTrip.itemCount && (
                          <Text style={styles.tripMetaItem}>📦 {d.activeTrip.itemCount} items</Text>
                        )}
                        {d.activeTrip.priority && (
                          <Text style={[styles.tripMetaItem, {
                            color: d.activeTrip.priority === 'HIGH' ? COLORS.DANGER
                              : d.activeTrip.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS
                          }]}>
                            {d.activeTrip.priority === 'HIGH' ? '🔴' : d.activeTrip.priority === 'MEDIUM' ? '🟡' : '🟢'} {d.activeTrip.priority}
                          </Text>
                        )}
                      </View>
                      {/* Location */}
                      {d.hasLocation && locations[d.uid] && (
                        <Text style={styles.locationText}>
                          📍 {locations[d.uid].lat.toFixed(4)}, {locations[d.uid].lng.toFixed(4)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>🚚</Text>
                  <Text style={styles.emptyTitle}>No Drivers</Text>
                  <Text style={styles.emptySubtext}>No drivers registered yet</Text>
                </View>
              }
            />
          )}

          {/* ═══ TAB: All Drivers ═══ */}
          {activeTab === 'all' && (
            <FlatList
              data={[...pendingDrivers, ...approvedDrivers]}
              keyExtractor={d => d.uid}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />}
              renderItem={({ item: d }) => (
                <TouchableOpacity
                  style={[styles.allDriverCard, d.status === 'pending' && { borderLeftWidth: 3, borderLeftColor: COLORS.WARNING }]}
                  onPress={() => router.push(`/supervisor/driverDetails?driverId=${d.uid}`)}
                >
                  <View style={[styles.avatar, { backgroundColor: d.status === 'pending' ? COLORS.WARNING : d.isOnTrip ? COLORS.SUCCESS : COLORS.GRAY_300, width: 40, height: 40, borderRadius: 20 }]}>
                    <Text style={[styles.avatarText, { fontSize: FONT_SIZES.MD }]}>{(d.name || d.displayName)?.[0]?.toUpperCase() || 'D'}</Text>
                  </View>
                  <View style={styles.allDriverInfo}>
                    <Text style={styles.allDriverName}>{d.name || d.displayName}</Text>
                    <Text style={styles.allDriverMeta}>{d.vehiclePlate || 'No plate'} • {d.phoneNumber || d.email}</Text>
                  </View>
                  {d.status === 'pending' ? (
                    <TouchableOpacity
                      style={[styles.statusIndicator, { backgroundColor: COLORS.SUCCESS }]}
                      onPress={() => handleApproveDriver(d.uid, d.name || d.displayName)}
                    >
                      <Text style={styles.statusIndicatorText}>Approve</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.statusIndicator, {
                      backgroundColor: d.isOnTrip ? COLORS.SUCCESS : d.hasLocation ? COLORS.PRIMARY : COLORS.GRAY_300
                    }]}>
                      <Text style={styles.statusIndicatorText}>
                        {d.isOnTrip ? 'Trip' : d.hasLocation ? 'On' : 'Off'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyTitle}>No Drivers Found</Text>
                  <Text style={styles.emptySubtext}>{searchQuery ? 'Try a different search' : 'No drivers registered'}</Text>
                </View>
              }
            />
          )}

          {/* ═══ TAB: All Trips ═══ */}
          {activeTab === 'trips' && (
            <FlatList
              data={allTasks}
              keyExtractor={t => t.id || ''}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />}
              ListHeaderComponent={
                <TouchableOpacity style={styles.createTripBtn} onPress={() => router.push('/supervisor/assignTask')}>
                  <Text style={styles.createTripBtnText}>➕ Create New Trip</Text>
                </TouchableOpacity>
              }
              renderItem={({ item: t }) => {
                const statusConfig: Record<string, { color: string; icon: string }> = {
                  pending: { color: COLORS.GRAY_400, icon: '⏳' },
                  assigned: { color: COLORS.PRIMARY_LIGHT, icon: '📌' },
                  in_progress: { color: COLORS.SECONDARY, icon: '🚚' },
                  arrived: { color: COLORS.WARNING, icon: '📍' },
                  delivered: { color: COLORS.SUCCESS, icon: '✅' },
                  failed: { color: COLORS.DANGER, icon: '❌' },
                };
                const cfg = statusConfig[t.status] || statusConfig.pending;

                return (
                  <View style={styles.tripListCard}>
                    <View style={styles.tripListHeader}>
                      <View style={[styles.tripListStatus, { backgroundColor: cfg.color + '15' }]}>
                        <Text style={{ fontSize: 12 }}>{cfg.icon}</Text>
                        <Text style={[styles.tripListStatusText, { color: cfg.color }]}>
                          {t.status.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                      {t.priority && (
                        <View style={[styles.tripListPriority, {
                          backgroundColor: t.priority === 'HIGH' ? COLORS.DANGER : t.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS
                        }]}>
                          <Text style={styles.tripListPriorityText}>{t.priority}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.tripListDestination} numberOfLines={1}>📍 {t.deliveryLocation}</Text>
                    <View style={styles.tripListFooter}>
                      <Text style={styles.tripListDriver}>
                        {t.assignedDriverName ? `🚚 ${t.assignedDriverName}` : '⚠️ Unassigned'}
                      </Text>
                      <Text style={styles.tripListRecipient}>👤 {t.recipientName}</Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>No Trips</Text>
                  <Text style={styles.emptySubtext}>Create your first trip</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Bottom Quick Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => router.push('/supervisor/assignTask')}>
          <Text style={styles.bottomBtnIcon}>➕</Text>
          <Text style={styles.bottomBtnLabel}>New Trip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => router.push('/supervisor/driverTracking')}>
          <Text style={styles.bottomBtnIcon}>🗺️</Text>
          <Text style={styles.bottomBtnLabel}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => router.push('/supervisor/fuelApprovals')}>
          <Text style={styles.bottomBtnIcon}>⛽</Text>
          <Text style={styles.bottomBtnLabel}>Fuel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => router.push('/supervisor/approvals')}>
          <Text style={styles.bottomBtnIcon}>🛡️</Text>
          <Text style={styles.bottomBtnLabel}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => router.push('/supervisor/chatList')}>
          <Text style={styles.bottomBtnIcon}>💬</Text>
          <Text style={styles.bottomBtnLabel}>Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.XL,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  headerSubtitle: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.7, marginTop: SPACING.XS },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileBtnText: { fontSize: 20 },

  // Search
  searchContainer: { paddingHorizontal: SPACING.XL, paddingTop: SPACING.SM },
  searchInput: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, ...SHADOWS.SM,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: SPACING.SM, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.LG },
  statCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    paddingVertical: SPACING.SM, alignItems: 'center', ...SHADOWS.SM,
  },
  statNumber: { fontSize: FONT_SIZES.XL, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.GRAY_500, fontWeight: '600', marginTop: 1 },

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: SPACING.XL,
    backgroundColor: COLORS.GRAY_100, borderRadius: RADIUS.LG, padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.WHITE, ...SHADOWS.SM },
  tabText: { fontSize: FONT_SIZES.XS, fontWeight: '600', color: COLORS.GRAY_500 },
  tabTextActive: { color: COLORS.PRIMARY },

  // List
  list: { padding: SPACING.XL, paddingBottom: 100 },

  // ═══ Driver Card (Active Tab) ═══
  driverCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  driverCardActive: { borderLeftWidth: 4, borderLeftColor: COLORS.SUCCESS },
  driverTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  driverInfoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  avatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.LG },
  driverMeta: { flex: 1 },
  driverNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
  driverName: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  driverDetail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  driverStatus: { fontSize: FONT_SIZES.XS, fontWeight: '600', marginTop: 2 },
  chatBtn: { padding: SPACING.SM },
  chatIcon: { fontSize: 24 },

  // Trip Info (inside driver card)
  tripInfo: {
    marginTop: SPACING.MD, backgroundColor: COLORS.GRAY_50,
    borderRadius: RADIUS.MD, padding: SPACING.MD,
  },
  tripInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.SM },
  tripInfoTitle: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.GRAY_700 },
  tripStatusBadge: { paddingHorizontal: SPACING.SM, paddingVertical: 2, borderRadius: RADIUS.FULL },
  tripStatusText: { fontSize: FONT_SIZES.XS, fontWeight: '600' },
  tripRoute: { marginBottom: SPACING.SM },
  tripRouteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XS },
  routeDot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.SM },
  tripRouteText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_700, flex: 1 },
  tripRouteLine: { width: 2, height: 12, backgroundColor: COLORS.GRAY_200, marginLeft: 3, marginBottom: SPACING.XS },
  tripMeta: { flexDirection: 'row', gap: SPACING.MD, flexWrap: 'wrap' },
  tripMetaItem: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_600 },
  locationText: { fontSize: FONT_SIZES.XS, color: COLORS.PRIMARY, marginTop: SPACING.SM },

  // All Drivers Tab
  allDriverCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG, padding: SPACING.MD, marginBottom: SPACING.SM, ...SHADOWS.SM,
  },
  allDriverInfo: { flex: 1, marginLeft: SPACING.MD },
  allDriverName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  allDriverMeta: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  statusIndicator: { paddingHorizontal: SPACING.MD, paddingVertical: SPACING.XS, borderRadius: RADIUS.FULL },
  statusIndicatorText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XS, fontWeight: '700' },

  // Trips Tab
  createTripBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.MD,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.LG,
  },
  createTripBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },
  tripListCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.SM, ...SHADOWS.SM,
  },
  tripListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.SM },
  tripListStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.SM, paddingVertical: 2, borderRadius: RADIUS.FULL, gap: 4 },
  tripListStatusText: { fontSize: FONT_SIZES.XS, fontWeight: '700' },
  tripListPriority: { paddingHorizontal: SPACING.SM, paddingVertical: 2, borderRadius: RADIUS.SM },
  tripListPriorityText: { color: COLORS.WHITE, fontSize: 10, fontWeight: '700' },
  tripListDestination: { fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800, marginBottom: SPACING.SM },
  tripListFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  tripListDriver: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_600 },
  tripListRecipient: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },

  // Empty
  emptyCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.XXXL,
    alignItems: 'center', ...SHADOWS.MD,
  },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.MD },
  emptyTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_800 },
  emptySubtext: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.SM },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: COLORS.WHITE,
    paddingVertical: SPACING.SM, paddingBottom: SPACING.LG,
    borderTopWidth: 1, borderTopColor: COLORS.GRAY_100, ...SHADOWS.LG,
  },
  bottomBtn: { flex: 1, alignItems: 'center', paddingVertical: SPACING.XS },
  bottomBtnIcon: { fontSize: 22 },
  bottomBtnLabel: { fontSize: 10, fontWeight: '600', color: COLORS.GRAY_600, marginTop: 2 },

  // Notification bell
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
});
