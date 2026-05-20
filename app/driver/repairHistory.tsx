import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getRepairsByDriver } from '../../src/services/repairService';
import { RepairRequest, REPAIR_TYPE_LABELS } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const STATUS_COLORS = {
  pending: COLORS.WARNING,
  approved: COLORS.SUCCESS,
  rejected: COLORS.DANGER,
};

const STATUS_ICONS = {
  pending: '⏳',
  approved: '✅',
  rejected: '❌',
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RepairHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const data = await getRepairsByDriver(user.uid);
        setRepairs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔧 Repair History</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={repairs}
          keyExtractor={item => item.id || ''}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.typeRow}>
                    <Text style={styles.typeIcon}>🔧</Text>
                    <Text style={styles.typeName}>{REPAIR_TYPE_LABELS[item.repairType]}</Text>
                  </View>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={[styles.statusTag, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                  <Text style={[styles.statusTagText, { color: STATUS_COLORS[item.status] }]}>
                    {STATUS_ICONS[item.status]} {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>

              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

              {/* Photos */}
              {item.photoUrls && item.photoUrls.length > 0 && (
                <View style={styles.photoRow}>
                  {item.photoUrls.slice(0, 3).map((url, i) => (
                    <Image key={i} source={{ uri: url }} style={styles.photoThumb} />
                  ))}
                  {item.photoUrls.length > 3 && (
                    <View style={styles.morePhotos}>
                      <Text style={styles.morePhotosText}>+{item.photoUrls.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Cost & Location */}
              <View style={styles.metaRow}>
                {item.estimatedCost ? (
                  <Text style={styles.metaItem}>💰 Est: LKR {item.estimatedCost.toLocaleString()}</Text>
                ) : null}
                {item.actualCost ? (
                  <Text style={styles.metaItem}>✅ Actual: LKR {item.actualCost.toLocaleString()}</Text>
                ) : null}
                {item.locationAddress ? (
                  <Text style={styles.metaItem}>📍 {item.locationAddress}</Text>
                ) : null}
              </View>

              {item.rejectionReason ? (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionText}>Reason: {item.rejectionReason}</Text>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 48, marginBottom: SPACING.MD }}>🔧</Text>
              <Text style={styles.emptyText}>No repair requests yet</Text>
              <TouchableOpacity
                style={styles.newRequestBtn}
                onPress={() => router.push('/driver/repairRequest')}
              >
                <Text style={styles.newRequestBtnText}>+ New Request</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  list: { padding: SPACING.XL },

  card: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: SPACING.SM,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  typeIcon: { fontSize: 16, marginRight: SPACING.XS },
  typeName: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  date: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  statusTag: {
    paddingVertical: SPACING.XS, paddingHorizontal: SPACING.SM,
    borderRadius: RADIUS.SM,
  },
  statusTagText: { fontWeight: '600', fontSize: FONT_SIZES.XS },
  description: {
    fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600,
    marginBottom: SPACING.SM, lineHeight: 20,
  },
  photoRow: {
    flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.SM,
  },
  photoThumb: {
    width: 60, height: 60, borderRadius: RADIUS.SM,
    borderWidth: 1, borderColor: COLORS.GRAY_200,
  },
  morePhotos: {
    width: 60, height: 60, borderRadius: RADIUS.SM,
    backgroundColor: COLORS.GRAY_100, justifyContent: 'center', alignItems: 'center',
  },
  morePhotosText: { fontSize: FONT_SIZES.MD, fontWeight: '700', color: COLORS.GRAY_500 },
  metaRow: { gap: 4 },
  metaItem: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },
  rejectionBox: {
    backgroundColor: COLORS.DANGER + '10', borderRadius: RADIUS.SM,
    padding: SPACING.SM, marginTop: SPACING.SM,
  },
  rejectionText: { fontSize: FONT_SIZES.SM, color: COLORS.DANGER, fontWeight: '500' },
  emptyBox: {
    alignItems: 'center', paddingVertical: SPACING.XXXL,
  },
  emptyText: { fontSize: FONT_SIZES.LG, color: COLORS.GRAY_500, fontWeight: '600', marginBottom: SPACING.LG },
  newRequestBtn: {
    backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD, borderRadius: RADIUS.LG,
  },
  newRequestBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
});
