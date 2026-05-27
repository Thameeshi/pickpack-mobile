import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Dimensions, Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getAllTasks } from '../../src/services/taskService';
import { subscribeToTrips } from '../../src/services/tripService';
import { TripSession } from '../../src/types';
import { Task } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

export default function SupervisorDashboardScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications(user?.uid || '');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList<TripSession>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const loadTasks = async () => {
    try {
      const data = await getAllTasks();
      setAllTasks(data);
    } catch (e) {
      console.log('Tasks load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadTasks(); }, []));

  useEffect(() => {
    const unsub = subscribeToTrips(setTrips);
    return () => unsub();
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [trips]);

  const handleRefresh = async () => { setRefreshing(true); await loadTasks(); setRefreshing(false); };

  const ongoingTasks = allTasks.filter(t => t.status === 'in_progress' || t.status === 'arrived');
  const activeTripSessions = trips.filter(tr => tr.status === 'active');
  const cardWidth = width * 0.84;
  const itemWidth = cardWidth + SPACING.MD;

  const shiftLeft = () => {
    if (currentIndex > 0) {
      const next = currentIndex - 1;
      flatListRef.current?.scrollToOffset({ offset: next * itemWidth, animated: true });
      setCurrentIndex(next);
    }
  };

  const shiftRight = () => {
    if (currentIndex < activeTripSessions.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToOffset({ offset: next * itemWidth, animated: true });
      setCurrentIndex(next);
    }
  };

  const onMomentumScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / itemWidth);
    setCurrentIndex(Math.max(0, Math.min(index, Math.max(0, activeTripSessions.length - 1))));
  };

  const renderTripCard = (t: TripSession | Task, isSessionTrip = false) => {
    const tripStatus = isSessionTrip ? 'active' : (t as Task).status;

    return (
      <TouchableOpacity
        style={[styles.tripCard, { width: cardWidth }]}
        activeOpacity={0.85}
        onPress={() => router.push('/supervisor/driverTracking')}
      >
        <View style={styles.tripCardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: COLORS.SECONDARY + '20' }]}>
            <Text style={[styles.statusText, { color: COLORS.SECONDARY }]}>🚚 Active Trip</Text>
          </View>
          <Text style={styles.activeDriver}>{isSessionTrip ? (t as TripSession).driverName || 'Driver' : (t as Task).assignedDriverName || 'Driver'}</Text>
        </View>

        <View style={styles.tripRoute}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.PRIMARY }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {isSessionTrip ? (t as TripSession).startLocation || 'Pickup location' : (t as Task).pickupLocation || 'Pickup location'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.SUCCESS }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {isSessionTrip ? (t as TripSession).endLocation || 'Destination' : (t as Task).deliveryLocation || 'Destination'}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <Text style={styles.driverName}>
            {isSessionTrip
              ? `Started ${new Date((t as TripSession).startTime || 0).toLocaleString()}`
              : tripStatus === 'arrived'
                ? 'Status: Arrived'
                : 'Status: In transit'}
          </Text>
          <Text style={styles.recipientName}>
            {isSessionTrip ? `${(t as TripSession).taskIds?.length || 0} tasks` : `👤 ${(t as Task).recipientName || 'Recipient'}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Quick Action Buttons
  const ACTIONS = [
    { id: 'new', label: 'Assign Trip', image: require('../../assets/icons/new-trip.png'), route: '/supervisor/assignTask' },
    { id: 'track', label: 'Track', image: require('../../assets/icons/track.png'), route: '/supervisor/driverTracking' },
    { id: 'add-driver', label: 'Add Driver', image: require('../../assets/icons/driver.png'), route: '/supervisor/addDriver' },
    { id: 'fuel', label: 'Fuel', image: require('../../assets/icons/fuel.png'), route: '/supervisor/fuelApprovals' },
    { id: 'repair', label: 'Repairs', image: require('../../assets/icons/repair.png'), route: '/supervisor/repairApprovals' },
    { id: 'approve', label: 'Approve', image: require('../../assets/icons/approve.png'), route: '/supervisor/approvals' },
    { id: 'chat', label: 'Chat', image: require('../../assets/icons/chat.png'), route: '/supervisor/chatList' },
    { id: 'trip-details', label: 'Trip Details', image: require('../../assets/icons/recent-trip.png'), route: '/supervisor/tripDetails' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{profile?.role === 'superadmin' ? 'Superadmin' : 'Supervisor'}</Text>
            <Text style={styles.headerSubtitle}>Welcome, {profile?.name || 'User'}</Text>
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
        <View style={styles.goldLine} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Ongoing Trips Carousel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ongoing trips</Text>
          <Text style={styles.sectionHint}>Swipe through trips or use the arrows to move between cards.</Text>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginVertical: SPACING.XL }} />
          ) : activeTripSessions.length > 0 ? (
            <View>
              <FlatList
                ref={flatListRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={activeTripSessions}
                keyExtractor={(t, index) => t.id || `${index}`}
                contentContainerStyle={{ paddingHorizontal: SPACING.XL, paddingBottom: SPACING.SM }}
                snapToAlignment="start"
                snapToInterval={itemWidth}
                decelerationRate="fast"
                disableIntervalMomentum
                onMomentumScrollEnd={onMomentumScrollEnd}
                renderItem={({ item: t }) => renderTripCard(t, true)}
              />

              <View style={styles.carouselControls}>
                <TouchableOpacity
                  style={[styles.carouselButton, currentIndex === 0 && styles.carouselButtonDisabled]}
                  onPress={shiftLeft}
                  disabled={currentIndex === 0}
                >
                  <Text style={styles.carouselButtonText}>{'‹'} Previous</Text>
                </TouchableOpacity>

                <Text style={styles.carouselCounter}>
                  {Math.min(currentIndex + 1, activeTripSessions.length)} of {activeTripSessions.length}
                </Text>

                <TouchableOpacity
                  style={[styles.carouselButton, currentIndex >= activeTripSessions.length - 1 && styles.carouselButtonDisabled]}
                  onPress={shiftRight}
                  disabled={currentIndex >= activeTripSessions.length - 1}
                >
                  <Text style={styles.carouselButtonText}>Next {'›'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : ongoingTasks.length > 0 ? (
            <View>
              <FlatList
                ref={flatListRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={ongoingTasks}
                keyExtractor={(t, index) => t.id || `${index}`}
                contentContainerStyle={{ paddingHorizontal: SPACING.XL, paddingBottom: SPACING.SM }}
                snapToAlignment="start"
                snapToInterval={itemWidth}
                decelerationRate="fast"
                onMomentumScrollEnd={onMomentumScrollEnd}
                renderItem={({ item: t }) => renderTripCard(t, false)}
              />
            </View>
          ) : (
            <View style={styles.emptyCarousel}>
              <Text style={styles.emptyIcon}>🛋️</Text>
              <Text style={styles.emptyText}>No ongoing trips right now.</Text>
            </View>
          )}
        </View>

        {/* Action Grid */}
        <View style={styles.gridContainer}>
          {ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.gridItemWrapper}
              activeOpacity={0.7}
              onPress={() => router.push(action.route as any)}
            >
              <View style={styles.gridItemCard}>
                <Image source={action.image} style={styles.gridImage} />
              </View>
              <Text style={styles.gridLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.XL,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    marginBottom: SPACING.MD,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: FONT_SIZES.XXL, fontWeight: '800', color: COLORS.WHITE },
  headerSubtitle: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.7, marginTop: SPACING.XS },
  goldLine: { width: 40, height: 3, backgroundColor: COLORS.ACCENT, borderRadius: 2, marginTop: SPACING.SM },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileBtnText: { fontSize: 20 },
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

  scrollContent: { paddingBottom: SPACING.XXXL },

  // Ongoing Trips Section
  section: { marginTop: SPACING.XL, marginBottom: SPACING.XL },
  sectionTitle: {
    fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900,
    paddingHorizontal: SPACING.XL, marginBottom: SPACING.MD
  },
  sectionHint: {
    fontSize: FONT_SIZES.SM,
    color: COLORS.GRAY_500,
    paddingHorizontal: SPACING.XL,
    marginTop: -SPACING.XS,
    marginBottom: SPACING.SM,
  },
  tripCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.LG,
    marginRight: SPACING.MD, borderWidth: 1.5, borderColor: '#9EE6AC',
    shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0,
    shadowRadius: 0, elevation: 0,
  },
  tripCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.MD },
  statusBadge: { paddingHorizontal: SPACING.SM, paddingVertical: 4, borderRadius: RADIUS.FULL },
  statusText: { fontSize: FONT_SIZES.XS, fontWeight: '700' },
  priorityBadge: { paddingHorizontal: SPACING.SM, paddingVertical: 4, borderRadius: RADIUS.SM },
  priorityText: { color: COLORS.WHITE, fontSize: 10, fontWeight: '700' },
  tripRoute: { marginBottom: SPACING.MD },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginRight: SPACING.SM },
  routeText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_800, flex: 1, fontWeight: '500' },
  routeLine: { width: 2, height: 14, backgroundColor: COLORS.GRAY_200, marginLeft: 4, marginVertical: 2 },
  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.GRAY_100, paddingTop: SPACING.SM },
  driverName: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_700, fontWeight: '600' },
  activeDriver: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_900, fontWeight: '800' },
  recipientName: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  emptyCarousel: {
    marginHorizontal: SPACING.XL, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL,
    padding: SPACING.XXL, alignItems: 'center', ...SHADOWS.SM,
  },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.SM },
  emptyText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },

  carouselControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.XL,
    marginTop: SPACING.SM,
  },
  carouselButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.FULL,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    minWidth: 110,
    ...SHADOWS.SM,
  },
  carouselButtonDisabled: {
    opacity: 0.4,
  },
  carouselButtonText: {
    color: COLORS.GRAY_800,
    fontSize: FONT_SIZES.SM,
    fontWeight: '700',
  },
  carouselCounter: {
    fontSize: FONT_SIZES.SM,
    color: COLORS.GRAY_500,
    fontWeight: '600',
  },

  // Action Grid
  gridContainer: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.XL,
    gap: SPACING.MD, justifyContent: 'space-between'
  },
  gridItemWrapper: {
    width: (width - SPACING.XL * 2 - SPACING.MD) / 2,
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  gridItemCard: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.MD,
    marginBottom: SPACING.SM,
  },
  gridImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain'
  },
  gridLabel: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '700',
    color: COLORS.GRAY_800,
    textAlign: 'center'
  },
});
