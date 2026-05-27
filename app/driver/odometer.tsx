import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/hooks/useAuth';
import {
  offlineAddOdometerReading, getTodayOdometerReadings,
  offlineUploadOdometerPhoto, calculateDailyDistance,
} from '../../src/services/fuelService';
import { getCurrentLocation } from '../../src/services/locationService';
import { OdometerType, OdometerReading } from '../../src/types';
import { useOfflineSync } from '../../src/hooks/useOfflineSync';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function OdometerScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();
  const [reading, setReading] = useState('');
  const [type, setType] = useState<OdometerType>('start_of_day');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [todayReadings, setTodayReadings] = useState<OdometerReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(true);

  useEffect(() => {
    loadTodayReadings();
  }, []);

  const loadTodayReadings = async () => {
    if (!user?.uid) return;
    try {
      const readings = await getTodayOdometerReadings(user.uid);
      setTodayReadings(readings);
      // Auto-select type based on what's already recorded
      if (readings.some(r => r.type === 'start_of_day') && !readings.some(r => r.type === 'end_of_day')) {
        setType('end_of_day');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReadings(false);
    }
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
      if (!result.canceled) setPhoto(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSubmit = async () => {
    if (!reading || isNaN(Number(reading))) {
      Alert.alert('Error', 'Please enter a valid odometer reading');
      return;
    }
    if (!photo) {
      Alert.alert('Photo Required', 'Please take a photo of your odometer');
      return;
    }

    setLoading(true);
    try {
      let loc = undefined;
      try {
        const position = await getCurrentLocation();
        loc = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {}

      const readingData = {
        driverId: user!.uid,
        driverName: profile?.name || '',
        reading: Number(reading),
        type,
        location: loc,
        timestamp: Date.now(),
        verified: false,
      };

      const docId = await offlineAddOdometerReading(readingData);

      // Upload photo
      try {
        const photoUrl = await offlineUploadOdometerPhoto(docId, photo);
      } catch {}

      const isOfflineMode = !isOnline;
      Alert.alert(
        isOfflineMode ? '⚡ Saved Locally' : '✅ Saved',
        isOfflineMode
          ? `Working Offline. Odometer reading (${reading} km) saved locally. It will automatically sync when connection returns.`
          : `${type === 'start_of_day' ? 'Start' : 'End'} of day reading recorded: ${reading} km`,
        [
          { text: 'OK', onPress: () => { loadTodayReadings(); setReading(''); setPhoto(null); } },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save reading');
    } finally {
      setLoading(false);
    }
  };

  const dailyDistance = calculateDailyDistance(todayReadings);
  const startReading = todayReadings.find(r => r.type === 'start_of_day');
  const endReading = todayReadings.find(r => r.type === 'end_of_day');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔢 Odometer</Text>
        <TouchableOpacity
          style={{
            width: 40, height: 40, borderRadius: 20,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: !isOnline ? COLORS.WARNING + '20' : 'rgba(255,255,255,0.15)',
          }}
          onPress={() => {
            if (isOnline && pendingCount > 0) {
              syncNow();
            } else {
              Alert.alert(
                'Cloud Sync Status',
                isOnline 
                  ? `You are ONLINE. ${pendingCount > 0 ? `${pendingCount} action(s) pending sync.` : 'All actions are perfectly synced with the server!'}`
                  : `You are OFFLINE. ${pendingCount > 0 ? `${pendingCount} action(s) saved locally, waiting for internet to sync.` : 'Working in Offline Mode. No pending updates.'}`
              );
            }
          }}
        >
          <Text style={{ fontSize: 18, color: COLORS.WHITE }}>
            {isOnline ? (pendingCount > 0 ? '🔄' : '☁️') : '⚡'}
          </Text>
          {pendingCount > 0 && (
            <View style={{
              position: 'absolute', top: -4, right: -4,
              backgroundColor: isOnline ? COLORS.PRIMARY : COLORS.WARNING,
              borderRadius: 8, minWidth: 16, height: 16,
              justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
            }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.WHITE }}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Today's Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today's Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Start</Text>
              <Text style={styles.summaryValue}>{startReading ? `${startReading.reading} km` : '—'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>End</Text>
              <Text style={styles.summaryValue}>{endReading ? `${endReading.reading} km` : '—'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Driven</Text>
              <Text style={[styles.summaryValue, { color: COLORS.SUCCESS }]}>{dailyDistance} km</Text>
            </View>
          </View>
        </View>

        {/* Type selector */}
        <Text style={styles.sectionLabel}>Reading Type</Text>
        <View style={styles.typeRow}>
          {([
            { value: 'start_of_day', label: '🌅 Start of Day', done: !!startReading },
            { value: 'end_of_day', label: '🌙 End of Day', done: !!endReading },
            { value: 'fuel_stop', label: '⛽ Fuel Stop', done: false },
          ] as { value: OdometerType; label: string; done: boolean }[]).map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeBtn, type === t.value && styles.typeBtnActive, t.done && styles.typeBtnDone]}
              onPress={() => !t.done && setType(t.value)}
              disabled={t.done}
            >
              <Text style={[styles.typeBtnText, type === t.value && styles.typeBtnTextActive]}>
                {t.label} {t.done ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reading Input */}
        <Text style={styles.sectionLabel}>Odometer Reading (km)</Text>
        <TextInput
          style={styles.readingInput}
          placeholder="e.g. 45230"
          placeholderTextColor={COLORS.GRAY_400}
          keyboardType="numeric"
          value={reading}
          onChangeText={setReading}
        />

        {/* Photo */}
        <Text style={styles.sectionLabel}>Odometer Photo</Text>
        {photo ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={handleTakePhoto}>
            <Text style={styles.photoPlaceholderIcon}>📷</Text>
            <Text style={styles.photoPlaceholderText}>Take a photo of your odometer</Text>
          </TouchableOpacity>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={COLORS.WHITE} /> : (
            <Text style={styles.submitBtnText}>Save Reading</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  summaryCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.XL,
    marginBottom: SPACING.XL, ...SHADOWS.MD,
  },
  summaryTitle: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.LG },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600' },
  summaryValue: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900, marginTop: SPACING.XS },
  summaryDivider: { width: 1, height: 40, backgroundColor: COLORS.GRAY_200 },
  sectionLabel: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM },
  typeRow: { flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.XL, flexWrap: 'wrap' },
  typeBtn: {
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.SM,
    borderRadius: RADIUS.FULL, borderWidth: 1.5, borderColor: COLORS.GRAY_200, backgroundColor: COLORS.WHITE,
  },
  typeBtnActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY + '10' },
  typeBtnDone: { opacity: 0.5 },
  typeBtnText: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_600 },
  typeBtnTextActive: { color: COLORS.PRIMARY },
  readingInput: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.LG,
    fontSize: FONT_SIZES.XXL, fontWeight: '700', color: COLORS.GRAY_900,
    textAlign: 'center', marginBottom: SPACING.XL, ...SHADOWS.SM,
  },
  photoContainer: { alignItems: 'center', marginBottom: SPACING.XL },
  photo: { width: '100%', height: 200, borderRadius: RADIUS.LG, marginBottom: SPACING.MD },
  retakeBtn: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderWidth: 1, borderColor: COLORS.PRIMARY, borderRadius: RADIUS.MD },
  retakeBtnText: { color: COLORS.PRIMARY, fontWeight: '600' },
  photoPlaceholder: {
    backgroundColor: COLORS.WHITE, borderWidth: 2, borderColor: COLORS.GRAY_200,
    borderStyle: 'dashed', borderRadius: RADIUS.LG, padding: SPACING.XXL,
    alignItems: 'center', marginBottom: SPACING.XL,
  },
  photoPlaceholderIcon: { fontSize: 48, marginBottom: SPACING.MD },
  photoPlaceholderText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500 },
  submitBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginBottom: SPACING.XXXL,
  },
  submitBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
});
