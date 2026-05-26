import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useNotifications } from '../../src/hooks/useNotifications';
import { markAsRead, markAllAsRead, clearAllNotifications, deleteNotification } from '../../src/services/notificationService';
import { AppNotification } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  task_assigned: { icon: '📦', color: COLORS.PRIMARY, label: 'Task Assigned' },
  task_accepted: { icon: '✅', color: COLORS.SUCCESS, label: 'Task Accepted' },
  task_rejected: { icon: '❌', color: COLORS.DANGER, label: 'Task Rejected' },
  task_completed: { icon: '🎉', color: COLORS.SUCCESS, label: 'Task Completed' },
  trip_started: { icon: '🚚', color: COLORS.PRIMARY, label: 'Trip Started' },
  trip_completed: { icon: '🏁', color: COLORS.SUCCESS, label: 'Trip Completed' },
  fuel_submitted: { icon: '⛽', color: COLORS.WARNING, label: 'Fuel Submitted' },
  fuel_approved: { icon: '💰', color: COLORS.SUCCESS, label: 'Fuel Approved' },
  fuel_rejected: { icon: '🚫', color: COLORS.DANGER, label: 'Fuel Rejected' },
  chat_message: { icon: '💬', color: COLORS.INFO, label: 'New Message' },
  approval: { icon: '🛡️', color: COLORS.WARNING, label: 'Pending Approval' },
  general: { icon: '🔔', color: COLORS.GRAY_500, label: 'Notification' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotifications(user?.uid || '');

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifications.forEach(notification => {
      const date = new Date(notification.createdAt);
      date.setHours(0, 0, 0, 0);

      let groupLabel = '';
      if (date.getTime() === today.getTime()) {
        groupLabel = 'Today';
      } else if (date.getTime() === yesterday.getTime()) {
        groupLabel = 'Yesterday';
      } else {
        groupLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
      }

      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push(notification);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [notifications]);

  const handlePress = async (notification: AppNotification) => {
    // Mark as read
    if (!notification.read && notification.id) {
      await markAsRead(notification.id);
    }

    // Navigate based on type
    switch (notification.type) {
      case 'task_assigned':
      case 'task_accepted':
      case 'task_rejected':
      case 'task_completed':
        if (notification.data?.taskId) {
          router.push(`/driver/taskDetails?taskId=${notification.data.taskId}`);
        }
        break;
      case 'trip_started':
        router.push('/driver/dashboard');
        break;
      case 'trip_completed':
        router.push('/driver/taskHistory');
        break;
      case 'fuel_submitted':
      case 'fuel_approved':
      case 'fuel_rejected':
        router.push('/driver/fuelHistory');
        break;
      case 'chat_message':
        router.push('/driver/chatList');
        break;
      default:
        if (notification.data?.taskId) {
          router.push(`/driver/taskDetails?taskId=${notification.data.taskId}`);
        }
        break;
    }
  };

  const handleMarkAllRead = async () => {
    if (user?.uid) await markAllAsRead(user.uid);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Notifications', 'Are you sure you want to delete all notifications? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => {
        if (user?.uid) await clearAllNotifications(user.uid);
      }}
    ]);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteNotification(id);
      }}
    ]);
  };

  const formatTime = (timestamp: number) => {
    const now = new Date();
    const notificationDate = new Date(timestamp);
    const diff = now.getTime() - notificationDate.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    // For older notifications, show time
    return notificationDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnContainer}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔔 Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={[styles.headerBtn, styles.headerBtnDanger]}>
              <Text style={styles.headerBtnTextDanger}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{unreadCount}</Text>
          </View>
          <Text style={styles.unreadText}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <SectionList
          sections={groupedNotifications}
          keyExtractor={(item) => item.id || String(item.createdAt)}
          renderItem={({ item }) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
            return (
              <TouchableOpacity
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: config.color + '15' }]}>
                  <Text style={styles.icon}>{config.icon}</Text>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.read && <View style={styles.unreadIndicator} />}
                  </View>
                  <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
                </View>

                <TouchableOpacity 
                  onPress={() => handleDelete(item.id!)} 
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnIcon}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>No notifications</Text>
          <Text style={styles.emptySubtext}>You'll be notified when tasks are assigned or updated</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  header: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.XL,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY + 'CC',
  },
  backBtnContainer: {
    padding: SPACING.SM,
    marginRight: SPACING.MD,
  },
  backBtn: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZES.MD,
    fontWeight: '600',
  },
  title: {
    fontSize: FONT_SIZES.LG,
    fontWeight: '700',
    color: COLORS.WHITE,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  headerBtn: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.WHITE + '20',
  },
  headerBtnDanger: {
    backgroundColor: COLORS.DANGER + '30',
  },
  headerBtnText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZES.XS,
    fontWeight: '600',
  },
  headerBtnTextDanger: {
    color: COLORS.DANGER,
    fontSize: FONT_SIZES.XS,
    fontWeight: '600',
  },

  // Unread Banner
  unreadBanner: {
    backgroundColor: COLORS.DANGER + '08',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.DANGER + '15',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  unreadBadge: {
    backgroundColor: COLORS.DANGER,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: COLORS.WHITE,
    fontWeight: '700',
    fontSize: FONT_SIZES.SM,
  },
  unreadText: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '600',
    color: COLORS.DANGER,
    flex: 1,
  },

  // List
  listContent: {
    padding: SPACING.LG,
  },

  // Section Header
  sectionHeader: {
    marginTop: SPACING.XL,
    marginBottom: SPACING.MD,
    paddingHorizontal: SPACING.SM,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.SM,
    fontWeight: '700',
    color: COLORS.GRAY_600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
    ...SHADOWS.SM,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  cardUnread: {
    backgroundColor: COLORS.PRIMARY + '08',
    borderLeftColor: COLORS.PRIMARY,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.MD,
    flexShrink: 0,
  },
  icon: {
    fontSize: 24,
  },

  cardContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.XS,
  },
  cardTitle: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '500',
    color: COLORS.GRAY_800,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: COLORS.GRAY_900,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: SPACING.SM,
    flexShrink: 0,
  },

  cardBody: {
    fontSize: FONT_SIZES.SM,
    color: COLORS.GRAY_600,
    lineHeight: 18,
    marginBottom: SPACING.XS,
  },
  cardTime: {
    fontSize: FONT_SIZES.XS,
    color: COLORS.GRAY_400,
  },

  deleteBtn: {
    padding: SPACING.SM,
    marginLeft: SPACING.SM,
    flexShrink: 0,
  },
  deleteBtnIcon: {
    fontSize: 18,
    color: COLORS.GRAY_300,
    fontWeight: '600',
  },

  // Empty State
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.XL,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: SPACING.LG,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: FONT_SIZES.LG,
    fontWeight: '700',
    color: COLORS.GRAY_600,
    marginBottom: SPACING.SM,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.MD,
    color: COLORS.GRAY_400,
    textAlign: 'center',
    lineHeight: 20,
  },
});
