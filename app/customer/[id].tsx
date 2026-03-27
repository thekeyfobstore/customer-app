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
  getInitials,
  formatPhone,
  formatDate,
  formatTime,
  formatDuration,
  getStatusColor,
} from "@/lib/helpers";

export default function CustomerDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomerById, getAppointmentsForCustomer, getMessagesForCustomer, deleteCustomer } =
    useData();

  const customer = getCustomerById(id || "");
  const appointments = getAppointmentsForCustomer(id || "");
  const messages = getMessagesForCustomer(id || "");

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

  if (!customer) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1 items-center justify-center">
        <Text style={[styles.emptyText, { color: colors.muted }]}>Customer not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const initials = getInitials(customer.firstName, customer.lastName);
  const statusColorMap: Record<string, string> = {
    primary: colors.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    muted: colors.muted,
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.navActions}>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/customer/edit" as any, params: { id: customer.id } })
            }
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="pencil" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="trash.fill" size={20} color={colors.error} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarLargeText}>{initials}</Text>
          </View>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {customer.firstName} {customer.lastName}
          </Text>
          {customer.company ? (
            <Text style={[styles.profileCompany, { color: colors.muted }]}>
              {customer.company}
            </Text>
          ) : null}
        </View>

        {/* Contact Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {customer.phone ? (
            <View style={styles.infoRow}>
              <IconSymbol name="phone.fill" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {formatPhone(customer.phone)}
              </Text>
            </View>
          ) : null}
          {customer.email ? (
            <View style={styles.infoRow}>
              <IconSymbol name="envelope.fill" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {customer.email}
              </Text>
            </View>
          ) : null}
          {customer.company ? (
            <View style={styles.infoRow}>
              <IconSymbol name="building.2.fill" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {customer.company}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Notes */}
        {customer.notes ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
            <Text style={[styles.notesText, { color: colors.foreground }]}>
              {customer.notes}
            </Text>
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

        {/* Appointments */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Appointments ({appointments.length})
          </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/appointment/add" as any, params: { customerId: customer.id } })
            }
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>
        {appointments.length === 0 ? (
          <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptySectionText, { color: colors.muted }]}>
              No appointments yet
            </Text>
          </View>
        ) : (
          appointments.slice(0, 5).map((apt) => {
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

        {/* Messages */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Messages ({messages.length})
          </Text>
        </View>
        {messages.length === 0 ? (
          <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptySectionText, { color: colors.muted }]}>
              No messages imported
            </Text>
          </View>
        ) : (
          messages.slice(0, 10).map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.messageHeader}>
                <IconSymbol
                  name={msg.direction === "inbound" ? "arrow.down.doc.fill" : "paperplane.fill"}
                  size={14}
                  color={msg.direction === "inbound" ? colors.success : colors.primary}
                />
                <Text style={[styles.messageDirection, { color: colors.muted }]}>
                  {msg.direction === "inbound" ? "Received" : "Sent"}
                </Text>
                <Text style={[styles.messageDate, { color: colors.muted }]}>
                  {formatDate(msg.createdAt)}
                </Text>
              </View>
              <Text style={[styles.messageBody, { color: colors.foreground }]} numberOfLines={3}>
                {msg.body}
              </Text>
            </View>
          ))
        )}

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
  navActions: {
    flexDirection: "row",
    gap: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  profileName: {
    fontSize: 26,
    fontWeight: "700",
  },
  profileCompany: {
    fontSize: 16,
  },
  section: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 16,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptySection: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 8,
  },
  emptySectionText: {
    fontSize: 14,
  },
  appointmentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  appointmentContent: {
    flex: 1,
    gap: 2,
  },
  appointmentDate: {
    fontSize: 15,
    fontWeight: "500",
  },
  appointmentService: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  messageCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  messageDirection: {
    fontSize: 12,
    fontWeight: "500",
  },
  messageDate: {
    fontSize: 12,
    marginLeft: "auto",
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
