import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RepairType, REPAIR_TYPE_LABELS } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES } from '../../src/constants/theme';

const REPAIR_TYPES: { key: RepairType; icon: string }[] = [
  { key: 'tyre_puncture', icon: '🛞' },
  { key: 'engine_issue', icon: '🔧' },
  { key: 'brake_failure', icon: '🛑' },
  { key: 'battery_dead', icon: '🔋' },
  { key: 'oil_leak', icon: '🛢️' },
  { key: 'radiator_overheat', icon: '🌡️' },
  { key: 'electrical_fault', icon: '⚡' },
  { key: 'body_damage', icon: '🚛' },
  { key: 'other', icon: '🔩' },
];

export default function RepairRequestScreen() {
  const router = useRouter();

  const handleSelectType = (type: RepairType) => {
    router.push({
      pathname: '/driver/repairDetails',
      params: { repairType: type }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔧 Repair Request</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Select the issue with your vehicle</Text>
        
        {/* Repair Type Selection */}
        <View style={styles.typeGrid}>
          {REPAIR_TYPES.map(rt => (
            <TouchableOpacity
              key={rt.key}
              style={styles.typeChip}
              onPress={() => handleSelectType(rt.key)}
            >
              <Text style={styles.typeChipIcon}>{rt.icon}</Text>
              <Text style={styles.typeChipText} numberOfLines={1}>
                {REPAIR_TYPE_LABELS[rt.key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
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
  
  subtitle: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '600',
    color: COLORS.GRAY_600,
    marginBottom: SPACING.XL,
    marginTop: SPACING.MD,
  },

  // Repair type grid
  typeGrid: {
    flexDirection: 'column', gap: SPACING.MD,
  },
  typeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.LG, paddingHorizontal: SPACING.XL,
    borderRadius: RADIUS.LG, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.GRAY_500, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  typeChipIcon: { fontSize: 24, marginRight: SPACING.LG },
  typeChipText: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_800 },
});
