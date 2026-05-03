import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getAllFuelExpenses, updateFuelExpenseStatus } from '../../src/services/fuelService';
import { FuelExpense } from '../../src/types';
import { formatDate, formatCurrency } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function FuelApprovalsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExpenses = async () => {
    try {
      const data = await getAllFuelExpenses();
      setExpenses(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadExpenses(); }, []);

  const handleApproval = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateFuelExpenseStatus(id, status, user?.uid);
      Alert.alert('✅ Done', `Expense ${status}`);
      loadExpenses();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const pending = expenses.filter(e => e.status === 'pending');
  const processed = expenses.filter(e => e.status !== 'pending');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⛽ Fuel Approvals</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>
      ) : (
        <FlatList
          data={[...pending, ...processed]}
          keyExtractor={item => item.id || ''}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pending.length > 0 ? (
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingText}>⚠️ {pending.length} pending approval(s)</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.driverName}>{item.driverName}</Text>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.amount}>LKR {item.totalCost.toFixed(0)}</Text>
              </View>
              <Text style={styles.detail}>
                {item.fuelType === 'diesel' ? '🛢️' : '⛽'} {item.litres}L @ LKR {item.costPerLitre} | Odo: {item.odometerReading} km
              </Text>
              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.SUCCESS }]}
                    onPress={() => handleApproval(item.id!, 'approved')}
                  >
                    <Text style={styles.actionText}>✅ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.DANGER }]}
                    onPress={() => handleApproval(item.id!, 'rejected')}
                  >
                    <Text style={styles.actionText}>❌ Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
              {item.status !== 'pending' && (
                <View style={[styles.statusTag, { backgroundColor: item.status === 'approved' ? COLORS.SUCCESS + '20' : COLORS.DANGER + '20' }]}>
                  <Text style={{ color: item.status === 'approved' ? COLORS.SUCCESS : COLORS.DANGER, fontWeight: '600', fontSize: FONT_SIZES.SM }}>
                    {item.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No fuel expenses to review</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL, paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  list: { padding: SPACING.XL },
  pendingBanner: { backgroundColor: COLORS.WARNING + '20', padding: SPACING.MD, borderRadius: RADIUS.MD, marginBottom: SPACING.LG },
  pendingText: { color: COLORS.WARNING, fontWeight: '600', fontSize: FONT_SIZES.MD },
  card: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG, marginBottom: SPACING.MD, ...SHADOWS.SM },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.SM },
  driverName: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  date: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  amount: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900 },
  detail: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600, marginBottom: SPACING.MD },
  actions: { flexDirection: 'row', gap: SPACING.MD },
  actionBtn: { flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, alignItems: 'center' },
  actionText: { color: COLORS.WHITE, fontWeight: '600', fontSize: FONT_SIZES.MD },
  statusTag: { paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD, borderRadius: RADIUS.SM, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', paddingVertical: SPACING.XXXL },
  emptyText: { fontSize: FONT_SIZES.LG, color: COLORS.GRAY_500, fontWeight: '600' },
});
