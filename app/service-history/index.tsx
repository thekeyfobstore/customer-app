import { useMemo } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { formatDate } from "@/lib/helpers";
import type { ServiceRecord } from "@/lib/types";

export default function ServiceHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { vehicleId, customerId } = useLocalSearchParams<{
    vehicleId?: string;
    customerId?: string;
  }>();
  const { getServiceRecordsForVehicle, getServiceRecordsForCustomer, getCustomerById } = useData();

  const customer = customerId ? getCustomerById(customerId) : undefined;
  const vehicle = useMemo(() => {
    if (!vehicleId || !customer?.vehicles) return undefined;
    return customer.vehicles.find((v) => v.id === vehicleId);
  }, [vehicleId, customer]);

  const records = useMemo(() => {
    if (vehicleId) return getServiceRecordsForVehicle(vehicleId);
    if (customerId) return getServiceRecordsForCustomer(customerId);
    return [];
  }, [vehicleId, customerId, getServiceRecordsForVehicle, getServiceRecordsForCustomer]);

  const title = vehicle
    ? `${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}`
    : customer
    ? `${customer.firstName} ${customer.lastName}`
    : "Service History";

  const renderRecord = ({ item }: { item: ServiceRecord }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
          <IconSymbol name="tag.fill" size={16} color={colors.primary} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.serviceName, { color: colors.foreground }]}>{item.service}</Text>
          <Text style={[styles.serviceDate, { color: colors.muted }]}>{formatDate(item.date)}</Text>
        </View>
        <Text style={[styles.serviceCost, { color: colors.foreground }]}>
          ${(item.cost / 100).toFixed(2)}
        </Text>
      </View>
      {item.description ? (
        <Text style={[styles.serviceDesc, { color: colors.muted }]}>{item.description}</Text>
      ) : null}
    </View>
  );

  const totalCost = useMemo(
    () => records.reduce((sum, r) => sum + r.cost, 0),
    [records]
  );

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}>
          <IconSymbol name="arrow.left" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Service History</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Vehicle/Customer Info */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={styles.infoStats}>
          <View style={styles.infoStat}>
            <Text style={[styles.infoStatValue, { color: colors.primary }]}>{records.length}</Text>
            <Text style={[styles.infoStatLabel, { color: colors.muted }]}>Services</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoStat}>
            <Text style={[styles.infoStatValue, { color: colors.primary }]}>
              ${(totalCost / 100).toFixed(2)}
            </Text>
            <Text style={[styles.infoStatLabel, { color: colors.muted }]}>Total Spent</Text>
          </View>
        </View>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="clock.fill" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Service History</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Service records will appear here after completing appointments and charging through Clover.
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  navButton: { padding: 8 },
  navTitle: { fontSize: 17, fontWeight: "600" },
  infoCard: { marginHorizontal: 20, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  infoTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  infoStats: { flexDirection: "row", alignItems: "center" },
  infoStat: { flex: 1, alignItems: "center" },
  infoStatValue: { fontSize: 22, fontWeight: "700" },
  infoStatLabel: { fontSize: 13, marginTop: 2 },
  infoDivider: { width: 1, height: 36 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardHeaderText: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: "600" },
  serviceDate: { fontSize: 13, marginTop: 2 },
  serviceCost: { fontSize: 16, fontWeight: "700" },
  serviceDesc: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "600", marginTop: 8 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
