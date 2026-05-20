import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { validateEmail } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      const { getCurrentUser } = require('../../src/services/authService');
      const userProfile = await getCurrentUser();
      if (userProfile?.status === 'pending') {
        const { logoutUser } = require('../../src/services/authService');
        await logoutUser();
        Alert.alert(
          '⏳ Account Pending',
          'Your account is awaiting approval from the administrator. You will be notified once your account is approved.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (userProfile?.status === 'suspended') {
        const { logoutUser } = require('../../src/services/authService');
        await logoutUser();
        Alert.alert(
          '🚫 Account Suspended',
          'Your account has been suspended. Please contact your administrator.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (userProfile?.status === 'rejected') {
        const { logoutUser } = require('../../src/services/authService');
        await logoutUser();
        Alert.alert(
          '❌ Account Rejected',
          'Your account registration was rejected. Please contact the administrator.',
          [{ text: 'OK' }]
        );
        return;
      }
      // Success — navigation handled by index.tsx
    } catch (error: any) {
      const msg = error.message || 'Login failed';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
      } else if (msg.includes('user-not-found')) {
        Alert.alert('Login Failed', 'No account found with this email.');
      } else if (msg.includes('too-many-requests')) {
        Alert.alert('Too Many Attempts', 'Please try again later.');
      } else {
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>📦</Text>
          </View>
          <Text style={styles.title}>PickPack</Text>
          <View style={styles.goldLine} />
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.GRAY_400}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.GRAY_400}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showBtn}>
                <Text style={styles.showBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.PRIMARY_DARK} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/register')}>
            <Text style={styles.linkText}>Register here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.PRIMARY },
  content: { flexGrow: 1, justifyContent: 'center', padding: SPACING.XL },
  header: { alignItems: 'center', marginBottom: SPACING.XXL },
  logoContainer: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.ACCENT, 
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.LG,
    ...SHADOWS.LG,
  },
  logoIcon: { fontSize: 42 },
  title: { fontSize: FONT_SIZES.DISPLAY, fontWeight: '800', color: COLORS.WHITE, letterSpacing: 2 },
  goldLine: {
    width: 48, height: 3, backgroundColor: COLORS.ACCENT,
    borderRadius: 2, marginTop: SPACING.SM, marginBottom: SPACING.SM,
  },
  subtitle: { fontSize: FONT_SIZES.MD, color: COLORS.ACCENT, opacity: 0.9, marginTop: SPACING.XS },
  formCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.XL,
    ...SHADOWS.LG,
  },
  inputGroup: { marginBottom: SPACING.LG },
  label: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.GRAY_200, borderRadius: RADIUS.LG,
    backgroundColor: COLORS.GRAY_50, paddingHorizontal: SPACING.MD,
  },
  inputIcon: { fontSize: 16, marginRight: SPACING.SM },
  input: { flex: 1, paddingVertical: SPACING.MD, fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900 },
  showBtn: { paddingHorizontal: SPACING.SM },
  showBtnText: { color: COLORS.PRIMARY, fontSize: FONT_SIZES.SM, fontWeight: '600' },
  loginButton: {
    backgroundColor: COLORS.ACCENT, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginTop: SPACING.SM,
  },
  buttonDisabled: { opacity: 0.6 },
  loginButtonText: { color: COLORS.PRIMARY_DARK, fontSize: FONT_SIZES.LG, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.XL },
  footerText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, opacity: 0.8 },
  linkText: { color: COLORS.ACCENT, fontSize: FONT_SIZES.MD, fontWeight: '700' },
});
