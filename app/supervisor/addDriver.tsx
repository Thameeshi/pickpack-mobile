import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { createPendingDriver } from '../../src/services/authService';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AddDriverScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('+94 ');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [loading, setLoading] = useState(false);

  // Custom Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (type: 'success' | 'error', title: string, message: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    if (modalType === 'success') {
      router.back();
    }
  };

  const handleAddDriver = async () => {
    const newErrors: { [k: string]: string } = {};
    if (!name.trim()) newErrors.name = 'Full name is required.';
    if (!email.trim()) newErrors.email = 'Email is required.';
    if (!password || password.length < 6) newErrors.password = 'Password must be at least 6 characters.';
    if (!phone.trim() || phone.trim().length < 6) newErrors.phone = 'Please enter a valid phone number.';

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      showModal('error', 'Missing Information', Object.values(newErrors)[0]);
      return;
    }

    setLoading(true);
    try {
      if (!user?.uid) throw new Error("Not authenticated");
      
      await createPendingDriver(email, password, name, phone, vehiclePlate, user.uid);
      
      showModal(
        'success',
        'Driver Added Successfully',
        'The driver account has been created. They are currently pending approval from the Super Admin.'
      );
      setName(''); setEmail(''); setPassword(''); setPhone('+94 '); setVehiclePlate(''); setShowOptional(false); setErrors({});
    } catch (e: any) {
      showModal('error', 'Registration Failed', e.message || 'Failed to add driver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add New Driver</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver Details</Text>
          <Text style={styles.cardSubtitle}>The driver will be pending until approved by the admin.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe"
              placeholderTextColor={COLORS.GRAY_400}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="driver@example.com"
              placeholderTextColor={COLORS.GRAY_400}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min 6 characters"
                placeholderTextColor={COLORS.GRAY_400}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrors(prev => ({ ...prev, password: '' })); }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.iconBtn}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.GRAY_500} />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="+94 7X XXX XXXX"
              placeholderTextColor={COLORS.GRAY_400}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                let next = t;
                if (!next.startsWith('+') && next !== '') next = '+' + next;
                setPhone(next);
                setErrors(prev => ({ ...prev, phone: '' }));
              }}
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            {!showOptional ? (
              <TouchableOpacity onPress={() => setShowOptional(true)} activeOpacity={0.7}>
                <Text style={styles.optionalToggle}>+ Add vehicle plate (optional)</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.label}>Vehicle Plate (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. WP ABC 1234"
                  placeholderTextColor={COLORS.GRAY_400}
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                />
                <TouchableOpacity onPress={() => { setVehiclePlate(''); setShowOptional(false); }} style={styles.removeOptional}>
                  <Text style={styles.removeOptionalText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleAddDriver}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.WHITE} />
            ) : (
              <Text style={styles.submitText}>Add Driver</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={{ height: SPACING.XXXL }} />
      </ScrollView>

      {/* Custom Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.iconCircle, 
              { backgroundColor: modalType === 'success' ? '#E8F5E9' : '#FFEBEE' }
            ]}>
              <Ionicons 
                name={modalType === 'success' ? 'checkmark-circle' : 'close-circle'} 
                size={48} 
                color={modalType === 'success' ? '#4CAF50' : '#F44336'} 
              />
            </View>
            
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            
            <TouchableOpacity 
              style={[
                styles.modalButton, 
                { backgroundColor: modalType === 'success' ? COLORS.PRIMARY : '#F44336' }
              ]} 
              onPress={closeModal}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>
                {modalType === 'success' ? 'Continue' : 'Try Again'}
              </Text>
            </TouchableOpacity>
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
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.XL,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    marginBottom: SPACING.MD,
    ...SHADOWS.MD,
  },
  backBtnWrapper: { width: 50, justifyContent: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.WHITE },
  content: { flex: 1, paddingHorizontal: SPACING.LG },
  card: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    ...SHADOWS.SM, borderWidth: 1, borderColor: COLORS.GRAY_100, marginTop: SPACING.SM
  },
  cardTitle: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900, marginBottom: 4 },
  cardSubtitle: { fontSize: FONT_SIZES.SM, color: COLORS.WARNING, marginBottom: SPACING.LG },
  inputGroup: { marginBottom: SPACING.MD },
  label: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.XS },
  input: {
    backgroundColor: COLORS.GRAY_50, borderWidth: 1, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900,
  },
  submitBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginTop: SPACING.LG,
    ...SHADOWS.MD,
  },
  submitText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
  
  // Custom Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XL,
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    padding: SPACING.XL,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...SHADOWS.LG,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  modalTitle: {
    fontSize: FONT_SIZES.XL,
    fontWeight: '800',
    color: COLORS.GRAY_900,
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: FONT_SIZES.MD,
    color: COLORS.GRAY_600,
    textAlign: 'center',
    marginBottom: SPACING.XL,
    lineHeight: 22,
  },
  modalButton: {
    width: '100%',
    paddingVertical: SPACING.MD + 4,
    borderRadius: RADIUS.LG,
    alignItems: 'center',
  },
  modalButtonText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZES.LG,
    fontWeight: '700',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: SPACING.SM, marginLeft: SPACING.SM },
  errorText: { color: '#D32F2F', marginTop: SPACING.XS, fontSize: FONT_SIZES.SM },
  optionalToggle: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: FONT_SIZES.MD },
  removeOptional: { marginTop: SPACING.SM, alignSelf: 'flex-end' },
  removeOptionalText: { color: COLORS.GRAY_500, fontWeight: '600' },
});
