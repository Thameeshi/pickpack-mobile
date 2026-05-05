import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getFuelExpensesByDriver } from '../../src/services/fuelService';
import { getActiveTrip } from '../../src/services/tripService';
import { FuelExpense, TripSession } from '../../src/types';
import { formatDate, formatCurrency } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function FuelHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const trip = await getActiveTrip(user.uid);
        setActiveTrip(trip);
        const data = await getFuelExpensesByDriver(user.uid);
        setExpenses(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user]);

  // If there's an active trip, show only fuel for that trip in the summary section
  const summaryExpenses = activeTrip ? expenses.filter(e => e.tripId === activeTrip.id) : expenses;
  const totalSpent = summaryExpenses.reduce((s, e) => s + e.totalCost, 0);
  const totalLitres = summaryExpenses.reduce((s, e) => s + e.litres, 0);

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.PRIMARY} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📊 Fuel History</Text>
        <TouchableOpacity onPress={() => router.push('/driver/fuelExpense')}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {activeTrip && (
        <Text style={{ textAlign: 'center', color: COLORS.GRAY_500, marginBottom: SPACING.SM, fontWeight: '600' }}>
          Active Trip Fuel
        </Text>
      )}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Spent</Text>
          <Text style={styles.summaryValue}>LKR {totalSpent.toFixed(0)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Litres</Text>
          <Text style={styles.summaryValue}>{totalLitres.toFixed(1)} L</Text>
        </View>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={item => item.id || ''}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'approved' ? COLORS.SUCCESS + '20' : COLORS.WARNING + '20' }]}>
                  <Text style={[styles.statusText, { color: item.status === 'approved' ? COLORS.SUCCESS : COLORS.WARNING }]}>
                    {item.status === 'approved' ? 'Accepted' : 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>{item.fuelType === 'diesel' ? '🛢️' : '⛽'} {item.litres}L @ LKR {item.costPerLitre}</Text>
                  <Text style={styles.cardTotal}>LKR {item.totalCost.toFixed(2)}</Text>
                </View>
                <Text style={styles.cardOdo}>Odometer: {item.odometerReading} km</Text>
                {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={require('../../assets/icons/fuel.png')} style={{ width: 72, height: 72, marginBottom: SPACING.MD }} resizeMode="contain" />
            <Text style={styles.emptyText}>No fuel expenses yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  addBtn: { color: COLORS.ACCENT, fontSize: FONT_SIZES.MD, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: SPACING.MD, paddingHorizontal: SPACING.XL, paddingTop: SPACING.XL },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, alignItems: 'center', ...SHADOWS.SM,
  },
  summaryLabel: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600' },
  summaryValue: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900, marginTop: SPACING.XS },
  list: { padding: SPACING.XL },
  card: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG, marginBottom: SPACING.MD, ...SHADOWS.SM },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.MD },
  cardDate: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_500 },
  statusBadge: { paddingHorizontal: SPACING.SM, paddingVertical: SPACING.XS, borderRadius: RADIUS.SM },
  statusText: { fontSize: FONT_SIZES.XS, fontWeight: '600' },
  cardBody: {},
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_700 },
  cardTotal: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  cardOdo: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500, marginTop: SPACING.SM },
  cardNotes: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_400, marginTop: SPACING.XS, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingVertical: SPACING.XXXL },
  emptyText: { fontSize: FONT_SIZES.LG, fontWeight: '600', color: COLORS.GRAY_500 },
});
