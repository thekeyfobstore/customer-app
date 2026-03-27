import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { getInitials, formatPhone } from "@/lib/helpers";
import type { Customer, CustomerStatus } from "@/lib/types";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_COLORS, ROUTE_CODES, ROUTE_LABELS } from "@/lib/types";
import { Linking, ScrollView } from "react-native";

export default function CustomersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customers, messages, loading } = useData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [routeFilter, setRouteFilter] = useState<string>("all");

  // Extract unique areas from customer company fields and addresses
  const areas = useMemo(() => {
    const areaSet = new Set<string>();
    for (const c of customers) {
      // Extract area from address
      if (c.address?.city) areaSet.add(c.address.city.trim());
      if (c.address?.street) {
        // Check for known Nova Scotia areas in address
        const addr = c.address.street.toLowerCase();
        const knownAreas = ["pictou", "bridgewater", "halifax", "dartmouth", "truro", "sydney",
          "antigonish", "new glasgow", "amherst", "yarmouth", "kentville", "wolfville",
          "windsor", "digby", "lunenburg", "mahone bay", "chester", "shelburne",
          "liverpool", "middleton", "berwick", "port hawkesbury", "glace bay",
          "eskasoni", "easkasoni", "baddeck", "inverness", "cheticamp", "canso",
          "guysborough", "springhill", "parrsboro", "tatamagouche", "westville",
          "stellarton", "moncton", "fredericton", "saint john", "miramichi",
          "bathurst", "campbellton", "sussex", "sackville", "oromocto",
          "lower sackville", "bedford", "cole harbour", "eastern passage"];
        for (const area of knownAreas) {
          if (addr.includes(area)) {
            areaSet.add(area.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
          }
        }
      }
      // Extract area from company field (your format: "Name Year Make Model Location")
      if (c.company) {
        const companyLower = c.company.toLowerCase();
        const knownAreas = ["pictou", "bridgewater", "halifax", "dartmouth", "truro", "sydney",
          "antigonish", "new glasgow", "amherst", "yarmouth", "kentville", "wolfville",
          "windsor", "digby", "lunenburg", "mahone bay", "chester", "shelburne",
          "liverpool", "middleton", "berwick", "port hawkesbury", "glace bay",
          "eskasoni", "easkasoni", "baddeck", "inverness", "cheticamp", "canso",
          "guysborough", "springhill", "parrsboro", "tatamagouche", "westville",
          "stellarton", "moncton", "fredericton", "saint john", "miramichi",
          "bathurst", "campbellton", "sussex", "sackville", "oromocto",
          "lower sackville", "bedford", "cole harbour", "eastern passage"];
        for (const area of knownAreas) {
          if (companyLower.includes(area)) {
            areaSet.add(area.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
          }
        }
      }
    }
    return Array.from(areaSet).sort();
  }, [customers]);

  // Helper to check if a customer belongs to an area
  const customerInArea = useCallback((c: Customer, area: string): boolean => {
    const areaLower = area.toLowerCase();
    if (c.address?.city?.toLowerCase().includes(areaLower)) return true;
    if (c.address?.street?.toLowerCase().includes(areaLower)) return true;
    if (c.company?.toLowerCase().includes(areaLower)) return true;
    return false;
  }, []);

  const filtered = useMemo(() => {
    let result = customers;
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => (c.status || "none") === statusFilter);
    }
    // Area filter
    if (areaFilter !== "all") {
      result = result.filter((c) => customerInArea(c, areaFilter));
    }
    // Route filter
    if (routeFilter !== "all") {
      result = result.filter((c) => {
        if (!c.route) return false;
        const routeCode = c.route.split(" ")[0]?.toUpperCase() || c.route.toUpperCase();
        return routeCode === routeFilter || c.route.toUpperCase().startsWith(routeFilter);
      });
    }
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter((c) => {
      // Search name, phone, company, email
      if (
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      ) {
        return true;
      }
      // Search vehicle fields
      if (c.vehicles && c.vehicles.length > 0) {
        return c.vehicles.some(
          (v) =>
            v.year.toLowerCase().includes(q) ||
            v.make.toLowerCase().includes(q) ||
            v.model.toLowerCase().includes(q) ||
            v.vin.toLowerCase().includes(q) ||
            (v.keyCode || "").toLowerCase().includes(q) ||
            (v.dealerComparison || "").toLowerCase().includes(q) ||
            (v.partNumber || "").toLowerCase().includes(q) ||
            `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q) ||
            `${v.make} ${v.model}`.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [customers, search, statusFilter, areaFilter, routeFilter, customerInArea]);

  // Helper to find matching vehicle for search highlight
  const getMatchingVehicle = useCallback(
    (customer: Customer): string | null => {
      if (!search.trim() || !customer.vehicles?.length) return null;
      const q = search.toLowerCase();
      const match = customer.vehicles.find(
        (v) =>
          v.year.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.vin.toLowerCase().includes(q) ||
          (v.keyCode || "").toLowerCase().includes(q) ||
          (v.dealerComparison || "").toLowerCase().includes(q) ||
          (v.partNumber || "").toLowerCase().includes(q) ||
          `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q) ||
          `${v.make} ${v.model}`.toLowerCase().includes(q)
      );
      if (!match) return null;
      const parts = [match.year, match.make, match.model].filter(Boolean);
      const label = parts.join(" ");
      if (match.vin && match.vin.toLowerCase().includes(q)) {
        return `${label} (VIN: ...${match.vin.slice(-6)})`;
      }
      if (match.keyCode && match.keyCode.toLowerCase().includes(q)) {
        return `${label} (Key: ${match.keyCode})`;
      }
      if (match.partNumber && match.partNumber.toLowerCase().includes(q)) {
        return `${label} (Part: ${match.partNumber})`;
      }
      return label;
    },
    [search]
  );

  // Build a map of customerId -> most recent message timestamp
  const lastMessageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of messages) {
      const existing = map.get(msg.customerId);
      if (!existing || msg.createdAt > existing) {
        map.set(msg.customerId, msg.createdAt);
      }
    }
    return map;
  }, [messages]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      // Sort by most recent message first (like phone system)
      const aTime = lastMessageMap.get(a.id) || a.updatedAt || a.createdAt;
      const bTime = lastMessageMap.get(b.id) || b.updatedAt || b.createdAt;
      // Most recent first
      const timeDiff = bTime.localeCompare(aTime);
      if (timeDiff !== 0) return timeDiff;
      // Fallback: alphabetical by first name
      return a.firstName.localeCompare(b.firstName);
    }),
    [filtered, lastMessageMap]
  );

  const renderCustomer = useCallback(
    ({ item }: { item: Customer }) => {
      const initials = getInitials(item.firstName, item.lastName);
      return (
        <Pressable
          onPress={() => router.push(`/customer/${item.id}` as any)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {item.firstName} {item.lastName}
              </Text>
              {item.status && item.status !== "none" ? (
                <View style={[
                  styles.statusChip,
                  { backgroundColor: CUSTOMER_STATUS_COLORS[item.status].bg },
                ]}>
                  <Text style={[
                    styles.statusChipText,
                    { color: CUSTOMER_STATUS_COLORS[item.status].text },
                  ]}>{CUSTOMER_STATUS_LABELS[item.status]}</Text>
                </View>
              ) : null}
            </View>
            {item.phone ? (
              <Text style={[styles.detail, { color: colors.muted }]}>
                {formatPhone(item.phone)}
              </Text>
            ) : null}
            {item.company ? (
              <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={1}>{item.company}</Text>
            ) : null}
            {item.route ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <IconSymbol name="arrow.triangle.turn.up.right.diamond.fill" size={12} color="#065F46" />
                <Text style={{ color: "#065F46", fontSize: 12, fontWeight: "600" }}>{item.route}</Text>
              </View>
            ) : null}
            {(() => {
              const matchedVehicle = getMatchingVehicle(item);
              if (matchedVehicle) {
                return (
                  <View style={styles.vehicleMatchRow}>
                    <IconSymbol name="car.fill" size={13} color={colors.primary} />
                    <Text style={[styles.vehicleMatchText, { color: colors.primary }]}>
                      {matchedVehicle}
                    </Text>
                  </View>
                );
              }
              if (item.vehicles && item.vehicles.length > 0) {
                return (
                  <Text style={[styles.detail, { color: colors.muted }]}>
                    {item.vehicles.length} vehicle{item.vehicles.length !== 1 ? 's' : ''}
                  </Text>
                );
              }
              return null;
            })()}
          </View>
          <View style={styles.cardActions}>
            {item.openPhoneContactId ? (
              <Pressable
                onPress={() => {
                  const url = `https://app.openphone.com/contacts/${item.openPhoneContactId}`;
                  Linking.openURL(url).catch(() => {});
                }}
                style={({ pressed }) => [
                  styles.openPhoneIcon,
                  { backgroundColor: colors.primary + "15" },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <IconSymbol name="message.fill" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
            <IconSymbol name="chevron.right" size={18} color={colors.muted} />
          </View>
        </Pressable>
      );
    },
    [colors, router]
  );

  const keyExtractor = useCallback((item: Customer) => item.id, []);

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
        <Text style={[styles.title, { color: colors.foreground }]}>Customers</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {customers.length} {customers.length === 1 ? "contact" : "contacts"}
        </Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name, phone, or vehicle..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="done"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <IconSymbol name="xmark" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        <Pressable
          onPress={() => setStatusFilter("all")}
          style={({ pressed }) => [
            styles.chip,
            statusFilter === "all"
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[
            styles.chipText,
            { color: statusFilter === "all" ? "#FFFFFF" : colors.foreground },
          ]}>All ({customers.length})</Text>
        </Pressable>
        {(["need-price-part", "quote-sent", "book-later", "booked-needs-confirmation", "confirmed", "rejected", "none"] as CustomerStatus[]).map((s) => {
          const count = customers.filter((c) => (c.status || "none") === s).length;
          if (count === 0) return null;
          const sc = CUSTOMER_STATUS_COLORS[s];
          const isActive = statusFilter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setStatusFilter(isActive ? "all" : s)}
              style={({ pressed }) => [
                styles.chip,
                isActive
                  ? { backgroundColor: sc.bg, borderColor: sc.text, borderWidth: 1.5 }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[
                styles.chipText,
                { color: isActive ? sc.text : colors.muted },
                isActive && { fontWeight: "700" },
              ]}>{CUSTOMER_STATUS_LABELS[s]} ({count})</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Route Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        <Pressable
          onPress={() => setRouteFilter("all")}
          style={({ pressed }) => [
            styles.chip,
            routeFilter === "all"
              ? { backgroundColor: "#D1FAE5", borderColor: "#065F46", borderWidth: 1.5 }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[
            styles.chipText,
            { color: routeFilter === "all" ? "#065F46" : colors.muted },
            routeFilter === "all" && { fontWeight: "700" },
          ]}>All Routes</Text>
        </Pressable>
        {ROUTE_CODES.map((code) => {
          const count = customers.filter((c) => {
            if (!c.route) return false;
            const rc = c.route.split(" ")[0]?.toUpperCase() || c.route.toUpperCase();
            return rc === code || c.route.toUpperCase().startsWith(code);
          }).length;
          const isActive = routeFilter === code;
          return (
            <Pressable
              key={code}
              onPress={() => setRouteFilter(isActive ? "all" : code)}
              style={({ pressed }) => [
                styles.chip,
                isActive
                  ? { backgroundColor: "#D1FAE5", borderColor: "#065F46", borderWidth: 1.5 }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[
                styles.chipText,
                { color: isActive ? "#065F46" : colors.muted },
                isActive && { fontWeight: "700" },
              ]}>{code} ({count})</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Area Filter Chips */}
      {areas.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          <Pressable
            onPress={() => setAreaFilter("all")}
            style={({ pressed }) => [
              styles.chip,
              areaFilter === "all"
                ? { backgroundColor: colors.primary + "20", borderColor: colors.primary, borderWidth: 1.5 }
                : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[
              styles.chipText,
              { color: areaFilter === "all" ? colors.primary : colors.muted },
              areaFilter === "all" && { fontWeight: "700" },
            ]}>All Areas</Text>
          </Pressable>
          {areas.map((area) => {
            const count = customers.filter((c) => customerInArea(c, area)).length;
            const isActive = areaFilter === area;
            return (
              <Pressable
                key={area}
                onPress={() => setAreaFilter(isActive ? "all" : area)}
                style={({ pressed }) => [
                  styles.chip,
                  isActive
                    ? { backgroundColor: colors.primary + "20", borderColor: colors.primary, borderWidth: 1.5 }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[
                  styles.chipText,
                  { color: isActive ? colors.primary : colors.muted },
                  isActive && { fontWeight: "700" },
                ]}>{area} ({count})</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {sorted.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search ? "No results found" : "No customers yet"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {search
              ? "Try a different search term"
              : "Import contacts from OpenPhone or add customers manually"}
          </Text>
          {!search && (
            <View style={styles.emptyActions}>
              <Pressable
                onPress={() => router.push("/import-contacts" as any)}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
              >
                <IconSymbol name="arrow.down.doc.fill" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Import from OpenPhone</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/customer/add" as any)}
                style={({ pressed }) => [
                  styles.emptyButtonOutline,
                  { borderColor: colors.primary },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name="plus" size={18} color={colors.primary} />
                <Text style={[styles.emptyButtonOutlineText, { color: colors.primary }]}>
                  Add Manually
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={sorted}
          renderItem={renderCustomer}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {sorted.length > 0 && (
        <View style={styles.fabContainer}>
          <Pressable
            onPress={() => router.push("/import-contacts" as any)}
            style={({ pressed }) => [
              styles.fabSecondary,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <IconSymbol name="arrow.down.doc.fill" size={22} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/customer/add" as any)}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <IconSymbol name="plus" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
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
  cardContent: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
  },
  detail: {
    fontSize: 14,
  },
  vehicleMatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  vehicleMatchText: {
    fontSize: 13,
    fontWeight: "500",
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
  emptyActions: {
    marginTop: 20,
    gap: 12,
    width: "100%",
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyButtonOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  emptyButtonOutlineText: {
    fontSize: 16,
    fontWeight: "600",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  fab: {
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
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterChips: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  openPhoneIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
