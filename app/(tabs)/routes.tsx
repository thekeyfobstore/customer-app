import { useState, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity, FlatList, StyleSheet, Alert, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { Appointment } from "@/lib/types";
import { formatAddress, haversineDistance, estimateDriveMinutes, optimizeRouteOrder, openInMaps } from "@/lib/geocoding";

type ViewMode = "today" | "upcoming";

export default function RoutesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { appointments, customers, dropInLocations } = useData();
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Get dates with appointments
  const upcomingDates = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const dates = new Set<string>();
    appointments
      .filter((a) => a.status === "scheduled" && a.date >= today)
      .forEach((a) => dates.add(a.date));
    return Array.from(dates).sort();
  }, [appointments]);

  // Get appointments for selected date
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === selectedDate && a.status === "scheduled")
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDate]);

  // Build route stops with coordinates
  const routeStops = useMemo(() => {
    return dayAppointments.map((apt) => {
      const customer = customers.find((c) => c.id === apt.customerId);
      const loc = apt.location;
      return {
        appointment: apt,
        customer,
        address: loc?.address || customer?.address || { street: "", city: "", state: "", zip: "" },
        latitude: loc?.latitude || undefined,
        longitude: loc?.longitude || undefined,
        label: customer ? `${customer.firstName} ${customer.lastName}` : "Unknown",
      };
    });
  }, [dayAppointments, customers]);

  // Optimized route
  const optimizedStops = useMemo(() => {
    return optimizeRouteOrder(routeStops);
  }, [routeStops]);

  // Calculate total distance and time
  const routeStats = useMemo(() => {
    let totalMiles = 0;
    let totalMinutes = 0;
    const stopsWithCoords = optimizedStops.filter((s) => s.latitude && s.longitude);

    for (let i = 1; i < stopsWithCoords.length; i++) {
      const prev = stopsWithCoords[i - 1];
      const curr = stopsWithCoords[i];
      const dist = haversineDistance(prev.latitude!, prev.longitude!, curr.latitude!, curr.longitude!);
      totalMiles += dist;
      totalMinutes += estimateDriveMinutes(dist);
    }

    // Add appointment durations
    const serviceMinutes = dayAppointments.reduce((sum, a) => sum + a.duration, 0);

    return {
      totalMiles: totalMiles.toFixed(1),
      driveMinutes: totalMinutes,
      serviceMinutes,
      totalMinutes: totalMinutes + serviceMinutes,
      stopsCount: dayAppointments.length,
    };
  }, [optimizedStops, dayAppointments]);

  const handleStartNavigation = () => {
    const stopsWithCoords = optimizedStops
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({ latitude: s.latitude!, longitude: s.longitude!, label: s.label }));

    if (stopsWithCoords.length === 0) {
      Alert.alert("No Coordinates", "None of your stops have GPS coordinates. Add addresses to your customers or appointments to enable navigation.");
      return;
    }

    openInMaps(stopsWithCoords);
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === tomorrow) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const renderStop = ({ item, index }: { item: typeof optimizedStops[0]; index: number }) => {
    const prevStop = index > 0 ? optimizedStops[index - 1] : null;
    let driveMins = 0;
    let driveMiles = 0;
    if (prevStop && prevStop.latitude && prevStop.longitude && item.latitude && item.longitude) {
      driveMiles = haversineDistance(prevStop.latitude, prevStop.longitude, item.latitude, item.longitude);
      driveMins = estimateDriveMinutes(driveMiles);
    }

    return (
      <View>
        {/* Drive segment */}
        {index > 0 && (driveMins > 0 || driveMiles > 0) && (
          <View style={styles.driveSegment}>
            <View style={[styles.driveLine, { backgroundColor: colors.border }]} />
            <View style={[styles.driveInfo, { backgroundColor: colors.surface }]}>
              <IconSymbol name="car.fill" size={12} color={colors.muted} />
              <Text style={[styles.driveText, { color: colors.muted }]}>
                {driveMiles.toFixed(1)} mi / ~{driveMins} min
              </Text>
            </View>
            <View style={[styles.driveLine, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* Stop card */}
        <TouchableOpacity
          style={[styles.stopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push({ pathname: "/appointment/[id]" as any, params: { id: item.appointment.id } })}
          activeOpacity={0.7}
        >
          <View style={[styles.stopNumber, { backgroundColor: colors.primary }]}>
            <Text style={styles.stopNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.stopInfo}>
            <View style={styles.stopHeader}>
              <Text style={[styles.stopName, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.stopTime, { color: colors.primary }]}>{formatTime(item.appointment.time)}</Text>
            </View>
            <Text style={[styles.stopService, { color: colors.muted }]}>{item.appointment.service}</Text>
            <Text style={[styles.stopAddress, { color: colors.muted }]} numberOfLines={1}>
              {formatAddress(item.address)}
            </Text>
            <View style={styles.stopMeta}>
              <Text style={[styles.stopDuration, { color: colors.muted }]}>
                {item.appointment.duration} min
              </Text>
              {!item.latitude && (
                <Text style={[styles.noCoords, { color: colors.warning }]}>No GPS</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Routes</Text>
          <TouchableOpacity
            style={[styles.dropInBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/drop-in" as any)}
          >
            <IconSymbol name="location.fill" size={14} color={colors.primary} />
            <Text style={[styles.dropInBtnText, { color: colors.primary }]}>Drop-ins ({dropInLocations.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Date selector */}
        <View style={styles.dateSelector}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={upcomingDates}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.dateList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.dateChip, selectedDate === item && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedDate(item)}
              >
                <Text style={[styles.dateChipText, { color: selectedDate === item ? "#fff" : colors.foreground }]}>
                  {formatDateDisplay(item)}
                </Text>
                <Text style={[styles.dateChipCount, { color: selectedDate === item ? "#fff" + "99" : colors.muted }]}>
                  {appointments.filter((a) => a.date === item && a.status === "scheduled").length} stops
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Route stats */}
        {dayAppointments.length > 0 && (
          <View style={[styles.statsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{routeStats.stopsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Stops</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{routeStats.totalMiles}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Miles</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{routeStats.driveMinutes}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Drive min</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{routeStats.serviceMinutes}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Work min</Text>
            </View>
          </View>
        )}

        {/* Route content */}
        {dayAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="map.fill" size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Stops Scheduled</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {upcomingDates.length === 0
                ? "Book appointments to see your routes here"
                : "Select a date above to view that day's route"}
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={optimizedStops}
              renderItem={renderStop}
              keyExtractor={(item) => item.appointment.id}
              contentContainerStyle={styles.routeList}
              showsVerticalScrollIndicator={false}
            />

            {/* Start navigation button */}
            <View style={[styles.navButtonContainer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.navButton, { backgroundColor: colors.primary }]}
                onPress={handleStartNavigation}
              >
                <IconSymbol name="arrow.triangle.turn.up.right.diamond.fill" size={20} color="#fff" />
                <Text style={styles.navButtonText}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: "700" },
  dropInBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  dropInBtnText: { fontSize: 12, fontWeight: "600" },
  dateSelector: { paddingVertical: 10 },
  dateList: { paddingHorizontal: 16, gap: 8 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: "transparent" },
  dateChipText: { fontSize: 14, fontWeight: "600" },
  dateChipCount: { fontSize: 11, marginTop: 2 },
  statsBar: { flexDirection: "row", marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },
  routeList: { padding: 16, paddingBottom: 100 },
  driveSegment: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 20 },
  driveLine: { flex: 1, height: 1 },
  driveInfo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  driveText: { fontSize: 11 },
  stopCard: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  stopNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stopNumberText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stopInfo: { flex: 1 },
  stopHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stopName: { fontSize: 15, fontWeight: "600", flex: 1 },
  stopTime: { fontSize: 14, fontWeight: "600" },
  stopService: { fontSize: 13, marginTop: 2 },
  stopAddress: { fontSize: 12, marginTop: 2 },
  stopMeta: { flexDirection: "row", gap: 10, marginTop: 4 },
  stopDuration: { fontSize: 11 },
  noCoords: { fontSize: 11, fontWeight: "600" },
  navButtonContainer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5 },
  navButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  navButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: "center", marginTop: 4, paddingHorizontal: 40 },
});
