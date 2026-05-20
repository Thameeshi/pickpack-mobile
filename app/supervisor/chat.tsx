import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { ChatMessage } from '../../src/types';
import {
  getConversationId, sendDirectMessage, subscribeToDirectMessages,
} from '../../src/services/chatService';
import { createNotification } from '../../src/services/notificationService';
import { COLORS, SPACING, FONT_SIZES, RADIUS, SHADOWS } from '../../src/constants/theme';

export default function SupervisorChatScreen() {
  const router = useRouter();
  const { driverId, driverName } = useLocalSearchParams<{
    driverId?: string;
    driverName?: string;
  }>();
  const { user, profile } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const conversationId =
    user?.uid && driverId ? getConversationId(user.uid, driverId) : '';

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    const unsub = subscribeToDirectMessages(
      conversationId,
      (msgs) => {
        setMessages(msgs);
        setLoading(false);
      },
      (_error) => {
        // Firestore permission or index error — stop loading
        setLoading(false);
      }
    );
    return unsub;
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !conversationId || !user) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      await sendDirectMessage(conversationId, {
        senderId: user.uid,
        senderName: profile?.name || 'Supervisor',
        senderRole: 'supervisor',
        text: msg,
        type: 'text',
      });
      // Send notification to the driver
      if (driverId) {
        createNotification(
          driverId,
          `💬 New message from ${profile?.name || 'Supervisor'}`,
          msg.length > 80 ? msg.substring(0, 80) + '...' : msg,
          'chat_message',
          { senderId: user.uid },
          user.uid,
          profile?.name || 'Supervisor',
        ).catch(() => {});
      }
    } catch (e: any) {
      setText(msg); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  };

  const formatDateHeader = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  // Group messages by date
  const getDateForMessage = (index: number) => {
    const msg = messages[index];
    if (index === 0) return formatDateHeader(msg.timestamp);
    const prevMsg = messages[index - 1];
    const prevDate = new Date(prevMsg.timestamp).toDateString();
    const currDate = new Date(msg.timestamp).toDateString();
    if (prevDate !== currDate) return formatDateHeader(msg.timestamp);
    return null;
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.senderId === user?.uid;
    const dateHeader = getDateForMessage(index);

    return (
      <View>
        {dateHeader && (
          <View style={styles.dateHeaderContainer}>
            <View style={styles.dateLine} />
            <Text style={styles.dateHeaderText}>{dateHeader}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
          {!isMe && (
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>
                {item.senderName?.[0]?.toUpperCase() || 'D'}
              </Text>
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMine : styles.bubbleTheirs]}>
            {!isMe && (
              <Text style={styles.bubbleSenderName}>{item.senderName}</Text>
            )}
            <Text style={[styles.bubbleText, isMe && { color: COLORS.WHITE }]}>
              {item.text}
            </Text>
            <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {driverName?.[0]?.toUpperCase() || 'D'}
            </Text>
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {driverName || 'Driver'}
            </Text>
            <Text style={styles.headerSub}>Driver</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptySub}>
              Send a message to {driverName || 'the driver'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, idx) => item.id || String(idx)}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.GRAY_400}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!text.trim() || sending) && { opacity: 0.5 },
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
            ) : (
              <Text style={styles.sendBtnText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0EB' },

  // Header
  header: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XXXL + SPACING.MD,
    paddingBottom: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnWrapper: { width: 36, justifyContent: 'center' },
  backBtn: { color: COLORS.WHITE, fontSize: 22, fontWeight: '400' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.SM,
  },
  headerAvatarText: { color: COLORS.WHITE, fontWeight: '700', fontSize: FONT_SIZES.MD },
  headerName: { color: COLORS.WHITE, fontSize: FONT_SIZES.LG, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZES.XS },

  // Loading / Empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.MD },
  emptyTitle: { fontSize: FONT_SIZES.XL, fontWeight: '700', color: COLORS.GRAY_700, marginBottom: SPACING.XS },
  emptySub: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_400, textAlign: 'center' },

  // Messages list
  messagesList: { padding: SPACING.LG, paddingBottom: SPACING.SM },

  // Date headers
  dateHeaderContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: SPACING.MD, paddingHorizontal: SPACING.LG,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: COLORS.GRAY_200 },
  dateHeaderText: {
    marginHorizontal: SPACING.MD,
    fontSize: FONT_SIZES.XS, color: COLORS.GRAY_500, fontWeight: '600',
  },

  // Bubble rows
  bubbleRow: { flexDirection: 'row', marginBottom: SPACING.SM, alignItems: 'flex-end' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },

  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.SECONDARY,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.XS,
  },
  avatarSmallText: { color: COLORS.WHITE, fontWeight: '700', fontSize: 11 },

  // Bubbles
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.LG,
  },
  bubbleMine: {
    backgroundColor: COLORS.PRIMARY,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.WHITE,
    borderBottomLeftRadius: 4,
    ...SHADOWS.SM,
  },
  bubbleSenderName: {
    fontSize: FONT_SIZES.XS, fontWeight: '700',
    color: COLORS.PRIMARY, marginBottom: 2,
  },
  bubbleText: { fontSize: FONT_SIZES.MD, color: COLORS.GRAY_900, lineHeight: 20 },
  bubbleTime: {
    fontSize: 10, color: COLORS.GRAY_400,
    marginTop: 4, textAlign: 'right',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: SPACING.SM, paddingBottom: SPACING.LG,
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 1, borderTopColor: COLORS.GRAY_200,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.GRAY_50,
    borderRadius: RADIUS.XL,
    paddingHorizontal: SPACING.LG,
    paddingVertical: Platform.OS === 'ios' ? SPACING.SM : 0,
    marginRight: SPACING.SM,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.GRAY_200,
  },
  textInput: {
    fontSize: FONT_SIZES.MD,
    color: COLORS.GRAY_900,
    minHeight: 36,
    maxHeight: 80,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.SM,
  },
  sendBtnText: { color: COLORS.WHITE, fontSize: 20 },
});
