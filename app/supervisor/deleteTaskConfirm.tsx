import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { COLORS, FONT_SIZES, RADIUS, SHADOWS, SPACING } from '../../src/constants/theme';
import { deleteTask, getTaskById } from '../../src/services/taskService';
import { Task } from '../../src/types';

export default function DeleteTaskConfirmScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!taskId) {
      setError('Missing task id.');
      setLoading(false);
      return;
    }
    try {
      const t = await getTaskById(taskId);
      setTask(t);
    } catch (e) {
      console.log('Load task error:', e);
      setError('Failed to load this item.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      load();
    }, [taskId]),
  );

  const onDelete = async () => {
    if (!taskId) return;
    try {
      setDeleting(true);
      await deleteTask(taskId);
      router.replace('/supervisor/tripDetails');
    } catch (e) {
      console.log('Delete task error:', e);
      setError('Delete failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backText}>{'← Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm delete</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginTop: SPACING.XXL }} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.warningTitle}>Delete this history item?</Text>
            <Text style={styles.warningText}>
              This will permanently remove the selected assignment/approval record.
            </Text>

            {!!task && (
              <View style={styles.taskPreview}>
                <Text style={styles.previewTitle}>🚚 {task.assignedDriverName || 'Unassigned'}</Text>
                <Text style={styles.previewRoute} numberOfLines={1}>
                  {task.pickupLocation} → {task.deliveryLocation}
                </Text>
                <Text style={styles.previewMeta}>
                  {new Date(task.createdAt || Date.now()).toLocaleString()}
                </Text>
              </View>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={() => router.back()}
                activeOpacity={0.85}
                disabled={deleting}
              >
                <Text style={[styles.btnText, styles.cancelText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.deleteBtn, deleting && { opacity: 0.6 }]}
                onPress={onDelete}
                activeOpacity={0.85}
                disabled={deleting || !taskId}
              >
                <Text style={[styles.btnText, styles.deleteText]}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.XL,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: SPACING.MD,
    ...SHADOWS.MD,
  },
  backBtn: { width: 70, justifyContent: 'center' },
  backText: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '700' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '800', color: COLORS.WHITE },
  content: { flex: 1, paddingHorizontal: SPACING.XL, paddingTop: SPACING.MD },

  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.XL,
    padding: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.GRAY_100,
    ...SHADOWS.SM,
  },
  warningTitle: { fontSize: FONT_SIZES.LG, fontWeight: '900', color: COLORS.GRAY_900 },
  warningText: { marginTop: 6, fontSize: FONT_SIZES.SM, color: COLORS.GRAY_600, lineHeight: 20 },
  taskPreview: {
    marginTop: SPACING.LG,
    backgroundColor: COLORS.GRAY_100,
    borderRadius: RADIUS.LG,
    padding: SPACING.MD,
  },
  previewTitle: { fontSize: FONT_SIZES.MD, fontWeight: '800', color: COLORS.GRAY_900 },
  previewRoute: { marginTop: 4, fontSize: FONT_SIZES.SM, color: COLORS.GRAY_700 },
  previewMeta: { marginTop: 4, fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500 },

  errorText: { marginTop: SPACING.MD, color: COLORS.DANGER, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.XL },
  btn: {
    flex: 1,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.FULL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: FONT_SIZES.MD, fontWeight: '800' },
  cancelBtn: { backgroundColor: COLORS.GRAY_100, borderWidth: 1, borderColor: COLORS.GRAY_200 },
  cancelText: { color: COLORS.GRAY_800 },
  deleteBtn: { backgroundColor: COLORS.DANGER },
  deleteText: { color: COLORS.WHITE },
});

