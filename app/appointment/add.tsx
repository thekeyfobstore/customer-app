import { useState, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId, getInitials } from "@/lib/helpers";
import { formatAddress, geocodeAddress } from "@/lib/geocoding";
import type { Appointment, AppointmentLocation } from "@/lib/types";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

function durationLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${hrs} hr` : `${hrs} hr ${m} min`;
}

type LocationType = "customer" | "drop-in" | "custom";

export default function AddAppointmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const { customers, dropInLocations, addAppointment } = useData();

  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId || "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(!params.customerId);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");

  // Location state
  const [locationType, setLocationType] = useState<LocationType>("customer");
  const [selectedDropInId, setSelectedDropInId] = useState("");
  const [customStreet, setCustomStreet] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customState, setCustomState] = useState("");
  const [customZip, setCustomZip] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedDropIn = dropInLocations.find((d) => d.id === selectedDropInId);

  const handleSave = async () => {
    if (!selectedCustomerId) {
      Alert.alert("Required", "Please select a customer.");
      return;
    }
    if (!date) {
      Alert.alert("Required", "Please select a date.");
      return;
    }

    let location: AppointmentLocation | undefined;

    if (locationType === "customer" && selectedCustomer?.address) {
      const coords = await geocodeAddress(selectedCustomer.address);
      location = {
        type: "customer",
        address: selectedCustomer.address,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      };
    } else if (locationType === "drop-in" && selectedDropIn) {
      location = {
        type: "drop-in",
        dropInId: selectedDropIn.id,
        address: selectedDropIn.address,
        latitude: selectedDropIn.latitude,
        longitude: selectedDropIn.longitude,
      };
    } else if (locationType === "custom" && (customStreet || customCity)) {
      const addr = { street: customStreet.trim(), city: customCity.trim(), state: customState.trim(), zip: customZip.trim() };
      const coords = await geocodeAddress(addr);
      location = {
        type: "custom",
        address: addr,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      };
    }

    const now = new Date().toISOString();
    const appointment: Appointment = {
      id: generateId(),
      customerId: selectedCustomerId,
      date,
      time,
      duration,
      service: service.trim(),
      status: "scheduled",
      notes: notes.trim(),
      location,
      createdAt: now,
      updatedAt: now,
    };

    addAppointment(appointment);
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>New Appointment</Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Customer Picker */}
        <Text style={[styles.label, { color: colors.foreground }]}>Customer</Text>
        {selectedCustomer && !showCustomerPicker ? (
          <Pressable
            onPress={() => setShowCustomerPicker(true)}
            style={({ pressed }) => [
              styles.selectedCustomer,
              { backgroundColor: colors.surface, borderColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.miniAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.miniAvatarText}>
                {getInitials(selectedCustomer.firstName, selectedCustomer.lastName)}
              </Text>
            </View>
            <Text style={[styles.selectedName, { color: colors.foreground }]}>
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </Text>
            <Text style={[styles.changeText, { color: colors.primary }]}>Change</Text>
          </Pressable>
        ) : (
          <View>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search customers..."
                placeholderTextColor={colors.muted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus={!params.customerId}
                returnKeyType="done"
              />
            </View>
            {filteredCustomers.length === 0 ? (
              <Text style={[styles.noResults, { color: colors.muted }]}>No customers found</Text>
            ) : (
              <View style={styles.customerList}>
                {filteredCustomers.slice(0, 5).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setSelectedCustomerId(c.id);
                      setShowCustomerPicker(false);
                      setCustomerSearch("");
                    }}
                    style={({ pressed }) => [
                      styles.customerOption,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.miniAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.miniAvatarText}>{getInitials(c.firstName, c.lastName)}</Text>
                    </View>
                    <Text style={[styles.customerOptionName, { color: colors.foreground }]}>
                      {c.firstName} {c.lastName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Date & Time */}
        <Text style={[styles.label, { color: colors.foreground }]}>Date & Time</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
            <IconSymbol name="calendar" size={18} color={colors.primary} />
            <TextInput
              style={[styles.rowInput, { color: colors.foreground }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={date}
              onChangeText={setDate}
              returnKeyType="next"
            />
          </View>
          <View style={styles.inputRow}>
            <IconSymbol name="clock.fill" size={18} color={colors.primary} />
            <TextInput
              style={[styles.rowInput, { color: colors.foreground }]}
              placeholder="HH:MM (24hr)"
              placeholderTextColor={colors.muted}
              value={time}
              onChangeText={setTime}
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Duration */}
        <Text style={[styles.label, { color: colors.foreground }]}>Duration</Text>
        <View style={styles.durationGrid}>
          {DURATION_OPTIONS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDuration(d)}
              style={({ pressed }) => [
                styles.durationChip,
                {
                  backgroundColor: duration === d ? colors.primary : colors.surface,
                  borderColor: duration === d ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.durationChipText, { color: duration === d ? "#FFFFFF" : colors.foreground }]}>
                {durationLabel(d)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Location */}
        <Text style={[styles.label, { color: colors.foreground }]}>Location</Text>
        <View style={styles.locationTypeRow}>
          {([
            { key: "customer" as const, label: "Customer Address", icon: "person.fill" as const },
            { key: "drop-in" as const, label: "Drop-in Spot", icon: "location.fill" as const },
            { key: "custom" as const, label: "Other Address", icon: "mappin" as const },
          ]).map((lt) => (
            <Pressable
              key={lt.key}
              onPress={() => setLocationType(lt.key)}
              style={({ pressed }) => [
                styles.locationTypeBtn,
                {
                  borderColor: locationType === lt.key ? colors.primary : colors.border,
                  backgroundColor: locationType === lt.key ? colors.primary + "15" : colors.surface,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name={lt.icon} size={14} color={locationType === lt.key ? colors.primary : colors.muted} />
              <Text style={[styles.locationTypeText, { color: locationType === lt.key ? colors.primary : colors.muted }]}>
                {lt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {locationType === "customer" && selectedCustomer?.address && (
          <View style={[styles.locationPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="mappin" size={14} color={colors.primary} />
            <Text style={[styles.locationPreviewText, { color: colors.foreground }]}>
              {formatAddress(selectedCustomer.address)}
            </Text>
          </View>
        )}
        {locationType === "customer" && (!selectedCustomer?.address) && (
          <Text style={[styles.locationHint, { color: colors.muted }]}>
            {selectedCustomer ? "This customer has no address on file" : "Select a customer first"}
          </Text>
        )}

        {locationType === "drop-in" && (
          <View>
            {dropInLocations.length === 0 ? (
              <Text style={[styles.locationHint, { color: colors.muted }]}>
                No drop-in locations saved. Add them in Routes tab.
              </Text>
            ) : (
              <View style={styles.dropInList}>
                {dropInLocations.map((di) => (
                  <Pressable
                    key={di.id}
                    onPress={() => setSelectedDropInId(di.id)}
                    style={({ pressed }) => [
                      styles.dropInOption,
                      {
                        borderColor: selectedDropInId === di.id ? colors.primary : colors.border,
                        backgroundColor: selectedDropInId === di.id ? colors.primary + "10" : colors.surface,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <IconSymbol name="location.fill" size={14} color={selectedDropInId === di.id ? colors.primary : colors.muted} />
                    <View style={styles.dropInInfo}>
                      <Text style={[styles.dropInName, { color: colors.foreground }]}>{di.name}</Text>
                      <Text style={[styles.dropInAddr, { color: colors.muted }]}>{formatAddress(di.address)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {locationType === "custom" && (
          <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Street address"
              placeholderTextColor={colors.muted}
              value={customStreet}
              onChangeText={setCustomStreet}
              returnKeyType="next"
            />
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, styles.cityInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                placeholder="City"
                placeholderTextColor={colors.muted}
                value={customCity}
                onChangeText={setCustomCity}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.stateInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                placeholder="ST"
                placeholderTextColor={colors.muted}
                value={customState}
                onChangeText={setCustomState}
                maxLength={2}
                autoCapitalize="characters"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.zipInput, { color: colors.foreground }]}
                placeholder="ZIP"
                placeholderTextColor={colors.muted}
                value={customZip}
                onChangeText={setCustomZip}
                keyboardType="number-pad"
                maxLength={5}
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        {/* Service & Notes */}
        <Text style={[styles.label, { color: colors.foreground }]}>Details</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Service type (e.g., Key Replacement)"
            placeholderTextColor={colors.muted}
            value={service}
            onChangeText={setService}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, styles.multilineInput, { color: colors.foreground }]}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  navTitle: { fontSize: 17, fontWeight: "600" },
  cancelText: { fontSize: 17 },
  saveText: { fontSize: 17, fontWeight: "600" },
  form: { paddingHorizontal: 20, paddingBottom: 60, gap: 8 },
  label: { fontSize: 14, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  selectedCustomer: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1.5, gap: 12 },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  selectedName: { flex: 1, fontSize: 16, fontWeight: "600" },
  changeText: { fontSize: 14, fontWeight: "500" },
  searchBox: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  noResults: { textAlign: "center", paddingVertical: 16, fontSize: 14 },
  customerList: { marginTop: 8, gap: 6 },
  customerOption: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  customerOptionName: { fontSize: 16, fontWeight: "500" },
  fieldGroup: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 0.5 },
  rowInput: { flex: 1, fontSize: 16, padding: 0 },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderBottomWidth: 0.5 },
  multilineInput: { minHeight: 80, textAlignVertical: "top", borderBottomWidth: 0 },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  durationChipText: { fontSize: 14, fontWeight: "500" },
  locationTypeRow: { flexDirection: "row", gap: 6 },
  locationTypeBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1 },
  locationTypeText: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  locationPreview: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  locationPreviewText: { flex: 1, fontSize: 13 },
  locationHint: { fontSize: 13, marginTop: 8, fontStyle: "italic" },
  dropInList: { marginTop: 8, gap: 6 },
  dropInOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  dropInInfo: { flex: 1 },
  dropInName: { fontSize: 14, fontWeight: "600" },
  dropInAddr: { fontSize: 12, marginTop: 2 },
  addressRow: { flexDirection: "row" },
  cityInput: { flex: 1 },
  stateInput: { width: 50 },
  zipInput: { width: 70, borderBottomWidth: 0 },
});
