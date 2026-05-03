import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { validateEmail, validatePhone, validatePassword } from '../../src/utils/helpers';
import { UserRole } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const ROLES: { label: string; value: UserRole; icon: string; desc: string }[] = [
  { label: 'Driver', value: 'driver', icon: '🚚', desc: 'Deliver packages & track routes' },
  { label: 'Supervisor', value: 'supervisor', icon: '📋', desc: 'Manage drivers & assign tasks' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [step, setStep] = useState(1); // 1 = role, 2 = basic info, 3 = vehicle (driver only)
  const [role, setRole] = useState<UserRole>('driver');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Driver vehicle fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!name || !email || !phone || !password || !confirmPassword) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      if (!validateEmail(email)) { Alert.alert('Error', 'Invalid email'); return; }
      if (!validatePhone(phone)) { Alert.alert('Error', 'Invalid phone number'); return; }
      const passCheck = validatePassword(password);
      if (!passCheck.valid) { Alert.alert('Error', passCheck.message); return; }
      if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }

      if (role === 'driver') {
        setStep(3);
        return;
      }
      handleRegister();
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const extra = role === 'driver' ? { licenseNumber, vehicleType, vehiclePlate, vehicleModel } : {};
      await register(email, password, name, phone, role, extra);

      if (role === 'driver') {
        Alert.alert(
          '✅ Registration Successful',
          'Your account has been created and is pending approval from the super admin. You will be notified once approved.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
        );
      } else {
        Alert.alert('✅ Registration Successful', 'Welcome to PickPack!',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
      }
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string, value: string, setter: (v: string) => void,
    icon: string, opts?: { secure?: boolean; keyboard?: any; placeholder?: string }
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Text style={styles.inputIcon}>{icon}</Text>
        <TextInput
          style={styles.input}
          placeholder={opts?.placeholder || label}
          placeholderTextColor={COLORS.GRAY_400}
          value={value}
          onChangeText={setter}
          secureTextEntry={opts?.secure}
          keyboardType={opts?.keyboard}
          autoCapitalize={opts?.keyboard === 'email-address' ? 'none' : 'words'}
          editable={!loading}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Step {step} of {role === 'driver' ? 3 : 2}</Text>
          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / (role === 'driver' ? 3 : 2)) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.formCard}>
          {/* Step 1: Choose Role */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Select Your Role</Text>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, role === r.value && styles.roleCardSelected]}
                  onPress={() => setRole(r.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <View style={styles.roleInfo}>
                    <Text style={[styles.roleLabel, role === r.value && styles.roleLabelSelected]}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                  <View style={[styles.radioOuter, role === r.value && styles.radioSelected]}>
                    {role === r.value && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Personal Information</Text>
              {renderInput('Full Name', name, setName, '👤', { placeholder: 'Enter your full name' })}
              {renderInput('Email', email, setEmail, '✉️', { keyboard: 'email-address', placeholder: 'you@example.com' })}
              {renderInput('Phone Number', phone, setPhone, '📱', { keyboard: 'phone-pad', placeholder: '+94 7X XXX XXXX' })}
              {renderInput('Password', password, setPassword, '🔒', { secure: true, placeholder: 'Min 6 characters' })}
              {renderInput('Confirm Password', confirmPassword, setConfirmPassword, '🔒', { secure: true })}
            </>
          )}

          {/* Step 3: Vehicle Details (Driver only) */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Vehicle Details</Text>
              <Text style={styles.stepDesc}>This information helps supervisors assign the right deliveries to you.</Text>
              {renderInput('License Number', licenseNumber, setLicenseNumber, '🪪')}
              {renderInput('Vehicle Type', vehicleType, setVehicleType, '🚛', { placeholder: 'e.g. Truck, Van, Bike' })}
              {renderInput('Vehicle Plate', vehiclePlate, setVehiclePlate, '🔢')}
              {renderInput('Vehicle Model', vehicleModel, setVehicleModel, '🚗', { placeholder: 'e.g. Toyota Hiace' })}
            </>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.actionButton, loading && styles.buttonDisabled]}
            onPress={step === 3 || (step === 2 && role !== 'driver') ? handleRegister : handleNext}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <Text style={styles.actionButtonText}>
                {step === 3 || (step === 2 && role !== 'driver') ? 'Create Account' : 'Continue →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={styles.linkText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.PRIMARY },
  content: { flexGrow: 1, padding: SPACING.XL, paddingTop: SPACING.XXXL },
  header: { marginBottom: SPACING.XL },
  backBtn: { marginBottom: SPACING.LG },
  backText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XXL, fontWeight: '800', color: COLORS.WHITE },
  subtitle: { fontSize: FONT_SIZES.SM, color: COLORS.WHITE, opacity: 0.7, marginTop: SPACING.XS },
  progressBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: SPACING.MD,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.ACCENT, borderRadius: 2 },
  formCard: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.XL, ...SHADOWS.LG,
  },
  stepTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: SPACING.LG },
  stepDesc: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginBottom: SPACING.LG, marginTop: -SPACING.SM },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.LG,
    borderWidth: 2, borderColor: COLORS.GRAY_200, borderRadius: RADIUS.LG,
    marginBottom: SPACING.MD, backgroundColor: COLORS.WHITE,
  },
  roleCardSelected: { borderColor: COLORS.PRIMARY, backgroundColor: '#EFF6FF' },
  roleIcon: { fontSize: 32, marginRight: SPACING.LG },
  roleInfo: { flex: 1 },
  roleLabel: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  roleLabelSelected: { color: COLORS.PRIMARY },
  roleDesc: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.XS },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.GRAY_300,
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: COLORS.PRIMARY },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.PRIMARY },
  inputGroup: { marginBottom: SPACING.MD },
  label: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.XS },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.GRAY_200, borderRadius: RADIUS.LG,
    backgroundColor: COLORS.GRAY_50, paddingHorizontal: SPACING.MD,
  },
  inputIcon: { fontSize: 16, marginRight: SPACING.SM },
  input: { flex: 1, paddingVertical: SPACING.MD, fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900 },
  actionButton: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginTop: SPACING.LG,
  },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.XL },
  footerText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, opacity: 0.8 },
  linkText: { color: COLORS.ACCENT, fontSize: FONT_SIZES.MD, fontWeight: '700' },
});
