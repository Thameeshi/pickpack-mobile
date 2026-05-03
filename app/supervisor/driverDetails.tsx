import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { getTasksByDriver } from '../../src/services/taskService';
import { getTripsByDriver } from '../../src/services/tripService';
import { setAccountStatus } from '../../src/services/authService';
import { useAuth } from '../../src/hooks/useAuth';
import { Task, TripSession, Driver } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function DriverDetailsScreen() {
  const router = useRouter();
  const { driverId } = useLocalSearchParams<{ driverId: string }>();
  const { user } = useAuth();
  const [driver, setDriver] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trips, setTrips] = useState<TripSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;
    (async () => {
      try {
        // Load driver profile
        const driverDoc = await getDoc(doc(db, 'users', driverId));
        if (driverDoc.exists()) {
          setDriver({ uid: driverDoc.id, ...driverDoc.data() });
        }
        // Load tasks
        const driverTasks = await getTasksByDriver(driverId);
        setTasks(driverTasks);
        // Load trips
        try {
          const driverTrips = await getTripsByDriver(driverId);
          setTrips(driverTrips);
        } catch {}
      } catch (e) {
        console.log('Error loading driver details:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [driverId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  if (!driver) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Driver not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>← Go back</Text></TouchableOpacity>
      </View>
    );
  }

  // Weekly stats (last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekTasks = tasks.filter(t => t.createdAt >= weekAgo);
  const weekDelivered = weekTasks.filter(t => t.status === 'delivered').length;
  const weekFailed = weekTasks.filter(t => t.status === 'failed').length;
  const weekTrips = trips.filter(t => t.startTime >= weekAgo);
  const weekDistance = weekTrips.reduce((sum, t) => sum + (t.totalDistance || 0), 0);
  const weekFuel = weekTrips.reduce((sum, t) => sum + (t.totalFuelCost || 0), 0);

  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'arrived' || t.status === 'assigned');
  const isPending = driver.status === 'pending';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Driver Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Driver Profile Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: isPending ? COLORS.WARNING : COLORS.PRIMARY }]}>
            <Text style={styles.avatarText}>{(driver.name || driver.displayName)?.[0]?.toUpperCase() || 'D'}</Text>
          </View>
          <Text style={styles.driverName}>{driver.name || driver.displayName || 'Unknown'}</Text>
          <Text style={styles.driverEmail}>{driver.email}</Text>
          <Text style={styles.driverPhone}>{driver.phone || driver.phoneNumber || 'No phone'}</Text>

          <View style={[styles.statusBadge, { backgroundColor: isPending ? COLORS.WARNING + '20' : COLORS.SUCCESS + '20' }]}>
            <Text style={[styles.statusText, { color: isPending ? COLORS.WARNING : COLORS.SUCCESS }]}>
              {isPending ? '⏳ Pending Approval' : '✅ Approved'}
            </Text>
          </View>

          {driver.vehiclePlate && (
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleText}>🚚 {driver.vehicleModel || 'Vehicle'} • {driver.vehiclePlate}</Text>
            </View>
          )}

          {isPending && (
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => {
                Alert.alert('Approve?', `Approve ${driver.name || 'this driver'}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Approve', onPress: async () => {
                    await setAccountStatus(driverId!, 'approved', user?.uid);
                    setDriver({ ...driver, status: 'approved' });
                    Alert.alert('✅ Approved!');
                  }},
                ]);
              }}
            >
              <Text style={styles.approveBtnText}>✅ Approve Driver</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Weekly Summary */}
        <Text style={styles.sectionTitle}>📊 Last 7 Days</Text>
        <View style={styles.statsGrid}>
          <StatBox icon="📦" label="Delivered" value={String(weekDelivered)} color={COLORS.SUCCESS} />
          <StatBox icon="❌" label="Failed" value={String(weekFailed)} color={COLORS.DANGER} />
          <StatBox icon="🚚" label="Trips" value={String(weekTrips.length)} color={COLORS.PRIMARY} />
          <StatBox icon="📏" label="Distance" value={`${weekDistance.toFixed(0)} km`} color={COLORS.SECONDARY} />
          <StatBox icon="⛽" label="Fuel Cost" value={`LKR ${weekFuel.toFixed(0)}`} color={COLORS.WARNING} />
          <StatBox icon="📋" label="Active" value={String(activeTasks.length)} color={COLORS.INFO} />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push(`/supervisor/assignTask`)}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>Assign Task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push(`/supervisor/driverTracking?driverId=${driverId}`)}>
            <Text style={styles.actionIcon}>🗺️</Text>
            <Text style={styles.actionLabel}>Track Live</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push(`/supervisor/chat?driverId=${driverId}`)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionLabel}>Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Tasks */}
        <Text style={styles.sectionTitle}>📋 Recent Deliveries</Text>
        {weekTasks.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>No deliveries this week</Text></View>
        ) : (
          weekTasks.slice(0, 10).map(t => (
            <View key={t.id} style={styles.taskRow}>
              <Text style={styles.taskIcon}>{t.status === 'delivered' ? '✅' : t.status === 'failed' ? '❌' : '🚚'}</Text>
              <View style={styles.taskInfo}>
                <Text style={styles.taskDest} numberOfLines={1}>{t.deliveryLocation}</Text>
                <Text style={styles.taskMeta}>{t.recipientName} • {formatDateTime(t.createdAt)}</Text>
              </View>
              <Text style={[styles.taskStatus, {
                color: t.status === 'delivered' ? COLORS.SUCCESS : t.status === 'failed' ? COLORS.DANGER : COLORS.PRIMARY
              }]}>{t.status.replace('_', ' ')}</Text>
            </View>
          ))
        )}

        <View style={{ height: SPACING.XXXL }} />
      </ScrollView>
    </View>
  );
}

function StatBox({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statBoxIcon}>{icon}</Text>
      <Text style={[styles.statBoxValue, { color }]}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  errorText: { fontSize: FONT_SIZES.XL, color: COLORS.GRAY_500 },
  backLink: { fontSize: FONT_SIZES.MD, color: COLORS.PRIMARY, marginTop: SPACING.MD },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  content: { flex: 1, padding: SPACING.XL },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL,
    padding: SPACING.XXL, alignItems: 'center', ...SHADOWS.MD, marginBottom: SPACING.XL,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.MD,
  },
  avatarText: { color: COLORS.WHITE, fontWeight: '800', fontSize: FONT_SIZES.XXL },
  driverName: { fontSize: FONT_SIZES.XXL, fontWeight: '800', color: COLORS.GRAY_900 },
  driverEmail: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.XS },
  driverPhone: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },
  statusBadge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.FULL, marginTop: SPACING.MD },
  statusText: { fontWeight: '700', fontSize: FONT_SIZES.SM },
  vehicleInfo: { marginTop: SPACING.SM },
  vehicleText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600 },
  approveBtn: {
    backgroundColor: COLORS.SUCCESS, paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.MD,
    borderRadius: RADIUS.LG, marginTop: SPACING.LG,
  },
  approveBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },

  // Section
  sectionTitle: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.MD, marginTop: SPACING.SM },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginBottom: SPACING.XL },
  statBox: {
    width: '31%', backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.MD, alignItems: 'center', ...SHADOWS.SM,
  },
  statBoxIcon: { fontSize: 20, marginBottom: SPACING.XS },
  statBoxValue: { fontSize: FONT_SIZES.LG, fontWeight: '800' },
  statBoxLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: SPACING.MD, marginBottom: SPACING.XL },
  actionCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, alignItems: 'center', ...SHADOWS.SM,
  },
  actionIcon: { fontSize: 28, marginBottom: SPACING.SM },
  actionLabel: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700 },

  // Tasks
  emptyBox: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.XL, alignItems: 'center' },
  emptyText: { color: COLORS.GRAY_400, fontSize: FONT_SIZES.MD },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG, padding: SPACING.MD, marginBottom: SPACING.SM, ...SHADOWS.SM,
  },
  taskIcon: { fontSize: 20, marginRight: SPACING.MD },
  taskInfo: { flex: 1 },
  taskDest: { fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800 },
  taskMeta: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  taskStatus: { fontSize: FONT_SIZES.XS, fontWeight: '700', textTransform: 'uppercase' },
});
