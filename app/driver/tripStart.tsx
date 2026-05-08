import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/hooks/useAuth';
import { startTrip, linkAcceptedTasksToTrip } from '../../src/services/tripService';
import { addOdometerReading, uploadOdometerPhoto } from '../../src/services/fuelService';
import { getCurrentLocation } from '../../src/services/locationService';
import { startTrackingDriverLocation } from '../../src/services/locationService';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function TripStartScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [odometer, setOdometer] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [linkedTaskCount, setLinkedTaskCount] = useState(0);

  const handleTakePhoto = async () => {
    try {
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
      Alert.alert('⚠️ Required', 'Please enter your current odometer reading');
      return;
    }
    if (!photo) {
      Alert.alert('📷 Required', 'Please take a photo of your odometer dashboard');
      return;
    }

    setLoading(true);
    try {
      // 1. Get current GPS location
      let loc = undefined;
      try {
        const position = await getCurrentLocation();
        loc = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {}

      // 2. Create trip session
      const tripId = await startTrip(
        user!.uid,
        profile?.name || '',
        Number(odometer),
      );

      // 3. Save odometer reading
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

      // 4. Upload odometer photo
      if (photo) {
        try { await uploadOdometerPhoto(readingId, photo); } catch {}
      }

      // 5. Auto-link all accepted/assigned tasks to this trip
      try {
        const linkedIds = await linkAcceptedTasksToTrip(user!.uid, tripId);
        setLinkedTaskCount(linkedIds.length);
      } catch {}

      // 6. Start GPS tracking
      try { await startTrackingDriverLocation(user!.uid); } catch {}

      setShowSuccessModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🚚 Start Trip</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoIcon}>📋</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Before You Drive</Text>
              <Text style={styles.infoText}>
                Record your starting odometer reading and take a photo of the dashboard.
                This activates GPS tracking for your trip.
              </Text>
            </View>
          </View>

          {/* Odometer Input */}
          <Text style={styles.label}>Starting Odometer Reading (km)</Text>
          <TextInput
            style={styles.odometerInput}
            placeholder="e.g. 45230"
            placeholderTextColor={COLORS.GRAY_400}
            keyboardType="numeric"
            value={odometer}
            onChangeText={setOdometer}
          />

          {odometer ? (
            <View style={styles.readingPreview}>
              <Text style={styles.readingPreviewLabel}>Starting at</Text>
              <Text style={styles.readingPreviewValue}>{Number(odometer).toLocaleString()} km</Text>
            </View>
          ) : null}

          {/* Photo */}
          <Text style={styles.label}>Odometer Photo</Text>
          {photo ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                <Text style={styles.retakeBtnText}>📷 Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={handleTakePhoto}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderTitle}>Take Odometer Photo</Text>
              <Text style={styles.photoPlaceholderText}>
                Photo of your dashboard showing the odometer reading
              </Text>
            </TouchableOpacity>
          )}

          {/* Checklist */}
          <View style={styles.checklist}>
            <Text style={styles.checklistTitle}>Pre-Trip Checklist</Text>
            <CheckItem label="Odometer reading entered" done={!!odometer && !isNaN(Number(odometer))} />
            <CheckItem label="Dashboard photo taken" done={!!photo} />
            <CheckItem label="GPS tracking will activate" done={true} />
          </View>

          {/* Start Button */}
          <TouchableOpacity
            style={[styles.startBtn, loading && { opacity: 0.6 }]}
            onPress={handleStartTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <>
                <Text style={styles.startBtnIcon}>🚀</Text>
                <Text style={styles.startBtnText}>Start Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚚 Trip Started!</Text>
            </View>
            <View style={styles.modalBody}>
               <Text style={styles.modalText}>Odometer: <Text style={{fontWeight:'700'}}>{odometer} km</Text></Text>
               {linkedTaskCount > 0 && (
                 <Text style={styles.modalText}>📦 <Text style={{fontWeight:'700'}}>{linkedTaskCount} task{linkedTaskCount > 1 ? 's' : ''}</Text> linked to this trip</Text>
               )}
               <Text style={styles.modalText}>GPS tracking is now active.</Text>
               <Text style={styles.modalText}>Drive safely!</Text>
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

function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.checkItem}>
      <Text style={styles.checkIcon}>{done ? '✅' : '⬜'}</Text>
      <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{label}</Text>
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
  content: { flex: 1, padding: SPACING.XL },
  infoBanner: {
    backgroundColor: COLORS.PRIMARY + '10', borderRadius: RADIUS.LG,
    padding: SPACING.LG, flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: SPACING.XL, borderWidth: 1, borderColor: COLORS.PRIMARY + '20',
  },
  infoIcon: { fontSize: 28, marginRight: SPACING.MD },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.PRIMARY, marginBottom: SPACING.XS },
  infoText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600, lineHeight: 18 },
  label: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM },
  odometerInput: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.LG,
    fontSize: FONT_SIZES.XXL, fontWeight: '700', color: COLORS.GRAY_900,
    textAlign: 'center', marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  readingPreview: {
    backgroundColor: COLORS.SUCCESS + '10', borderRadius: RADIUS.MD,
    padding: SPACING.MD, alignItems: 'center', marginBottom: SPACING.XL,
    borderWidth: 1, borderColor: COLORS.SUCCESS + '30',
  },
  readingPreviewLabel: { fontSize: FONT_SIZES.XS, color: COLORS.SUCCESS, fontWeight: '600' },
  readingPreviewValue: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.SUCCESS },
  photoContainer: { alignItems: 'center', marginBottom: SPACING.XL },
  photo: { width: '100%', height: 200, borderRadius: RADIUS.LG, marginBottom: SPACING.MD },
  retakeBtn: {
    paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM,
    borderWidth: 1, borderColor: COLORS.PRIMARY, borderRadius: RADIUS.MD,
  },
  retakeBtnText: { color: COLORS.PRIMARY, fontWeight: '600' },
  photoPlaceholder: {
    backgroundColor: COLORS.WHITE, borderWidth: 2, borderColor: COLORS.GRAY_200,
    borderStyle: 'dashed', borderRadius: RADIUS.LG, padding: SPACING.XXL,
    alignItems: 'center', marginBottom: SPACING.XL,
  },
  photoPlaceholderIcon: { fontSize: 48, marginBottom: SPACING.SM },
  photoPlaceholderTitle: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_700 },
  photoPlaceholderText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, textAlign: 'center', marginTop: SPACING.XS },
  checklist: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.XL, ...SHADOWS.SM,
  },
  checklistTitle: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.MD },
  checkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.SM },
  checkIcon: { fontSize: 18, marginRight: SPACING.MD },
  checkLabel: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_600 },
  checkLabelDone: { color: COLORS.GRAY_900, fontWeight: '500' },
  startBtn: {
    backgroundColor: COLORS.SUCCESS, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL,
    flexDirection: 'row', justifyContent: 'center', gap: SPACING.SM, ...SHADOWS.MD,
  },
  startBtnIcon: { fontSize: 24 },
  startBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XL, fontWeight: '700' },
  // Modal Styles
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
