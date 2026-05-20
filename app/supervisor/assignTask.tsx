import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useDrivers } from '../../src/hooks/useDrivers';
import { createTask, getTaskById, updateTask, assignTaskToDriver, getAllTasks } from '../../src/services/taskService';
import { getDriversTripStatus } from '../../src/services/tripService';
import { TaskPriority, Driver } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const PACKAGE_TYPES = ['Dry Groceries', 'Frozen Foods', 'Fresh Produce', 'Beverages', 'Electronics'];

const SectionCard = ({ title, icon, children }: { title: string, icon?: string, children: React.ReactNode }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      {icon && <Text style={styles.cardIcon}>{icon}</Text>}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

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
  const [driverTripStatus, setDriverTripStatus] = useState<Record<string, boolean>>({});
  const [driverTaskStatus, setDriverTaskStatus] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [middleLocations, setMiddleLocations] = useState<string[]>([]);

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
          setMiddleLocations(task.middleLocations || []);
        }
      })();
    }
  }, [taskId]);

  // Fetch trip and task status for all drivers
  useEffect(() => {
    if (drivers.length > 0) {
      const ids = drivers.map(d => d.uid);
      getDriversTripStatus(ids)
        .then(setDriverTripStatus)
        .catch(() => {});

      getAllTasks().then(tasks => {
        const map: Record<string, string> = {};
        tasks.forEach(t => {
           if (t.assignedDriverId && t.status === 'assigned') {
             map[t.assignedDriverId] = 'PENDING_APPROVAL';
           }
        });
        setDriverTaskStatus(map);
      }).catch(() => {});
    }
  }, [drivers]);

  const handleSubmit = async () => {
    if (!pickupLocation || !deliveryLocation || !recipientName || !recipientPhone || !selectedDriverId) {
      Alert.alert('Error', 'Please fill in all required fields and select a driver.');
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
          middleLocations,
        });

        await assignTaskToDriver(taskId, selectedDriverId, selectedDriverName);

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
          assignedDriverId: selectedDriverId,
          assignedDriverName: selectedDriverName,
          supervisorId: user!.uid,
          supervisorName: profile?.name || 'Supervisor',
          itemCount: itemCount ? Number(itemCount) : undefined,
          estimatedDeliveryTime: estimatedTime,
          middleLocations,
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          {!isEditing && <Image source={require('../../assets/icons/new-trip.png')} style={styles.headerIcon} />}
          <Text style={styles.title}>{isEditing ? '✏️ Edit Task' : 'Create Task'}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {currentStep === 1 ? (
          <>
            <SectionCard title="Driver Assignment" icon="🚚">
              <Text style={styles.label}>Select a driver to continue (Step 1 of 2)</Text>
              
              <View style={[styles.driverList, { marginTop: SPACING.MD, borderWidth: 0, elevation: 0, shadowOpacity: 0 }]}>
                {driversLoading ? (
                  <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ padding: SPACING.XXL }} />
                ) : drivers.length === 0 ? (
                  <Text style={styles.noDrivers}>No approved drivers available</Text>
                ) : (
                  drivers.map(driver => {
                    const isOnTrip = driverTripStatus[driver.uid] || false;
                    const isPending = driverTaskStatus[driver.uid] === 'PENDING_APPROVAL';

                    return (
                      <TouchableOpacity
                        key={driver.uid}
                        style={[
                          styles.driverItem,
                          selectedDriverId === driver.uid && styles.driverItemSelected,
                          { borderRadius: RADIUS.MD, marginBottom: SPACING.SM, borderWidth: 1, borderColor: selectedDriverId === driver.uid ? COLORS.PRIMARY : COLORS.GRAY_200 }
                        ]}
                        onPress={() => selectDriver(driver)}
                      >
                        <View style={[
                          styles.driverAvatar,
                          { backgroundColor: isOnTrip ? COLORS.PRIMARY : isPending ? COLORS.WARNING : COLORS.SECONDARY }
                        ]}>
                          <Text style={styles.driverAvatarText}>{driver.displayName[0]?.toUpperCase() || 'D'}</Text>
                        </View>
                        <View style={styles.driverItemInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.driverItemName}>{driver.displayName}</Text>
                            {isOnTrip ? (
                              <View style={[styles.statusBadge, { backgroundColor: COLORS.PRIMARY + '15', borderColor: COLORS.PRIMARY + '30' }]}>
                                <Text style={[styles.statusBadgeText, { color: COLORS.PRIMARY }]}>🚚 On Trip</Text>
                              </View>
                            ) : isPending ? (
                              <View style={[styles.statusBadge, { backgroundColor: COLORS.WARNING + '15', borderColor: COLORS.WARNING + '30' }]}>
                                <Text style={[styles.statusBadgeText, { color: COLORS.WARNING }]}>⏳ Pending Approval</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.driverItemDetail}>
                            {driver.vehiclePlate || 'No vehicle'} • {driver.phoneNumber}
                          </Text>
                        </View>
                        {selectedDriverId === driver.uid && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </SectionCard>

            <TouchableOpacity
              style={[styles.submitBtn, !selectedDriverId && { backgroundColor: COLORS.GRAY_400 }]}
              onPress={() => {
                if (!selectedDriverId) {
                  Alert.alert('Required', 'Please select a driver to continue.');
                  return;
                }
                setCurrentStep(2);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.submitText}>Next ➡️</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <SectionCard title="Task Priority">
              <View style={styles.priorityRow}>
                {(['LOW', 'MEDIUM', 'HIGH'] as TaskPriority[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityBtn, {
                      borderColor: p === 'HIGH' ? COLORS.DANGER : p === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS,
                      backgroundColor: priority === p
                        ? (p === 'HIGH' ? COLORS.DANGER : p === 'MEDIUM' ? COLORS.WARNING : COLORS.SUCCESS)
                        : COLORS.GRAY_50,
                    }]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.priorityText, priority === p && { color: COLORS.WHITE }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            <SectionCard title="Route Details">
              <View style={styles.routeContainer}>
                <View style={styles.routeLineContainer}>
                  <View style={styles.routeDotPickup} />
                  <View style={styles.routeLine} />
                  {middleLocations.map((_, index) => (
                    <React.Fragment key={`dot-${index}`}>
                      <View style={styles.routeDotMiddle} />
                      <View style={styles.routeLine} />
                    </React.Fragment>
                  ))}
                  <View style={styles.routeDotDelivery} />
                </View>
                <View style={styles.routeInputs}>
                  <View style={styles.inputGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XS }}>
                      <Text style={[styles.label, { marginBottom: 0 }]}>Pickup Location (Warehouse) *</Text>
                      <TouchableOpacity onPress={() => setMiddleLocations([...middleLocations, ''])} style={{ paddingHorizontal: SPACING.XS }}>
                        <Text style={{ fontSize: FONT_SIZES.LG, color: COLORS.PRIMARY, fontWeight: 'bold' }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Central Warehouse, Port Road"
                      placeholderTextColor={COLORS.GRAY_400}
                      value={pickupLocation}
                      onChangeText={setPickupLocation}
                    />
                  </View>

                  {middleLocations.map((loc, index) => (
                    <View key={`loc-${index}`} style={[styles.inputGroup, { marginTop: SPACING.MD }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XS }}>
                        <Text style={[styles.label, { marginBottom: 0 }]}>Stop {index + 1}</Text>
                        <TouchableOpacity onPress={() => {
                          const newLocs = [...middleLocations];
                          newLocs.splice(index, 1);
                          setMiddleLocations(newLocs);
                        }}>
                          <Text style={{ fontSize: FONT_SIZES.SM, color: COLORS.DANGER, fontWeight: '600' }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder={`e.g. Stop ${index + 1} Address`}
                        placeholderTextColor={COLORS.GRAY_400}
                        value={loc}
                        onChangeText={(text) => {
                          const newLocs = [...middleLocations];
                          newLocs[index] = text;
                          setMiddleLocations(newLocs);
                        }}
                      />
                    </View>
                  ))}
                  
                  <View style={[styles.inputGroup, { marginTop: SPACING.MD }]}>
                    <Text style={styles.label}>Delivery Location (Supermarket) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. SaveMart Supermarket, Downtown"
                      placeholderTextColor={COLORS.GRAY_400}
                      value={deliveryLocation}
                      onChangeText={setDeliveryLocation}
                    />
                  </View>
                </View>
              </View>
            </SectionCard>

            <SectionCard title="Package Details">
              <Text style={styles.label}>Package Items & Description</Text>
              <View style={styles.packageSuggestions}>
                {PACKAGE_TYPES.map(type => (
                  <TouchableOpacity 
                    key={type} 
                    style={styles.pillBtn}
                    onPress={() => {
                      const newDesc = description ? `${description}, ${type}` : type;
                      setDescription(newDesc);
                    }}
                  >
                    <Text style={styles.pillText}>+ {type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: SPACING.SM }]}
                placeholder="Package details, special instructions..."
                placeholderTextColor={COLORS.GRAY_400}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <View style={[styles.row, { marginTop: SPACING.MD }]}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Total Items Count</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 45 Boxes"
                    placeholderTextColor={COLORS.GRAY_400}
                    value={itemCount}
                    onChangeText={setItemCount}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Est. Delivery Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2:30 PM"
                    placeholderTextColor={COLORS.GRAY_400}
                    value={estimatedTime}
                    onChangeText={setEstimatedTime}
                  />
                </View>
              </View>
            </SectionCard>

            <SectionCard title="Recipient Information" icon="👤">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contact person at supermarket"
                  placeholderTextColor={COLORS.GRAY_400}
                  value={recipientName}
                  onChangeText={setRecipientName}
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: SPACING.MD }]}>
                <Text style={styles.label}>Recipient Phone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+94 7X XXX XXXX"
                  placeholderTextColor={COLORS.GRAY_400}
                  keyboardType="phone-pad"
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                />
              </View>
            </SectionCard>

            <View style={{ flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG }}>
              <TouchableOpacity
                style={[styles.submitBtn, { flex: 1, backgroundColor: COLORS.GRAY_200, marginTop: 0 }]}
                onPress={() => setCurrentStep(1)}
              >
                <Text style={[styles.submitText, { color: COLORS.GRAY_800 }]}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { flex: 2, marginTop: 0 }, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.WHITE} />
                ) : (
                  <Text style={styles.submitText}>
                    {isEditing ? 'Save Changes' : 'Create Task'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: SPACING.XXXL }} />
      </ScrollView>
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
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 26, height: 26, marginRight: SPACING.SM, resizeMode: 'contain' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.WHITE },
  content: { flex: 1, paddingHorizontal: SPACING.LG },
  
  // Card Styles
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    ...SHADOWS.SM,
    borderWidth: 1,
    borderColor: COLORS.GRAY_100,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_100,
    paddingBottom: SPACING.SM,
  },
  cardIcon: {
    fontSize: FONT_SIZES.LG,
    marginRight: SPACING.SM,
  },
  cardTitle: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '700',
    color: COLORS.GRAY_900,
  },
  
  label: {
    fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700,
    marginBottom: SPACING.XS,
  },
  inputGroup: {
    width: '100%',
  },
  input: {
    backgroundColor: COLORS.GRAY_50, borderWidth: 1, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900,
  },
  
  // Route specific styles
  routeContainer: {
    flexDirection: 'row',
  },
  routeLineContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: SPACING.SM,
    paddingVertical: SPACING.MD,
  },
  routeDotPickup: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.PRIMARY,
    borderWidth: 3, borderColor: COLORS.PRIMARY + '40',
  },
  routeDotDelivery: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.SUCCESS,
    borderWidth: 3, borderColor: COLORS.SUCCESS + '40',
  },
  routeDotMiddle: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.WARNING,
    borderWidth: 2, borderColor: COLORS.WARNING + '40',
  },
  routeLine: {
    flex: 1, width: 2, backgroundColor: COLORS.GRAY_300,
    marginVertical: 4, borderStyle: 'dashed',
  },
  routeInputs: {
    flex: 1,
  },

  // Priority Styles
  priorityRow: { flexDirection: 'row', gap: SPACING.SM },
  priorityBtn: {
    flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD,
    borderWidth: 1.5, alignItems: 'center',
  },
  priorityText: { fontSize: FONT_SIZES.SM, fontWeight: '700', color: COLORS.GRAY_700 },
  
  row: { flexDirection: 'row', gap: SPACING.MD },
  halfInput: { flex: 1 },
  
  // Package Suggestion Pills
  packageSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.XS,
    marginBottom: SPACING.SM,
  },
  pillBtn: {
    backgroundColor: COLORS.SECONDARY + '20',
    paddingHorizontal: SPACING.SM,
    paddingVertical: 6,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY + '50',
  },
  pillText: {
    color: COLORS.SECONDARY,
    fontSize: FONT_SIZES.XS,
    fontWeight: '600',
  },

  // Driver Selector
  driverSelector: {
    backgroundColor: COLORS.GRAY_50, borderWidth: 1, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.MD, padding: SPACING.MD,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
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
    borderRadius: RADIUS.MD, marginTop: SPACING.SM, overflow: 'hidden', ...SHADOWS.SM,
  },
  noDrivers: { padding: SPACING.LG, textAlign: 'center', color: COLORS.GRAY_500, fontSize: FONT_SIZES.SM },
  driverItem: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.MD,
    borderBottomWidth: 1, borderBottomColor: COLORS.GRAY_100,
  },
  driverItemSelected: { backgroundColor: COLORS.PRIMARY + '08' },
  driverItemDisabled: { backgroundColor: COLORS.GRAY_50, opacity: 0.7 },
  driverItemInfo: { flex: 1 },
  driverItemName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  driverItemDetail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  checkmark: { fontSize: FONT_SIZES.XL, color: COLORS.SUCCESS, fontWeight: '700' },
  unassignBtn: { padding: SPACING.MD, alignItems: 'center', backgroundColor: COLORS.GRAY_50 },
  unassignText: { fontSize: FONT_SIZES.SM, color: COLORS.DANGER, fontWeight: '600' },

  // Status Badge
  statusBadge: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  
  submitBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', marginTop: SPACING.LG,
    ...SHADOWS.MD,
  },
  submitText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
});
