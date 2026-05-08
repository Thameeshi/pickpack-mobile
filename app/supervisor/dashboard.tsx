import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Dimensions, Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getAllTasks } from '../../src/services/taskService';
import { Task } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

export default function SupervisorDashboardScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications(user?.uid || '');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
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

  const handleRefresh = async () => { setRefreshing(true); await loadTasks(); setRefreshing(false); };

  const ongoingTrips = allTasks.filter(t => t.status === 'in_progress' || t.status === 'arrived');
  const itemWidth = width * 0.85 + SPACING.MD;

  const shiftLeft = () => {
    if (currentIndex > 0) {
      const next = currentIndex - 1;
      flatListRef.current?.scrollToOffset({ offset: next * itemWidth, animated: true });
      setCurrentIndex(next);
    }
  };

  const shiftRight = () => {
    if (currentIndex < ongoingTrips.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToOffset({ offset: next * itemWidth, animated: true });
      setCurrentIndex(next);
    }
  };

  const onMomentumScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / itemWidth);
    setCurrentIndex(index);
  };

  // Quick Action Buttons
  const ACTIONS = [
    { id: 'new', label: 'New Trip', image: require('../../assets/icons/new-trip.png'), route: '/supervisor/assignTask' },
    { id: 'track', label: 'Track', image: require('../../assets/icons/track.png'), route: '/supervisor/driverTracking' },
    { id: 'add-driver', label: 'Add Driver', image: require('../../assets/icons/profile.png'), route: '/supervisor/addDriver' },
    { id: 'fuel', label: 'Fuel', image: require('../../assets/icons/fuel.png'), route: '/supervisor/fuelApprovals' },
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
          {loading && !refreshing ? (
             <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginVertical: SPACING.XL }} />
          ) : ongoingTrips.length > 0 ? (
            <View style={{ position: 'relative' }}>
              <FlatList
                ref={flatListRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={ongoingTrips}
                keyExtractor={t => t.id || Math.random().toString()}
                contentContainerStyle={{ paddingHorizontal: SPACING.XL, paddingBottom: SPACING.MD }}
                snapToInterval={itemWidth}
                decelerationRate="fast"
                onMomentumScrollEnd={onMomentumScrollEnd}
                renderItem={({ item: t }) => (
                  <TouchableOpacity 
                    style={[styles.tripCard, { width: width * 0.85 }]}
                    activeOpacity={0.8}
                    onPress={() => router.push('/supervisor/driverTracking')}
                  >
                    <View style={styles.tripCardHeader}>
                       <View style={[styles.statusBadge, { backgroundColor: t.status === 'arrived' ? COLORS.WARNING + '20' : COLORS.SECONDARY + '20' }]}>
                         <Text style={[styles.statusText, { color: t.status === 'arrived' ? COLORS.WARNING : COLORS.SECONDARY }]}>
                           {t.status === 'arrived' ? '📍 Arrived' : '🚚 In Transit'}
                         </Text>
                       </View>
                       {t.priority && (
                         <View style={[styles.priorityBadge, { backgroundColor: t.priority === 'HIGH' ? COLORS.DANGER : t.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS }]}>
                           <Text style={styles.priorityText}>{t.priority}</Text>
                         </View>
                       )}
                    </View>
                    
                    <View style={styles.tripRoute}>
                      <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: COLORS.PRIMARY }]} />
                        <Text style={styles.routeText} numberOfLines={1}>{t.pickupLocation}</Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: COLORS.SUCCESS }]} />
                        <Text style={styles.routeText} numberOfLines={1}>{t.deliveryLocation}</Text>
                      </View>
                    </View>

                    <View style={styles.tripFooter}>
                      <Text style={styles.driverName}>🚚 {t.assignedDriverName || 'Unassigned'}</Text>
                      <Text style={styles.recipientName}>👤 {t.recipientName}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
              
              {/* Left Arrow */}
              {currentIndex > 0 && (
                <TouchableOpacity style={[styles.navArrow, { left: SPACING.SM }]} onPress={shiftLeft}>
                  <Text style={styles.navArrowText}>{'<'}</Text>
                </TouchableOpacity>
              )}
              
              {/* Right Arrow */}
              {currentIndex < ongoingTrips.length - 1 && (
                <TouchableOpacity style={[styles.navArrow, { right: SPACING.SM }]} onPress={shiftRight}>
                  <Text style={styles.navArrowText}>{'>'}</Text>
                </TouchableOpacity>
              )}
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
  tripCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.LG,
    marginRight: SPACING.MD, borderLeftWidth: 4, borderLeftColor: COLORS.SECONDARY,
    ...SHADOWS.MD,
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
  recipientName: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  emptyCarousel: {
    marginHorizontal: SPACING.XL, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL,
    padding: SPACING.XXL, alignItems: 'center', ...SHADOWS.SM,
  },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.SM },
  emptyText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },

  // Carousel Arrows
  navArrow: {
    position: 'absolute',
    top: '35%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...SHADOWS.SM,
  },
  navArrowText: {
    color: COLORS.WHITE,
    fontSize: 20,
    fontWeight: '800',
    marginTop: -2, // visual alignment
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
    aspectRatio: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.MD,
    marginBottom: SPACING.SM,
  },
  gridImage: { 
    width: 64, 
    height: 64, 
    resizeMode: 'contain' 
  },
  gridLabel: { 
    fontSize: FONT_SIZES.MD, 
    fontWeight: '700', 
    color: COLORS.GRAY_800,
    textAlign: 'center'
  },
});
