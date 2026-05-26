import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { setAccountStatus } from '../../src/services/authService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { UserProfile, AccountStatus } from '../../src/types';
import { formatDate } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function ApprovalsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const loadUsers = async () => {
    try {
      // Get pending users
      const pendingQ = query(
        collection(db, 'users'),
        where('status', '==', 'pending'),
        where('role', '==', 'driver')
      );
      const pendingSnap = await getDocs(pendingQ);
      setPendingUsers(pendingSnap.docs.map(d => d.data() as UserProfile));

      // Get all drivers
      const allQ = query(
        collection(db, 'users'),
        where('role', '==', 'driver')
      );
      const allSnap = await getDocs(allQ);
      setAllUsers(allSnap.docs.map(d => d.data() as UserProfile));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'superadmin' && profile?.role !== 'supervisor') {
      Alert.alert('Access Denied', 'Only supervisors and super admins can access this page');
      router.back();
      return;
    }
    loadUsers();
  }, [profile]);

  const handleAction = (userProfile: UserProfile, status: AccountStatus) => {
    const action = status === 'approved' ? 'approve' : status === 'suspended' ? 'suspend' : 'reject';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Driver`,
      `Are you sure you want to ${action} ${userProfile.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: status === 'approved' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await setAccountStatus(userProfile.uid, status, user?.uid);
              Alert.alert('Done', `${userProfile.name} has been ${status}`);
              loadUsers();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const statusConfig: Record<AccountStatus, { color: string; icon: string }> = {
    pending: { color: COLORS.WARNING, icon: '⏳' },
    approved: { color: COLORS.SUCCESS, icon: '' },
    rejected: { color: COLORS.DANGER, icon: '' },
    suspended: { color: COLORS.GRAY_500, icon: '🚫' },
  };

  const displayList = tab === 'pending' ? pendingUsers : allUsers;

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🛡️ Approvals</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pending ({pendingUsers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            All Drivers ({allUsers.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayList}
        keyExtractor={u => u.uid}
        contentContainerStyle={styles.list}
        renderItem={({ item: u }) => {
          const cfg = statusConfig[u.status];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.avatar, { backgroundColor: cfg.color }]}>
                    <Text style={styles.avatarText}>{u.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <Text style={styles.userPhone}>{u.phone}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.icon ? `${cfg.icon} ` : ''}{u.status}</Text>
                </View>
              </View>

              {/* Vehicle Info */}
              {(u.vehiclePlate || u.vehicleType || u.licenseNumber) && (
                <View style={styles.vehicleSection}>
                  <Text style={styles.vehicleTitle}>🚚 Vehicle Details</Text>
                  <View style={styles.vehicleGrid}>
                    {u.licenseNumber && (
                      <View style={styles.vehicleItem}>
                        <Text style={styles.vehicleLabel}>License</Text>
                        <Text style={styles.vehicleValue}>{u.licenseNumber}</Text>
                      </View>
                    )}
                    {u.vehicleType && (
                      <View style={styles.vehicleItem}>
                        <Text style={styles.vehicleLabel}>Type</Text>
                        <Text style={styles.vehicleValue}>{u.vehicleType}</Text>
                      </View>
                    )}
                    {u.vehiclePlate && (
                      <View style={styles.vehicleItem}>
                        <Text style={styles.vehicleLabel}>Plate</Text>
                        <Text style={styles.vehicleValue}>{u.vehiclePlate}</Text>
                      </View>
                    )}
                    {u.vehicleModel && (
                      <View style={styles.vehicleItem}>
                        <Text style={styles.vehicleLabel}>Model</Text>
                        <Text style={styles.vehicleValue}>{u.vehicleModel}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              <Text style={styles.dateText}>Registered: {u.createdAt ? formatDate(new Date(u.createdAt).getTime()) : 'N/A'}</Text>

              {/* Actions */}
              {u.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.SUCCESS }]}
                    onPress={() => handleAction(u, 'approved')}
                  >
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.DANGER }]}
                    onPress={() => handleAction(u, 'rejected')}
                  >
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {u.status === 'approved' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.GRAY_500, marginTop: SPACING.MD }]}
                  onPress={() => handleAction(u, 'suspended')}
                >
                  <Text style={styles.actionBtnText}>🚫 Suspend</Text>
                </TouchableOpacity>
              )}

              {u.status === 'suspended' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.SUCCESS, marginTop: SPACING.MD }]}
                  onPress={() => handleAction(u, 'approved')}
                >
                  <Text style={styles.actionBtnText}>Re-activate</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{tab === 'pending' ? '🎉' : '🚚'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'pending' ? 'No pending approvals!' : 'No drivers registered yet'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  tabRow: {
    flexDirection: 'row', marginHorizontal: SPACING.XL, marginTop: SPACING.LG,
    backgroundColor: COLORS.GRAY_100, borderRadius: RADIUS.LG, padding: 3,
  },
  tab: { flex: 1, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.WHITE, ...SHADOWS.SM },
  tabText: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_500 },
  tabTextActive: { color: COLORS.PRIMARY },
  list: { padding: SPACING.XL },
  card: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  avatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.LG },
  userName: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  userEmail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 1 },
  userPhone: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  statusBadge: { paddingHorizontal: SPACING.SM, paddingVertical: SPACING.XS, borderRadius: RADIUS.SM },
  statusText: { fontSize: FONT_SIZES.XS, fontWeight: '600', textTransform: 'capitalize' },
  vehicleSection: {
    backgroundColor: COLORS.GRAY_50, borderRadius: RADIUS.MD, padding: SPACING.MD,
    marginTop: SPACING.MD,
  },
  vehicleTitle: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.MD },
  vehicleItem: { minWidth: '40%' },
  vehicleLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400 },
  vehicleValue: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_800 },
  dateText: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, marginTop: SPACING.MD },
  actions: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.MD },
  actionBtn: { flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, alignItems: 'center' },
  actionBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
  empty: { alignItems: 'center', paddingVertical: SPACING.XXXL },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.MD },
  emptyText: { fontSize: FONT_SIZES.LG, fontWeight: '600', color: COLORS.GRAY_500 },
});
