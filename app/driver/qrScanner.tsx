import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Animated, 
  Modal, 
  TextInput 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import { getCachedTasks } from '../../src/services/offlineService';
import { offlineUpdateTaskStatus, offlineGetTaskById } from '../../src/services/taskService';

export default function QRScannerScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [targetTask, setTargetTask] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  
  // New States
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [manualInputVisible, setManualInputVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Scanning Laser Animation
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate scanning line continuously
    const startAnimation = () => {
      scanLineAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 250, // Height of scanner cutout minus laser height
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    if (!scanned && !loading) {
      startAnimation();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [scanned, loading]);

  // Load target task if taskId is provided
  useEffect(() => {
    if (taskId) {
      setLoading(true);
      offlineGetTaskById(taskId)
        .then((t) => setTargetTask(t))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [taskId]);

  // Core processing function for both Scan & Manual Entry
  const processCode = async (code: string) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (taskId && targetTask) {
      // Flow A: Scanning for a specific task
      const expectedCode = targetTask.qrCode || targetTask.id;
      if (trimmedCode === expectedCode || trimmedCode === targetTask.id) {
        setLoading(true);
        try {
          await offlineUpdateTaskStatus(taskId, 'arrived');
          Alert.alert(
            '✅ Package Verified',
            `QR code matched successfully for delivery to ${targetTask.recipientName || 'recipient'}. Status updated to Arrived.`,
            [{ text: 'OK', onPress: () => router.replace(`/driver/taskDetails?taskId=${taskId}`) }]
          );
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to update delivery status.');
          setScanned(false);
        } finally {
          setLoading(false);
        }
      } else {
        Alert.alert(
          '❌ Invalid Package',
          `Scanned code does not match this task.\nExpected: ${expectedCode}\nScanned: ${trimmedCode}`,
          [{ text: 'Try Again', onPress: () => setScanned(false) }]
        );
      }
    } else {
      // Flow B: Scan from dashboard (no specific task ID)
      setLoading(true);
      try {
        const cachedTasks = await getCachedTasks();
        const matched = cachedTasks.find(
          (t) => (t.qrCode && t.qrCode.trim() === trimmedCode) || t.id === trimmedCode
        );

        if (matched) {
          Alert.alert(
            '📦 Delivery Found',
            `Matching package found for ${matched.recipientName}.\nDestination: ${matched.deliveryLocation}`,
            [
              { text: 'View Task', onPress: () => router.replace(`/driver/taskDetails?taskId=${matched.id}`) },
              { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) }
            ]
          );
        } else {
          Alert.alert(
            '⚠️ No Matching Task',
            `No assigned delivery task matches the QR code: "${trimmedCode}".`,
            [{ text: 'Scan Again', onPress: () => setScanned(false) }]
          );
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to search tasks.');
        setScanned(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleManualSubmit = () => {
    setManualInputVisible(false);
    processCode(manualCode);
    setManualCode('');
  };

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📷 QR Scanner</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={80} color={COLORS.GRAY_400} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            We need camera access to scan delivery package barcodes and QR codes.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
        </TouchableOpacity>
        <Text style={styles.title}>Scan package QR</Text>
        <TouchableOpacity onPress={() => setTorchEnabled(!torchEnabled)}>
          <Ionicons 
            name={torchEnabled ? "flash" : "flash-off"} 
            size={24} 
            color={torchEnabled ? '#ffc107' : COLORS.WHITE} 
          />
        </TouchableOpacity>
      </View>

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned || loading ? undefined : ({ data }) => processCode(data)}
      />

      {/* Overlay Scanning Guide */}
      <View style={styles.overlayContainer}>
        <View style={styles.topOverlay}>
          <Text style={styles.instructionText}>
            {targetTask 
              ? `Scan QR code for recipient ${targetTask.recipientName || ''}`
              : 'Scan package QR code to locate assignment'
            }
          </Text>
        </View>

        <View style={styles.middleOverlay}>
          <View style={styles.sideOverlay} />
          <View style={styles.scannerCutout}>
            {/* Corner Indicators */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* Animated Laser Scanning Line */}
            {!scanned && !loading && (
              <Animated.View 
                style={[
                  styles.laserLine, 
                  { transform: [{ translateY: scanLineAnim }] }
                ]} 
              />
            )}

            {loading && (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={COLORS.WHITE} />
              </View>
            )}
          </View>
          <View style={styles.sideOverlay} />
        </View>

        <View style={styles.bottomOverlay}>
          {scanned && !loading ? (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
              <Ionicons name="refresh" size={20} color={COLORS.WHITE} style={{ marginRight: 6 }} />
              <Text style={styles.rescanBtnText}>Scan Again</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.manualBtn} 
              onPress={() => setManualInputVisible(true)}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.WHITE} style={{ marginRight: 6 }} />
              <Text style={styles.manualBtnText}>Enter Code Manually</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Manual Input Fallback Modal */}
      <Modal
        visible={manualInputVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setManualInputVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Package Code</Text>
            <Text style={styles.modalSubtitle}>
              If the QR code won't scan, type the package ID or tracking code below:
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="e.g. PKG-12948-X"
              placeholderTextColor="#999"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => {
                  setManualInputVisible(false);
                  setManualCode('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.submitBtn]} 
                onPress={handleManualSubmit}
              >
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BLACK },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  permissionContainer: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.LG,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  permissionContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XXL },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.GRAY_800, marginTop: SPACING.LG },
  permissionSubtitle: { fontSize: 14, color: COLORS.GRAY_500, marginTop: SPACING.MD, textAlign: 'center', lineHeight: 20 },
  permissionBtn: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.MD, borderRadius: RADIUS.FULL, marginTop: SPACING.XXL, ...SHADOWS.SM },
  permissionBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },

  // Overlay
  overlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', zIndex: 5 },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: SPACING.XL },
  instructionText: { color: COLORS.WHITE, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: SPACING.XL },
  middleOverlay: { flexDirection: 'row', height: 260 },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scannerCutout: { width: 260, height: 260, position: 'relative', backgroundColor: 'transparent' },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: SPACING.XXL },

  // Corner indicators
  corner: { position: 'absolute', width: 24, height: 24, borderColor: COLORS.PRIMARY_LIGHT, borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  // Animated laser line
  laserLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 3,
    backgroundColor: '#00ffff', // Electric cyan color
    borderRadius: 2,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },

  loaderWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG, ...SHADOWS.MD },
  rescanBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
  
  manualBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  manualBtnText: { color: COLORS.WHITE, fontWeight: '600', fontSize: FONT_SIZES.MD },

  // Modal styling
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
  modalContent: { backgroundColor: COLORS.WHITE, width: '100%', borderRadius: RADIUS.LG, padding: SPACING.XL, ...SHADOWS.LG },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.SM },
  modalSubtitle: { fontSize: 14, color: COLORS.GRAY_600, marginBottom: SPACING.LG, lineHeight: 20 },
  textInput: { borderWidth: 1, borderColor: COLORS.GRAY_300, borderRadius: RADIUS.MD, padding: SPACING.MD, fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, marginBottom: SPACING.XL },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: SPACING.MD, paddingHorizontal: SPACING.XL, borderRadius: RADIUS.MD },
  cancelBtn: { marginRight: SPACING.MD },
  cancelBtnText: { color: COLORS.GRAY_600, fontWeight: '600', fontSize: FONT_SIZES.MD },
  submitBtn: { backgroundColor: COLORS.PRIMARY },
  submitBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
});
