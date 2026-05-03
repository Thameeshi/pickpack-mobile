import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function SupervisorProfileScreen() {
  const router = useRouter();
  const { profile, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/auth/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name || 'S')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.role}>{profile?.role === 'superadmin' ? '🛡️ Super Admin' : '📋 Supervisor'}</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL, paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  card: {
    backgroundColor: COLORS.WHITE, margin: SPACING.XL, borderRadius: RADIUS.XL,
    padding: SPACING.XXL, alignItems: 'center', ...SHADOWS.MD,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.LG,
  },
  avatarText: { fontSize: FONT_SIZES.XXXL, fontWeight: '800', color: COLORS.WHITE },
  name: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_900 },
  email: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.XS },
  role: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.PRIMARY, marginTop: SPACING.SM },
  logoutBtn: {
    marginHorizontal: SPACING.XL, backgroundColor: COLORS.DANGER + '10',
    paddingVertical: SPACING.LG, borderRadius: RADIUS.LG, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.DANGER + '30',
  },
  logoutText: { color: COLORS.DANGER, fontSize: FONT_SIZES.MD, fontWeight: '600' },
});
