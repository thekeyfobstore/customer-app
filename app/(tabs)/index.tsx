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

  // Helper to extract location from customer data
  const getCustomerLocation = useCallback((c: Customer): string | null => {
    // First check address city
    if (c.address?.city) return c.address.city.trim();
    // Then check route for location info (format: "CODE - Location")
    if (c.route) {
      const parts = c.route.split(" - ");
      if (parts.length > 1) return parts.slice(1).join(" - ").trim();
    }
    // Check company field for known areas
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
          return area.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }
      }
    }
    return null;
  }, []);

  // Helper to get primary vehicle info
  const getVehicleInfo = useCallback((c: Customer): string | null => {
    if (!c.vehicles || c.vehicles.length === 0) return null;
    const v = c.vehicles[0];
    const parts = [v.year, v.make, v.model].filter(Boolean);
    if (parts.length === 0) return null;
    const label = parts.join(" ");
    if (c.vehicles.length > 1) {
      return `${label} (+${c.vehicles.length - 1} more)`;
    }
    return label;
  }, []);

  const filtered = useMemo(() => {
    let result = customers;
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => (c.status || "none") === statusFilter);
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
  }, [customers, search, statusFilter]);

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
      // Sort by most recent activity (matching OpenPhone order)
      const aTime = a.lastActivityAt || lastMessageMap.get(a.id) || a.updatedAt || a.createdAt;
      const bTime = b.lastActivityAt || lastMessageMap.get(b.id) || b.updatedAt || b.createdAt;
      const timeDiff = bTime.localeCompare(aTime);
      if (timeDiff !== 0) return timeDiff;
      return a.firstName.localeCompare(b.firstName);
    }),
    [filtered, lastMessageMap]
  );

  const renderCustomer = useCallback(
    ({ item }: { item: Customer }) => {
      // Build display name with fallbacks
      const hasRealName = item.firstName.trim() || item.lastName.trim();
      let displayName = `${item.firstName} ${item.lastName}`.trim();
      if (!hasRealName) {
        displayName = item.company || formatPhone(item.phone) || "Unknown";
      }
      const initials = hasRealName
        ? getInitials(item.firstName, item.lastName)
        : displayName.charAt(0).toUpperCase() || "?";

      const vehicleInfo = getVehicleInfo(item);
      const location = getCustomerLocation(item);

      // Build OpenPhone deep link for messaging
      const phoneDigits = (item.phone || "").replace(/\D/g, "");
      const phoneFormatted = phoneDigits.startsWith("1") ? `+${phoneDigits}` : `+1${phoneDigits}`;

      return (
        <Pressable
          onPress={() => router.push(`/customer/${item.id}` as any)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: hasRealName ? colors.primary : colors.muted }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.cardContent}>
            {/* Row 1: Name + Status */}
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {displayName}
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

            {/* Row 2: Phone number (tappable for OpenPhone) */}
            {item.phone ? (
              <Pressable
                onPress={() => {
                  // Open OpenPhone message thread directly
                  Linking.openURL(`openphone://message?number=${encodeURIComponent(phoneFormatted)}`).catch(() => {
                    Linking.openURL(`sms:${phoneFormatted}`).catch(() => {
                      if (item.openPhoneContactId) {
                        Linking.openURL(`https://app.openphone.com/contacts/${item.openPhoneContactId}`).catch(() => {});
                      }
                    });
                  });
                }}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.phoneText, { color: colors.primary }]}>
                  {formatPhone(item.phone)}
                </Text>
              </Pressable>
            ) : null}

            {/* Row 3: Vehicle year, make, model */}
            {vehicleInfo ? (
              <View style={styles.infoRow}>
                <IconSymbol name="car.fill" size={11} color={colors.muted} />
                <Text style={[styles.infoText, { color: colors.muted }]} numberOfLines={1}>
                  {vehicleInfo}
                </Text>
              </View>
            ) : null}

            {/* Row 4: Location */}
            {location ? (
              <View style={styles.infoRow}>
                <IconSymbol name="mappin.circle.fill" size={11} color={colors.muted} />
                <Text style={[styles.infoText, { color: colors.muted }]} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardActions}>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </View>
        </Pressable>
      );
    },
    [colors, router, getVehicleInfo, getCustomerLocation]
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
        <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
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
            <IconSymbol name="xmark" size={14} color={colors.muted} />
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
    paddingTop: 6,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.37,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  cardContent: {
    flex: 1,
    gap: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  phoneText: {
    fontSize: 12,
    fontWeight: "500",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  infoText: {
    fontSize: 11,
    flex: 1,
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 9,
    fontWeight: "700",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
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
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minHeight: 30,
    justifyContent: "center" as const,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
});
