import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  Alert, ScrollView, TextInput, PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
  const { taskId, supervisorId } = useLocalSearchParams<{ taskId: string; supervisorId?: string }>();
  const { user, profile } = useAuth();
  const { location } = useLocation();
  const { isOnline } = useOfflineSync();
  const [step, setStep] = useState(0); // 0=photo, 1=signature, 2=document, 3=confirm
  const [photo, setPhoto] = useState<string | null>(null);
  const [document, setDocument] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [uploading, setUploading] = useState(false);

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
        // Complete the task offline: passes local file paths, which the sync engine will upload later.
        await offlineCompleteTask(
          taskId!,
          photo, // local image URI
          location?.coords?.latitude || 0,
          location?.coords?.longitude || 0,
          signatureUri, // local signature URI
          document || undefined, // local doc URI (optional)
          recipientName.trim(),
        );

        Alert.alert('Offline Mode', 'Delivery saved locally! It will sync automatically when you are back online.', [
          { text: 'OK', onPress: () => router.replace('/driver/dashboard') }
        ]);
        return;
      }

      // --- ONLINE WORKFLOW ---
      // 1. Upload delivery photo (REQUIRED — block completion if fails)
      let proofUrl = '';
      try {
        proofUrl = await uploadProofOfDelivery(taskId!, photo, `${taskId}-${Date.now()}.jpg`);
        console.log('✅ Photo uploaded:', proofUrl);
      } catch (uploadErr: any) {
        const msg = uploadErr?.message || String(uploadErr);
        console.error('❌ Photo upload failed:', msg);
        Alert.alert('Upload Error (Photo)', msg + '\n\nPlease check your connection and try again.');
        setUploading(false);
        return; // BLOCK
      }

      // 2. Upload signature (REQUIRED — block completion if fails)
      let signatureUrl = '';
      if (signatureUri) {
        try {
          signatureUrl = await uploadSignature(taskId!, signatureUri);
          console.log('✅ Signature uploaded:', signatureUrl);
        } catch (e: any) {
          const msg = e?.message || String(e);
          console.error('❌ Signature upload failed:', msg);
          Alert.alert('Upload Error (Signature)', msg + '\n\nPlease try again.');
          setUploading(false);
          return; // BLOCK
        }
      }

      // 3. Upload document if taken (OPTIONAL — don't block completion)
      let documentUrl: string | undefined;
      if (document) {
        try {
          documentUrl = await uploadDeliveryDocument(taskId!, document);
          console.log('✅ Document uploaded:', documentUrl);
        } catch (e: any) {
          console.error('❌ Document upload failed:', e?.message);
          Alert.alert('Document Upload Warning', 'Document could not be uploaded, but delivery can proceed.');
        }
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

      // 7. Check if there are more pending tasks to complete
      let nextPendingTask: string | null = null;
      let nextSupervisorId: string | null = null;
      let pendingCount = 0;
      try {
        const trip = await getActiveTrip(user!.uid);
        if (trip?.taskIds && trip.taskIds.length > 0) {
          for (const tid of trip.taskIds) {
            if (tid === taskId) continue; // skip the one we just completed
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
          '✅ Delivered!',
          `Proof of delivery uploaded. You still have ${pendingCount} more pending delivery${pendingCount > 1 ? 'ies' : ''}. Continue to the next one?`,
          [
            { text: 'Dashboard', style: 'cancel', onPress: () => router.replace('/driver/dashboard') },
            {
              text: `Next (${pendingCount} left)`,
              onPress: () => router.replace(`/driver/proofOfDelivery?taskId=${nextPendingTask}&supervisorId=${nextSupervisorId || ''}`),
            },
          ]
        );
      } else {
        Alert.alert('✅ All Done!', 'All deliveries completed successfully!', [
          { text: 'OK', onPress: () => router.replace('/driver/dashboard') },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const steps = ['📷 Photo', '✍️ Signature', '📄 Document', '✅ Confirm'];

  return (
    <View style={styles.container}>
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>⚡ Offline Mode — Proof will sync when online</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
          <Text style={styles.backBtn}>← {step > 0 ? 'Back' : 'Cancel'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Proof of Delivery</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepRow}>
        {steps.map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive]} />
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
                    <Text style={styles.retakeBtnText}>📷 Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(1)}>
                    <Text style={styles.nextBtnText}>Next →</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
                <Text style={styles.captureBtnIcon}>📷</Text>
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

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearSignature}>
                <Text style={styles.clearBtnText}>🗑️ Clear</Text>
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
                    <Text style={styles.retakeBtnText}>📷 Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
                    <Text style={styles.nextBtnText}>Next →</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.captureBtn} onPress={handleTakeDocument}>
                  <Text style={styles.captureBtnIcon}>📄</Text>
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
              <ConfirmRow icon="📷" label="Delivery Photo" value={photo ? '✅ Captured' : '❌ Missing'} />
              <ConfirmRow icon="✍️" label="Signature" value={paths.length > 0 ? '✅ Signed' : '❌ Missing'} />
              <ConfirmRow icon="👤" label="Recipient" value={recipientName || '❌ Missing'} />
              <ConfirmRow icon="📄" label="Document" value={document ? '✅ Uploaded' : '⏭️ Skipped'} />
              <ConfirmRow icon="📍" label="GPS Location" value={location ? '✅ Captured' : '⏳ Loading...'} />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, uploading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color={COLORS.WHITE} /> : (
                <Text style={styles.submitBtnText}>✅ Submit Delivery Proof</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ConfirmRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmIcon}>{icon}</Text>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={styles.confirmValue}>{value}</Text>
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
    flexDirection: 'row', paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    backgroundColor: COLORS.WHITE, borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_100,
  },
  stepItem: { flex: 1, alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.GRAY_300, marginBottom: 4 },
  stepDotActive: { backgroundColor: COLORS.PRIMARY },
  stepLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, fontWeight: '500' },
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
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnIcon: { fontSize: 48, marginBottom: SPACING.SM },
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
    padding: SPACING.LG, marginBottom: SPACING.XL, ...SHADOWS.SM,
  },
  confirmRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.MD, borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_50,
  },
  confirmIcon: { fontSize: 20, marginRight: SPACING.MD },
  confirmLabel: { flex: 1, fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_700 },
  confirmValue: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_900 },
  submitBtn: {
    backgroundColor: COLORS.SUCCESS, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL, ...SHADOWS.MD,
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
});
