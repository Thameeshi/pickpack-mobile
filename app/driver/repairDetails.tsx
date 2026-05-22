import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../../src/hooks/useAuth';
import { addRepairRequest, uploadRepairPhoto } from '../../src/services/repairService';
import { getActiveTrip } from '../../src/services/tripService';
import { RepairType, REPAIR_TYPE_LABELS, TripSession } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function RepairDetailsScreen() {
  const router = useRouter();
  const { repairType } = useLocalSearchParams<{ repairType: RepairType }>();
  const { user, profile } = useAuth();
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState<TripSession | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [locationAddress, setLocationAddress] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      // Get active trip
      const trip = await getActiveTrip(user.uid);
      setActiveTrip(trip);
      if (trip?.startOdometer && !odometerReading) {
        setOdometerReading(String(trip.startOdometer));
      }
      // Get current location address
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geocode.length > 0) {
            const place = geocode[0];
            setLocationAddress(`${place.street || ''} ${place.city || ''}`.trim() || 'Unknown');
          }
        }
      } catch {}
    })();
  }, [user]);

  const handleTakePhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit', 'Maximum 5 photos allowed');
      return;
    }
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'You need to allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, quality: 0.7,
      });
      if (!result.canceled) {
        setPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!repairType) {
      Alert.alert('Error', 'Invalid repair type');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please add a description of the issue');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Error', 'Please capture at least one photo of the issue');
      return;
    }

    setLoading(true);
    try {
      // Get GPS location
      let location = undefined;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        location = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      } catch {}

      const requestId = await addRepairRequest({
        driverId: user!.uid,
        driverName: profile?.name || '',
        ...(activeTrip?.id ? { tripId: activeTrip.id } : {}),
        repairType,
        description: description.trim(),
        ...(estimatedCost ? { estimatedCost: Number(estimatedCost) } : {}),
        photoUrls: [], // will be updated after upload
        ...(location ? { location } : {}),
        ...(locationAddress ? { locationAddress } : {}),
        ...(odometerReading ? { odometerReading: Number(odometerReading) } : {}),
        status: 'pending',
      });

      // Upload photos
      const uploadedUrls: string[] = [];
      for (const photoUri of photos) {
        try {
          const url = await uploadRepairPhoto(requestId, photoUri);
          uploadedUrls.push(url);
        } catch {}
      }

      // Update the document with photo URLs if any uploaded
      if (uploadedUrls.length > 0) {
        const { updateDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../../src/services/firebase');
        await updateDoc(doc(db, 'repairRequests', requestId), { photoUrls: uploadedUrls });
      }

      setShowSuccessModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit repair request');
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
        <Text style={styles.title}>🔧 Repair Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active trip indicator */}
        {activeTrip && (
          <View style={styles.tripBanner}>
            <Text style={styles.tripBannerIcon}>🚚</Text>
            <Text style={styles.tripBannerText}>Linked to active trip • Odo: {activeTrip.startOdometer} km</Text>
          </View>
        )}

        {/* Location display */}
        {locationAddress ? (
          <View style={styles.locationBanner}>
            <Text style={{ fontSize: 14 }}>📍</Text>
            <Text style={styles.locationText}>{locationAddress}</Text>
          </View>
        ) : null}

        {/* Selected Repair Type */}
        {repairType && REPAIR_TYPE_LABELS[repairType] && (
          <View style={styles.selectedTypeContainer}>
            <Text style={styles.selectedTypeLabel}>Selected Issue</Text>
            <Text style={styles.selectedTypeText}>{REPAIR_TYPE_LABELS[repairType]}</Text>
          </View>
        )}

        {/* Description */}
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="Describe the issue in detail..."
          value={description}
          onChangeText={setDescription}
          multiline
          placeholderTextColor={COLORS.GRAY_400}
        />

        {/* Estimated Cost */}
        <Text style={styles.label}>Estimated Repair Cost (LKR)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5000"
          keyboardType="numeric"
          value={estimatedCost}
          onChangeText={setEstimatedCost}
          placeholderTextColor={COLORS.GRAY_400}
        />

        {/* Odometer Reading */}
        <Text style={styles.label}>Current Odometer (km)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 45230"
          keyboardType="numeric"
          value={odometerReading}
          onChangeText={setOdometerReading}
          placeholderTextColor={COLORS.GRAY_400}
        />

        {/* Photos */}
        <Text style={styles.label}>Photos * ({photos.length}/5)</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, idx) => (
            <View key={idx} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <TouchableOpacity
                style={styles.photoRemoveBtn}
                onPress={() => handleRemovePhoto(idx)}
              >
                <Text style={styles.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 5 && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={handleTakePhoto}>
              <Text style={styles.addPhotoIcon}>📷</Text>
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* GPS auto-capture note */}
        <View style={styles.gpsNote}>
          <Text style={styles.gpsNoteIcon}>📍</Text>
          <Text style={styles.gpsNoteText}>Your GPS location will be auto-captured when submitting</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={COLORS.WHITE} /> : (
            <Text style={styles.submitBtnText}>🔧 Submit Repair Request</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✅ Request Submitted</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Your repair request for{' '}
                <Text style={{ fontWeight: '700' }}>
                  {repairType ? REPAIR_TYPE_LABELS[repairType] : ''}
                </Text>{' '}
                has been submitted and is pending approval.
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.dismissAll();
                  router.replace('/driver');
                }}
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
    marginBottom: SPACING.MD, borderWidth: 1, borderColor: COLORS.PRIMARY + '20',
  },
  tripBannerIcon: { fontSize: 18, marginRight: SPACING.SM },
  tripBannerText: { fontSize: FONT_SIZES.SM, color: COLORS.PRIMARY, fontWeight: '600' },
  locationBanner: {
    backgroundColor: COLORS.SUCCESS + '10', borderRadius: RADIUS.MD,
    padding: SPACING.MD, flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.LG, borderWidth: 1, borderColor: COLORS.SUCCESS + '20',
  },
  locationText: { fontSize: FONT_SIZES.SM, color: COLORS.SUCCESS, fontWeight: '600', marginLeft: SPACING.SM },
  
  selectedTypeContainer: {
    backgroundColor: COLORS.WHITE,
    padding: SPACING.MD,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.GRAY_200,
    marginBottom: SPACING.MD,
  },
  selectedTypeLabel: {
    fontSize: FONT_SIZES.XS,
    color: COLORS.GRAY_500,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  selectedTypeText: {
    fontSize: FONT_SIZES.MD,
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },

  label: {
    fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700,
    marginBottom: SPACING.SM, marginTop: SPACING.MD,
  },
  input: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, marginBottom: SPACING.SM, ...SHADOWS.SM,
  },

  // Photos
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginBottom: SPACING.LG,
  },
  photoWrapper: { position: 'relative' },
  photoThumb: {
    width: 90, height: 90, borderRadius: RADIUS.MD,
    borderWidth: 1, borderColor: COLORS.GRAY_200,
  },
  photoRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.DANGER, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.WHITE,
  },
  photoRemoveText: { color: COLORS.WHITE, fontSize: 10, fontWeight: '800' },
  addPhotoBtn: {
    width: 90, height: 90, borderRadius: RADIUS.MD,
    borderWidth: 2, borderColor: COLORS.GRAY_200, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.WHITE,
  },
  addPhotoIcon: { fontSize: 24, marginBottom: 2 },
  addPhotoText: { fontSize: 10, color: COLORS.GRAY_500, fontWeight: '600' },

  gpsNote: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.SUCCESS + '10', borderRadius: RADIUS.MD,
    padding: SPACING.MD, marginBottom: SPACING.LG,
  },
  gpsNoteIcon: { fontSize: 16, marginRight: SPACING.SM },
  gpsNoteText: { fontSize: FONT_SIZES.SM, color: COLORS.SUCCESS, fontWeight: '500' },
  submitBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL,
  },
  submitBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },

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
