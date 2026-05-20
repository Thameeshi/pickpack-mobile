import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useTasksByDriver } from '../../src/hooks/useTasks';
import { formatDateTime } from '../../src/utils/helpers';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

export default function TaskHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { tasks, loading } = useTasksByDriver(user?.uid || '');

  // Filter only completed (delivered/failed) trips for history
  const historyTrips = tasks
    .filter(t => t.status === 'delivered' || t.status === 'failed')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={historyTrips}
        keyExtractor={item => item.id || Math.random().toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: SPACING.MD }}>
              <Text style={styles.backBtn}>←</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../../assets/icons/recent-trip.png')} style={{ width: 28, height: 28, marginRight: SPACING.SM }} />
              <Text style={styles.title}>Recent Trips</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/driver/taskDetails?taskId=${item.id}`)}
          >
            <View style={styles.cardLeft}>
              <Image 
                source={require('../../assets/icons/approve.png')} 
                style={styles.checkIcon} 
                resizeMode="contain" 
              />
              <View style={styles.cardInfo}>
                <Text style={styles.locationText} numberOfLines={1}>{item.deliveryLocation}</Text>
                <Text style={styles.dateText}>
                  {item.completedAt ? formatDateTime(item.completedAt) : 'N/A'}
                </Text>
              </View>
            </View>
            <Text style={styles.personText}>{item.supervisorName || 'Unassigned'}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
             <Text style={styles.emptyText}>No recent trips found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PRIMARY },
  list: { padding: SPACING.XL, paddingTop: SPACING.XXXL },
  header: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.XL,
  },
  backBtn: { fontSize: FONT_SIZES.XL, color: COLORS.GRAY_800, fontWeight: '700' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG,
    marginBottom: SPACING.MD,
    borderWidth: 1, borderColor: COLORS.GRAY_100,
    ...SHADOWS.SM,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkIcon: { width: 36, height: 36, marginRight: SPACING.MD },
  cardInfo: { flex: 1, marginRight: SPACING.SM },
  locationText: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_900 },
  dateText: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, marginTop: 4 },
  personText: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600 },
  empty: { paddingVertical: SPACING.XXXL, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500 },
});
