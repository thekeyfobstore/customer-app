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
import type { Customer } from "@/lib/types";

export default function CustomersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customers, loading } = useData();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [filtered]
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
            <Text style={[styles.name, { color: colors.foreground }]}>
              {item.firstName} {item.lastName}
            </Text>
            {item.phone ? (
              <Text style={[styles.detail, { color: colors.muted }]}>
                {formatPhone(item.phone)}
              </Text>
            ) : null}
            {item.company ? (
              <Text style={[styles.detail, { color: colors.muted }]}>{item.company}</Text>
            ) : null}
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
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
          placeholder="Search customers..."
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
});
