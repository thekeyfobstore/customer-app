import { useState, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { formatPhone } from "@/lib/helpers";
import { loadApiKey } from "@/lib/storage";
import { sendOpenPhoneMessage, fetchOpenPhoneNumbers } from "@/lib/openphone";
import * as Haptics from "expo-haptics";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#E5E7EB", text: "#6B7280" },
  sent: { bg: "#DBEAFE", text: "#1E40AF" },
  accepted: { bg: "#D1FAE5", text: "#065F46" },
  rejected: { bg: "#FEE2E2", text: "#991B1B" },
};

export default function QuoteDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id, customerId } = useLocalSearchParams<{ id: string; customerId: string }>();
  const { getCustomerById, getQuotesForCustomer, updateQuote, updateCustomer, deleteQuote } = useData();

  const customer = getCustomerById(customerId || "");
  const quotes = getQuotesForCustomer(customerId || "");
  const quote = quotes.find((q) => q.id === id);

  const [sending, setSending] = useState(false);

  const vehicle = useMemo(() => {
    if (!quote?.vehicleId || !customer?.vehicles) return null;
    return customer.vehicles.find((v) => v.id === quote.vehicleId) || null;
  }, [quote, customer]);

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleResend = async () => {
    if (!customer || !quote) return;
    setSending(true);

    try {
      const vehicleStr = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
        : "";

      let msg = `Hi ${customer.firstName || "there"}! Here's your quote`;
      if (quote.service) msg += ` for ${quote.service}`;
      if (vehicleStr) msg += ` on your ${vehicleStr}`;
      msg += ":\n\n";

      quote.options.forEach((opt, i) => {
        msg += `Option ${i + 1}: ${opt.label} — ${formatCurrency(opt.price)}\n`;
        if (opt.description) msg += `  ${opt.description}\n`;
      });

      if (quote.notes) msg += `\n${quote.notes}\n`;
      msg += "\nLet me know which option works for you, or if you have any questions!";

      const apiKey = await loadApiKey();
      if (!apiKey) {
        Alert.alert("No API Key", "Configure your OpenPhone API key in Settings first.");
        return;
      }

      const phoneNumbers = await fetchOpenPhoneNumbers(apiKey);
      if (phoneNumbers.length === 0) {
        Alert.alert("Error", "No OpenPhone numbers found.");
        return;
      }

      await sendOpenPhoneMessage(apiKey, phoneNumbers[0].id, customer.phone, msg);

      const now = new Date().toISOString();
      updateQuote({ ...quote, status: "sent", sentAt: now, updatedAt: now });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert("Sent!", "Quote resent via OpenPhone.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send quote");
    } finally {
      setSending(false);
    }
  };

  const handleMarkAccepted = (optionId: string) => {
    if (!quote || !customer) return;
    const now = new Date().toISOString();
    updateQuote({
      ...quote,
      status: "accepted",
      acceptedOptionId: optionId,
      updatedAt: now,
    });
    // Update customer status
    updateCustomer({
      ...customer,
      status: "book-later",
      statusUpdatedAt: now,
      updatedAt: now,
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleMarkRejected = () => {
    if (!quote || !customer) return;
    const now = new Date().toISOString();
    updateQuote({ ...quote, status: "rejected", updatedAt: now });
    updateCustomer({
      ...customer,
      status: "rejected",
      statusUpdatedAt: now,
      updatedAt: now,
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Quote", "Are you sure you want to delete this quote?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (quote) deleteQuote(quote.id);
          router.back();
        },
      },
    ]);
  };

  if (!customer || !quote) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Quote not found</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Go Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const sc = STATUS_COLORS[quote.status] || STATUS_COLORS.draft;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Quote Detail</Text>
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="trash.fill" size={20} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>
              {STATUS_LABELS[quote.status]}
            </Text>
          </View>
          {quote.sentAt && (
            <Text style={[styles.sentDate, { color: colors.muted }]}>
              Sent {new Date(quote.sentAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Customer Info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>CUSTOMER</Text>
          <Text style={[styles.customerName, { color: colors.foreground }]}>
            {customer.firstName} {customer.lastName}
          </Text>
          {customer.phone ? (
            <Text style={[styles.customerPhone, { color: colors.muted }]}>
              {formatPhone(customer.phone)}
            </Text>
          ) : null}
        </View>

        {/* Service & Vehicle */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>SERVICE</Text>
          <Text style={[styles.serviceText, { color: colors.foreground }]}>{quote.service}</Text>
          {vehicle && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <IconSymbol name="car.fill" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14 }}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
            </View>
          )}
        </View>

        {/* Options */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>PRICING OPTIONS</Text>
        {quote.options.map((opt, i) => {
          const isAccepted = quote.acceptedOptionId === opt.id;
          return (
            <View
              key={opt.id}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isAccepted ? colors.success + "15" : colors.surface,
                  borderColor: isAccepted ? colors.success : colors.border,
                },
              ]}
            >
              <View style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>
                    Option {i + 1}: {opt.label}
                  </Text>
                  {opt.description ? (
                    <Text style={[styles.optionDesc, { color: colors.muted }]}>
                      {opt.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.optionPrice, { color: colors.foreground }]}>
                  {formatCurrency(opt.price)}
                </Text>
              </View>
              {isAccepted && (
                <View style={[styles.acceptedBadge, { backgroundColor: colors.success + "20" }]}>
                  <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>
                    Customer Accepted
                  </Text>
                </View>
              )}
              {quote.status === "sent" && !quote.acceptedOptionId && (
                <Pressable
                  onPress={() => handleMarkAccepted(opt.id)}
                  style={({ pressed }) => [
                    styles.acceptButton,
                    { backgroundColor: colors.success + "15", borderColor: colors.success },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600" }}>
                    Mark as Accepted
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Notes */}
        {quote.notes ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>NOTES</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
                {quote.notes}
              </Text>
            </View>
          </>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          {(quote.status === "draft" || quote.status === "sent") && (
            <Pressable
              onPress={handleResend}
              disabled={sending}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {sending ? "Sending..." : quote.status === "draft" ? "Send Quote" : "Resend Quote"}
              </Text>
            </Pressable>
          )}

          {quote.status === "sent" && !quote.acceptedOptionId && (
            <Pressable
              onPress={handleMarkRejected}
              style={({ pressed }) => [
                styles.actionButtonOutline,
                { borderColor: colors.error },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.error, fontSize: 16, fontWeight: "600" }}>
                Mark as Rejected
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  sentDate: {
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  customerName: {
    fontSize: 17,
    fontWeight: "600",
  },
  customerPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  serviceText: {
    fontSize: 17,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionDesc: {
    fontSize: 14,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 20,
    fontWeight: "700",
  },
  acceptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  acceptButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  actionButtonOutline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
});
