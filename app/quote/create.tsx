import { useState, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId, formatPhone } from "@/lib/helpers";
import { loadApiKey } from "@/lib/storage";
import { sendOpenPhoneMessage, fetchOpenPhoneNumbers } from "@/lib/openphone";
import * as Haptics from "expo-haptics";
import type { QuoteOption, Quote } from "@/lib/types";

export default function CreateQuoteScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customerId, vehicleId } = useLocalSearchParams<{
    customerId: string;
    vehicleId?: string;
  }>();
  const { getCustomerById, addQuote, updateCustomer } = useData();

  const customer = getCustomerById(customerId || "");

  // Find the vehicle if vehicleId is provided
  const vehicle = useMemo(() => {
    if (!vehicleId || !customer?.vehicles) return customer?.vehicles?.[0];
    return customer.vehicles.find((v) => v.id === vehicleId) || customer.vehicles[0];
  }, [customer, vehicleId]);

  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [options, setOptions] = useState<
    Array<{ id: string; label: string; description: string; price: string }>
  >([
    { id: generateId(), label: "OEM", description: "", price: "" },
    { id: generateId(), label: "Aftermarket", description: "", price: "" },
  ]);
  const [sending, setSending] = useState(false);

  // Common locksmith services for quick selection
  const quickServices = [
    "Key Fob Programming",
    "Spare Key Cut",
    "Push to Start Key",
    "Ignition Replacement",
    "Transponder Key",
    "Remote Start Install",
    "Lock Rekey",
  ];

  const addOption = () => {
    setOptions([
      ...options,
      { id: generateId(), label: "", description: "", price: "" },
    ]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 1) return;
    setOptions(options.filter((o) => o.id !== id));
  };

  const updateOption = (
    id: string,
    field: "label" | "description" | "price",
    value: string
  ) => {
    setOptions(
      options.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const buildQuoteMessage = (): string => {
    const vehicleStr = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
      : "";

    let msg = `Hi ${customer?.firstName || "there"}! Here's your quote`;
    if (service) msg += ` for ${service}`;
    if (vehicleStr) msg += ` on your ${vehicleStr}`;
    msg += ":\n\n";

    const validOptions = options.filter(
      (o) => o.label.trim() && o.price.trim()
    );

    validOptions.forEach((opt, i) => {
      const priceNum = Math.round(parseFloat(opt.price) * 100);
      msg += `Option ${i + 1}: ${opt.label} — ${formatCurrency(priceNum)}\n`;
      if (opt.description.trim()) {
        msg += `  ${opt.description}\n`;
      }
    });

    if (notes.trim()) {
      msg += `\n${notes}\n`;
    }

    msg += "\nLet me know which option works for you, or if you have any questions!";

    return msg;
  };

  const handleSendQuote = async () => {
    if (!customer) return;

    const validOptions = options.filter(
      (o) => o.label.trim() && o.price.trim()
    );
    if (validOptions.length === 0) {
      Alert.alert("Missing Info", "Add at least one option with a label and price.");
      return;
    }

    if (!service.trim()) {
      Alert.alert("Missing Info", "Please select or enter a service type.");
      return;
    }

    setSending(true);

    try {
      // Build quote options
      const quoteOptions: QuoteOption[] = validOptions.map((o) => ({
        id: o.id,
        label: o.label.trim(),
        description: o.description.trim(),
        price: Math.round(parseFloat(o.price) * 100),
      }));

      // Build the text message
      const message = buildQuoteMessage();

      // Try to send via OpenPhone
      let sentViaOpenPhone = false;
      const apiKey = await loadApiKey();
      if (apiKey && customer.phone) {
        try {
          const phoneNumbers = await fetchOpenPhoneNumbers(apiKey);
          if (phoneNumbers.length > 0) {
            await sendOpenPhoneMessage(
              apiKey,
              phoneNumbers[0].id,
              customer.phone,
              message
            );
            sentViaOpenPhone = true;
          }
        } catch (err: any) {
          console.error("Failed to send via OpenPhone:", err);
          // Will fall through to save quote without sending
        }
      }

      // Save the quote
      const now = new Date().toISOString();
      const quote: Quote = {
        id: generateId(),
        customerId: customer.id,
        vehicleId: vehicle?.id,
        service: service.trim(),
        options: quoteOptions,
        notes: notes.trim(),
        status: sentViaOpenPhone ? "sent" : "draft",
        sentAt: sentViaOpenPhone ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };

      addQuote(quote);

      // Auto-update customer status to "Quote Sent" if sent
      if (sentViaOpenPhone && customer.status !== "quote-sent") {
        updateCustomer({
          ...customer,
          status: "quote-sent",
          statusUpdatedAt: now,
          updatedAt: now,
        });
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        sentViaOpenPhone ? "Quote Sent!" : "Quote Saved",
        sentViaOpenPhone
          ? `Quote sent to ${customer.firstName} via OpenPhone. Status updated to "Quote Sent".`
          : "Quote saved as draft. Configure OpenPhone API key to send via text.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create quote");
    } finally {
      setSending(false);
    }
  };

  if (!customer) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Customer not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const vehicleStr = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
    : "";

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Quick Quote
          </Text>
          <Pressable
            onPress={handleSendQuote}
            disabled={sending}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.sendText, { color: colors.primary, opacity: sending ? 0.5 : 1 }]}>
              {sending ? "Sending..." : "Send"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Customer Info */}
          <View style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(customer.firstName?.charAt(0) || "").toUpperCase()}
                {(customer.lastName?.charAt(0) || "").toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.customerName, { color: colors.foreground }]}>
                {customer.firstName} {customer.lastName}
              </Text>
              {customer.phone ? (
                <Text style={[styles.customerDetail, { color: colors.muted }]}>
                  {formatPhone(customer.phone)}
                </Text>
              ) : null}
              {vehicleStr ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <IconSymbol name="car.fill" size={13} color={colors.primary} />
                  <Text style={[styles.customerDetail, { color: colors.primary }]}>
                    {vehicleStr}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Service Selection */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>SERVICE</Text>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Service type (e.g., Key Fob Programming)"
              placeholderTextColor={colors.muted}
              value={service}
              onChangeText={setService}
              returnKeyType="done"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChips}
            >
              {quickServices.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setService(s);
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.quickChip,
                    service === s
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      { color: service === s ? "#FFFFFF" : colors.foreground },
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Quote Options */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>PRICING OPTIONS</Text>
          {options.map((opt, index) => (
            <View
              key={opt.id}
              style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.optionHeader}>
                <Text style={[styles.optionNumber, { color: colors.primary }]}>
                  Option {index + 1}
                </Text>
                {options.length > 1 && (
                  <Pressable
                    onPress={() => removeOption(opt.id)}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.error} />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Label (e.g., OEM Key Fob)"
                placeholderTextColor={colors.muted}
                value={opt.label}
                onChangeText={(v) => updateOption(opt.id, "label", v)}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.muted}
                value={opt.description}
                onChangeText={(v) => updateOption(opt.id, "description", v)}
                returnKeyType="next"
              />
              <View style={styles.priceRow}>
                <Text style={[styles.dollarSign, { color: colors.foreground }]}>$</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.priceInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  value={opt.price}
                  onChangeText={(v) => updateOption(opt.id, "price", v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>
          ))}

          <Pressable
            onPress={addOption}
            style={({ pressed }) => [
              styles.addOptionButton,
              { borderColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addOptionText, { color: colors.primary }]}>
              Add Another Option
            </Text>
          </Pressable>

          {/* Notes */}
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>NOTES</Text>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
              ]}
              placeholder="Additional notes (e.g., includes programming, warranty info)"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Preview */}
          {options.some((o) => o.label.trim() && o.price.trim()) && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>MESSAGE PREVIEW</Text>
              <View style={[styles.previewCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                <Text style={[styles.previewText, { color: colors.foreground }]}>
                  {buildQuoteMessage()}
                </Text>
              </View>
            </>
          )}

          {/* Send Button */}
          <Pressable
            onPress={handleSendQuote}
            disabled={sending}
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>
              {sending ? "Sending..." : "Send Quote via OpenPhone"}
            </Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  cancelText: {
    fontSize: 16,
  },
  sendText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  customerName: {
    fontSize: 17,
    fontWeight: "600",
  },
  customerDetail: {
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickChips: {
    gap: 8,
    paddingVertical: 4,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  optionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionNumber: {
    fontSize: 15,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: "600",
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    gap: 8,
    marginTop: 4,
  },
  addOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 20,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
