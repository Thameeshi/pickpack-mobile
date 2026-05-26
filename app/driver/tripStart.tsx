import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/hooks/useAuth';
import { startTrip, linkAcceptedTasksToTrip } from '../../src/services/tripService';
import { getTasksByDriver } from '../../src/services/taskService';
import { addOdometerReading, uploadOdometerPhoto } from '../../src/services/fuelService';
import { getCurrentLocation } from '../../src/services/locationService';
import { startTrackingDriverLocation } from '../../src/services/locationService';
import { Task } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function TripStartScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [odometer, setOdometer] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [linkedTaskCount, setLinkedTaskCount] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);

  // Auto-fetched from accepted tasks
  const [acceptedTasks, setAcceptedTasks] = useState<Task[]>([]);

  // Fetch accepted/assigned tasks
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const allTasks = await getTasksByDriver(user.uid);
        const active = allTasks.filter(
          t => t.status === 'accepted' || t.status === 'assigned' || t.status === 'in_progress'
        );
        // Sort by most recently accepted/updated and take only the latest one
        active.sort((a, b) => (b.acceptedAt || b.updatedAt || 0) - (a.acceptedAt || a.updatedAt || 0));
        setAcceptedTasks(active.length > 0 ? [active[0]] : []);
      } catch (e) {
        console.error('Failed to fetch tasks:', e);
      } finally {
        setLoadingTasks(false);
      }
    })();
  }, [user?.uid]);

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'You need to allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, aspect: [4, 3], quality: 0.7,
      });
      if (!result.canceled) setPhoto(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleStartTrip = async () => {
    if (!odometer || isNaN(Number(odometer))) {
      Alert.alert(' Required', 'Please enter your current odometer reading');
      return;
    }
    if (!photo) {
      Alert.alert('📷 Required', 'Please take a photo of your odometer');
      return;
    }

    setLoading(true);
    try {
      let loc = undefined;
      try {
        const position = await getCurrentLocation();
        loc = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch { }

      // Use first task's pickup/delivery as start/end
      const firstTask = acceptedTasks[0];
      const startLocation = firstTask?.pickupLocation || '';
      const endLocation = firstTask?.deliveryLocation || '';

      const tripId = await startTrip(
        user!.uid,
        profile?.name || '',
        Number(odometer),
        startLocation,
        endLocation,
      );

      const readingId = await addOdometerReading({
        driverId: user!.uid,
        driverName: profile?.name || '',
        reading: Number(odometer),
        type: 'trip_start',
        location: loc,
        tripId,
        timestamp: Date.now(),
        verified: false,
      });

      if (photo) {
        try { await uploadOdometerPhoto(readingId, photo); } catch { }
      }

      try {
        const linkedIds = await linkAcceptedTasksToTrip(user!.uid, tripId);
        setLinkedTaskCount(linkedIds.length);
      } catch { }

      try { await startTrackingDriverLocation(user!.uid); } catch { }

      setShowSuccessModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Image source={require('../../assets/icons/new-trip.png')} style={styles.headerIcon} />
          <Text style={styles.title}>New Trip Request</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Top Info Card */}
          <View style={styles.topInfoCard}>
            <View style={styles.locationPinIcon}>
              <Image source={require('../../assets/icons/truck.png')} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
            </View>
            <View>
              <Text style={styles.topInfoValue}>{profile?.vehiclePlate || '42 2732'}</Text>
              <Text style={styles.topInfoSub}>{profile?.name || 'Driver'}</Text>
            </View>
          </View>

          {/* Odometer Input Card */}
          <View style={styles.odometerCard}>
            <View style={styles.odometerIconWrapper}>
              <Image source={require('../../assets/icons/odometer.png')} style={styles.odometerIconImage} />
            </View>
            <View style={styles.odometerInputWrapper}>
              <Text style={styles.odometerTitle}>Start Odometer Reading</Text>
              <View style={styles.odometerInputContainer}>
                <TextInput
                  style={styles.odometerInput}
                  placeholder="Tap to enter"
                  placeholderTextColor={COLORS.GRAY_400}
                  keyboardType="numeric"
                  value={odometer}
                  onChangeText={setOdometer}
                />
                <Text style={styles.editIcon}>✏️</Text>
              </View>
            </View>
          </View>

          {/* Odometer Photo */}
          <Text style={styles.sectionLabel}>📷 Odometer Photo</Text>
          {photo ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                <Text style={styles.retakeBtnText}>📷 Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={handleTakePhoto}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>Take odometer photo</Text>
              <Text style={styles.photoPlaceholderHint}>Capture your starting odometer reading</Text>
            </TouchableOpacity>
          )}

          {/* ═══ DELIVERY DETAILS ═══ */}
          <Text style={styles.sectionLabel}>📦 Delivery Details</Text>
          {loadingTasks ? (
            <ActivityIndicator size="small" color={COLORS.PRIMARY} style={{ marginVertical: SPACING.XL }} />
          ) : acceptedTasks.length === 0 ? (
            <View style={styles.noTaskCard}>
              <Text style={styles.noTaskIcon}>📦</Text>
              <Text style={styles.noTaskTitle}>No accepted tasks</Text>
              <Text style={styles.noTaskSub}>
                Accept a delivery assignment first, then come back to start your trip.
              </Text>
            </View>
          ) : (
            acceptedTasks.map((task, idx) => (
              <View key={task.id || idx} style={styles.taskCard}>
                {/* Header row */}
                <View style={styles.taskCardHeader}>
                  <View style={[styles.taskStatusBadge, {
                    backgroundColor: task.status === 'in_progress' ? COLORS.SECONDARY + '15'
                      : task.status === 'accepted' ? COLORS.INFO + '15' : COLORS.PRIMARY_LIGHT + '15',
                  }]}>
                    <Text style={[styles.taskStatusText, {
                      color: task.status === 'in_progress' ? COLORS.SECONDARY
                        : task.status === 'accepted' ? COLORS.INFO : COLORS.PRIMARY_LIGHT,
                    }]}>
                      {task.status === 'in_progress' ? '🚚 In Progress'
                        : task.status === 'accepted' ? '✅ Accepted' : '📌 Assigned'}
                    </Text>
                  </View>
                  <View style={[styles.taskPriorityChip, {
                    backgroundColor: task.priority === 'HIGH' ? COLORS.DANGER
                      : task.priority === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS,
                  }]}>
                    <Text style={styles.taskPriorityText}>{task.priority}</Text>
                  </View>
                </View>

                {/* Route */}
                <View style={styles.taskRoute}>
                  <View style={styles.taskRouteRow}>
                    <View style={[styles.taskRouteDot, { backgroundColor: '#72252A' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskRouteLabel}>PICKUP</Text>
                      <Text style={styles.taskRouteValue}>{task.pickupLocation}</Text>
                    </View>
                  </View>
                  <View style={styles.taskRouteLine} />
                  <View style={styles.taskRouteRow}>
                    <View style={[styles.taskRouteDot, { backgroundColor: COLORS.SUCCESS }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskRouteLabel}>DELIVERY</Text>
                      <Text style={styles.taskRouteValue}>{task.deliveryLocation}</Text>
                    </View>
                  </View>
                </View>

                {/* Recipient + Details */}
                <View style={styles.taskDetails}>
                  {task.recipientName && (
                    <View style={styles.taskDetailRow}>
                      <Text style={styles.taskDetailLabel}>Recipient</Text>
                      <Text style={styles.taskDetailValue}>{task.recipientName}</Text>
                    </View>
                  )}
                  {task.description && (
                    <View style={styles.taskDetailRow}>
                      <Text style={styles.taskDetailLabel}>Description</Text>
                      <Text style={styles.taskDetailValue}>{task.description}</Text>
                    </View>
                  )}
                  {task.itemCount && (
                    <View style={styles.taskDetailRow}>
                      <Text style={styles.taskDetailLabel}>Items</Text>
                      <Text style={styles.taskDetailValue}>{task.itemCount} packages</Text>
                    </View>
                  )}
                  {task.qrCode && (
                    <View style={styles.taskDetailRow}>
                      <Text style={styles.taskDetailLabel}>QR Code</Text>
                      <Text style={[styles.taskDetailValue, { fontSize: 11 }]}>{task.qrCode}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}

          <View style={{ height: 24 }} />

          {/* Start Trip Button */}
          <TouchableOpacity
            style={[
              styles.requestBtn,
              (loading || acceptedTasks.length === 0) && { opacity: 0.5 },
            ]}
            onPress={handleStartTrip}
            disabled={loading || acceptedTasks.length === 0}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <View style={styles.requestBtnContent}>
                <Text style={styles.requestBtnText}>Start Trip</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚚 Trip Started!</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>Odometer: <Text style={{ fontWeight: '700' }}>{odometer} km</Text></Text>
              {acceptedTasks[0] && (
                <>
                  <Text style={styles.modalText}>From: <Text style={{ fontWeight: '700' }}>{acceptedTasks[0].pickupLocation}</Text></Text>
                  <Text style={styles.modalText}>To: <Text style={{ fontWeight: '700' }}>{acceptedTasks[0].deliveryLocation}</Text></Text>
                </>
              )}
              {linkedTaskCount > 0 && (
                <Text style={styles.modalText}>📦 <Text style={{ fontWeight: '700' }}>{linkedTaskCount} task{linkedTaskCount > 1 ? 's' : ''}</Text> linked</Text>
              )}
              {photo && <Text style={styles.modalText}>📷 Odometer photo captured</Text>}
              <Text style={styles.modalText}>GPS tracking is now active.</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => { setShowSuccessModal(false); router.replace('/driver/dashboard'); }}
              >
                <Text style={styles.modalConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.MD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtnWrapper: { width: 40, justifyContent: 'center' },
  backBtn: { color: COLORS.GRAY_900, fontSize: FONT_SIZES.XXL, fontWeight: '400' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 32, height: 32, marginRight: SPACING.SM, resizeMode: 'contain' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: '#5D1115' },
  content: { flex: 1, paddingHorizontal: SPACING.LG, paddingTop: SPACING.MD },

  // Top info card
  topInfoCard: {
    backgroundColor: '#72252A',
    borderRadius: RADIUS.LG,
    paddingVertical: SPACING.XL,
    paddingHorizontal: SPACING.LG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.LG,
    ...SHADOWS.MD,
  },
  locationPinIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40, height: 40,
    borderRadius: RADIUS.MD,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.MD,
  },
  topInfoValue: { fontSize: 22, fontWeight: '700', color: COLORS.WHITE, marginBottom: 2 },
  topInfoSub: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.9 },

  // Odometer Card
  odometerCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG,
    padding: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.LG,
    ...SHADOWS.SM,
  },
  odometerIconWrapper: {
    width: 80, height: 80,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.MD,
  },
  odometerIconImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  odometerInputWrapper: { flex: 1 },
  odometerTitle: {
    fontSize: FONT_SIZES.MD, fontWeight: '700',
    color: '#0D7B74', marginBottom: SPACING.SM,
  },
  odometerInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0D7B74',
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.SM,
  },
  odometerInput: { flex: 1, fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900 },
  editIcon: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_400 },

  // Section label
  sectionLabel: {
    fontSize: FONT_SIZES.MD, fontWeight: '700',
    color: '#3A1F1F', marginBottom: SPACING.SM, marginTop: SPACING.XS,
  },

  // Photo
  photoContainer: { alignItems: 'center', marginBottom: SPACING.LG },
  photo: { width: '100%', height: 180, borderRadius: RADIUS.LG, marginBottom: SPACING.SM },
  retakeBtn: {
    paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM,
    borderWidth: 1, borderColor: COLORS.PRIMARY, borderRadius: RADIUS.MD,
  },
  retakeBtnText: { color: COLORS.PRIMARY, fontWeight: '600', fontSize: FONT_SIZES.SM },
  photoPlaceholder: {
    backgroundColor: COLORS.WHITE, borderWidth: 2, borderColor: COLORS.GRAY_200,
    borderStyle: 'dashed', borderRadius: RADIUS.LG, padding: SPACING.XL,
    alignItems: 'center', marginBottom: SPACING.LG,
  },
  photoPlaceholderIcon: { fontSize: 40, marginBottom: SPACING.SM },
  photoPlaceholderText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_600 },
  photoPlaceholderHint: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_400, marginTop: 4 },

  // No task
  noTaskCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.XXL, alignItems: 'center',
    ...SHADOWS.SM, marginBottom: SPACING.LG,
  },
  noTaskIcon: { fontSize: 48, marginBottom: SPACING.SM },
  noTaskTitle: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_700, marginBottom: SPACING.XS },
  noTaskSub: {
    fontSize: FONT_SIZES.SM, color: COLORS.GRAY_400,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.MD,
  },

  // Task Card (like Task Details screen)
  taskCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.MD,
    ...SHADOWS.SM, borderWidth: 1, borderColor: COLORS.GRAY_100,
  },
  taskCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.MD,
  },
  taskStatusBadge: {
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.XS,
    borderRadius: RADIUS.FULL,
  },
  taskStatusText: { fontSize: FONT_SIZES.XS, fontWeight: '700' },
  taskPriorityChip: {
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.XS,
    borderRadius: RADIUS.SM,
  },
  taskPriorityText: { fontSize: 10, fontWeight: '800', color: COLORS.WHITE },

  // Route inside task card
  taskRoute: {
    marginBottom: SPACING.MD,
  },
  taskRouteRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  taskRouteDot: {
    width: 12, height: 12, borderRadius: 6,
    marginRight: SPACING.MD,
  },
  taskRouteLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.GRAY_400,
    letterSpacing: 0.8, marginBottom: 1,
  },
  taskRouteValue: {
    fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900,
  },
  taskRouteLine: {
    width: 2, height: 20, backgroundColor: COLORS.GRAY_200,
    marginLeft: 5, marginVertical: 4,
  },

  // Details table
  taskDetails: {
    borderTopWidth: 1, borderTopColor: COLORS.GRAY_100,
    paddingTop: SPACING.SM,
  },
  taskDetailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_50,
  },
  taskDetailIcon: { fontSize: 14, marginRight: SPACING.SM, width: 20 },
  taskDetailLabel: {
    fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, fontWeight: '500',
    width: 90,
  },
  taskDetailValue: {
    fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_900,
    flex: 1, textAlign: 'right',
  },

  // Start Trip Button
  requestBtn: {
    backgroundColor: '#4A0404',
    paddingVertical: SPACING.LG,
    borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.MD,
  },
  requestBtnContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
  requestBtnIcon: { fontSize: 20, color: COLORS.WHITE },
  requestBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.XL, width: '85%',
    borderWidth: 1, borderColor: COLORS.PRIMARY, ...SHADOWS.LG,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginBottom: SPACING.LG },
  modalTitle: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900 },
  modalBody: { marginBottom: SPACING.XL },
  modalText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_700, marginBottom: SPACING.XS },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.LG },
  modalConfirmBtn: { paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD },
  modalConfirmText: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: FONT_SIZES.MD },
});
