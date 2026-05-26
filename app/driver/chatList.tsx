import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, SPACING, FONT_SIZES, RADIUS, SHADOWS } from '../../src/constants/theme';
import {
  collection, query, where, getDocs, onSnapshot, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { UserProfile } from '../../src/types';

interface ConversationPreview {
  id: string;
  otherUid: string;
  otherName: string;
  lastMessage: string;
  lastMessageTime: number;
  lastSenderId: string;
}

export default function DriverChatListScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Tab: 'inbox' or 'new'
  const [activeTab, setActiveTab] = useState<'inbox' | 'new'>('inbox');

  // Inbox state
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  // New message state
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedName, setSelectedName] = useState('');

  // Subscribe to conversations in real-time
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const previews: ConversationPreview[] = [];
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const participants = data.participants as string[];
        const otherUid = participants.find((p: string) => p !== user.uid) || '';
        previews.push({
          id: docSnap.id,
          otherUid,
          otherName: data.lastSenderName || 'Unknown',
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.updatedAt || 0,
          lastSenderId: data.lastSenderId || '',
        });
      }

      // Fetch names for other participants
      for (const conv of previews) {
        if (conv.otherUid) {
          try {
            const userDoc = await getDocs(
              query(collection(db, 'users'), where('__name__', '==', conv.otherUid))
            );
            if (!userDoc.empty) {
              conv.otherName = userDoc.docs[0].data().name || conv.otherName;
            }
          } catch {}
        }
      }

      setConversations(previews);
      setInboxLoading(false);
    }, () => {
      setInboxLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  // Fetch supervisors when switching to "new" tab
  useEffect(() => {
    if (activeTab !== 'new' || supervisors.length > 0) return;
    setLoadingSupervisors(true);
    (async () => {
      try {
        const q1 = query(collection(db, 'users'), where('role', '==', 'supervisor'));
        const q2 = query(collection(db, 'users'), where('role', '==', 'superadmin'));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const all: UserProfile[] = [
          ...snap1.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)),
          ...snap2.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)),
        ];
        setSupervisors(all);
      } catch (e) {
        console.error('Failed to fetch supervisors:', e);
      } finally {
        setLoadingSupervisors(false);
      }
    })();
  }, [activeTab]);

  const filteredSupervisors = supervisors.filter(s => {
    if (!s.name && !s.email && !s.displayName) return false;
    const q = searchQuery.toLowerCase();
    const name = s.name || s.displayName || '';
    return (
      name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  const handleOpenConversation = (conv: ConversationPreview) => {
    router.push(
      `/driver/chat?supervisorId=${conv.otherUid}&supervisorName=${encodeURIComponent(conv.otherName)}`
    );
  };

  const handleNewMessage = () => {
    if (!selectedId) {
      Alert.alert('Selection Required', 'Please select a supervisor to start messaging.');
      return;
    }
    router.push(
      `/driver/chat?supervisorId=${selectedId}&supervisorName=${encodeURIComponent(selectedName)}`
    );
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💬 Messages</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'inbox' && styles.tabActive]}
          onPress={() => setActiveTab('inbox')}
        >
          <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>
            Inbox
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.tabActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            New Message
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══ INBOX TAB ═══ */}
      {activeTab === 'inbox' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {inboxLoading ? (
            <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginTop: SPACING.XXXL }} />
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                Tap "New Message" to start a conversation with your supervisor.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setActiveTab('new')}
              >
                <Text style={styles.emptyBtnText}>New Message</Text>
              </TouchableOpacity>
            </View>
          ) : (
            conversations.map((conv) => {
              const isFromMe = conv.lastSenderId === user?.uid;
              return (
                <TouchableOpacity
                  key={conv.id}
                  style={[
                    styles.conversationCard,
                    !isFromMe && styles.conversationCardUnread,
                  ]}
                  onPress={() => handleOpenConversation(conv)}
                  activeOpacity={0.7}
                >
                  <View style={styles.convAvatar}>
                    <Text style={styles.convAvatarText}>
                      {conv.otherName[0]?.toUpperCase() || 'S'}
                    </Text>
                  </View>
                  <View style={styles.convContent}>
                    <View style={styles.convTop}>
                      <Text style={[
                        styles.convName,
                        !isFromMe && styles.convNameBold,
                      ]} numberOfLines={1}>
                        {conv.otherName}
                      </Text>
                      <Text style={styles.convTime}>{formatTime(conv.lastMessageTime)}</Text>
                    </View>
                    <Text
                      style={[styles.convMessage, !isFromMe && { color: COLORS.GRAY_800, fontWeight: '500' }]}
                      numberOfLines={1}
                    >
                      {isFromMe ? `You: ${conv.lastMessage}` : conv.lastMessage}
                    </Text>
                  </View>
                  {!isFromMe && <View style={styles.convUnreadDot} />}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: SPACING.XXXL }} />
        </ScrollView>
      )}

      {/* ═══ NEW MESSAGE TAB ═══ */}
      {activeTab === 'new' && (
        <View style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.label}>Search and select a supervisor</Text>

            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor={COLORS.GRAY_400}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: SPACING.XL }} showsVerticalScrollIndicator={false}>
            {loadingSupervisors ? (
              <ActivityIndicator size="large" color={COLORS.PRIMARY} style={{ marginTop: SPACING.XXXL }} />
            ) : filteredSupervisors.length === 0 ? (
              <Text style={styles.emptyText}>No supervisors found.</Text>
            ) : (
              filteredSupervisors.map((sup) => (
                <TouchableOpacity
                  key={sup.uid}
                  style={[
                    styles.supervisorItem,
                    selectedId === sup.uid && styles.supervisorItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedId(sup.uid);
                    setSelectedName(sup.name || 'Supervisor');
                  }}
                >
                  <View style={styles.supervisorAvatar}>
                    <Text style={styles.supervisorAvatarText}>{(sup.name || 'S')[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.supervisorItemInfo}>
                    <Text style={styles.supervisorItemName}>{sup.name || sup.displayName || 'Unnamed'}</Text>
                    <Text style={styles.supervisorItemDetail}>
                      {sup.role === 'superadmin' ? 'Super Admin' : 'Supervisor'}
                    </Text>
                  </View>
                  {selectedId === sup.uid && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: SPACING.XXXL * 2 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, !selectedId && { backgroundColor: COLORS.GRAY_400 }]}
              onPress={handleNewMessage}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>Start Chat </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_PRIMARY },
  header: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XL,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.LG,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtnWrapper: { width: 60, justifyContent: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: FONT_SIZES.MD, fontWeight: '600' },
  title: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.WHITE },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_200,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.MD,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.PRIMARY,
  },
  tabText: {
    fontSize: FONT_SIZES.MD,
    fontWeight: '600',
    color: COLORS.GRAY_400,
  },
  tabTextActive: {
    color: COLORS.PRIMARY,
  },

  content: { paddingHorizontal: SPACING.XL, paddingTop: SPACING.LG },

  // Empty
  emptyContainer: { alignItems: 'center', paddingTop: SPACING.XXXL * 2 },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.MD },
  emptyTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_700 },
  emptySub: {
    fontSize: FONT_SIZES.MD, color: COLORS.GRAY_400,
    textAlign: 'center', marginTop: SPACING.SM, paddingHorizontal: SPACING.XL,
  },
  emptyBtn: {
    marginTop: SPACING.XL,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.LG,
    ...SHADOWS.SM,
  },
  emptyBtnText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },

  // Conversation cards (inbox)
  conversationCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG,
    padding: SPACING.LG, marginBottom: SPACING.SM,
    ...SHADOWS.SM,
  },
  conversationCardUnread: {
    backgroundColor: COLORS.PRIMARY + '06',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
  },
  convAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.SECONDARY,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.MD,
  },
  convAvatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.LG },
  convContent: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { fontSize: FONT_SIZES.MD, fontWeight: '500', color: COLORS.GRAY_800, flex: 1 },
  convNameBold: { fontWeight: '700', color: COLORS.GRAY_900 },
  convTime: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_400, marginLeft: SPACING.SM },
  convMessage: { fontSize: FONT_SIZES.SM, color: COLORS.GRAY_500 },
  convUnreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.PRIMARY, marginLeft: SPACING.SM,
  },

  // New message tab
  label: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_800, marginBottom: SPACING.MD },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, borderWidth: 1, borderColor: COLORS.GRAY_200,
    borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: SPACING.SM,
    marginBottom: SPACING.LG, ...SHADOWS.SM,
  },
  searchIcon: { fontSize: FONT_SIZES.MD, marginRight: SPACING.SM, color: COLORS.GRAY_400 },
  searchInput: { flex: 1, fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900 },
  emptyText: { textAlign: 'center', color: COLORS.GRAY_500, marginTop: SPACING.XL, fontSize: FONT_SIZES.MD },

  supervisorItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.WHITE, padding: SPACING.MD,
    borderRadius: RADIUS.MD, marginBottom: SPACING.SM,
    borderWidth: 1, borderColor: COLORS.GRAY_200, ...SHADOWS.SM,
  },
  supervisorItemSelected: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY + '08' },
  supervisorAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.SECONDARY,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.MD,
  },
  supervisorAvatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.LG },
  supervisorItemInfo: { flex: 1 },
  supervisorItemName: { fontSize: FONT_SIZES.MD, fontWeight: '600', color: COLORS.GRAY_900 },
  supervisorItemDetail: { fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, marginTop: 2 },
  checkmark: { fontSize: FONT_SIZES.XL, color: COLORS.SUCCESS, fontWeight: '700' },

  footer: { padding: SPACING.XL, backgroundColor: COLORS.BG_PRIMARY },
  nextBtn: {
    backgroundColor: COLORS.PRIMARY, paddingVertical: SPACING.LG,
    borderRadius: RADIUS.LG, alignItems: 'center', ...SHADOWS.MD,
  },
  nextBtnText: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
});
