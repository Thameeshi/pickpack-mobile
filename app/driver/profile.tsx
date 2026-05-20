import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { profile, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/auth/login'); } },
    ]);
  };

  const menuItems = [
    { icon: '🔢', label: 'Odometer Readings', route: '/driver/odometer' },
    { icon: '⛽', label: 'Fuel Expenses', route: '/driver/fuelHistory' },
    { icon: '📷', label: 'QR Scanner', route: '/driver/qrScanner' },
    { icon: '💬', label: 'Messages', route: '/driver/chatList' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name || 'D')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.role}>Driver</Text>
        {profile?.vehiclePlate && (
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleText}>🚚 {profile.vehiclePlate}</Text>
          </View>
        )}
      </View>

      <View style={styles.menu}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem} onPress={() => router.push(item.route as any)}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>
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
  profileCard: {
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
  role: { fontSize: FONT_SIZES.XS, fontWeight: '600', color: COLORS.PRIMARY, marginTop: SPACING.SM, textTransform: 'uppercase' },
  vehicleBadge: {
    backgroundColor: COLORS.GRAY_100, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM,
    borderRadius: RADIUS.FULL, marginTop: SPACING.MD,
  },
  vehicleText: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700 },
  menu: {
    backgroundColor: COLORS.WHITE, marginHorizontal: SPACING.XL, borderRadius: RADIUS.LG,
    ...SHADOWS.SM, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.LG,
    borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_100,
  },
  menuIcon: { fontSize: 20, marginRight: SPACING.MD },
  menuLabel: { flex: 1, fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800 },
  menuArrow: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_400 },
  logoutBtn: {
    marginHorizontal: SPACING.XL, marginTop: SPACING.XL,
    backgroundColor: COLORS.DANGER + '10', paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', borderWidth: 1, borderColor: COLORS.DANGER + '30',
  },
  logoutText: { color: COLORS.DANGER, fontSize: FONT_SIZES.MD, fontWeight: '600' },
});
