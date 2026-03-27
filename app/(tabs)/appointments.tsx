import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { formatDate, formatTime, formatDuration, getStatusColor, getRelativeDate } from "@/lib/helpers";
import type { Appointment } from "@/lib/types";

type ViewMode = "list" | "calendar";
type Tab = "upcoming" | "past";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function formatMonthYear(year: number, month: number) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[month]} ${year}`;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AppointmentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { appointments, customers, loading } = useData();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // Calendar: map dates to appointment counts
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const existing = map.get(a.date);
      if (existing) existing.push(a);
      else map.set(a.date, [a]);
    });
    return map;
  }, [appointments]);

  const calDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);

  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return (appointmentsByDate.get(selectedDate) || []).sort(
      (a, b) => a.time.localeCompare(b.time)
    );
  }, [selectedDate, appointmentsByDate]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  // Group appointments by date for list view
  const sections = useMemo(() => {
    const groups: { date: string; label: string; items: Appointment[] }[] = [];
    const dateMap = new Map<string, Appointment[]>();
    data.forEach((apt) => {
      const existing = dateMap.get(apt.date);
      if (existing) existing.push(apt);
      else dateMap.set(apt.date, [apt]);
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

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Appointments</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {upcoming.length} upcoming
            </Text>
          </View>
          <Pressable
            onPress={() => setViewMode(viewMode === "list" ? "calendar" : "list")}
            style={({ pressed }) => [
              styles.viewToggle,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol
              name={viewMode === "list" ? "calendar" : "ellipsis"}
              size={20}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>

      {viewMode === "list" ? (
        <>
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
        </>
      ) : (
        /* Calendar View */
        <ScrollView contentContainerStyle={styles.calendarContainer} showsVerticalScrollIndicator={false}>
          {/* Month Navigation */}
          <View style={styles.calNavRow}>
            <Pressable onPress={prevMonth} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.6 }]}>
              <IconSymbol name="arrow.left" size={20} color={colors.primary} />
            </Pressable>
            <Text style={[styles.calMonthTitle, { color: colors.foreground }]}>
              {formatMonthYear(calYear, calMonth)}
            </Text>
            <Pressable onPress={nextMonth} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.6 }]}>
              <IconSymbol name="chevron.right" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {/* Day Headers */}
          <View style={styles.calDayHeaders}>
            {DAYS.map((d) => (
              <Text key={d} style={[styles.calDayHeader, { color: colors.muted }]}>{d}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calGrid}>
            {calDays.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.calCell} />;
              }
              const dateStr = toDateStr(calYear, calMonth, day);
              const aptsOnDay = appointmentsByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <Pressable
                  key={dateStr}
                  onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={({ pressed }) => [
                    styles.calCell,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View
                    style={[
                      styles.calDayCircle,
                      isToday && { backgroundColor: colors.primary + "20" },
                      isSelected && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        { color: colors.foreground },
                        isToday && !isSelected && { color: colors.primary, fontWeight: "700" },
                        isSelected && { color: "#FFFFFF", fontWeight: "700" },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {aptsOnDay.length > 0 && (
                    <View style={styles.calDotsRow}>
                      {aptsOnDay.slice(0, 3).map((a, i) => {
                        const sc = statusColorMap[getStatusColor(a.status)] || colors.muted;
                        return <View key={i} style={[styles.calDot, { backgroundColor: sc }]} />;
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Selected Date Appointments */}
          {selectedDate && (
            <View style={styles.calSelectedSection}>
              <Text style={[styles.calSelectedTitle, { color: colors.foreground }]}>
                {formatDate(selectedDate)}
              </Text>
              {selectedDateAppointments.length === 0 ? (
                <Text style={[styles.calNoAppts, { color: colors.muted }]}>
                  No appointments on this day
                </Text>
              ) : (
                selectedDateAppointments.map(renderAppointment)
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 15, marginTop: 2 },
  viewToggle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, marginTop: 4 },
  segmentContainer: { flexDirection: "row", marginHorizontal: 20, marginBottom: 16, borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  segmentText: { fontSize: 14 },
  sectionHeader: { fontSize: 16, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  cardLeft: {},
  timeBlock: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: "center", minWidth: 72 },
  timeText: { fontSize: 14, fontWeight: "600" },
  durationText: { fontSize: 11, marginTop: 2 },
  cardContent: { flex: 1, gap: 2 },
  customerName: { fontSize: 16, fontWeight: "600" },
  serviceText: { fontSize: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "600" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "600", marginTop: 8 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, gap: 8, marginTop: 12 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  // Calendar styles
  calendarContainer: { paddingHorizontal: 20 },
  calNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  calNavBtn: { padding: 8 },
  calMonthTitle: { fontSize: 18, fontWeight: "600" },
  calDayHeaders: { flexDirection: "row" },
  calDayHeader: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%", alignItems: "center", paddingVertical: 4, minHeight: 48 },
  calDayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  calDayText: { fontSize: 15 },
  calDotsRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  calDot: { width: 5, height: 5, borderRadius: 2.5 },
  calSelectedSection: { marginTop: 20 },
  calSelectedTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  calNoAppts: { fontSize: 15, textAlign: "center", paddingVertical: 20 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
});
