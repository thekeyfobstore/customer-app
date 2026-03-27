import { useState, useEffect, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { loadCloverConfig } from "@/lib/storage";
import { createCloverOrder } from "@/lib/clover";
import { generateId } from "@/lib/helpers";
import type { CloverLineItem, CloverOrder } from "@/lib/types";

export default function ChargeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customerId, appointmentId } = useLocalSearchParams<{
    customerId: string;
    appointmentId?: string;
  }>();
  const {
    getCustomerById,
    appointments,
    addCloverOrder,
    addServiceRecord,
  } = useData();

  const customer = getCustomerById(customerId || "");
  const appointment = useMemo(
    () => appointments.find((a) => a.id === appointmentId),
    [appointments, appointmentId]
  );

  const [lineItems, setLineItems] = useState<CloverLineItem[]>([]);
  const [newItemName, setNewItemName] = useState(appointment?.service || "");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [sending, setSending] = useState(false);
  const [cloverConfigured, setCloverConfigured] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    customer?.vehicles?.[0]?.id || ""
  );

  useEffect(() => {
    loadCloverConfig().then((cfg) => {
      setCloverConfigured(!!cfg.apiToken && !!cfg.merchantId);
    });
  }, []);

  useEffect(() => {
    if (appointment?.service && lineItems.length === 0) {
      setNewItemName(appointment.service);
    }
  }, [appointment]);

  const totalCents = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [lineItems]
  );

  const addLineItem = () => {
    const name = newItemName.trim();
    const priceNum = parseFloat(newItemPrice);
    if (!name) {
      Alert.alert("Required", "Enter a service name.");
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Required", "Enter a valid price.");
      return;
    }
    setLineItems([...lineItems, { name, price: Math.round(priceNum * 100), quantity: 1 }]);
    setNewItemName("");
    setNewItemPrice("");
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSendToClover = async () => {
    if (lineItems.length === 0) {
      Alert.alert("No Items", "Add at least one service line item.");
      return;
    }
    if (!cloverConfigured) {
      Alert.alert(
        "Clover Not Configured",
        "Go to Settings to add your Clover API token and Merchant ID."
      );
      return;
    }

    setSending(true);
    try {
      const config = await loadCloverConfig();
      const customerName = customer
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : "Customer";
      const title = `${customerName} - ${appointment?.service || "Service"}`;

      const result = await createCloverOrder(config, title, lineItems, appointment?.notes);

      const order: CloverOrder = {
        id: generateId(),
        customerId: customerId || "",
        appointmentId: appointmentId || undefined,
        cloverOrderId: result.orderId,
        title,
        lineItems,
        totalAmount: totalCents,
        status: "sent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addCloverOrder(order);

      // Also add service records for each line item
      if (selectedVehicleId) {
        for (const item of lineItems) {
          addServiceRecord({
            id: generateId(),
            vehicleId: selectedVehicleId,
            customerId: customerId || "",
            appointmentId: appointmentId || undefined,
            service: item.name,
            description: `Charged $${(item.price / 100).toFixed(2)}`,
            cost: item.price,
            date: new Date().toISOString().split("T")[0],
            createdAt: new Date().toISOString(),
          });
        }
      }

      Alert.alert(
        "Sent to Clover",
        `Order "${title}" has been sent to your Clover device for $${(totalCents / 100).toFixed(2)}. Open the order on Clover and tap Pay.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send order to Clover.");
    } finally {
      setSending(false);
    }
  };

  if (!customer) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted, fontSize: 16 }}>Customer not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Charge Customer</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {customer.firstName} {customer.lastName}
          </Text>
          {appointment && (
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              {appointment.service} — {appointment.date}
            </Text>
          )}
        </View>

        {/* Vehicle Selector */}
        {customer.vehicles && customer.vehicles.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>VEHICLE</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {customer.vehicles.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVehicleId(v.id)}
                  style={({ pressed }) => [
                    styles.vehicleRow,
                    { borderBottomColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <IconSymbol
                    name={selectedVehicleId === v.id ? "checkmark" : "car.fill"}
                    size={18}
                    color={selectedVehicleId === v.id ? colors.primary : colors.muted}
                  />
                  <Text style={[styles.vehicleText, { color: colors.foreground }]}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Line Items */}
        <Text style={[styles.label, { color: colors.muted }]}>LINE ITEMS</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {lineItems.map((item, index) => (
            <View key={index} style={[styles.lineItemRow, { borderBottomColor: colors.border }]}>
              <View style={styles.lineItemInfo}>
                <Text style={[styles.lineItemName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.lineItemPrice, { color: colors.muted }]}>
                  ${(item.price / 100).toFixed(2)}
                </Text>
              </View>
              <Pressable onPress={() => removeLineItem(index)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={16} color={colors.error} />
              </Pressable>
            </View>
          ))}

          {/* Add new line item */}
          <View style={styles.addItemRow}>
            <TextInput
              style={[styles.itemInput, styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Service name"
              placeholderTextColor={colors.muted}
              value={newItemName}
              onChangeText={setNewItemName}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.itemInput, styles.priceInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="$0.00"
              placeholderTextColor={colors.muted}
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Pressable
              onPress={addLineItem}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="plus" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Total */}
        {lineItems.length > 0 && (
          <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.muted }]}>Total</Text>
            <Text style={[styles.totalAmount, { color: colors.foreground }]}>
              ${(totalCents / 100).toFixed(2)}
            </Text>
          </View>
        )}

        {/* Send Button */}
        <Pressable
          onPress={handleSendToClover}
          disabled={sending || lineItems.length === 0}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: lineItems.length === 0 ? colors.muted : colors.success },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            sending && { opacity: 0.6 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Send to Clover</Text>
            </>
          )}
        </Pressable>

        {!cloverConfigured && (
          <View style={[styles.warningCard, { backgroundColor: colors.warning + "15", borderColor: colors.warning }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.foreground }]}>
              Clover is not configured. Go to Settings to add your API token and Merchant ID.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  navTitle: { fontSize: 17, fontWeight: "600" },
  cancelText: { fontSize: 17 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTitle: { fontSize: 18, fontWeight: "600", padding: 14, paddingBottom: 4 },
  cardSubtitle: { fontSize: 14, paddingHorizontal: 14, paddingBottom: 14 },
  vehicleRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10, borderBottomWidth: 0.5 },
  vehicleText: { fontSize: 15, fontWeight: "500" },
  lineItemRow: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 0.5, gap: 10 },
  lineItemInfo: { flex: 1 },
  lineItemName: { fontSize: 15, fontWeight: "500" },
  lineItemPrice: { fontSize: 13, marginTop: 2 },
  addItemRow: { flexDirection: "row", padding: 10, gap: 8, alignItems: "center" },
  itemInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderRadius: 10, borderWidth: 1 },
  nameInput: { flex: 1 },
  priceInput: { width: 80, textAlign: "right" },
  addButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  totalCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: "500" },
  totalAmount: { fontSize: 24, fontWeight: "700" },
  sendButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 8, marginTop: 16 },
  sendButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  warningCard: { flexDirection: "row", padding: 14, borderRadius: 12, borderWidth: 1, gap: 10, alignItems: "center", marginTop: 12 },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
