import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllTasks } from '../../src/services/taskService';
import { Task } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function TripDetailsScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await getAllTasks();
      const recentTasks = data.filter(t => ['pending', 'assigned', 'accepted', 'rejected'].includes(t.status));
      setTasks(recentTasks);
    } catch (e) {
      console.log('Tasks load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadTasks(); }, []));

  const handleRefresh = async () => { setRefreshing(true); await loadTasks(); setRefreshing(false); };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'accepted': return { backgroundColor: COLORS.SUCCESS + '20' };
      case 'rejected': return { backgroundColor: COLORS.DANGER + '20' };
      case 'assigned': return { backgroundColor: COLORS.WARNING + '20' };
      default: return { backgroundColor: COLORS.GRAY_200 };
    }
  };

  const getStatusTextStyle = (status: string) => {
    switch (status) {
      case 'accepted': return { color: COLORS.SUCCESS };
      case 'rejected': return { color: COLORS.DANGER };
      case 'assigned': return { color: COLORS.WARNING };
      default: return { color: COLORS.GRAY_700 };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'assigned': return 'Pending Approval';
      case 'pending': return 'Unassigned';
      default: return status;
    }
  };

  const renderItem = ({ item: t }: { item: Task }) => (
    <View style={styles.recentCard}>
      <View style={styles.recentHeader}>
        <Text style={styles.recentDriver}>🚚 {t.assignedDriverName || 'Unassigned'}</Text>
        <View style={styles.recentHeaderRight}>
          <View style={[styles.badge, getStatusStyle(t.status)]}>
            <Text style={[styles.badgeText, getStatusTextStyle(t.status)]}>
              {getStatusText(t.status)}
            </Text>
          </View>
          {!!t.id && (
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/supervisor/deleteTaskConfirm', params: { taskId: t.id } })}
              accessibilityLabel="Delete assignment history item"
            >
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.recentRoute} numberOfLines={1}>{t.pickupLocation} → {t.deliveryLocation}</Text>
      <Text style={styles.recentTime}>{new Date(t.createdAt || Date.now()).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Trip Details</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionSubtitle}>Recent Assignments & Approvals</Text>
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginTop: SPACING.XXL }} />
        ) : tasks.length > 0 ? (
          <FlatList
            data={tasks}
            keyExtractor={t => t.id || Math.random().toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.PRIMARY]} />}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Text style={styles.emptyTextCenter}>No recent assignments.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.XL,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    marginBottom: SPACING.MD,
    ...SHADOWS.MD,
  },
  backBtnWrapper: { width: 50, justifyContent: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.WHITE },
  
  content: { flex: 1 },
  sectionSubtitle: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, paddingHorizontal: SPACING.XL, marginBottom: SPACING.MD },
  listContent: { paddingHorizontal: SPACING.XL, paddingBottom: SPACING.XXXL },
  
  recentCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.MD,
    marginBottom: SPACING.MD, ...SHADOWS.SM, borderLeftWidth: 4, borderLeftColor: COLORS.PRIMARY,
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XS },
  recentDriver: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900 },
  recentHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
  badge: { paddingHorizontal: SPACING.SM, paddingVertical: 4, borderRadius: RADIUS.SM },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.GRAY_100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 16 },
  recentRoute: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_700, marginBottom: SPACING.XS },
  recentTime: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  emptyTextCenter: { textAlign: 'center', color: COLORS.GRAY_500, marginVertical: SPACING.LG },
});
