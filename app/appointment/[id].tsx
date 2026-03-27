import { useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import {
  formatDate,
  formatTime,
  formatDuration,
  getInitials,
  getStatusColor,
} from "@/lib/helpers";
import type { AppointmentStatus } from "@/lib/types";

export default function AppointmentDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments, getCustomerById, updateAppointment, deleteAppointment } = useData();

  const appointment = appointments.find((a) => a.id === id);
  const customer = appointment ? getCustomerById(appointment.customerId) : undefined;

  const statusColorMap: Record<string, string> = {
    primary: colors.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    muted: colors.muted,
  };

  const handleStatusChange = useCallback(
    (status: AppointmentStatus) => {
      if (!appointment) return;
      updateAppointment({
        ...appointment,
        status,
        updatedAt: new Date().toISOString(),
      });
    },
    [appointment, updateAppointment]
  );

  const handleDelete = useCallback(() => {
    Alert.alert("Delete Appointment", "Are you sure you want to delete this appointment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteAppointment(id || "");
          router.back();
        },
      },
    ]);
  }, [id, deleteAppointment, router]);

  if (!appointment) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted, fontSize: 16 }}>Appointment not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const sc = statusColorMap[getStatusColor(appointment.status)] || colors.muted;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Appointment</Text>
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="trash.fill" size={20} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: sc + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: sc }]} />
            <Text style={[styles.statusTextLarge, { color: sc }]}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Date & Time Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <IconSymbol name="calendar" size={20} color={colors.primary} />
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Date</Text>
            <Text style={[styles.cardValue, { color: colors.foreground }]}>
              {formatDate(appointment.date)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.cardRow}>
            <IconSymbol name="clock.fill" size={20} color={colors.primary} />
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Time</Text>
            <Text style={[styles.cardValue, { color: colors.foreground }]}>
              {formatTime(appointment.time)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.cardRow}>
            <IconSymbol name="clock.fill" size={20} color={colors.primary} />
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Duration</Text>
            <Text style={[styles.cardValue, { color: colors.foreground }]}>
              {formatDuration(appointment.duration)}
            </Text>
          </View>
          {appointment.service ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.cardRow}>
                <IconSymbol name="tag.fill" size={20} color={colors.primary} />
                <Text style={[styles.cardLabel, { color: colors.muted }]}>Service</Text>
                <Text style={[styles.cardValue, { color: colors.foreground }]}>
                  {appointment.service}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Customer Card */}
        {customer && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Customer</Text>
            <Pressable
              onPress={() => router.push(`/customer/${customer.id}` as any)}
              style={({ pressed }) => [
                styles.customerCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {getInitials(customer.firstName, customer.lastName)}
                </Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={[styles.customerName, { color: colors.foreground }]}>
                  {customer.firstName} {customer.lastName}
                </Text>
                {customer.phone ? (
                  <Text style={[styles.customerDetail, { color: colors.muted }]}>
                    {customer.phone}
                  </Text>
                ) : null}
              </View>
              <IconSymbol name="chevron.right" size={18} color={colors.muted} />
            </Pressable>
          </>
        )}

        {/* Notes */}
        {appointment.notes ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                {appointment.notes}
              </Text>
            </View>
          </>
        ) : null}

        {/* Status Actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Actions</Text>
        <View style={styles.actionsGrid}>
          {appointment.status === "scheduled" && (
            <>
              <Pressable
                onPress={() => handleStatusChange("completed")}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: colors.success + "15", borderColor: colors.success },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol name="checkmark" size={20} color={colors.success} />
                <Text style={[styles.actionText, { color: colors.success }]}>
                  Mark Complete
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleStatusChange("cancelled")}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: colors.error + "15", borderColor: colors.error },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol name="xmark" size={20} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => handleStatusChange("no-show")}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: colors.warning + "15", borderColor: colors.warning },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
                <Text style={[styles.actionText, { color: colors.warning }]}>No-Show</Text>
              </Pressable>
            </>
          )}
          {appointment.status !== "scheduled" && (
            <Pressable
              onPress={() => handleStatusChange("scheduled")}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.primary + "15", borderColor: colors.primary },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                Reschedule
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
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navButton: {
    padding: 8,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statusRow: {
    alignItems: "center",
    marginVertical: 16,
  },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTextLarge: {
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  cardLabel: {
    fontSize: 14,
    width: 70,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  divider: {
    height: 0.5,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 8,
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
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
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    fontSize: 17,
    fontWeight: "600",
  },
  customerDetail: {
    fontSize: 14,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionsGrid: {
    gap: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
