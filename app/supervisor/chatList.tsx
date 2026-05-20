import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDrivers } from '../../src/hooks/useDrivers';
import { Driver } from '../../src/types';
import { COLORS, SPACING, FONT_SIZES, RADIUS, SHADOWS } from '../../src/constants/theme';

export default function SupervisorChatListScreen() {
  const router = useRouter();
  const { drivers, loading } = useDrivers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDriverName, setSelectedDriverName] = useState('');

  const filteredDrivers = drivers.filter(driver => {
    const q = searchQuery.toLowerCase();
    return (
      (driver.displayName && driver.displayName.toLowerCase().includes(q)) ||
      (driver.vehiclePlate && driver.vehiclePlate.toLowerCase().includes(q)) ||
      (driver.phoneNumber && driver.phoneNumber.includes(q))
    );
  });

  const handleNext = () => {
    if (!selectedDriverId) {
      Alert.alert('Selection Required', 'Please select a driver to start messaging.');
      return;
    }
    router.push(`/supervisor/chat?driverId=${selectedDriverId}&driverName=${encodeURIComponent(selectedDriverName)}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💬 Messages</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Search and select a driver</Text>
        
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or code..."
            placeholderTextColor={COLORS.GRAY_400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView style={styles.driverList} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginTop: SPACING.XXXL }} />
          ) : filteredDrivers.length === 0 ? (
            <Text style={styles.emptyText}>No drivers found.</Text>
          ) : (
            filteredDrivers.map((driver: Driver) => (
              <TouchableOpacity
                key={driver.uid}
                style={[
                  styles.driverItem,
                  selectedDriverId === driver.uid && styles.driverItemSelected,
                ]}
                onPress={() => {
                  setSelectedDriverId(driver.uid);
                  setSelectedDriverName(driver.displayName);
                }}
              >
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>{driver.displayName[0]?.toUpperCase() || 'D'}</Text>
                </View>
                <View style={styles.driverItemInfo}>
                  <Text style={styles.driverItemName}>{driver.displayName}</Text>
                  <Text style={styles.driverItemDetail}>
                    {driver.vehiclePlate || 'No vehicle'} • {driver.phoneNumber}
                  </Text>
                </View>
                {selectedDriverId === driver.uid && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: SPACING.XXXL }} />
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !selectedDriverId && { backgroundColor: COLORS.GRAY_400 }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>Next ➡️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: { 
    backgroundColor: COLORS.PRIMARY, 
    paddingHorizontal: SPACING.XL, 
    paddingTop: SPACING.XXXL + SPACING.MD, 
    paddingBottom: SPACING.LG, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  backBtnWrapper: { width: 60, justifyContent: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  content: { flex: 1, padding: SPACING.XL },
  label: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_800, marginBottom: SPACING.MD },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    marginBottom: SPACING.LG,
    ...SHADOWS.SM,
  },
  searchIcon: { fontSize: FONT_SIZES.MD, marginRight: SPACING.SM, color: COLORS.GRAY_400 },
  searchInput: { flex: 1, fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900 },
  
  driverList: { flex: 1 },
  emptyText: { textAlign: 'center', color: COLORS.GRAY_500, marginTop: SPACING.XL, fontSize: FONT_SIZES.MD },
  
  driverItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.WHITE,
    padding: SPACING.MD,
    borderRadius: RADIUS.MD,
    marginBottom: SPACING.SM, 
    borderWidth: 1, 
    borderColor: COLORS.GRAY_200,
    ...SHADOWS.SM,
  },
  driverItemSelected: { 
    borderColor: COLORS.PRIMARY, 
    backgroundColor: COLORS.PRIMARY + '08' 
  },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.SECONDARY,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  driverAvatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.LG },
  driverItemInfo: { flex: 1 },
  driverItemName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  driverItemDetail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  checkmark: { fontSize: FONT_SIZES.XL, color: COLORS.SUCCESS, fontWeight: '700' },
  
  footer: {
    padding: SPACING.XL,
    backgroundColor: COLORS.BG_PRIMARY,
  },
  nextBtn: {
    backgroundColor: COLORS.PRIMARY, 
    paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, 
    alignItems: 'center', 
    ...SHADOWS.MD,
  },
  nextBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
});
