import { useState, useMemo } from "react";
import { Text, View, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { FollowUpType } from "@/lib/types";
import { generateId } from "@/lib/helpers";
import { inferArea } from "@/lib/geocoding";

export default function AddFollowUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customers, addFollowUp } = useData();

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [type, setType] = useState<FollowUpType>("new-lead");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, search]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.address && !area) {
      setArea(inferArea(cust.address));
    }
  };

  const handleSave = () => {
    if (!selectedCustomerId) {
      Alert.alert("Error", "Please select a customer");
      return;
    }
    if (!area.trim()) {
      Alert.alert("Error", "Please enter an area/zone");
      return;
    }

    const now = new Date().toISOString();
    addFollowUp({
      id: generateId(),
      customerId: selectedCustomerId,
      type,
      status: "pending",
      area: area.trim(),
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
    });
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Add Follow-up</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {/* Type selector */}
          <Text style={[styles.label, { color: colors.muted }]}>Type</Text>
          <View style={styles.typeRow}>
            {([{ key: "new-lead", label: "New Lead" }, { key: "repeat-customer", label: "Repeat Customer" }] as const).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, { borderColor: colors.border }, type === t.key && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                onPress={() => setType(t.key)}
              >
                <Text style={[styles.typeText, { color: type === t.key ? colors.primary : colors.muted }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Customer picker */}
          <Text style={[styles.label, { color: colors.muted }]}>Customer</Text>
          {selectedCustomer ? (
            <View style={[styles.selectedCustomer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.selectedName, { color: colors.foreground }]}>
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </Text>
              <TouchableOpacity onPress={() => setSelectedCustomerId("")}>
                <IconSymbol name="xmark" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="magnifyingglass" size={14} color={colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder="Search customers..."
                  placeholderTextColor={colors.muted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="done"
                />
              </View>
              <FlatList
                data={filteredCustomers.slice(0, 5)}
                keyExtractor={(item) => item.id}
                style={styles.customerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.customerItem, { borderColor: colors.border }]}
                    onPress={() => handleSelectCustomer(item.id)}
                  >
                    <Text style={[styles.customerItemName, { color: colors.foreground }]}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={[styles.customerItemPhone, { color: colors.muted }]}>{item.phone}</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          {/* Area */}
          <Text style={[styles.label, { color: colors.muted }]}>Area / Zone</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder="e.g., Downtown, North Side, Westfield"
            placeholderTextColor={colors.muted}
            value={area}
            onChangeText={setArea}
            returnKeyType="done"
          />

          {/* Notes */}
          <Text style={[styles.label, { color: colors.muted }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder="What do they need? Any details..."
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 17, fontWeight: "600" },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  form: { padding: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 16 },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  typeText: { fontSize: 14, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14 },
  customerList: { maxHeight: 180 },
  customerItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 0.5 },
  customerItemName: { fontSize: 15, fontWeight: "500" },
  customerItemPhone: { fontSize: 13, marginTop: 2 },
  selectedCustomer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, borderWidth: 1 },
  selectedName: { fontSize: 15, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textArea: { height: 80, paddingTop: 10 },
});
