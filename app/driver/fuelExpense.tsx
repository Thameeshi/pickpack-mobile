import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/hooks/useAuth';
import { addFuelExpense, uploadFuelReceipt } from '../../src/services/fuelService';
import { getActiveTrip, addFuelExpenseToTrip } from '../../src/services/tripService';
import { getCurrentLocation } from '../../src/services/locationService';
import { FuelType, TripSession } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function FuelExpenseScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [fuelType, setFuelType] = useState<FuelType>('diesel');
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [stationName, setStationName] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState<TripSession | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const totalCost = (Number(litres) || 0) * (Number(costPerLitre) || 0);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const trip = await getActiveTrip(user.uid);
      setActiveTrip(trip);
      // Pre-fill odometer from active trip's start reading as a helpful baseline
      if (trip?.startOdometer && !odometerReading) {
        setOdometerReading(String(trip.startOdometer));
      }
    })();
  }, [user]);

  const handleTakeReceipt = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.7,
    });
    if (!result.canceled) setReceipt(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!litres || !costPerLitre || !odometerReading) {
      Alert.alert('Error', 'Please fill in litres, cost per litre, and odometer reading');
      return;
    }
    if (!stationName.trim()) {
      Alert.alert('Error', 'Please enter the fuel station name');
      return;
    }

    setLoading(true);
    try {
      // Auto-capture GPS location of fuel station
      let stationLocation = undefined;
      try {
        const position = await getCurrentLocation();
        stationLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {}

      const expenseId = await addFuelExpense({
        driverId: user!.uid,
        driverName: profile?.name || '',
        tripId: activeTrip?.id,
        date: new Date().toISOString(),
        fuelType,
        litres: Number(litres),
        costPerLitre: Number(costPerLitre),
        totalCost,
        odometerReading: Number(odometerReading),
        stationName: stationName.trim(),
        stationLocation,
        status: 'pending',
        notes,
      });

      // Upload receipt
      if (receipt) {
        try { await uploadFuelReceipt(expenseId, receipt); } catch {}
      }

      // Link to active trip
      if (activeTrip?.id) {
        try { await addFuelExpenseToTrip(activeTrip.id, expenseId); } catch {}
      }

      setShowSuccessModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
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
        <Text style={styles.title}>⛽ Fuel Expense</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active trip indicator */}
        {activeTrip && (
          <View style={styles.tripBanner}>
            <Text style={styles.tripBannerIcon}>🚚</Text>
            <Text style={styles.tripBannerText}>Linked to active trip • Start: {activeTrip.startOdometer} km</Text>
          </View>
        )}

        {/* Total display */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Cost</Text>
          <Text style={styles.totalValue}>LKR {totalCost.toFixed(2)}</Text>
        </View>

        {/* Fuel type */}
        <Text style={styles.label}>Fuel Type</Text>
        <View style={styles.typeRow}>
          {(['diesel', 'petrol'] as FuelType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, fuelType === t && styles.typeBtnActive]}
              onPress={() => setFuelType(t)}
            >
              <Text style={[styles.typeBtnText, fuelType === t && styles.typeBtnTextActive]}>
                {t === 'diesel' ? '🛢️' : '⛽'} {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Station Name */}
        <Text style={styles.label}>Fuel Station Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. IOC Kandy Road, Ceylon Petroleum"
          value={stationName} onChangeText={setStationName} placeholderTextColor={COLORS.GRAY_400} />

        {/* Inputs */}
        <Text style={styles.label}>Litres *</Text>
        <TextInput style={styles.input} placeholder="e.g. 45.5" keyboardType="decimal-pad"
          value={litres} onChangeText={setLitres} placeholderTextColor={COLORS.GRAY_400} />

        <Text style={styles.label}>Cost per Litre (LKR) *</Text>
        <TextInput style={styles.input} placeholder="e.g. 365.00" keyboardType="decimal-pad"
          value={costPerLitre} onChangeText={setCostPerLitre} placeholderTextColor={COLORS.GRAY_400} />

        <Text style={styles.label}>Odometer Reading (km) *</Text>
        <TextInput style={styles.input} placeholder="e.g. 45230" keyboardType="numeric"
          value={odometerReading} onChangeText={setOdometerReading} placeholderTextColor={COLORS.GRAY_400} />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Any additional notes..."
          value={notes} onChangeText={setNotes} multiline placeholderTextColor={COLORS.GRAY_400} />

        {/* GPS auto-capture note */}
        <View style={styles.gpsNote}>
          <Text style={styles.gpsNoteIcon}>📍</Text>
          <Text style={styles.gpsNoteText}>Your GPS location will be auto-captured when submitting</Text>
        </View>

        {/* Receipt photo */}
        <Text style={styles.label}>Fuel Receipt</Text>
        {receipt ? (
          <View style={styles.receiptContainer}>
            <Image source={{ uri: receipt }} style={styles.receiptImage} />
            <TouchableOpacity style={styles.retakeBtn} onPress={handleTakeReceipt}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoBtn} onPress={handleTakeReceipt}>
            <Text style={styles.photoBtnIcon}>📷</Text>
            <Text style={styles.photoBtnText}>Take Receipt Photo</Text>
          </TouchableOpacity>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={COLORS.WHITE} /> : (
            <Text style={styles.submitBtnText}>Submit for Approval</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✅ Submitted</Text>
            </View>
            <View style={styles.modalBody}>
               <Text style={styles.modalText}>Fuel expense of <Text style={{fontWeight:'700'}}>LKR {totalCost.toFixed(2)}</Text> submitted for approval.</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalConfirmBtn} 
                onPress={() => { setShowSuccessModal(false); router.back(); }}
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
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  content: { flex: 1, padding: SPACING.XL },
  tripBanner: {
    backgroundColor: COLORS.PRIMARY + '10', borderRadius: RADIUS.MD,
    padding: SPACING.MD, flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.LG, borderWidth: 1, borderColor: COLORS.PRIMARY + '20',
  },
  tripBannerIcon: { fontSize: 18, marginRight: SPACING.SM },
  tripBannerText: { fontSize: FONT_SIZES.SM, color: COLORS.PRIMARY, fontWeight: '600' },
  totalCard: {
    backgroundColor: COLORS.PRIMARY, borderRadius: RADIUS.LG, padding: SPACING.XL,
    alignItems: 'center', marginBottom: SPACING.XL,
  },
  totalLabel: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.8 },
  totalValue: { fontSize: FONT_SIZES.DISPLAY, fontWeight: '800', color: COLORS.WHITE, marginTop: SPACING.XS },
  label: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM, marginTop: SPACING.MD },
  typeRow: { flexDirection: 'row', gap: SPACING.MD, marginBottom: SPACING.SM },
  typeBtn: {
    flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG,
    borderWidth: 1.5, borderColor: COLORS.GRAY_200, alignItems: 'center', backgroundColor: COLORS.WHITE,
  },
  typeBtnActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY + '10' },
  typeBtnText: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_600 },
  typeBtnTextActive: { color: COLORS.PRIMARY },
  input: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, marginBottom: SPACING.SM, ...SHADOWS.SM,
  },
  gpsNote: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.SUCCESS + '10', borderRadius: RADIUS.MD,
    padding: SPACING.MD, marginTop: SPACING.SM, marginBottom: SPACING.MD,
  },
  gpsNoteIcon: { fontSize: 16, marginRight: SPACING.SM },
  gpsNoteText: { fontSize: FONT_SIZES.SM, color: COLORS.SUCCESS, fontWeight: '500' },
  receiptContainer: { alignItems: 'center', marginBottom: SPACING.LG },
  receiptImage: { width: '100%', height: 200, borderRadius: RADIUS.LG, marginBottom: SPACING.MD },
  retakeBtn: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderWidth: 1, borderColor: COLORS.PRIMARY, borderRadius: RADIUS.MD },
  retakeBtnText: { color: COLORS.PRIMARY, fontWeight: '600' },
  photoBtn: {
    backgroundColor: COLORS.WHITE, borderWidth: 2, borderColor: COLORS.GRAY_200,
    borderStyle: 'dashed', borderRadius: RADIUS.LG, padding: SPACING.XL,
    alignItems: 'center', marginBottom: SPACING.LG,
  },
  photoBtnIcon: { fontSize: 32, marginBottom: SPACING.SM },
  photoBtnText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500, fontWeight: '500' },
  submitBtn: {
    backgroundColor: COLORS.SUCCESS, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL,
  },
  submitBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
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
