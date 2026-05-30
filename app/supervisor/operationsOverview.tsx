import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllTasks } from '../../src/services/taskService';
import { subscribeToTrips } from '../../src/services/tripService';
import { getAllRepairRequests } from '../../src/services/repairService';
import { TripSession, Task, RepairRequest } from '../../src/types';
import { COLORS, FONT_SIZES, RADIUS, SHADOWS, SPACING } from '../../src/constants/theme';

const { width } = Dimensions.get('window');
const DAY_START = (() => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
})();
const ON_TIME_WINDOW_MS = 6 * 60 * 60 * 1000;

export default function OperationsOverviewScreen() {
  const router = useRouter();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getAllTasks();
      setAllTasks(data);
      const repairData = await getAllRepairRequests();
      setRepairs(repairData);
    } catch (e) {
      console.log('Operations overview load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    const unsub = subscribeToTrips(setTrips);
    return () => unsub();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const todaysScheduledDeliveries = allTasks.filter(
    t => (t.createdAt || 0) >= DAY_START && !['delivered', 'failed'].includes(t.status),
  );
  const deliveredTasks = allTasks.filter(t => t.status === 'delivered');
  const onTimeDeliveries = deliveredTasks.filter(t => {
    const startedAt = t.assignedAt || t.createdAt;
    const finishedAt = t.completedAt || t.updatedAt;
    return finishedAt - startedAt <= ON_TIME_WINDOW_MS;
  }).length;
  const completionRate = allTasks.length ? deliveredTasks.length / allTasks.length : 0;
  const onTimeRate = deliveredTasks.length ? onTimeDeliveries / deliveredTasks.length : 0;
  const pendingRepairs = repairs.filter(r => r.status === 'pending');
  const issueCount = allTasks.filter(t => t.status === 'failed').length + pendingRepairs.length;
  const routeStatusCounts = ['pending', 'assigned', 'accepted', 'in_progress', 'arrived', 'delivered', 'failed'] as const;

  const driverLoads = Object.values(
    allTasks.reduce((acc, task) => {
      const key = task.assignedDriverId || task.assignedDriverName || 'unassigned';
      if (!acc[key]) {
        acc[key] = { id: key, name: task.assignedDriverName || 'Unassigned', assigned: 0, completed: 0, onTime: 0 };
      }
      acc[key].assigned += 1;
      if (task.status === 'delivered') {
        acc[key].completed += 1;
        const startedAt = task.assignedAt || task.createdAt;
        const finishedAt = task.completedAt || task.updatedAt;
        if (finishedAt - startedAt <= ON_TIME_WINDOW_MS) acc[key].onTime += 1;
      }
      return acc;
    }, {} as Record<string, { id: string; name: string; assigned: number; completed: number; onTime: number }>),
  ).sort((a, b) => b.assigned - a.assigned);

  const completedTrips = trips.filter(tr => tr.status === 'completed');
  const fuelEfficiencyPerRoute = completedTrips.length
    ? completedTrips.reduce((sum, trip) => sum + (trip.totalFuelLitres || 0), 0) / completedTrips.length
    : 0;

  const topMetrics = [
    {
      key: 'scheduled',
      value: `${todaysScheduledDeliveries.length}`,
      label: 'Scheduled today',
      meta: `${deliveredTasks.length} completed`,
      color: '#2563EB',
      bg: '#EFF6FF',
    },
    {
      key: 'completion',
      value: `${Math.round(completionRate * 100)}%`,
      label: 'Completion rate',
      meta: 'all tasks',
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    {
      key: 'ontime',
      value: `${Math.round(onTimeRate * 100)}%`,
      label: 'On-time delivery',
      meta: '6h assigned-to-complete',
      color: '#059669',
      bg: '#ECFDF5',
    },
    {
      key: 'issues',
      value: `${issueCount}`,
      label: 'Issues / incidents',
      meta: `${pendingRepairs.length} repairs pending`,
      color: '#DC2626',
      bg: '#FEF2F2',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Daily operations dashboard</Text>
          <Text style={styles.headerSubtitle}>Overview</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginTop: SPACING.XXL }} />
        ) : (
          <View style={{ paddingBottom: SPACING.XXXL }}>
            <Text style={[styles.sectionHint, { paddingHorizontal: SPACING.XL }]}>
              Supervisor summary for deliveries, allocation, and incidents.
            </Text>

            <View style={styles.opsGrid}>
              {topMetrics.map(m => (
                <View key={m.key} style={[styles.opsCard, { backgroundColor: m.bg, borderColor: m.color + '30' }]}>
                  <Text style={styles.opsLabel}>{m.label}</Text>
                  <Text style={[styles.opsValue, { color: m.color }]}>{m.value}</Text>
                  <Text style={styles.opsMeta}>{m.meta}</Text>
                </View>
              ))}
            </View>

            <View style={styles.opsPanel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelEmoji}>🧭</Text>
                <Text style={styles.opsPanelTitle}>Route status overview</Text>
              </View>
              {routeStatusCounts.map(status => {
                const count = allTasks.filter(t => t.status === status).length;
                const widthPct = allTasks.length ? (count / allTasks.length) * 100 : 0;
                
                // Lightweight colors matching status type
                const statusColor = {
                  pending: '#94A3B8',     // Soft slate
                  assigned: '#FBBF24',    // Soft amber
                  accepted: '#F97316',    // Soft orange
                  in_progress: '#3B82F6', // Soft blue
                  arrived: '#8B5CF6',     // Soft purple
                  delivered: '#10B981',   // Soft emerald green
                  failed: '#EF4444',      // Soft red
                }[status] || '#64748B';

                return (
                  <View key={status} style={styles.routeRowMetric}>
                    <View style={styles.routeRowTop}>
                      <Text style={styles.routeLabel}>{status.replace('_', ' ')}</Text>
                      <Text style={styles.routeCount}>{count}</Text>
                    </View>
                    <View style={styles.routeBarTrack}>
                      <View
                        style={[
                          styles.routeBarFill,
                          {
                            width: `${widthPct}%` as any,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.opsPanel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelEmoji}>👥</Text>
                <Text style={styles.opsPanelTitle}>Order allocation</Text>
              </View>
              {driverLoads.slice(0, 4).map(driver => {
                const maxLoad = Math.max(1, driverLoads[0]?.assigned || 1);
                return (
                  <View key={driver.id} style={styles.allocationItem}>
                    <View style={styles.routeRowTop}>
                      <Text style={styles.routeLabel} numberOfLines={1}>
                        {driver.name}
                      </Text>
                      <Text style={styles.routeCount}>{driver.assigned}</Text>
                    </View>
                    <View style={styles.routeBarTrack}>
                      <View
                        style={[
                          styles.routeBarFill,
                          { width: `${(driver.assigned / maxLoad) * 100}%`, backgroundColor: '#818CF8' }, // Lightweight soft indigo
                        ]}
                      />
                    </View>
                    <Text style={styles.opsMeta}>
                      {driver.completed} completed • {driver.onTime} on-time
                    </Text>
                  </View>
                );
              })}
              {driverLoads.length === 0 && <Text style={styles.emptyText}>No order allocation yet.</Text>}
            </View>

             <View style={styles.opsGrid}>
              <View style={[styles.opsCard, { backgroundColor: '#F0F9FF', borderColor: '#7DD3FC55' }]}>
                <Text style={styles.opsLabel}>Delivery completion</Text>
                <Text style={styles.opsValue}>{Math.round(completionRate * 100)}%</Text>
                <Text style={styles.opsMeta}>current snapshot</Text>
              </View>
              <View style={[styles.opsCard, { backgroundColor: '#ECFDF5', borderColor: '#34D39955' }]}>
                <Text style={styles.opsLabel}>On-time delivery</Text>
                <Text style={styles.opsValue}>{Math.round(onTimeRate * 100)}%</Text>
                <Text style={styles.opsMeta}>current snapshot</Text>
              </View>
              <View style={[styles.opsCard, { backgroundColor: '#FFF7ED', borderColor: '#FDBA7455' }]}>
                <Text style={styles.opsLabel}>Customer satisfaction</Text>
                <Text style={styles.opsValue}>N/A</Text>
                <Text style={styles.opsMeta}>feedback not tracked yet</Text>
              </View>
              <View style={[styles.opsCard, { backgroundColor: '#F5F3FF', borderColor: '#C4B5FD55' }]}>
                <Text style={styles.opsLabel}>Fuel / route</Text>
                <Text style={styles.opsValue}>{completedTrips.length ? `${fuelEfficiencyPerRoute.toFixed(1)}L` : '—'}</Text>
                <Text style={styles.opsMeta}>per completed route</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.LG,
    paddingHorizontal: SPACING.XL,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.WHITE + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { fontSize: 22, color: COLORS.WHITE, fontWeight: '900' },
  headerTitle: { fontSize: FONT_SIZES.XL, fontWeight: '900', color: COLORS.WHITE },
  headerSubtitle: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.75, marginTop: 2 },

  scrollContent: { paddingTop: SPACING.MD },
  sectionHint: {
    fontSize: FONT_SIZES.SM,
    color: COLORS.GRAY_500,
    marginBottom: SPACING.SM,
  },

  opsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.MD,
    paddingHorizontal: SPACING.XL,
    marginTop: SPACING.SM,
  },
  opsCard: {
    width: (width - SPACING.XL * 2 - SPACING.MD) / 2,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    padding: SPACING.MD,
    borderWidth: 1,
    borderColor: '#E6F5EA',
    ...SHADOWS.SM,
  },
  opsValue: {
    fontSize: FONT_SIZES.XXL,
    fontWeight: '800',
    color: COLORS.GRAY_900,
    marginTop: 4,
  },
  opsLabel: {
    fontSize: FONT_SIZES.SM,
    fontWeight: '700',
    color: COLORS.GRAY_800,
  },
  opsMeta: {
    marginTop: 4,
    fontSize: FONT_SIZES.XS,
    color: COLORS.GRAY_500,
  },
  opsPanel: {
    marginTop: SPACING.MD,
    marginHorizontal: SPACING.XL,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    padding: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.GRAY_100,
    ...SHADOWS.SM,
  },
  opsPanelTitle: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '800',
    color: COLORS.GRAY_900,
    marginBottom: SPACING.SM,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  panelEmoji: {
    fontSize: 18,
  },
  routeRowMetric: { marginBottom: SPACING.SM },
  routeRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeLabel: {
    fontSize: FONT_SIZES.SM,
    color: COLORS.GRAY_800,
    fontWeight: '600',
    textTransform: 'capitalize',
    flex: 1,
    paddingRight: SPACING.SM,
  },
  routeCount: {
    fontSize: FONT_SIZES.SM,
    fontWeight: '700',
    color: COLORS.GRAY_700,
  },
  routeBarTrack: {
    height: 8,
    backgroundColor: COLORS.GRAY_100,
    borderRadius: 999,
    overflow: 'hidden',
  },
  routeBarFill: { height: '100%', borderRadius: 999 },
  allocationItem: { marginBottom: SPACING.SM },
  emptyText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },
});

