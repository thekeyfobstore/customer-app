import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { formatDate, formatTime, formatDuration, getStatusColor, getRelativeDate } from "@/lib/helpers";
import type { Appointment } from "@/lib/types";

type Tab = "upcoming" | "past";

export default function AppointmentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { appointments, customers, loading } = useData();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");

  const now = new Date();

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => {
          const aptDate = new Date(a.date + "T" + a.time);
          return aptDate >= now && a.status === "scheduled";
        })
        .sort((a, b) => new Date(a.date + "T" + a.time).getTime() - new Date(b.date + "T" + b.time).getTime()),
    [appointments]
  );

  const past = useMemo(
    () =>
      appointments
        .filter((a) => {
          const aptDate = new Date(a.date + "T" + a.time);
          return aptDate < now || a.status !== "scheduled";
        })
        .sort((a, b) => new Date(b.date + "T" + b.time).getTime() - new Date(a.date + "T" + a.time).getTime()),
    [appointments]
  );

  const data = activeTab === "upcoming" ? upcoming : past;

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => map.set(c.id, `${c.firstName} ${c.lastName}`));
    return map;
  }, [customers]);

  const statusColorMap: Record<string, string> = {
    primary: colors.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    muted: colors.muted,
  };

  // Group appointments by date
  const sections = useMemo(() => {
    const groups: { date: string; label: string; items: Appointment[] }[] = [];
    const dateMap = new Map<string, Appointment[]>();

    data.forEach((apt) => {
      const existing = dateMap.get(apt.date);
      if (existing) {
        existing.push(apt);
      } else {
        dateMap.set(apt.date, [apt]);
      }
    });

    dateMap.forEach((items, date) => {
      groups.push({ date, label: getRelativeDate(date), items });
    });

    return groups;
  }, [data]);

  const renderAppointment = useCallback(
    (apt: Appointment) => {
      const sc = statusColorMap[getStatusColor(apt.status)] || colors.muted;
      const customerName = customerMap.get(apt.customerId) || "Unknown";

      return (
        <Pressable
          key={apt.id}
          onPress={() => router.push(`/appointment/${apt.id}` as any)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.timeBlock, { backgroundColor: colors.primary + "12" }]}>
              <Text style={[styles.timeText, { color: colors.primary }]}>
                {formatTime(apt.time)}
              </Text>
              <Text style={[styles.durationText, { color: colors.muted }]}>
                {formatDuration(apt.duration)}
              </Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.customerName, { color: colors.foreground }]}>{customerName}</Text>
            <Text style={[styles.serviceText, { color: colors.muted }]}>
              {apt.service || "Appointment"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc + "20" }]}>
            <Text style={[styles.statusText, { color: sc }]}>
              {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [colors, customerMap, router]
  );

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Appointments</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {upcoming.length} upcoming
        </Text>
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentContainer, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={() => setActiveTab("upcoming")}
          style={({ pressed }) => [
            styles.segment,
            activeTab === "upcoming" && { backgroundColor: colors.background },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              { color: activeTab === "upcoming" ? colors.foreground : colors.muted },
              activeTab === "upcoming" && { fontWeight: "600" },
            ]}
          >
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("past")}
          style={({ pressed }) => [
            styles.segment,
            activeTab === "past" && { backgroundColor: colors.background },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              { color: activeTab === "past" ? colors.foreground : colors.muted },
              activeTab === "past" && { fontWeight: "600" },
            ]}
          >
            Past
          </Text>
        </Pressable>
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="calendar" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {activeTab === "upcoming" ? "No upcoming appointments" : "No past appointments"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {activeTab === "upcoming"
              ? "Schedule your first appointment to get started"
              : "Completed appointments will appear here"}
          </Text>
          {activeTab === "upcoming" && (
            <Pressable
              onPress={() => router.push("/appointment/add" as any)}
              style={({ pressed }) => [
                styles.emptyButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>New Appointment</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={sections}
          renderItem={({ item: section }) => (
            <View>
              <Text style={[styles.sectionHeader, { color: colors.foreground }]}>
                {section.label}
              </Text>
              {section.items.map(renderAppointment)}
            </View>
          )}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {data.length > 0 && (
        <Pressable
          onPress={() => router.push("/appointment/add" as any)}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <IconSymbol name="plus" size={26} color="#FFFFFF" />
        </Pressable>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.37,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  cardLeft: {},
  timeBlock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 72,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  durationText: {
    fontSize: 11,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  serviceText: {
    fontSize: 14,
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    marginTop: 12,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
