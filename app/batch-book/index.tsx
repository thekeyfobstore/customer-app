import { useState, useMemo } from "react";
import { Text, View, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId } from "@/lib/helpers";

export default function BatchBookScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ area: string; followUpIds: string }>();
  const { followUps, customers, addAppointment, updateFollowUp, addDayRoute } = useData();

  const area = params.area || "Unknown";
  const followUpIds = (params.followUpIds || "").split(",").filter(Boolean);
  const areaFollowUps = followUps.filter((f) => followUpIds.includes(f.id));

  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("45");
  const [service, setService] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(followUpIds));

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBookAll = () => {
    if (selectedIds.size === 0) {
      Alert.alert("Error", "Select at least one follow-up to book");
      return;
    }
    if (!date || !startTime) {
      Alert.alert("Error", "Please set a date and start time");
      return;
    }

    const dur = parseInt(duration) || 45;
    const now = new Date().toISOString();
    let currentMinutes = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);

    const selectedFollowUps = areaFollowUps.filter((f) => selectedIds.has(f.id));

    for (const fu of selectedFollowUps) {
      const hours = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      const timeStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

      const customer = customers.find((c) => c.id === fu.customerId);

      addAppointment({
        id: generateId(),
        customerId: fu.customerId,
        date,
        time: timeStr,
        duration: dur,
        service: service || "Service Call",
        status: "scheduled",
        notes: `Follow-up: ${fu.notes || "Scheduled from batch booking"}`,
        location: customer?.address
          ? { type: "customer", address: customer.address }
          : undefined,
        createdAt: now,
        updatedAt: now,
      });

      updateFollowUp({ ...fu, status: "booked", updatedAt: now });

      // Add 15 min buffer + appointment duration for travel
      currentMinutes += dur + 15;
    }

    Alert.alert(
      "Booked!",
      `${selectedFollowUps.length} appointments created for ${date} in ${area}`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Schedule Route</Text>
          <TouchableOpacity onPress={handleBookAll}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Book All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* Area info */}
          <View style={[styles.areaCard, { backgroundColor: colors.primary + "10" }]}>
            <IconSymbol name="mappin" size={20} color={colors.primary} />
            <View style={styles.areaInfo}>
              <Text style={[styles.areaTitle, { color: colors.foreground }]}>{area}</Text>
              <Text style={[styles.areaSubtitle, { color: colors.muted }]}>
                {selectedIds.size} of {areaFollowUps.length} customers selected
              </Text>
            </View>
          </View>

          {/* Date & Time */}
          <Text style={[styles.label, { color: colors.muted }]}>Date</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.muted }]}>Start Time</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.muted }]}>Duration (min)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="45"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>Default Service</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
            value={service}
            onChangeText={setService}
            placeholder="e.g., Key Replacement, Lock Repair"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />

          {/* Customer list */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Customers</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Appointments will be spaced {duration || 45} min apart starting at {startTime}
          </Text>

          {areaFollowUps.map((fu, idx) => {
            const customer = customers.find((c) => c.id === fu.customerId);
            const isSelected = selectedIds.has(fu.id);
            const hours = Math.floor((parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]) + idx * (parseInt(duration) + 15 || 60)) / 60);
            const mins = (parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]) + idx * (parseInt(duration) + 15 || 60)) % 60;
            const estTime = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

            return (
              <TouchableOpacity
                key={fu.id}
                style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border }]}
                onPress={() => toggleSelection(fu.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }, !isSelected && { borderColor: colors.border }]}>
                  {isSelected && <IconSymbol name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={styles.customerInfo}>
                  <Text style={[styles.customerName, { color: colors.foreground }]}>
                    {customer ? `${customer.firstName} ${customer.lastName}` : "Unknown"}
                  </Text>
                  <Text style={[styles.customerDetail, { color: colors.muted }]}>
                    {fu.notes || "No notes"}
                  </Text>
                </View>
                {isSelected && (
                  <Text style={[styles.estTime, { color: colors.primary }]}>{estTime}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 17, fontWeight: "600" },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 100 },
  areaCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, gap: 12, marginBottom: 16 },
  areaInfo: { flex: 1 },
  areaTitle: { fontSize: 17, fontWeight: "700" },
  areaSubtitle: { fontSize: 13, marginTop: 2 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 12 },
  customerCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8, gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: "600" },
  customerDetail: { fontSize: 12, marginTop: 2 },
  estTime: { fontSize: 14, fontWeight: "700" },
});
