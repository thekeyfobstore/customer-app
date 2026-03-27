import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import {
  getInitials,
  formatPhone,
  formatDate,
  formatTime,
  formatDuration,
  getStatusColor,
  generateId,
} from "@/lib/helpers";
import { loadApiKey, saveApiKey } from "@/lib/storage";
import {
  sendOpenPhoneMessage,
  fetchOpenPhoneNumbers,
  fetchConversationMessages,
} from "@/lib/openphone";
import type { Vehicle, Message } from "@/lib/types";

type Tab = "info" | "messages" | "appointments";

export default function CustomerDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getCustomerById,
    getAppointmentsForCustomer,
    getMessagesForCustomer,
    deleteCustomer,
    updateCustomer,
    addMessages,
  } = useData();

  const customer = getCustomerById(id || "");
  const appointments = getAppointmentsForCustomer(id || "");
  const messages = getMessagesForCustomer(id || "");

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [refreshingMessages, setRefreshingMessages] = useState(false);

  useEffect(() => {
    loadApiKey().then((key) => {
      setApiKey(key);
      if (key) {
        fetchOpenPhoneNumbers(key).then((nums) => {
          if (nums.length > 0) setPhoneNumberId(nums[0].id);
        });
      }
    });
  }, []);

  const handleDelete = useCallback(() => {
    Alert.alert("Delete Customer", "This will also remove all linked appointments and messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteCustomer(id || "");
          router.back();
        },
      },
    ]);
  }, [id, deleteCustomer, router]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !customer?.phone || !apiKey || !phoneNumberId) {
      if (!apiKey) Alert.alert("Setup Required", "Add your OpenPhone API key in Settings first.");
      return;
    }
    setSending(true);
    try {
      await sendOpenPhoneMessage(apiKey, phoneNumberId, customer.phone, messageText.trim());
      const newMsg: Message = {
        id: generateId(),
        customerId: customer.id,
        body: messageText.trim(),
        direction: "outbound",
        createdAt: new Date().toISOString(),
        from: phoneNumberId,
        to: customer.phone,
      };
      addMessages([newMsg]);
      setMessageText("");
    } catch (err: any) {
      Alert.alert("Send Failed", err.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  }, [messageText, customer, apiKey, phoneNumberId, addMessages]);

  const handleRefreshMessages = useCallback(async () => {
    if (!apiKey || !phoneNumberId || !customer?.phone) return;
    setRefreshingMessages(true);
    try {
      const raw = await fetchConversationMessages(apiKey, phoneNumberId, customer.phone);
      const newMessages: Message[] = raw
        .map((m: any) => ({
          id: m.id || generateId(),
          customerId: customer.id,
          body: m.body || m.text || m.content || "",
          direction: (m.direction === "inbound" ? "inbound" : "outbound") as "inbound" | "outbound",
          createdAt: m.createdAt || new Date().toISOString(),
          from: m.from || "",
          to: m.to || "",
        }))
        .filter((m: Message) => m.body);
      const existingIds = new Set(messages.map((m) => m.id));
      const fresh = newMessages.filter((m) => !existingIds.has(m.id));
      if (fresh.length > 0) addMessages(fresh);
    } catch {
      // silent fail
    } finally {
      setRefreshingMessages(false);
    }
  }, [apiKey, phoneNumberId, customer, messages, addMessages]);

  const handleDeleteVehicle = useCallback(
    (vehicleId: string) => {
      if (!customer) return;
      Alert.alert("Remove Vehicle", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            updateCustomer({
              ...customer,
              vehicles: (customer.vehicles || []).filter((v) => v.id !== vehicleId),
              updatedAt: new Date().toISOString(),
            });
          },
        },
      ]);
    },
    [customer, updateCustomer]
  );

  const statusColorMap: Record<string, string> = {
    primary: colors.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    muted: colors.muted,
  };

  if (!customer) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1 items-center justify-center">
        <Text style={[styles.emptyText, { color: colors.muted }]}>Customer not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { backgroundColor: colors.primary }, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const initials = getInitials(customer.firstName, customer.lastName);
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Nav Bar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.navActions}>
          <Pressable
            onPress={() => router.push({ pathname: "/customer/edit" as any, params: { id: customer.id } })}
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="pencil" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: "/extract-info" as any, params: { customerId: customer.id } })}
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="sparkles" size={20} color={colors.warning} />
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}>
            <IconSymbol name="trash.fill" size={20} color={colors.error} />
          </Pressable>
        </View>
      </View>

      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarLargeText}>{initials}</Text>
        </View>
        <Text style={[styles.profileName, { color: colors.foreground }]}>
          {customer.firstName} {customer.lastName}
        </Text>
        {customer.company ? (
          <Text style={[styles.profileCompany, { color: colors.muted }]}>{customer.company}</Text>
        ) : null}
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        {(["info", "messages", "appointments"] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab && { backgroundColor: colors.background },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.foreground : colors.muted },
                activeTab === tab && { fontWeight: "600" },
              ]}
            >
              {tab === "info" ? "Info" : tab === "messages" ? `Messages (${messages.length})` : `Appts (${appointments.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === "info" && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Contact Info */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {customer.phone ? (
              <View style={styles.infoRow}>
                <IconSymbol name="phone.fill" size={18} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.foreground }]}>{formatPhone(customer.phone)}</Text>
              </View>
            ) : null}
            {customer.email ? (
              <View style={styles.infoRow}>
                <IconSymbol name="envelope.fill" size={18} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.foreground }]}>{customer.email}</Text>
              </View>
            ) : null}
            {customer.address && customer.address.street ? (
              <View style={styles.infoRow}>
                <IconSymbol name="mappin" size={18} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.foreground }]}>
                  {customer.address.street}, {customer.address.city}, {customer.address.state} {customer.address.zip}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Vehicles */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Vehicles ({(customer.vehicles || []).length})
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: "/vehicle/add" as any, params: { customerId: customer.id } })}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <IconSymbol name="plus" size={22} color={colors.primary} />
            </Pressable>
          </View>
          {(!customer.vehicles || customer.vehicles.length === 0) ? (
            <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptySectionText, { color: colors.muted }]}>No vehicles added</Text>
            </View>
          ) : (
            customer.vehicles.map((v) => (
              <View key={v.id}>
                <View
                  style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.vehicleIcon, { backgroundColor: colors.primary + "15" }]}>
                    <IconSymbol name="car.fill" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={[styles.vehicleTitle, { color: colors.foreground }]}>
                      {v.year} {v.make} {v.model}
                    </Text>
                    {v.vin ? (
                      <Text style={[styles.vehicleDetail, { color: colors.muted }]}>VIN: {v.vin}</Text>
                    ) : null}
                  </View>
                  <View style={styles.vehicleActions}>
                    <Pressable
                      onPress={() => router.push(`/service-history?vehicleId=${v.id}&customerId=${customer.id}` as any)}
                      style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name="clock.fill" size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteVehicle(v.id)}
                      style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Notes */}
          {customer.notes ? (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>{customer.notes}</Text>
            </View>
          ) : null}

          {/* Tags */}
          {customer.tags && customer.tags.length > 0 ? (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tags</Text>
              <View style={styles.tagsContainer}>
                {customer.tags.map((tag, i) => (
                  <View key={i} style={[styles.tag, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {activeTab === "messages" && (
        <View style={styles.messagesContainer}>
          {/* Refresh button */}
          {apiKey ? (
            <Pressable
              onPress={handleRefreshMessages}
              style={({ pressed }) => [
                styles.refreshBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              {refreshingMessages ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol name="arrow.clockwise" size={16} color={colors.primary} />
              )}
              <Text style={[styles.refreshText, { color: colors.primary }]}>
                {refreshingMessages ? "Refreshing..." : "Refresh from OpenPhone"}
              </Text>
            </Pressable>
          ) : null}

          <ScrollView contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false}>
            {sortedMessages.length === 0 ? (
              <View style={styles.emptyMessages}>
                <IconSymbol name="bubble.left.and.bubble.right" size={40} color={colors.muted} />
                <Text style={[styles.emptyMessagesText, { color: colors.muted }]}>No messages yet</Text>
                <Text style={[styles.emptyMessagesHint, { color: colors.muted }]}>
                  {apiKey ? "Send a message or refresh from OpenPhone" : "Add your OpenPhone API key in Settings to start messaging"}
                </Text>
              </View>
            ) : (
              sortedMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.direction === "outbound"
                      ? [styles.outboundBubble, { backgroundColor: colors.primary }]
                      : [styles.inboundBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                >
                  <Text
                    style={[
                      styles.messageBody,
                      { color: msg.direction === "outbound" ? "#FFFFFF" : colors.foreground },
                    ]}
                  >
                    {msg.body}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      { color: msg.direction === "outbound" ? "rgba(255,255,255,0.7)" : colors.muted },
                    ]}
                  >
                    {formatDate(msg.createdAt)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Compose Bar */}
          <View style={[styles.composeBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.composeInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder={apiKey ? "Type a message..." : "Add API key in Settings"}
              placeholderTextColor={colors.muted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              editable={!!apiKey}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sending || !apiKey}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: messageText.trim() && apiKey ? colors.primary : colors.muted },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {activeTab === "appointments" && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Appointments ({appointments.length})
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: "/appointment/add" as any, params: { customerId: customer.id } })}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <IconSymbol name="plus" size={22} color={colors.primary} />
            </Pressable>
          </View>
          {appointments.length === 0 ? (
            <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptySectionText, { color: colors.muted }]}>No appointments yet</Text>
            </View>
          ) : (
            appointments.map((apt) => {
              const sc = statusColorMap[getStatusColor(apt.status)] || colors.muted;
              return (
                <Pressable
                  key={apt.id}
                  onPress={() => router.push(`/appointment/${apt.id}` as any)}
                  style={({ pressed }) => [
                    styles.appointmentCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: sc }]} />
                  <View style={styles.appointmentContent}>
                    <Text style={[styles.appointmentDate, { color: colors.foreground }]}>
                      {formatDate(apt.date)} at {formatTime(apt.time)}
                    </Text>
                    <Text style={[styles.appointmentService, { color: colors.muted }]}>
                      {apt.service || "Appointment"} · {formatDuration(apt.duration)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "20" }]}>
                    <Text style={[styles.statusText, { color: sc }]}>
                      {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  navButton: { padding: 8 },
  navActions: { flexDirection: "row", gap: 4 },
  profileHeader: { alignItems: "center", paddingVertical: 12, gap: 4 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarLargeText: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  profileName: { fontSize: 24, fontWeight: "700" },
  profileCompany: { fontSize: 15 },
  tabBar: { flexDirection: "row", marginHorizontal: 20, marginBottom: 12, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabText: { fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12, gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoText: { fontSize: 16, flex: 1 },
  notesText: { fontSize: 15, lineHeight: 22 },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 13, fontWeight: "500" },
  emptySection: { padding: 20, borderRadius: 14, borderWidth: 1, alignItems: "center", marginBottom: 8 },
  emptySectionText: { fontSize: 14 },
  vehicleCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vehicleInfo: { flex: 1, gap: 2 },
  vehicleTitle: { fontSize: 16, fontWeight: "600" },
  vehicleDetail: { fontSize: 13 },
  vehicleVin: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  vehicleActions: { flexDirection: "row" as const, gap: 12, alignItems: "center" as const },
  appointmentCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  appointmentContent: { flex: 1, gap: 2 },
  appointmentDate: { fontSize: 15, fontWeight: "500" },
  appointmentService: { fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "600" },
  messagesContainer: { flex: 1 },
  refreshBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, marginHorizontal: 20, borderRadius: 10, borderWidth: 1, gap: 6, marginBottom: 8 },
  refreshText: { fontSize: 13, fontWeight: "500" },
  messagesList: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  emptyMessages: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyMessagesText: { fontSize: 18, fontWeight: "600" },
  emptyMessagesHint: { fontSize: 14, textAlign: "center", paddingHorizontal: 20 },
  messageBubble: { maxWidth: "80%", padding: 12, borderRadius: 16, marginVertical: 2 },
  outboundBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  inboundBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1 },
  messageBody: { fontSize: 15, lineHeight: 21 },
  messageTime: { fontSize: 11, marginTop: 4 },
  composeBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, gap: 10 },
  composeInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, fontSize: 15, maxHeight: 100 },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, marginBottom: 16 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
