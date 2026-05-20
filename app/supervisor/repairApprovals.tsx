import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Image, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getAllRepairRequests, updateRepairStatus } from '../../src/services/repairService';
import { RepairRequest, REPAIR_TYPE_LABELS } from '../../src/types';
import { COLORS, SPACING, RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';

const REPAIR_ICONS: Record<string, string> = {
  tyre_puncture: '🛞',
  engine_issue: '🔧',
  brake_failure: '🛑',
  battery_dead: '🔋',
  oil_leak: '🛢️',
  radiator_overheat: '🌡️',
  electrical_fault: '⚡',
  body_damage: '🚛',
  other: '🔩',
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RepairApprovalsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [repairs, setRepairs] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadRepairs = async () => {
    try {
      const data = await getAllRepairRequests();
      setRepairs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRepairs(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await updateRepairStatus(id, 'approved', user?.uid);
      Alert.alert('Approved', 'Repair request has been approved.');
      loadRepairs();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRejectStart = (id: string) => {
    setRejectingId(id);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectingId) return;
    try {
      await updateRepairStatus(rejectingId, 'rejected', user?.uid, rejectionReason.trim() || undefined);
      Alert.alert('Rejected', 'Repair request has been rejected.');
      setRejectModalVisible(false);
      loadRepairs();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const pending = repairs.filter(r => r.status === 'pending');
  const processed = repairs.filter(r => r.status !== 'pending');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔧 Repair Approvals</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={[...pending, ...processed]}
          keyExtractor={item => item.id || ''}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pending.length > 0 ? (
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingText}>⚠️ {pending.length} repair request(s) pending approval</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.card, item.status === 'pending' && styles.cardPending]}>
              {/* Header */}
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.typeRow}>
                    <Text style={styles.typeIcon}>{REPAIR_ICONS[item.repairType] || '🔧'}</Text>
                    <Text style={styles.typeName}>{REPAIR_TYPE_LABELS[item.repairType]}</Text>
                  </View>
                  <Text style={styles.driverName}>{item.driverName}</Text>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
                {item.estimatedCost ? (
                  <Text style={styles.cost}>LKR {item.estimatedCost.toLocaleString()}</Text>
                ) : null}
              </View>

              {/* Description */}
              <Text style={styles.description}>{item.description}</Text>

              {/* Location */}
              {item.locationAddress ? (
                <Text style={styles.locationText}>📍 {item.locationAddress}</Text>
              ) : null}

              {/* Photos */}
              {item.photoUrls && item.photoUrls.length > 0 && (
                <View style={styles.photoRow}>
                  {item.photoUrls.map((url, i) => (
                    <Image key={i} source={{ uri: url }} style={styles.photoThumb} />
                  ))}
                </View>
              )}

              {/* Trip link */}
              {item.tripId ? (
                <View style={styles.tripLink}>
                  <Text style={styles.tripLinkText}>🚚 Linked to trip</Text>
                </View>
              ) : null}

              {/* Actions */}
              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.SUCCESS }]}
                    onPress={() => handleApprove(item.id!)}
                  >
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.DANGER }]}
                    onPress={() => handleRejectStart(item.id!)}
                  >
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Status tag for processed items */}
              {item.status !== 'pending' && (
                <View style={[styles.statusTag, {
                  backgroundColor: item.status === 'approved' ? COLORS.SUCCESS + '20' : COLORS.DANGER + '20'
                }]}>
                  <Text style={{
                    color: item.status === 'approved' ? COLORS.SUCCESS : COLORS.DANGER,
                    fontWeight: '600', fontSize: FONT_SIZES.SM,
                  }}>
                    {item.status === 'approved' ? 'Approved' : 'Rejected'}
                  </Text>
                  {item.rejectionReason ? (
                    <Text style={{ color: COLORS.DANGER, fontSize: FONT_SIZES.XS, marginTop: 2 }}>
                      Reason: {item.rejectionReason}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 48, marginBottom: SPACING.MD }}>🔧</Text>
              <Text style={styles.emptyText}>No repair requests to review</Text>
            </View>
          }
        />
      )}

      {/* Rejection Reason Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Repair Request</Text>
            <Text style={styles.modalLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              placeholderTextColor={COLORS.GRAY_400}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectBtn}
                onPress={handleRejectConfirm}
              >
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  pendingBanner: {
    backgroundColor: COLORS.WARNING + '20', padding: SPACING.MD,
    borderRadius: RADIUS.MD, marginBottom: SPACING.LG,
  },
  pendingText: { color: COLORS.WARNING, fontWeight: '600', fontSize: FONT_SIZES.MD },

  card: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.MD, ...SHADOWS.SM,
  },
  cardPending: {
    borderLeftWidth: 4, borderLeftColor: COLORS.WARNING,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: SPACING.SM,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  typeIcon: { fontSize: 18, marginRight: SPACING.XS },
  typeName: { fontSize: FONT_SIZES.LG, fontWeight: '700', color: COLORS.GRAY_900 },
  driverName: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginTop: 2 },
  date: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  cost: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900 },

  description: {
    fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600,
    marginBottom: SPACING.SM, lineHeight: 20,
  },
  locationText: {
    fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginBottom: SPACING.SM,
  },
  photoRow: {
    flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.MD,
  },
  photoThumb: {
    width: 70, height: 70, borderRadius: RADIUS.SM,
    borderWidth: 1, borderColor: COLORS.GRAY_200,
  },
  tripLink: {
    backgroundColor: COLORS.PRIMARY + '10', borderRadius: RADIUS.SM,
    paddingVertical: SPACING.XS, paddingHorizontal: SPACING.SM,
    alignSelf: 'flex-start', marginBottom: SPACING.SM,
  },
  tripLinkText: { fontSize: FONT_SIZES.XS, color: COLORS.PRIMARY, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: SPACING.MD },
  actionBtn: {
    flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD, alignItems: 'center',
  },
  actionText: { color: COLORS.WHITE, fontWeight: '600', fontSize: FONT_SIZES.MD },
  statusTag: {
    paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD,
    borderRadius: RADIUS.SM, alignSelf: 'flex-start',
  },

  emptyBox: { alignItems: 'center', paddingVertical: SPACING.XXXL },
  emptyText: { fontSize: FONT_SIZES.LG, color: COLORS.GRAY_500, fontWeight: '600' },

  // Rejection Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.XL, width: '85%', ...SHADOWS.LG,
  },
  modalTitle: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.GRAY_900, marginBottom: SPACING.LG },
  modalLabel: { fontSize: FONT_SIZES.SM, fontWeight: '600', color: COLORS.GRAY_700, marginBottom: SPACING.SM },
  modalInput: {
    backgroundColor: COLORS.GRAY_50, borderWidth: 1, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.MD, padding: SPACING.MD,
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900,
    height: 80, textAlignVertical: 'top', marginBottom: SPACING.LG,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.MD },
  modalCancelBtn: { paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD },
  modalCancelText: { color: COLORS.GRAY_500, fontWeight: '600', fontSize: FONT_SIZES.MD },
  modalRejectBtn: {
    backgroundColor: COLORS.DANGER, paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.LG, borderRadius: RADIUS.MD,
  },
  modalRejectText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
});
