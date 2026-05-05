import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useNotifications } from '../../src/hooks/useNotifications';
import { markAsRead, markAllAsRead } from '../../src/services/notificationService';
import { getAllFuelExpenses } from '../../src/services/fuelService';
import { AppNotification } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  task_assigned: { icon: '📦', color: COLORS.PRIMARY },
  task_accepted: { icon: '✅', color: COLORS.SUCCESS },
  task_rejected: { icon: '❌', color: COLORS.DANGER },
  task_completed: { icon: '🎉', color: COLORS.SUCCESS },
  trip_started: { icon: '🚚', color: COLORS.PRIMARY },
  trip_completed: { icon: '🏁', color: COLORS.SUCCESS },
  fuel_submitted: { icon: '⛽', color: COLORS.WARNING },
  fuel_approved: { icon: '💰', color: COLORS.SUCCESS },
  fuel_rejected: { icon: '🚫', color: COLORS.DANGER },
  chat_message: { icon: '💬', color: COLORS.INFO },
  approval: { icon: '🛡️', color: COLORS.WARNING },
  general: { icon: '🔔', color: COLORS.GRAY_500 },
};

export default function SupervisorNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications: dbNotifications } = useNotifications(user?.uid || '');
  const [fuelNotifications, setFuelNotifications] = React.useState<AppNotification[]>([]);

  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const expenses = await getAllFuelExpenses();
      const pending = expenses.filter(e => e.status === 'pending');
      const mapped: AppNotification[] = pending.map(e => ({
        id: `fuel_${e.id}`,
        userId: user.uid,
        type: 'fuel_submitted',
        title: 'Fuel Approval Required',
        body: `${e.driverName || 'A driver'} requested approval for ${e.litres}L of fuel (LKR ${e.totalCost.toFixed(0)})`,
        createdAt: e.createdAt || Date.now(),
        read: false,
        data: { expenseId: e.id }
      }));
      setFuelNotifications(mapped);
    })();
  }, [user]);

  const notifications = [...dbNotifications, ...fuelNotifications].sort((a, b) => b.createdAt - a.createdAt);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handlePress = async (notification: AppNotification) => {
    if (!notification.read && notification.id && !notification.id.startsWith('fuel_')) {
      await markAsRead(notification.id);
    }
    if (notification.type === 'fuel_submitted') {
      router.push('/supervisor/fuelApprovals');
    } else if (notification.data?.taskId) {
      router.push(`/supervisor/assignTask?taskId=${notification.data.taskId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (user?.uid) await markAllAsRead(user.uid);
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔔 Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllBtn}>Read All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>🔴 {unreadCount} unread</Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={n => n.id || String(n.createdAt)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
          return (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => handlePress(item)}
            >
              <View style={[styles.iconCircle, { backgroundColor: config.color + '15' }]}>
                <Text style={styles.icon}>{config.icon}</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>You'll see updates when drivers respond to assignments</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  markAllBtn: { color: COLORS.ACCENT, fontSize: FONT_SIZES.SM, fontWeight: '700' },
  unreadBanner: {
    backgroundColor: COLORS.DANGER + '10', paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.XL, borderBottomWidth: 1, borderBottomColor: COLORS.DANGER + '20',
  },
  unreadText: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.DANGER },
  list: { padding: SPACING.XL },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.SM, ...SHADOWS.SM,
  },
  cardUnread: { backgroundColor: COLORS.PRIMARY + '05', borderLeftWidth: 3, borderLeftColor: COLORS.PRIMARY },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  icon: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardTitle: { fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800, flex: 1 },
  cardTitleUnread: { fontWeight: '700', color: COLORS.GRAY_900 },
  cardTime: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, marginLeft: SPACING.SM },
  cardBody: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.PRIMARY, marginLeft: SPACING.SM,
  },
  empty: { alignItems: 'center', paddingVertical: SPACING.XXXL * 2 },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.MD },
  emptyText: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_500 },
  emptySubtext: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_400, marginTop: SPACING.SM },
});
