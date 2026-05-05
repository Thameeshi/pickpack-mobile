import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, ScrollView, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/hooks/useAuth';
import { endTrip, getActiveTrip } from '../../src/services/tripService';
import { addOdometerReading, uploadOdometerPhoto } from '../../src/services/fuelService';
import { stopTrackingDriverLocation, getCurrentLocation } from '../../src/services/locationService';
import { TripSession } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function TripEndScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [activeTrip, setActiveTrip] = useState<TripSession | null>(null);
  const [odometer, setOdometer] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [tripSummary, setTripSummary] = useState<TripSession | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const trip = await getActiveTrip(user.uid);
      setActiveTrip(trip);
      setLoadingTrip(false);
    })();
  }, [user]);

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

  const handleEndTrip = async () => {
    if (!odometer || isNaN(Number(odometer))) {
      Alert.alert('⚠️ Required', 'Please enter your ending odometer reading');
      return;
    }
    if (!photo) {
      Alert.alert('📷 Required', 'Please take a photo of your odometer');
      return;
    }
    if (activeTrip && Number(odometer) < activeTrip.startOdometer) {
      Alert.alert('⚠️ Invalid', 'End reading cannot be less than start reading');
      return;
    }

    setShowConfirmModal(true);
  };

  const onConfirmEndTrip = async () => {
    setLoading(true);
    try {
      let loc = undefined;
      try {
        const position = await getCurrentLocation();
        loc = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {}

      // 1. Save odometer reading
      const readingId = await addOdometerReading({
        driverId: user!.uid,
        driverName: profile?.name || '',
        reading: Number(odometer),
        type: 'trip_end',
        location: loc,
        tripId: activeTrip?.id,
        timestamp: Date.now(),
        verified: false,
      });

      if (photo) {
        try { await uploadOdometerPhoto(readingId, photo); } catch {}
      }

      // 2. End the trip
      const summary = await endTrip(activeTrip!.id!, Number(odometer));
      setTripSummary(summary);

      // 3. Stop GPS tracking
      stopTrackingDriverLocation();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to end trip');
    } finally {
      setLoading(false);
    }
  };

  if (loadingTrip) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  if (!activeTrip) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>End Trip</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚫</Text>
          <Text style={styles.emptyText}>No active trip to end</Text>
        </View>
      </View>
    );
  }

  // Show trip summary after completion
  if (tripSummary) {
    const duration = tripSummary.endTime! - tripSummary.startTime;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);

    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: COLORS.SUCCESS }]}>
          <View style={{ width: 50 }} />
          <Text style={styles.title}>🏁 Trip Complete!</Text>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: SPACING.XXXL }}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>✅</Text>
            <Text style={styles.summaryTitle}>Trip Summary</Text>

            <View style={styles.summaryGrid}>
              <SummaryItem label="Distance" value={`${tripSummary.totalDistance?.toLocaleString() || 0} km`} icon="📏" />
              <SummaryItem label="Duration" value={`${hours}h ${minutes}m`} icon="⏱️" />
              <SummaryItem label="Deliveries" value={`${tripSummary.deliveriesCompleted || 0} done`} icon="📦" />
              <SummaryItem label="Failed" value={`${tripSummary.deliveriesFailed || 0}`} icon="❌" />
              <SummaryItem label="Fuel Cost" value={`LKR ${tripSummary.totalFuelCost?.toFixed(0) || 0}`} icon="⛽" />
              <SummaryItem label="Fuel Used" value={`${tripSummary.totalFuelLitres?.toFixed(1) || 0} L`} icon="🛢️" />
            </View>

            <View style={styles.odometerSummary}>
              <View style={styles.odometerItem}>
                <Text style={styles.odometerLabel}>Start</Text>
                <Text style={styles.odometerValue}>{tripSummary.startOdometer.toLocaleString()} km</Text>
              </View>
              <Text style={styles.odometerArrow}>→</Text>
              <View style={styles.odometerItem}>
                <Text style={styles.odometerLabel}>End</Text>
                <Text style={styles.odometerValue}>{tripSummary.endOdometer?.toLocaleString()} km</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.replace('/driver/dashboard')}
          >
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Trip end form
  const tripDuration = Date.now() - activeTrip.startTime;
  const tripHours = Math.floor(tripDuration / 3600000);
  const tripMinutes = Math.floor((tripDuration % 3600000) / 60000);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: COLORS.PRIMARY }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('../../assets/icons/end-trip.png')} style={{ width: 24, height: 24, tintColor: COLORS.WHITE }} />
          <Text style={styles.title}>End Trip</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current trip info */}
        <View style={styles.tripInfo}>
          <Text style={styles.tripInfoTitle}>Active Trip</Text>
          <View style={styles.tripInfoRow}>
            <View style={styles.tripInfoItem}>
              <Text style={styles.tripInfoLabel}>Started</Text>
              <Text style={styles.tripInfoValue}>{new Date(activeTrip.startTime).toLocaleTimeString()}</Text>
            </View>
            <View style={styles.tripInfoItem}>
              <Text style={styles.tripInfoLabel}>Duration</Text>
              <Text style={styles.tripInfoValue}>{tripHours}h {tripMinutes}m</Text>
            </View>
            <View style={styles.tripInfoItem}>
              <Text style={styles.tripInfoLabel}>Start Odo</Text>
              <Text style={styles.tripInfoValue}>{activeTrip.startOdometer.toLocaleString()} km</Text>
            </View>
          </View>
          <Text style={styles.tripInfoStats}>
            📦 {activeTrip.taskIds.length} deliveries • ⛽ {activeTrip.fuelExpenseIds.length} fuel stops
          </Text>
        </View>

        {/* End odometer */}
        <Text style={styles.label}>Ending Odometer Reading (km)</Text>
        <TextInput
          style={styles.odometerInput}
          placeholder="e.g. 45350"
          placeholderTextColor={COLORS.GRAY_400}
          keyboardType="numeric"
          value={odometer}
          onChangeText={setOdometer}
        />

        {odometer && Number(odometer) >= activeTrip.startOdometer ? (
          <View style={styles.distancePreview}>
            <Text style={styles.distanceLabel}>Trip Distance</Text>
            <Text style={styles.distanceValue}>
              {(Number(odometer) - activeTrip.startOdometer).toLocaleString()} km
            </Text>
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
            <Text style={styles.photoPlaceholderText}>Take ending odometer photo</Text>
          </TouchableOpacity>
        )}

        {/* End Button */}
        <TouchableOpacity
          style={[styles.endBtn, loading && { opacity: 0.6 }]}
          onPress={handleEndTrip}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.WHITE} />
          ) : (
            <>
              <Image source={require('../../assets/icons/end-trip.png')} style={{ width: 28, height: 28, tintColor: COLORS.WHITE }} />
              <Text style={styles.endBtnText}>End Trip</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Image source={require('../../assets/icons/end-trip.png')} style={{ width: 24, height: 24, tintColor: COLORS.PRIMARY }} />
              <Text style={styles.modalTitle}>End Trip?</Text>
            </View>
            <View style={styles.modalBody}>
               <Text style={styles.modalText}>Start: <Text style={{fontWeight:'700'}}>{activeTrip.startOdometer?.toLocaleString()} km</Text></Text>
               <Text style={styles.modalText}>End: <Text style={{fontWeight:'700'}}>{Number(odometer).toLocaleString()} km</Text></Text>
               <Text style={styles.modalText}>Distance: <Text style={{fontWeight:'700'}}>{(Number(odometer) - (activeTrip.startOdometer || 0)).toLocaleString()} km</Text></Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => { setShowConfirmModal(false); onConfirmEndTrip(); }}>
                <Text style={styles.modalConfirmText}>END TRIP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function SummaryItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.summaryGridItem}>
      <Text style={styles.summaryGridIcon}>{icon}</Text>
      <Text style={styles.summaryGridValue}>{value}</Text>
      <Text style={styles.summaryGridLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  content: { flex: 1, padding: SPACING.XL },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.MD },
  emptyText: { fontSize: FONT_SIZES.XL, fontWeight: '600', color: COLORS.GRAY_500 },
  tripInfo: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.XL, ...SHADOWS.MD,
  },
  tripInfoTitle: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.MD },
  tripInfoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tripInfoItem: { alignItems: 'center' },
  tripInfoLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600' },
  tripInfoValue: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900, marginTop: SPACING.XS },
  tripInfoStats: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.MD, textAlign: 'center' },
  label: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM },
  odometerInput: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.LG,
    fontSize: FONT_SIZES.XXL, fontWeight: '700', color: COLORS.GRAY_900,
    textAlign: 'center', marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  distancePreview: {
    backgroundColor: COLORS.PRIMARY + '10', borderRadius: RADIUS.MD,
    padding: SPACING.MD, alignItems: 'center', marginBottom: SPACING.XL,
    borderWidth: 1, borderColor: COLORS.PRIMARY + '20',
  },
  distanceLabel: { fontSize: FONT_SIZES.XS, color: COLORS.PRIMARY, fontWeight: '600' },
  distanceValue: { fontSize: FONT_SIZES.XXL, fontWeight: '800', color: COLORS.PRIMARY },
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
  photoPlaceholderText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500 },
  endBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL,
    flexDirection: 'row', justifyContent: 'center', gap: SPACING.SM, ...SHADOWS.MD,
  },
  endBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.XL, fontWeight: '700' },
  // Summary styles
  summaryCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL,
    padding: SPACING.XXL, alignItems: 'center', ...SHADOWS.LG, marginBottom: SPACING.XL,
  },
  summaryIcon: { fontSize: 64, marginBottom: SPACING.MD },
  summaryTitle: { fontSize: FONT_SIZES.XXL, fontWeight: '800', color: COLORS.GRAY_900, marginBottom: SPACING.XL },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.MD, width: '100%' },
  summaryGridItem: {
    width: '47%', backgroundColor: COLORS.GRAY_50, borderRadius: RADIUS.LG,
    padding: SPACING.MD, alignItems: 'center',
  },
  summaryGridIcon: { fontSize: 24, marginBottom: SPACING.XS },
  summaryGridValue: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  summaryGridLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600', marginTop: 2 },
  odometerSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.XL, gap: SPACING.MD,
  },
  odometerItem: { alignItems: 'center' },
  odometerLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600' },
  odometerValue: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  odometerArrow: { fontSize: FONT_SIZES.XXL, color: COLORS.GRAY_400 },
  doneBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL,
  },
  doneBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
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
  modalCancelBtn: { paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD },
  modalCancelText: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: FONT_SIZES.MD },
  modalConfirmBtn: { paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD },
  modalConfirmText: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: FONT_SIZES.MD },
});
