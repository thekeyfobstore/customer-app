import { useState, useEffect, useMemo } from "react";
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
import { getInitials } from "@/lib/helpers";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

function durationLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${hrs} hr` : `${hrs} hr ${m} min`;
}

export default function EditAppointmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments, customers, updateAppointment } = useData();

  const appointment = appointments.find((a) => a.id === id);
  const customer = appointment ? customers.find((c) => c.id === appointment.customerId) : undefined;

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (appointment) {
      setDate(appointment.date);
      setTime(appointment.time);
      setDuration(appointment.duration);
      setService(appointment.service);
      setNotes(appointment.notes);
    }
  }, [appointment]);

  const handleSave = () => {
    if (!appointment) return;
    if (!date) {
      Alert.alert("Required", "Please enter a date.");
      return;
    }

    updateAppointment({
      ...appointment,
      date,
      time,
      duration,
      service: service.trim(),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    });
    router.back();
  };

  if (!appointment) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted, fontSize: 16 }}>Appointment not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Edit Appointment</Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Customer (read-only) */}
        {customer && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Customer</Text>
            <View style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.miniAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.miniAvatarText}>
                  {getInitials(customer.firstName, customer.lastName)}
                </Text>
              </View>
              <Text style={[styles.customerName, { color: colors.foreground }]}>
                {customer.firstName} {customer.lastName}
              </Text>
            </View>
          </>
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
              <Text
                style={[
                  styles.durationChipText,
                  { color: duration === d ? "#FFFFFF" : colors.foreground },
                ]}
              >
                {durationLabel(d)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Service & Notes */}
        <Text style={[styles.label, { color: colors.foreground }]}>Details</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Service type"
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
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 17,
  },
  saveText: {
    fontSize: 17,
    fontWeight: "600",
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  fieldGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
  },
  rowInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderBottomWidth: 0.5,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
    borderBottomWidth: 0,
  },
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
