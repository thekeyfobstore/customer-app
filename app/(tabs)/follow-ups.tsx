import { useState, useMemo } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { FollowUp, FollowUpStatus } from "@/lib/types";

type ViewMode = "by-area" | "all";
type FilterType = "all" | "new-lead" | "repeat-customer";

export default function FollowUpsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { followUps, customers, getFollowUpsByArea, updateFollowUp, deleteFollowUp } = useData();
  const [viewMode, setViewMode] = useState<ViewMode>("by-area");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const activeFollowUps = useMemo(() => {
    let list = followUps.filter((f) => f.status === "pending" || f.status === "contacted");
    if (filterType !== "all") list = list.filter((f) => f.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => {
        const cust = customers.find((c) => c.id === f.customerId);
        return (
          f.area.toLowerCase().includes(q) ||
          f.notes.toLowerCase().includes(q) ||
          (cust && `${cust.firstName} ${cust.lastName}`.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [followUps, filterType, search, customers]);

  const groupedByArea = useMemo(() => {
    const grouped: Record<string, FollowUp[]> = {};
    for (const f of activeFollowUps) {
      const area = f.area || "Unknown Area";
      if (!grouped[area]) grouped[area] = [];
      grouped[area].push(f);
    }
    return Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  }, [activeFollowUps]);

  const bookedCount = followUps.filter((f) => f.status === "booked").length;
  const pendingCount = followUps.filter((f) => f.status === "pending").length;

  const getCustomerName = (customerId: string) => {
    const c = customers.find((c) => c.id === customerId);
    return c ? `${c.firstName} ${c.lastName}` : "Unknown";
  };

  const handleStatusChange = (followUp: FollowUp, newStatus: FollowUpStatus) => {
    updateFollowUp({ ...followUp, status: newStatus, updatedAt: new Date().toISOString() });
  };

  const handleBookArea = (area: string, areaFollowUps: FollowUp[]) => {
    router.push({
      pathname: "/batch-book" as any,
      params: { area, followUpIds: areaFollowUps.map((f) => f.id).join(",") },
    });
  };

  const renderFollowUpCard = (item: FollowUp) => {
    const customerName = getCustomerName(item.customerId);
    const isNewLead = item.type === "new-lead";

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: "/customer/[id]" as any, params: { id: item.customerId } })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.typeBadge, { backgroundColor: isNewLead ? colors.primary + "20" : colors.success + "20" }]}>
              <Text style={[styles.typeBadgeText, { color: isNewLead ? colors.primary : colors.success }]}>
                {isNewLead ? "New Lead" : "Repeat"}
              </Text>
            </View>
            <Text style={[styles.customerName, { color: colors.foreground }]}>{customerName}</Text>
          </View>
          <View style={styles.cardActions}>
            {item.status === "pending" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
                onPress={() => handleStatusChange(item, "contacted")}
              >
                <IconSymbol name="phone.fill" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.success + "15" }]}
              onPress={() => handleStatusChange(item, "booked")}
            >
              <IconSymbol name="calendar" size={14} color={colors.success} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.error + "15" }]}
              onPress={() => {
                Alert.alert("Remove Follow-up", "Mark as declined?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Decline", style: "destructive", onPress: () => handleStatusChange(item, "declined") },
                  { text: "Delete", style: "destructive", onPress: () => deleteFollowUp(item.id) },
                ]);
              }}
            >
              <IconSymbol name="xmark" size={14} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        {item.notes ? (
          <Text style={[styles.notes, { color: colors.muted }]} numberOfLines={2}>{item.notes}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={[styles.areaTag, { color: colors.muted }]}>
            <IconSymbol name="mappin" size={11} color={colors.muted} /> {item.area}
          </Text>
          <Text style={[styles.statusText, { color: item.status === "contacted" ? colors.warning : colors.muted }]}>
            {item.status === "contacted" ? "Contacted" : "Pending"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAreaGroup = ({ item }: { item: [string, FollowUp[]] }) => {
    const [area, areaFollowUps] = item;
    return (
      <View style={styles.areaGroup}>
        <View style={styles.areaHeader}>
          <View style={styles.areaHeaderLeft}>
            <IconSymbol name="mappin" size={16} color={colors.primary} />
            <Text style={[styles.areaTitle, { color: colors.foreground }]}>{area}</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.countBadgeText, { color: colors.primary }]}>{areaFollowUps.length}</Text>
            </View>
          </View>
          {areaFollowUps.length >= 2 && (
            <TouchableOpacity
              style={[styles.scheduleBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleBookArea(area, areaFollowUps)}
            >
              <Text style={[styles.scheduleBtnText, { color: "#fff" }]}>Schedule Route</Text>
            </TouchableOpacity>
          )}
        </View>
        {areaFollowUps.map(renderFollowUpCard)}
      </View>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.title, { color: colors.foreground }]}>Follow-ups</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/follow-up/add" as any)}
            >
              <IconSymbol name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.warning + "15" }]}>
              <Text style={[styles.statNum, { color: colors.warning }]}>{pendingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Pending</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.success + "15" }]}>
              <Text style={[styles.statNum, { color: colors.success }]}>{bookedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Booked</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{groupedByArea.length}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Areas</Text>
            </View>
          </View>

          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search follow-ups..."
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="done"
            />
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              {(["all", "new-lead", "repeat-customer"] as FilterType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, filterType === type && { backgroundColor: colors.primary + "20" }]}
                  onPress={() => setFilterType(type)}
                >
                  <Text style={[styles.filterText, { color: filterType === type ? colors.primary : colors.muted }]}>
                    {type === "all" ? "All" : type === "new-lead" ? "New Leads" : "Repeat"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.viewToggle}>
              {(["by-area", "all"] as ViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.viewBtn, viewMode === mode && { backgroundColor: colors.primary + "20" }]}
                  onPress={() => setViewMode(mode)}
                >
                  <IconSymbol
                    name={mode === "by-area" ? "map.fill" : "list.bullet"}
                    size={14}
                    color={viewMode === mode ? colors.primary : colors.muted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Content */}
        {activeFollowUps.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="list.bullet.clipboard" size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Follow-ups</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Add follow-ups from customer profiles or tap + above
            </Text>
          </View>
        ) : viewMode === "by-area" ? (
          <FlatList
            data={groupedByArea}
            renderItem={renderAreaGroup}
            keyExtractor={([area]) => area}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={activeFollowUps}
            renderItem={({ item }) => renderFollowUpCard(item)}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "700" },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filterGroup: { flexDirection: "row", gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  filterText: { fontSize: 12, fontWeight: "600" },
  viewToggle: { flexDirection: "row", gap: 4 },
  viewBtn: { width: 32, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 100 },
  areaGroup: { marginBottom: 20 },
  areaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  areaHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  areaTitle: { fontSize: 16, fontWeight: "700" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: "700" },
  scheduleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  scheduleBtnText: { fontSize: 12, fontWeight: "600" },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: "700" },
  customerName: { fontSize: 15, fontWeight: "600", flex: 1 },
  cardActions: { flexDirection: "row", gap: 6 },
  actionBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  notes: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  areaTag: { fontSize: 12 },
  statusText: { fontSize: 12, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: "center", marginTop: 4, paddingHorizontal: 40 },
});
