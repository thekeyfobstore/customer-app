import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId } from "@/lib/helpers";
import { trpc } from "@/lib/trpc";
import type { ExtractedInfo, Vehicle, Address } from "@/lib/types";

export default function ExtractInfoScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { getCustomerById, getMessagesForCustomer, updateCustomer } = useData();

  const customer = getCustomerById(customerId || "");
  const messages = getMessagesForCustomer(customerId || "");

  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);
  const [error, setError] = useState("");

  // Editable fields from extraction
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const extractMutation = trpc.extract.fromMessages.useMutation();

  const handleExtract = useCallback(async () => {
    if (messages.length === 0) {
      setError("No messages to analyze. Import messages from OpenPhone first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const messageTexts = messages.map(
        (m) => `[${m.direction === "inbound" ? "Customer" : "You"}]: ${m.body}`
      );

      const result = await extractMutation.mutateAsync({
        messages: messageTexts,
        existingName: customer ? `${customer.firstName} ${customer.lastName}` : undefined,
      });

      setExtracted(result);

      // Pre-fill editable fields with extracted data (only if non-empty)
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.phone) setPhone(result.phone);
      if (result.email) setEmail(result.email);
      if (result.company) setCompany(result.company);
      if (result.address) {
        if (result.address.street) setStreet(result.address.street);
        if (result.address.city) setCity(result.address.city);
        if (result.address.state) setState(result.address.state);
        if (result.address.zip) setZip(result.address.zip);
      }
      if (result.vehicles && result.vehicles.length > 0) {
        setVehicles(
          result.vehicles.map((v: any) => ({
            id: generateId(),
            year: v.year || "",
            make: v.make || "",
            model: v.model || "",
            vin: v.vin || "",
          }))
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [messages, customer, extractMutation]);

  const handleApply = useCallback(() => {
    if (!customer) return;

    const hasAddress = street || city || state || zip;
    const address: Address | undefined = hasAddress
      ? { street, city, state, zip }
      : customer.address;

    const existingVehicleIds = new Set((customer.vehicles || []).map((v) => v.id));
    const newVehicles = vehicles.filter((v) => !existingVehicleIds.has(v.id));
    const mergedVehicles = [...(customer.vehicles || []), ...newVehicles];

    updateCustomer({
      ...customer,
      firstName: firstName || customer.firstName,
      lastName: lastName || customer.lastName,
      phone: phone || customer.phone,
      email: email || customer.email,
      company: company || customer.company,
      address,
      vehicles: mergedVehicles,
      updatedAt: new Date().toISOString(),
    });

    Alert.alert("Updated", "Customer profile has been updated with extracted information.");
    router.back();
  }, [customer, firstName, lastName, phone, email, company, street, city, state, zip, vehicles, updateCustomer, router]);

  // Auto-extract on mount if messages exist
  useEffect(() => {
    if (messages.length > 0 && !extracted && !loading) {
      handleExtract();
    }
  }, []);

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
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Extract Info</Text>
        {extracted ? (
          <Pressable onPress={handleApply} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={[styles.saveText, { color: colors.primary }]}>Apply</Text>
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>Analyzing Messages</Text>
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            AI is scanning {messages.length} messages for customer information...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={40} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <Pressable
            onPress={handleExtract}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : extracted ? (
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <View style={[styles.successBanner, { backgroundColor: colors.success + "15" }]}>
            <IconSymbol name="checkmark" size={20} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Information extracted from {messages.length} messages
            </Text>
          </View>

          <Text style={[styles.hint, { color: colors.muted }]}>
            Review and edit the extracted information below, then tap Apply to update the customer profile.
          </Text>

          {/* Name */}
          <Text style={[styles.label, { color: colors.muted }]}>NAME</Text>
          <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="First Name"
              placeholderTextColor={colors.muted}
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Last Name"
              placeholderTextColor={colors.muted}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          {/* Contact */}
          <Text style={[styles.label, { color: colors.muted }]}>CONTACT</Text>
          <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Phone"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Company"
              placeholderTextColor={colors.muted}
              value={company}
              onChangeText={setCompany}
            />
          </View>

          {/* Address */}
          <Text style={[styles.label, { color: colors.muted }]}>ADDRESS</Text>
          <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Street"
              placeholderTextColor={colors.muted}
              value={street}
              onChangeText={setStreet}
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="City"
              placeholderTextColor={colors.muted}
              value={city}
              onChangeText={setCity}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput, { color: colors.foreground, borderRightWidth: 0.5, borderRightColor: colors.border }]}
                placeholder="State"
                placeholderTextColor={colors.muted}
                value={state}
                onChangeText={setState}
              />
              <TextInput
                style={[styles.input, styles.halfInput, { color: colors.foreground }]}
                placeholder="ZIP"
                placeholderTextColor={colors.muted}
                value={zip}
                onChangeText={setZip}
              />
            </View>
          </View>

          {/* Vehicles */}
          {vehicles.length > 0 && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>VEHICLES FOUND</Text>
              {vehicles.map((v, i) => (
                <View
                  key={v.id}
                  style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.vehicleIcon, { backgroundColor: colors.primary + "15" }]}>
                    <IconSymbol name="car.fill" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={[styles.vehicleTitle, { color: colors.foreground }]}>
                      {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown Vehicle"}
                    </Text>
                    {v.vin ? (
                      <Text style={[styles.vehicleDetail, { color: colors.muted }]}>VIN: {v.vin}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => setVehicles(vehicles.filter((_, idx) => idx !== i))}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <IconSymbol name="sparkles" size={48} color={colors.warning} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>AI Info Extraction</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Scan this customer's message history to automatically extract names, phone numbers, addresses, and vehicle information.
          </Text>
          <Pressable
            onPress={handleExtract}
            style={({ pressed }) => [
              styles.extractButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <IconSymbol name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.extractButtonText}>Extract from {messages.length} Messages</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  navTitle: { fontSize: 17, fontWeight: "600" },
  cancelText: { fontSize: 17 },
  saveText: { fontSize: 17, fontWeight: "600" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  loadingTitle: { fontSize: 20, fontWeight: "600" },
  loadingText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  errorText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  successBanner: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, gap: 10, marginBottom: 8 },
  successText: { fontSize: 14, fontWeight: "600", flex: 1 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  fieldGroup: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderBottomWidth: 0.5 },
  row: { flexDirection: "row" },
  halfInput: { flex: 1, borderBottomWidth: 0 },
  vehicleCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vehicleInfo: { flex: 1, gap: 2 },
  vehicleTitle: { fontSize: 16, fontWeight: "600" },
  vehicleDetail: { fontSize: 13 },
  vehicleVin: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginTop: 8 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  extractButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, gap: 8, marginTop: 12 },
  extractButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
