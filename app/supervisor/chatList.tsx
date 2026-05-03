import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, FONT_SIZES } from '../../src/constants/theme';

export default function SupervisorChatListScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>💬 Messages</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.icon}>💬</Text>
        <Text style={styles.text}>Chat with Drivers</Text>
        <Text style={styles.subtext}>Real-time messaging — next phase</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.XL, paddingTop: SPACING.XXXL + SPACING.MD, paddingBottom: SPACING.LG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
  icon: { fontSize: 64, marginBottom: SPACING.LG },
  text: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_800 },
  subtext: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_500, marginTop: SPACING.SM },
});
