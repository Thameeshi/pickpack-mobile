import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  Alert, ScrollView, TextInput, PanResponder, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import {
  uploadProofOfDelivery, uploadSignature, uploadDeliveryDocument,
  completeTask, offlineCompleteTask, offlineGetTaskById,
} from '../../src/services/taskService';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import { addTaskToTrip, getActiveTrip } from '../../src/services/tripService';
import { notifyDeliveryCompleted } from '../../src/services/notificationService';
import { useLocation } from '../../src/hooks/useLocation';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

export default function ProofOfDeliveryScreen() {
  const router = useRouter();
  const { taskId, supervisorId, fromEndTrip } = useLocalSearchParams<{ taskId: string; supervisorId?: string; fromEndTrip?: string }>();
  const { user, profile } = useAuth();
  const { location } = useLocation();
  const { isOnline } = useOfflineSync();
  const [step, setStep] = useState(0); // 0=photo, 1=signature, 2=document, 3=confirm
  const [photo, setPhoto] = useState<string | null>(null);
  const [document, setDocument] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [offlineSavedVisible, setOfflineSavedVisible] = useState(false);

  // Signature drawing state
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const signatureRef = useRef<View>(null);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      setCurrentPath(`M${locationX},${locationY}`);
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
    },
    onPanResponderRelease: () => {
      if (currentPath) {
        setPaths(prev => [...prev, currentPath]);
        setCurrentPath('');
      }
    },
  });

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
  };

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
      if (!result.canceled) {
        setPhoto(result.assets[0].uri);
        setStep(1);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleTakeDocument = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'You need to allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, aspect: [3, 4], quality: 0.7,
      });
      if (!result.canceled) setDocument(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const autoEndTrip = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const savedOdo = await AsyncStorage.getItem('@pickpack_temp_end_odometer');
      const savedPhoto = await AsyncStorage.getItem('@pickpack_temp_end_photo');
      const savedTripId = await AsyncStorage.getItem('@pickpack_ending_trip_id');

      if (savedOdo && savedTripId) {
        let loc = undefined;
        try {
          const { getCurrentLocation } = require('../../src/services/locationService');
          const position = await getCurrentLocation();
          loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        } catch {}

        // 1. Save odometer reading
        const { offlineAddOdometerReading, offlineUploadOdometerPhoto } = require('../../src/services/fuelService');
        const readingId = await offlineAddOdometerReading({
          driverId: user!.uid,
          driverName: profile?.name || '',
          reading: Number(savedOdo),
          type: 'trip_end',
          location: loc,
          tripId: savedTripId,
          timestamp: Date.now(),
          verified: false,
        });

        if (savedPhoto) {
          try { await offlineUploadOdometerPhoto(readingId, savedPhoto); } catch {}
        }

        // 2. End the trip session
        const { offlineEndTrip } = require('../../src/services/tripService');
        await offlineEndTrip(savedTripId, Number(savedOdo), savedPhoto, loc);

        // 3. Stop GPS tracking
        try {
          const { stopTrackingDriverLocation } = require('../../src/services/locationService');
          stopTrackingDriverLocation();
        } catch {}

        // 4. Mark driver as offline if online
        if (isOnline) {
          try {
            const { doc, setDoc } = require('firebase/firestore');
            const { db } = require('../../src/services/firebase');
            await setDoc(
              doc(db, 'drivers', user!.uid),
              { isOnline: false },
              { merge: true }
            );
          } catch {}
        }

        // 5. Clean up temporary stored values
        await AsyncStorage.removeItem('@pickpack_temp_end_odometer');
        await AsyncStorage.removeItem('@pickpack_temp_end_photo');
        await AsyncStorage.removeItem('@pickpack_ending_trip_id');
        console.log('✅ Auto ended trip successfully');
      }
    } catch (e) {
      console.log('Error in autoEndTrip:', e);
    }
  };

  const handleSubmit = async () => {
    if (!photo) { Alert.alert('Required', 'Take a delivery photo'); return; }
    if (paths.length === 0) { Alert.alert('Required', 'Get recipient signature'); return; }
    if (!recipientName.trim()) { Alert.alert('Required', 'Enter recipient name'); return; }

    setUploading(true);
    try {
      // Capture signature URI first
      let signatureUri = '';
      if (signatureRef.current) {
        try {
          signatureUri = await captureRef(signatureRef.current, {
            format: 'png', quality: 0.9,
          });
        } catch (e: any) {
          Alert.alert('Error', 'Failed to capture signature image. Please try again.');
          setUploading(false);
          return;
        }
      }

      // Check if we are online or offline
      if (!isOnline) {
        // --- OFFLINE WORKFLOW ---
        await offlineCompleteTask(
          taskId!,
          photo, // local image URI
          location?.coords?.latitude || 0,
          location?.coords?.longitude || 0,
          signatureUri, // local signature URI
          document || undefined, // local doc URI (optional)
          recipientName.trim(),
        );
      } else {
        // --- ONLINE WORKFLOW ---
        // 1. Upload delivery photo
        let proofUrl = '';
        try {
          proofUrl = await uploadProofOfDelivery(taskId!, photo, `${taskId}-${Date.now()}.jpg`);
        } catch (uploadErr: any) {
          const msg = uploadErr?.message || String(uploadErr);
          Alert.alert('Upload Error (Photo)', msg + '\n\nPlease check your connection.');
          setUploading(false);
          return;
        }

        // 2. Upload signature
        let signatureUrl = '';
        if (signatureUri) {
          try {
            signatureUrl = await uploadSignature(taskId!, signatureUri);
          } catch (e: any) {
            const msg = e?.message || String(e);
            Alert.alert('Upload Error (Signature)', msg);
            setUploading(false);
            return;
          }
        }

        // 3. Upload document (optional)
        let documentUrl: string | undefined;
        if (document) {
          try {
            documentUrl = await uploadDeliveryDocument(taskId!, document);
          } catch {}
        }

        // 4. Complete the task
        await completeTask(
          taskId!,
          proofUrl,
          location?.coords?.latitude || 0,
          location?.coords?.longitude || 0,
          signatureUrl,
          documentUrl,
          recipientName.trim(),
        );

        // 5. Link to active trip
        try {
          const trip = await getActiveTrip(user!.uid);
          if (trip?.id) await addTaskToTrip(trip.id, taskId!);
        } catch {}

        // 6. Notify supervisor
        if (supervisorId) {
          try {
            await notifyDeliveryCompleted(
              supervisorId,
              profile?.name || 'Driver',
              taskId!,
              recipientName.trim(),
            );
          } catch {}
        }
      }

      // Both workflows check for pending tasks
      let nextPendingTask: string | null = null;
      let nextSupervisorId: string | null = null;
      let pendingCount = 0;
      try {
        const trip = await getActiveTrip(user!.uid);
        if (trip?.taskIds && trip.taskIds.length > 0) {
          for (const tid of trip.taskIds) {
            if (tid === taskId) continue;
            const t = await offlineGetTaskById(tid);
            if (t && t.status !== 'delivered' && t.status !== 'failed') {
              pendingCount++;
              if (!nextPendingTask) {
                nextPendingTask = tid;
                nextSupervisorId = t.supervisorId || '';
              }
            }
          }
        }
      } catch {}

      if (nextPendingTask && pendingCount > 0) {
        Alert.alert(
          isOnline ? '✅ Delivered!' : 'Saved Offline',
          isOnline 
            ? `Proof of delivery uploaded. You still have ${pendingCount} more pending delivery${pendingCount > 1 ? 'ies' : ''}. Continue to the next one?`
            : `Delivery saved locally. You still have ${pendingCount} more pending delivery${pendingCount > 1 ? 'ies' : ''}. Continue to the next one?`,
          [
            { text: fromEndTrip === 'true' ? 'End Trip' : 'Dashboard', style: 'cancel', onPress: () => router.replace(fromEndTrip === 'true' ? '/driver/tripEnd' : '/driver/dashboard') },
            {
              text: `Next (${pendingCount} left)`,
              onPress: () => router.replace(`/driver/proofOfDelivery?taskId=${nextPendingTask}&supervisorId=${nextSupervisorId || ''}${fromEndTrip === 'true' ? '&fromEndTrip=true' : ''}`),
            },
          ]
        );
      } else {
        if (fromEndTrip === 'true') {
          await autoEndTrip();
          Alert.alert(
            isOnline ? '✅ Trip Ended' : 'Saved Offline',
            isOnline 
              ? 'All deliveries completed and trip ended successfully!'
              : 'All deliveries completed and trip ended locally! It will sync when online.',
            [
              { text: 'OK', onPress: () => router.replace('/driver/dashboard') },
            ]
          );
        } else {
          Alert.alert(
            isOnline ? '✅ All Done!' : 'Saved Offline',
            isOnline ? 'All deliveries completed successfully!' : 'All deliveries completed successfully offline!',
            [
              { text: 'OK', onPress: () => router.replace('/driver/dashboard') },
            ]
          );
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const steps = ['Photo', 'Signature', 'Document', 'Confirm'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
          <Text style={styles.backBtn}>← {step > 0 ? 'Back' : 'Cancel'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Proof of Delivery</Text>
        <View style={{ width: 50 }} />

        {!isOnline && (
          <View style={styles.headerStatusRow}>
            <View style={styles.statusPillOffline}>
              <Ionicons name="flash-outline" size={14} color={COLORS.WARNING} />
              <Text style={styles.statusTextOffline}>Offline mode — will sync when online</Text>
            </View>
          </View>
        )}
      </View>

      {/* Step Indicator */}
      <View style={styles.stepRow}>
        {steps.map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepCircle, i <= step && styles.stepCircleActive]}>
              <Text style={[styles.stepCircleText, i <= step && styles.stepCircleTextActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Step 0: Photo */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Take Delivery Photo</Text>
            <Text style={styles.stepDesc}>Take a clear photo showing the delivered package at the location</Text>
            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.previewImage} />
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(1)}>
                    <Text style={styles.nextBtnText}>Next →</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
                <Text style={styles.captureBtnIcon}>Camera</Text>
                <Text style={styles.captureBtnText}>Take Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 1: Signature */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Get Recipient Signature</Text>
            <Text style={styles.stepDesc}>Ask the recipient to sign below with their finger</Text>

            <TextInput
              style={styles.nameInput}
              placeholder="Recipient's Full Name *"
              placeholderTextColor={COLORS.GRAY_400}
              value={recipientName}
              onChangeText={setRecipientName}
            />

            <View style={styles.signatureBox} ref={signatureRef} collapsable={false}>
              <Svg style={StyleSheet.absoluteFill}>
                {paths.map((path, i) => (
                  <Path key={i} d={path} stroke={COLORS.GRAY_900} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                ))}
                {currentPath ? (
                  <Path d={currentPath} stroke={COLORS.GRAY_900} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                ) : null}
              </Svg>
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
              {paths.length === 0 && !currentPath && (
                <Text style={styles.signPlaceholder}>Sign here ✍️</Text>
              )}
            </View>
            <Text style={styles.signatureHint}>Use your finger to sign inside the box.</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearSignature}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, (paths.length === 0 || !recipientName.trim()) && { opacity: 0.5 }]}
                onPress={() => setStep(2)}
                disabled={paths.length === 0 || !recipientName.trim()}
              >
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Document (optional) */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Upload Delivery Document</Text>
            <Text style={styles.stepDesc}>Take a photo of any delivery receipt or document (optional)</Text>

            {document ? (
              <>
                <Image source={{ uri: document }} style={styles.previewImage} />
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.retakeBtn} onPress={handleTakeDocument}>
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
                    <Text style={styles.nextBtnText}>Next →</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.captureBtn} onPress={handleTakeDocument}>
                  <Text style={styles.captureBtnIcon}>Document</Text>
                  <Text style={styles.captureBtnText}>Take Document Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(3)}>
                  <Text style={styles.skipBtnText}>Skip — No Document →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Confirm Delivery</Text>
            <Text style={styles.stepDesc}>Review and submit proof of delivery</Text>

            <View style={styles.confirmCard}>
              <ConfirmRow icon="📷" label="Delivery Photo" value={photo ? 'Captured' : 'Missing'} ok={!!photo} />
              <ConfirmRow icon="✍️" label="Signature" value={paths.length > 0 ? 'Signed' : 'Missing'} ok={paths.length > 0} />
              <ConfirmRow icon="👤" label="Recipient" value={recipientName || 'Missing'} ok={!!recipientName} />
              <ConfirmRow icon="📄" label="Document" value={document ? 'Uploaded' : 'Skipped'} ok={!!document} neutral={!document} />
              <ConfirmRow icon="📍" label="GPS Location" value={location ? 'Captured' : 'Loading...'} ok={!!location} />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, uploading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color={COLORS.WHITE} /> : (
                <Text style={styles.submitBtnText}>Submit Delivery Proof</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Clean offline saved modal */}
      <Modal
        visible={offlineSavedVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOfflineSavedVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopRow}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.SUCCESS} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Saved offline</Text>
                <Text style={styles.modalSubtitle}>
                  Delivery proof was saved locally and will sync automatically when you are back online.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalBtnPrimary}
              activeOpacity={0.85}
              onPress={() => {
                setOfflineSavedVisible(false);
                if (fromEndTrip === 'true') {
                  router.replace('/driver/tripEnd');
                } else {
                  router.replace('/driver/dashboard');
                }
              }}
            >
              <Text style={styles.modalBtnPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ConfirmRow({
  icon,
  label,
  value,
  ok,
  neutral,
}: {
  icon: string;
  label: string;
  value: string;
  ok?: boolean;
  neutral?: boolean;
}) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmIcon}>{icon}</Text>
      <Text style={styles.confirmLabel}>{label}</Text>
      <View
        style={[
          styles.confirmStatusPill,
          ok ? styles.confirmStatusPillOk : neutral ? styles.confirmStatusPillNeutral : styles.confirmStatusPillMissing,
        ]}
      >
        <Text
          style={[
            styles.confirmValue,
            ok ? styles.confirmValueOk : neutral ? styles.confirmValueNeutral : styles.confirmValueMissing,
          ]}
        >
          {value}
        </Text>
      </View>
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
  stepRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_100,
  },
  stepItem: { flex: 1, alignItems: 'center' },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.GRAY_100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.GRAY_200,
  },
  stepCircleActive: {
    backgroundColor: COLORS.PRIMARY + '15',
    borderColor: COLORS.PRIMARY,
  },
  stepCircleText: { fontSize: 11, color: COLORS.GRAY_500, fontWeight: '700' },
  stepCircleTextActive: { color: COLORS.PRIMARY_DARK },
  stepLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, fontWeight: '600' },
  stepLabelActive: { color: COLORS.PRIMARY, fontWeight: '600' },
  content: { flex: 1 },
  stepContent: { flex: 1, padding: SPACING.XL },
  stepTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.XS },
  stepDesc: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500, marginBottom: SPACING.XL },
  previewImage: { width: '100%', height: 250, borderRadius: RADIUS.LG, marginBottom: SPACING.LG },
  btnRow: { flexDirection: 'row', gap: SPACING.MD },
  captureBtn: {
    flex: 1, backgroundColor: COLORS.WHITE, borderWidth: 2, borderColor: COLORS.GRAY_200,
    borderStyle: 'dashed', borderRadius: RADIUS.LG, padding: SPACING.XXL,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.SM,
  },
  captureBtnIcon: { fontSize: FONT_SIZES.MD, marginBottom: SPACING.SM, color: COLORS.GRAY_600, fontWeight: '700' },
  captureBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_600 },
  retakeBtn: {
    flex: 1, paddingVertical: SPACING.LG, borderRadius: RADIUS.LG,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.GRAY_300,
  },
  retakeBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_700 },
  nextBtn: {
    flex: 1, paddingVertical: SPACING.LG, borderRadius: RADIUS.LG,
    alignItems: 'center', backgroundColor: COLORS.PRIMARY,
  },
  nextBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.WHITE },
  nameInput: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, marginBottom: SPACING.LG, ...SHADOWS.SM,
  },
  signatureBox: {
    backgroundColor: COLORS.WHITE, borderWidth: 2, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, height: 200, marginBottom: SPACING.LG,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', ...SHADOWS.SM,
  },
  signPlaceholder: { fontSize: FONT_SIZES.XL, color: COLORS.GRAY_300 },
  signatureHint: { marginTop: -SPACING.SM, marginBottom: SPACING.MD, fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  clearBtn: {
    flex: 1, paddingVertical: SPACING.LG, borderRadius: RADIUS.LG,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.GRAY_300,
  },
  clearBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_600 },
  skipBtn: {
    paddingVertical: SPACING.LG, alignItems: 'center', marginTop: SPACING.MD,
  },
  skipBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_500 },
  confirmCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.XL, ...SHADOWS.SM, borderWidth: 1, borderColor: COLORS.GRAY_100,
  },
  confirmRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.MD, borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_50,
  },
  confirmIcon: { fontSize: 20, marginRight: SPACING.MD },
  confirmLabel: { flex: 1, fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_700 },
  confirmStatusPill: { borderRadius: 999, paddingHorizontal: SPACING.SM, paddingVertical: 5 },
  confirmStatusPillOk: { backgroundColor: COLORS.SUCCESS + '18' },
  confirmStatusPillMissing: { backgroundColor: COLORS.DANGER + '18' },
  confirmStatusPillNeutral: { backgroundColor: COLORS.GRAY_100 },
  confirmValue: { fontSize: FONT_SIZES.SM, fontWeight: '700' },
  confirmValueOk: { color: COLORS.SUCCESS },
  confirmValueMissing: { color: COLORS.DANGER },
  confirmValueNeutral: { color: COLORS.GRAY_600 },
  submitBtn: {
    backgroundColor: COLORS.SUCCESS, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL, ...SHADOWS.MD, borderWidth: 1, borderColor: '#0B9A6D',
  },
  submitBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },

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

  headerStatusRow: {
    marginTop: SPACING.SM,
    paddingHorizontal: SPACING.XL,
    width: '100%',
  },
  statusPillOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: SPACING.MD,
    borderRadius: 999,
    backgroundColor: COLORS.WARNING + '15',
    borderWidth: 1,
    borderColor: COLORS.WARNING + '35',
  },
  statusTextOffline: {
    fontSize: FONT_SIZES.XS,
    fontWeight: '700',
    color: COLORS.WARNING,
    flex: 1,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: SPACING.XL,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    padding: SPACING.LG,
    ...SHADOWS.LG,
  },
  modalTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, marginBottom: SPACING.LG },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.SUCCESS + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: FONT_SIZES.LG, fontWeight: '900', color: COLORS.GRAY_900 },
  modalSubtitle: { marginTop: 2, fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600 },
  modalBtnPrimary: {
    paddingVertical: SPACING.MD,
    borderRadius: 999,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
  },
  modalBtnPrimaryText: { fontSize: FONT_SIZES.MD, fontWeight: '800', color: COLORS.WHITE },
});
