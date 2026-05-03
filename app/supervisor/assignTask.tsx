import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useDrivers } from '../../src/hooks/useDrivers';
import { createTask, getTaskById, updateTask, assignTaskToDriver } from '../../src/services/taskService';
import { TaskPriority, Driver } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function AssignTaskScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { user, profile } = useAuth();
  const { drivers, loading: driversLoading } = useDrivers();

  const [pickupLocation, setPickupLocation] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [itemCount, setItemCount] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load existing task for editing
  useEffect(() => {
    if (taskId) {
      (async () => {
        const task = await getTaskById(taskId);
        if (task) {
          setIsEditing(true);
          setPickupLocation(task.pickupLocation);
          setDeliveryLocation(task.deliveryLocation);
          setRecipientName(task.recipientName);
          setRecipientPhone(task.recipientPhone);
          setDescription(task.description || '');
          setPriority(task.priority || 'MEDIUM');
          setItemCount(task.itemCount?.toString() || '');
          setEstimatedTime(task.estimatedDeliveryTime || '');
          setSelectedDriverId(task.assignedDriverId || '');
          setSelectedDriverName(task.assignedDriverName || '');
        }
      })();
    }
  }, [taskId]);

  const handleSubmit = async () => {
    if (!pickupLocation || !deliveryLocation || !recipientName || !recipientPhone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && taskId) {
        await updateTask(taskId, {
          pickupLocation,
          deliveryLocation,
          recipientName,
          recipientPhone,
          description,
          priority,
          itemCount: itemCount ? Number(itemCount) : undefined,
          estimatedDeliveryTime: estimatedTime,
        });

        if (selectedDriverId) {
          await assignTaskToDriver(taskId, selectedDriverId, selectedDriverName);
        }

        Alert.alert('✅ Updated', 'Task updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const newTaskId = await createTask({
          pickupLocation,
          deliveryLocation,
          recipientName,
          recipientPhone,
          description,
          priority,
          assignedDriverId: selectedDriverId || undefined,
          assignedDriverName: selectedDriverName || undefined,
          supervisorId: user!.uid,
          supervisorName: profile?.name || 'Supervisor',
          itemCount: itemCount ? Number(itemCount) : undefined,
          estimatedDeliveryTime: estimatedTime,
        });

        Alert.alert('✅ Created', `Task created successfully${selectedDriverId ? ' and assigned to driver' : ''}`, [
          { text: 'OK', onPress: () => router.replace('/supervisor/dashboard') },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const selectDriver = (driver: Driver) => {
    setSelectedDriverId(driver.uid);
    setSelectedDriverName(driver.displayName);
    setShowDriverPicker(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? '✏️ Edit Task' : '➕ Create Task'}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Priority */}
        <Text style={styles.sectionTitle}>Priority</Text>
        <View style={styles.priorityRow}>
          {(['LOW', 'MEDIUM', 'HIGH'] as TaskPriority[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.priorityBtn, priority === p && styles.priorityBtnActive, {
                borderColor: p === 'HIGH' ? COLORS.DANGER : p === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS,
                backgroundColor: priority === p
                  ? (p === 'HIGH' ? COLORS.DANGER : p === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS)
                  : COLORS.WHITE,
              }]}
              onPress={() => setPriority(p)}
            >
              <Text style={[styles.priorityText, priority === p && { color: COLORS.WHITE }]}>
                {p === 'HIGH' ? '🔴' : p === 'MEDIUM' ? '🟡' : '🟢'} {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Locations */}
        <Text style={styles.sectionTitle}>Pickup Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Central Warehouse, Port Road"
          placeholderTextColor={COLORS.GRAY_400}
          value={pickupLocation}
          onChangeText={setPickupLocation}
        />

        <Text style={styles.sectionTitle}>Delivery Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. SaveMart Supermarket, Downtown"
          placeholderTextColor={COLORS.GRAY_400}
          value={deliveryLocation}
          onChangeText={setDeliveryLocation}
        />

        {/* Recipient */}
        <Text style={styles.sectionTitle}>Recipient Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Contact person at delivery location"
          placeholderTextColor={COLORS.GRAY_400}
          value={recipientName}
          onChangeText={setRecipientName}
        />

        <Text style={styles.sectionTitle}>Recipient Phone *</Text>
        <TextInput
          style={styles.input}
          placeholder="+94 7X XXX XXXX"
          placeholderTextColor={COLORS.GRAY_400}
          keyboardType="phone-pad"
          value={recipientPhone}
          onChangeText={setRecipientPhone}
        />

        {/* Optional fields */}
        <Text style={styles.sectionTitle}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Package details, special instructions..."
          placeholderTextColor={COLORS.GRAY_400}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.sectionTitle}>Items Count</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 45"
              placeholderTextColor={COLORS.GRAY_400}
              keyboardType="numeric"
              value={itemCount}
              onChangeText={setItemCount}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.sectionTitle}>Est. Time</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2:30 PM"
              placeholderTextColor={COLORS.GRAY_400}
              value={estimatedTime}
              onChangeText={setEstimatedTime}
            />
          </View>
        </View>

        {/* Driver Assignment */}
        <Text style={styles.sectionTitle}>Assign Driver</Text>
        <TouchableOpacity
          style={styles.driverSelector}
          onPress={() => setShowDriverPicker(!showDriverPicker)}
        >
          {selectedDriverId ? (
            <View style={styles.selectedDriver}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>{selectedDriverName[0]?.toUpperCase() || 'D'}</Text>
              </View>
              <View>
                <Text style={styles.driverName}>{selectedDriverName}</Text>
                <Text style={styles.driverHint}>Tap to change</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.driverPlaceholder}>👤 Select a driver (optional)</Text>
          )}
          <Text style={styles.dropdownArrow}>{showDriverPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showDriverPicker && (
          <View style={styles.driverList}>
            {driversLoading ? (
              <ActivityIndicator size="small" color={COLORS.PRIMARY} style={{ padding: SPACING.LG }} />
            ) : drivers.length === 0 ? (
              <Text style={styles.noDrivers}>No approved drivers available</Text>
            ) : (
              drivers.map(driver => (
                <TouchableOpacity
                  key={driver.uid}
                  style={[styles.driverItem, selectedDriverId === driver.uid && styles.driverItemSelected]}
                  onPress={() => selectDriver(driver)}
                >
                  <View style={[styles.driverAvatar, { backgroundColor: COLORS.SECONDARY }]}>
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

            {/* Unassign option */}
            {selectedDriverId && (
              <TouchableOpacity
                style={styles.unassignBtn}
                onPress={() => { setSelectedDriverId(''); setSelectedDriverName(''); setShowDriverPicker(false); }}
              >
                <Text style={styles.unassignText}>✕ Leave unassigned</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.WHITE} />
          ) : (
            <Text style={styles.submitText}>
              {isEditing ? '💾 Save Changes' : '✅ Create Task'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: SPACING.XXXL }} />
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
  sectionTitle: {
    fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700,
    marginBottom: SPACING.SM, marginTop: SPACING.MD,
  },
  input: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, ...SHADOWS.SM,
  },
  priorityRow: { flexDirection: 'row', gap: SPACING.SM },
  priorityBtn: {
    flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG,
    borderWidth: 2, alignItems: 'center',
  },
  priorityBtnActive: {},
  priorityText: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.GRAY_700 },
  row: { flexDirection: 'row', gap: SPACING.MD },
  halfInput: { flex: 1 },
  driverSelector: {
    backgroundColor: COLORS.WHITE, borderWidth: 1.5, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, padding: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    ...SHADOWS.SM,
  },
  selectedDriver: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  driverAvatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
  driverName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  driverHint: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400 },
  driverPlaceholder: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_400 },
  dropdownArrow: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_400 },
  driverList: {
    backgroundColor: COLORS.WHITE, borderWidth: 1, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.LG, marginTop: SPACING.SM, overflow: 'hidden', ...SHADOWS.MD,
  },
  noDrivers: { padding: SPACING.LG, textAlign: 'center', color: COLORS.GRAY_500, fontSize: FONT_SIZES.SM },
  driverItem: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.LG,
    borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_100,
  },
  driverItemSelected: { backgroundColor: COLORS.PRIMARY + '08' },
  driverItemInfo: { flex: 1 },
  driverItemName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  driverItemDetail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  checkmark: { fontSize: FONT_SIZES.XL, color: COLORS.SUCCESS, fontWeight: '700' },
  unassignBtn: { padding: SPACING.MD, alignItems: 'center', backgroundColor: COLORS.GRAY_50 },
  unassignText: { fontSize: FONT_SIZES.SM, color: COLORS.DANGER, fontWeight: '600' },
  submitBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginTop: SPACING.XXL,
  },
  submitText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
});
