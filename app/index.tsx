import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { COLORS } from '../src/constants/theme';

export default function IndexScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user || !profile) {
      router.replace('/auth/login');
      return;
    }

    // Check account status
    if (profile.status === 'pending') {
      router.replace('/auth/login');
      return;
    }

    if (profile.status === 'suspended' || profile.status === 'rejected') {
      router.replace('/auth/login');
      return;
    }

    // Route based on role
    switch (profile.role) {
      case 'driver':
        router.replace('/driver/dashboard');
        break;
      case 'supervisor':
      case 'superadmin':
        router.replace('/supervisor/dashboard');
        break;
      default:
        router.replace('/auth/login');
    }
  }, [user, profile, loading, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>📦</Text>
      <Text style={styles.title}>PickPack</Text>
      <Text style={styles.subtitle}>Delivery Management System</Text>
      <ActivityIndicator size="large" color={COLORS.WHITE} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 40, fontWeight: '800', color: COLORS.WHITE, letterSpacing: 2 },
  subtitle: { fontSize: 14, color: COLORS.WHITE, opacity: 0.8, marginTop: 8 },
  loader: { marginTop: 48 },
});
