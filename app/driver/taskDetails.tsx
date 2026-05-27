import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Linking, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import {
  offlineGetTaskById,
  offlineUpdateTaskStatus,
  offlineAcceptTask,
  offlineRejectTask,
} from '../../src/services/taskService';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import { getActiveTrip } from '../../src/services/tripService';
import { notifyTaskResponse } from '../../src/services/notificationService';
import { Task, TaskStatus, TripSession, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '../../src/types';
import { formatDateTime } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: COLORS.GRAY_400,
  assigned: COLORS.PRIMARY_LIGHT,
  accepted: COLORS.INFO,
  in_progress: COLORS.SECONDARY,
  arrived: COLORS.WARNING,
  delivered: COLORS.SUCCESS,
  failed: COLORS.DANGER,
};

const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '⏳', assigned: '📌', accepted: '👍', in_progress: '🚚',
  arrived: '📍', delivered: '✅', failed: '❌',
};

export default function TaskDetailsScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { user, profile } = useAuth();
  const { isOnline } = useOfflineSync();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [activeTrip, setActiveTrip] = useState<TripSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // seconds remaining for approval

  const loadTask = async () => {
    if (!taskId) return;
    try {
      const data = await offlineGetTaskById(taskId);
      setTask(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTask(); }, [taskId]);

  // Load active trip to show trip connection info
  useEffect(() => {
    if (user?.uid) {
      getActiveTrip(user.uid).then(setActiveTrip).catch(() => {});
    }
  }, [user?.uid]);

  // Countdown timer for 30-minute approval deadline
  useEffect(() => {
    if (!task?.approvalDeadline || task.status !== 'assigned' || task.driverAccepted) {
      setTimeRemaining(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((task.approvalDeadline! - Date.now()) / 1000));
      setTimeRemaining(remaining);

      // Auto-reject when time expires
      if (remaining <= 0) {
        (async () => {
          try {
            const res = await offlineRejectTask(taskId!, 'Auto-rejected: 30-minute approval deadline expired');
            if (task.supervisorId) {
              try {
                await notifyTaskResponse(
                  task.supervisorId,
                  profile?.name || 'Driver',
                  taskId!,
                  false,
                  'Auto-rejected: approval deadline expired',
                );
              } catch {}
            }
            await loadTask();
            if (res.offline) {
              Alert.alert('⏰ Time Expired (Offline)', 'This task was unassigned locally because the 30-minute approval deadline passed.');
            } else {
              Alert.alert('⏰ Time Expired', 'This task was automatically unassigned because the 30-minute approval deadline passed.');
            }
          } catch {}
        })();
      }
    };

    tick(); // run immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [task?.approvalDeadline, task?.status, task?.driverAccepted]);

  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    // Warn if starting delivery without an active trip
    if (newStatus === 'in_progress' && !activeTrip) {
      Alert.alert(
        '⚠️ No Active Trip',
        'You haven\'t started a trip yet. Start a trip first to link this delivery to your trip for odometer, fuel, and map tracking.',
        [
          { text: 'Start Trip', onPress: () => router.push('/driver/tripStart') },
          {
            text: 'Continue Anyway',
            style: 'destructive',
            onPress: () => performStatusUpdate(newStatus),
          },
        ]
      );
      return;
    }

    const messages: Record<string, string> = {
      in_progress: 'Start this delivery?',
      arrived: 'Confirm you have arrived at the delivery location?',
      failed: 'Mark this delivery as failed?',
    };

    Alert.alert(
      'Confirm',
      messages[newStatus] || `Change status to ${TASK_STATUS_LABELS[newStatus]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => performStatusUpdate(newStatus) },
      ]
    );
  };

  const performStatusUpdate = async (newStatus: TaskStatus) => {
    setActionLoading(true);
    try {
      const res = await offlineUpdateTaskStatus(taskId!, newStatus);
      await loadTask();
      // Refresh active trip to show the link
      if (user?.uid) {
        try {
          const trip = await getActiveTrip(user.uid);
          setActiveTrip(trip);
        } catch {}
      }
      if (res.offline) {
        Alert.alert('Offline Mode', 'Status updated locally! It will sync once you are online.');
      } else if (newStatus === 'in_progress') {
        Alert.alert('🚚 Delivery Started', activeTrip ? 'Linked to your active trip. Drive safely!' : 'Drive safely!');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCallRecipient = () => {
    if (task?.recipientPhone) {
      Linking.openURL(`tel:${task.recipientPhone}`);
    }
  };

  const handleOpenMaps = () => {
    if (task?.deliveryLocation) {
      const q = encodeURIComponent(task.deliveryLocation);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  if (!task) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Task not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate current step in status flow
  const currentStepIndex = TASK_STATUS_ORDER.indexOf(task.status);

  return (
    <View style={styles.container}>
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>⚡ Offline Mode — Working Locally</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Task Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status + Priority Card */}
        <View style={styles.topCard}>
          <View style={styles.topCardRow}>
            <View style={[styles.statusBadgeLarge, { backgroundColor: STATUS_COLORS[task.status] + '20' }]}>
              <Text style={styles.statusIcon}>{STATUS_ICONS[task.status]}</Text>
              <Text style={[styles.statusLabel, { color: STATUS_COLORS[task.status] }]}>
                {TASK_STATUS_LABELS[task.status]}
              </Text>
            </View>
            <View style={[styles.priorityTag, {
              backgroundColor: task.priority === 'HIGH' ? COLORS.DANGER
                : task.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS
            }]}>
              <Text style={styles.priorityText}>{task.priority}</Text>
            </View>
          </View>

          {/* Status Stepper */}
          <View style={styles.stepper}>
            {TASK_STATUS_ORDER.map((status, i) => {
              const isCompleted = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <View key={status} style={styles.stepContainer}>
                  <View style={[styles.stepDot,
                    isCompleted && { backgroundColor: STATUS_COLORS[status] },
                    isCurrent && styles.stepDotCurrent,
                  ]}>
                    {isCompleted && <Text style={styles.stepCheck}>✓</Text>}
                  </View>
                  {i < TASK_STATUS_ORDER.length - 1 && (
                    <View style={[styles.stepLine, isCompleted && { backgroundColor: STATUS_COLORS[status] }]} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.stepLabels}>
            {TASK_STATUS_ORDER.map(s => (
              <Text key={s} style={styles.stepLabelText}>{TASK_STATUS_LABELS[s].split(' ')[0]}</Text>
            ))}
          </View>
        </View>

        {/* Route Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Route</Text>
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.PRIMARY }]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeType}>PICKUP</Text>
                <Text style={styles.routeAddress}>{task.pickupLocation}</Text>
              </View>
            </View>
            <View style={styles.routeLineDotted} />
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.SUCCESS }]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeType}>DELIVERY</Text>
                <Text style={styles.routeAddress}>{task.deliveryLocation}</Text>
              </View>
              <TouchableOpacity style={styles.mapBtn} onPress={handleOpenMaps}>
                <Text style={styles.mapBtnText}>🗺️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recipient Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Recipient</Text>
          <View style={styles.recipientRow}>
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientName}>{task.recipientName}</Text>
              <Text style={styles.recipientPhone}>{task.recipientPhone}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={handleCallRecipient}>
              <Text style={styles.callBtnText}>📞 Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Details</Text>
          {task.description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{task.description}</Text>
            </View>
          )}
          {task.itemCount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Items</Text>
              <Text style={styles.detailValue}>{task.itemCount} packages</Text>
            </View>
          )}
          {task.qrCode && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>QR Code</Text>
              <Text style={[styles.detailValue, { fontFamily: 'monospace' }]}>{task.qrCode}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{formatDateTime(task.createdAt)}</Text>
          </View>
          {task.arrivedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Arrived</Text>
              <Text style={styles.detailValue}>{formatDateTime(task.arrivedAt)}</Text>
            </View>
          )}
          {task.completedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Completed</Text>
              <Text style={styles.detailValue}>{formatDateTime(task.completedAt)}</Text>
            </View>
          )}
        </View>

        {/* Trip Connection Info */}
        {task.tripId && activeTrip && (
          <View style={styles.tripLinkBanner}>
            <Text style={styles.tripLinkIcon}>🔗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripLinkTitle}>Linked to Active Trip</Text>
              <Text style={styles.tripLinkText}>
                Start Odo: {activeTrip.startOdometer?.toLocaleString()} km • {activeTrip.taskIds?.length || 0} tasks
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/driver/map')} style={styles.tripLinkMapBtn}>
              <Text style={styles.tripLinkMapText}>🗺️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No trip warning for accepted tasks */}
        {!activeTrip && (task.status === 'accepted' || (task.status === 'assigned' && task.driverAccepted)) && (
          <TouchableOpacity
            style={styles.noTripWarning}
            onPress={() => router.push('/driver/tripStart')}
          >
            <Text style={styles.noTripWarningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.noTripWarningTitle}>No Active Trip</Text>
              <Text style={styles.noTripWarningText}>Start a trip to link odometer, fuel & map tracking</Text>
            </View>
            <Text style={styles.noTripWarningArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Quick Map Access for in-progress tasks */}
        {(task.status === 'in_progress' || task.status === 'arrived') && (
          <TouchableOpacity
            style={styles.mapQuickBtn}
            onPress={() => router.push('/driver/map')}
          >
            <Text style={styles.mapQuickText}>🗺️ View Live Map</Text>
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        {task.status !== 'delivered' && task.status !== 'failed' && (
          <View style={styles.actionsSection}>
            {/* ═══ Accept/Reject for newly assigned tasks ═══ */}
            {task.status === 'assigned' && !task.driverAccepted && (
              <>
                <View style={styles.assignedBanner}>
                  <Text style={styles.assignedBannerIcon}>📦</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignedBannerTitle}>New Delivery Assignment</Text>
                    <Text style={styles.assignedBannerText}>Please accept or reject this delivery</Text>
                  </View>
                </View>

                {/* 30-Minute Countdown Timer */}
                {timeRemaining !== null && timeRemaining > 0 && (
                  <View style={[
                    styles.timerBanner,
                    timeRemaining < 300 && styles.timerBannerUrgent, // Under 5 min = red
                  ]}>
                    <Text style={styles.timerIcon}>{timeRemaining < 300 ? '🔴' : '⏱️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.timerTitle,
                        timeRemaining < 300 && { color: COLORS.DANGER },
                      ]}>
                        {timeRemaining < 300 ? 'Time Running Out!' : 'Approval Deadline'}
                      </Text>
                      <Text style={[
                        styles.timerText,
                        timeRemaining < 300 && { color: COLORS.DANGER },
                      ]}>
                        Respond within {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')} or task will be auto-rejected
                      </Text>
                    </View>
                    <Text style={[
                      styles.timerCount,
                      timeRemaining < 300 && { color: COLORS.DANGER },
                    ]}>
                      {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.SUCCESS }]}
                  onPress={async () => {
                    setActionLoading(true);
                    try {
                      const res = await offlineAcceptTask(taskId!);
                      if (task.supervisorId) {
                        try {
                          await notifyTaskResponse(task.supervisorId, profile?.name || 'Driver', taskId!, true);
                        } catch {}
                      }
                      await loadTask();
                      if (res.offline) {
                        Alert.alert('Offline Mode', 'Trip accepted locally! It will sync once you are online.');
                      } else {
                        Alert.alert('✅ Accepted', 'You have accepted this delivery. You can now start when ready.');
                      }
                    } catch (e: any) { Alert.alert('Error', e.message); }
                    finally { setActionLoading(false); }
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color={COLORS.WHITE} /> :
                    <Text style={styles.actionBtnText}>✅ Accept Delivery</Text>}
                </TouchableOpacity>

                {!showRejectInput ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.DANGER + '15', borderWidth: 1, borderColor: COLORS.DANGER }]}
                    onPress={() => setShowRejectInput(true)}
                  >
                    <Text style={[styles.actionBtnText, { color: COLORS.DANGER }]}>❌ Reject Delivery</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.rejectSection}>
                    <TextInput
                      style={styles.rejectInput}
                      placeholder="Reason for rejection (optional)"
                      placeholderTextColor={COLORS.GRAY_400}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: SPACING.SM }}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { flex: 1, backgroundColor: COLORS.GRAY_200 }]}
                        onPress={() => setShowRejectInput(false)}
                      >
                        <Text style={[styles.actionBtnText, { color: COLORS.GRAY_700 }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { flex: 1, backgroundColor: COLORS.DANGER }]}
                        onPress={async () => {
                          setActionLoading(true);
                          try {
                            const res = await offlineRejectTask(taskId!, rejectReason);
                            if (task.supervisorId) {
                              try {
                                await notifyTaskResponse(task.supervisorId, profile?.name || 'Driver', taskId!, false, rejectReason);
                              } catch {}
                            }
                            if (res.offline) {
                              Alert.alert('Offline Mode', 'Trip rejected locally! It will sync once you are online.', [
                                { text: 'OK', onPress: () => router.back() },
                              ]);
                            } else {
                              Alert.alert('Rejected', 'The delivery has been rejected and unassigned.', [
                                { text: 'OK', onPress: () => router.back() },
                              ]);
                            }
                          } catch (e: any) { Alert.alert('Error', e.message); }
                          finally { setActionLoading(false); }
                        }}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <ActivityIndicator color={COLORS.WHITE} /> :
                          <Text style={styles.actionBtnText}>Confirm Reject</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ═══ Start Delivery for accepted tasks ═══ */}
            {(task.status === 'accepted' || (task.status === 'assigned' && task.driverAccepted)) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.PRIMARY }]}
                onPress={() => handleStatusUpdate('in_progress')}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator color={COLORS.WHITE} /> :
                  <Text style={styles.actionBtnText}>🚚 Start Delivery</Text>}
              </TouchableOpacity>
            )}

            {task.status === 'in_progress' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.WARNING }]}
                  onPress={() => handleStatusUpdate('arrived')}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionBtnText}>📍 Mark Arrived</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.SECONDARY }]}
                  onPress={() => router.push(`/driver/qrScanner?taskId=${taskId}`)}
                >
                  <Text style={styles.actionBtnText}>📷 Scan QR Code</Text>
                </TouchableOpacity>
              </>
            )}

            {(task.status === 'arrived' || task.status === 'in_progress') && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.SUCCESS }]}
                onPress={() => router.push(`/driver/proofOfDelivery?taskId=${taskId}&supervisorId=${task.supervisorId}`)}
              >
                <Text style={styles.actionBtnText}>✅ Complete Delivery</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.DANGER + '15', borderWidth: 1, borderColor: COLORS.DANGER }]}
              onPress={() => handleStatusUpdate('failed')}
              disabled={actionLoading}
            >
              <Text style={[styles.actionBtnText, { color: COLORS.DANGER }]}>❌ Mark Failed</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => router.push(`/driver/chat?taskId=${taskId}`)}
        >
          <Text style={styles.chatBtnText}>💬 Message Supervisor</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.XXXL }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  errorText: { fontSize: FONT_SIZES.LG, color: COLORS.GRAY_500, fontWeight: '600' },
  backLink: { marginTop: SPACING.LG },
  backLinkText: { color: COLORS.PRIMARY, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  scrollContent: { flex: 1, padding: SPACING.XL },

  // Top Status Card
  topCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.XL,
    marginBottom: SPACING.LG, ...SHADOWS.MD,
  },
  topCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XL },
  statusBadgeLarge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM, borderRadius: RADIUS.FULL,
  },
  statusIcon: { fontSize: 18, marginRight: SPACING.SM },
  statusLabel: { fontSize: FONT_SIZES.MD, fontWeight: '700' },
  priorityTag: { paddingHorizontal: SPACING.MD, paddingVertical: SPACING.XS, borderRadius: RADIUS.SM },
  priorityText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XS, fontWeight: '700' },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.SM },
  stepContainer: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.GRAY_200,
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotCurrent: { borderWidth: 3, borderColor: COLORS.PRIMARY + '40' },
  stepCheck: { color: COLORS.WHITE, fontSize: 10, fontWeight: '700' },
  stepLine: { width: 30, height: 3, backgroundColor: COLORS.GRAY_200, marginHorizontal: 2 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  stepLabelText: { fontSize: 8, color: COLORS.GRAY_400, textAlign: 'center', width: 50, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  cardTitle: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.LG },

  // Route
  routeContainer: {},
  routePoint: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 12, height: 12, borderRadius: 6, marginRight: SPACING.MD },
  routeInfo: { flex: 1 },
  routeType: { fontSize: FONT_SIZES.XS, fontWeight: '600', color: COLORS.GRAY_400, letterSpacing: 0.5 },
  routeAddress: { fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800, marginTop: 2 },
  routeLineDotted: { width: 2, height: 24, backgroundColor: COLORS.GRAY_200, marginLeft: 5, marginVertical: SPACING.XS },
  mapBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.PRIMARY + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  mapBtnText: { fontSize: 18 },

  // Recipient
  recipientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recipientInfo: { flex: 1 },
  recipientName: { fontSize: FONT_SIZES.LG, fontWeight: '600', color: COLORS.GRAY_900 },
  recipientPhone: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.XS },
  callBtn: {
    backgroundColor: COLORS.SUCCESS + '15', paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM, borderRadius: RADIUS.FULL, borderWidth: 1, borderColor: COLORS.SUCCESS + '30',
  },
  callBtnText: { color: COLORS.SUCCESS, fontWeight: '600', fontSize: FONT_SIZES.SM },

  // Details
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: SPACING.SM, borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_50,
  },
  detailLabel: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, flex: 1 },
  detailValue: { fontSize: FONT_SIZES.SM, fontWeight: '500', color: COLORS.GRAY_800, flex: 2, textAlign: 'right' },

  // Actions
  actionsSection: { marginTop: SPACING.MD, gap: SPACING.SM },
  actionBtn: {
    paddingVertical: SPACING.LG, borderRadius: RADIUS.LG, alignItems: 'center',
  },
  actionBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },

  // Chat
  chatBtn: {
    marginTop: SPACING.LG, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG,
    alignItems: 'center', backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    ...SHADOWS.SM,
  },
  chatBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_700 },

  // Accept/Reject
  assignedBanner: {
    backgroundColor: COLORS.WARNING + '15', borderRadius: RADIUS.LG,
    padding: SPACING.LG, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.WARNING + '30',
  },
  assignedBannerIcon: { fontSize: 32, marginRight: SPACING.MD },
  assignedBannerTitle: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900 },
  assignedBannerText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: 2 },

  // Timer
  timerBanner: {
    backgroundColor: COLORS.INFO + '10', borderRadius: RADIUS.LG,
    padding: SPACING.MD, flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.SM, borderWidth: 1.5, borderColor: COLORS.INFO + '30',
  },
  timerBannerUrgent: {
    backgroundColor: COLORS.DANGER + '10',
    borderColor: COLORS.DANGER + '30',
  },
  timerIcon: { fontSize: 22, marginRight: SPACING.MD },
  timerTitle: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.INFO },
  timerText: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 1 },
  timerCount: {
    fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.INFO,
    fontVariant: ['tabular-nums'] as any,
  },
  rejectSection: { gap: SPACING.SM },
  rejectInput: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, minHeight: 60,
  },

  // Trip connection
  tripLinkBanner: {
    backgroundColor: COLORS.SUCCESS + '10', borderRadius: RADIUS.LG,
    padding: SPACING.LG, flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.MD, borderWidth: 1, borderColor: COLORS.SUCCESS + '25',
  },
  tripLinkIcon: { fontSize: 22, marginRight: SPACING.MD },
  tripLinkTitle: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.SUCCESS },
  tripLinkText: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  tripLinkMapBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.SUCCESS + '15', justifyContent: 'center', alignItems: 'center',
  },
  tripLinkMapText: { fontSize: 20 },

  // No trip warning
  noTripWarning: {
    backgroundColor: COLORS.WARNING + '10', borderRadius: RADIUS.LG,
    padding: SPACING.LG, flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.MD, borderWidth: 1, borderColor: COLORS.WARNING + '25',
  },
  noTripWarningIcon: { fontSize: 22, marginRight: SPACING.MD },
  noTripWarningTitle: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.WARNING },
  noTripWarningText: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  noTripWarningArrow: { fontSize: 18, color: COLORS.WARNING, fontWeight: '700' },

  // Map quick button
  mapQuickBtn: {
    backgroundColor: COLORS.PRIMARY + '10', borderRadius: RADIUS.LG,
    padding: SPACING.MD, alignItems: 'center', marginBottom: SPACING.MD,
    borderWidth: 1, borderColor: COLORS.PRIMARY + '20',
  },
  mapQuickText: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.PRIMARY },

  // Offline banner styles
  offlineBanner: {
    backgroundColor: COLORS.DANGER + '15',
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.DANGER + '30',
  },
  offlineText: {
    fontSize: FONT_SIZES.XS,
    fontWeight: '700',
    color: COLORS.DANGER,
  },
});
