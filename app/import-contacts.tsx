import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { loadApiKey, saveApiKey } from "@/lib/storage";
import {
  fetchOpenPhoneContacts,
  fetchOpenPhoneMessages,
  fetchOpenPhoneNumbers,
  convertToCustomers,
  convertToMessages,
} from "@/lib/openphone";
import type { OpenPhoneContact } from "@/lib/types";

export default function ImportContactsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { importCustomers, addMessages, customers } = useData();

  const [apiKey, setApiKey] = useState("");
  const [contacts, setContacts] = useState<OpenPhoneContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"key" | "preview" | "done">("key");
  const [importMessages, setImportMessages] = useState(true);
  const [error, setError] = useState("");

  const loadSavedKey = useCallback(async () => {
    const saved = await loadApiKey();
    if (saved) setApiKey(saved);
  }, []);

  useState(() => {
    loadSavedKey();
  });

  const handleFetch = async () => {
    if (!apiKey.trim()) {
      Alert.alert("API Key Required", "Please enter your OpenPhone API key.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await saveApiKey(apiKey.trim());
      const fetchedContacts = await fetchOpenPhoneContacts(apiKey.trim());

      if (fetchedContacts.length === 0) {
        setError("No contacts found. Please check your API key and try again.");
        setLoading(false);
        return;
      }

      // Mark contacts that already exist as unselected
      const existingPhones = new Set(customers.map((c) => c.phone));
      const markedContacts = fetchedContacts.map((c) => ({
        ...c,
        selected: !existingPhones.has(c.phoneNumbers?.[0]?.number || ""),
      }));

      setContacts(markedContacts);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Failed to fetch contacts. Please check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleAll = () => {
    const allSelected = contacts.every((c) => c.selected);
    setContacts((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const handleImport = async () => {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) {
      Alert.alert("No Selection", "Please select at least one contact to import.");
      return;
    }

    setLoading(true);

    try {
      const newCustomers = convertToCustomers(selected);
      importCustomers(newCustomers);

      // Optionally import messages
      if (importMessages) {
        try {
          const phoneNumbers = await fetchOpenPhoneNumbers(apiKey.trim());
          if (phoneNumbers.length > 0) {
            const phoneNumberId = phoneNumbers[0]?.id;
            if (phoneNumberId) {
              const rawMessages = await fetchOpenPhoneMessages(apiKey.trim(), phoneNumberId);
              const customerPhoneMap = new Map<string, string>();
              newCustomers.forEach((c) => {
                if (c.phone) customerPhoneMap.set(c.phone, c.id);
              });
              const msgs = convertToMessages(rawMessages, customerPhoneMap);
              if (msgs.length > 0) {
                addMessages(msgs);
              }
            }
          }
        } catch {
          // Messages import is optional, don't fail the whole import
        }
      }

      setStep("done");
    } catch (err: any) {
      Alert.alert("Import Error", err.message || "Failed to import contacts.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = contacts.filter((c) => c.selected).length;

  const renderContact = useCallback(
    ({ item }: { item: OpenPhoneContact }) => (
      <Pressable
        onPress={() => toggleContact(item.id)}
        style={({ pressed }) => [
          styles.contactCard,
          { backgroundColor: colors.surface, borderColor: item.selected ? colors.primary : colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: item.selected ? colors.primary : "transparent",
              borderColor: item.selected ? colors.primary : colors.muted,
            },
          ]}
        >
          {item.selected && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
        </View>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.foreground }]}>
            {item.firstName} {item.lastName}
          </Text>
          {item.phoneNumbers?.[0]?.number ? (
            <Text style={[styles.contactDetail, { color: colors.muted }]}>
              {item.phoneNumbers[0].number}
            </Text>
          ) : null}
          {item.company ? (
            <Text style={[styles.contactDetail, { color: colors.muted }]}>{item.company}</Text>
          ) : null}
          {item.customFields?.vehicle ? (
            <Text style={[styles.contactDetail, { color: colors.primary }]}>
              {item.customFields.vehicle}
            </Text>
          ) : null}
        </View>
      </Pressable>
    ),
    [colors]
  );

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.cancelText, { color: colors.primary }]}>
            {step === "done" ? "Done" : "Cancel"}
          </Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Import from OpenPhone</Text>
        <View style={{ width: 60 }} />
      </View>

      {step === "key" && (
        <View style={styles.keyContainer}>
          <View style={styles.keyHeader}>
            <IconSymbol name="key.fill" size={40} color={colors.primary} />
            <Text style={[styles.keyTitle, { color: colors.foreground }]}>
              Connect OpenPhone
            </Text>
            <Text style={[styles.keyDescription, { color: colors.muted }]}>
              Enter your OpenPhone API key to import your contacts and message history.
            </Text>
          </View>

          <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="OpenPhone API Key"
              placeholderTextColor={colors.muted}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleFetch}
            />
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "15" }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.helpText, { color: colors.muted }]}>
            Find your API key at Settings → API Keys in your OpenPhone dashboard.
          </Text>

          <Pressable
            onPress={handleFetch}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              loading && { opacity: 0.6 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Fetch Contacts</Text>
            )}
          </Pressable>
        </View>
      )}

      {step === "preview" && (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderLeft}>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>
                {contacts.length} contacts found
              </Text>
              <Text style={[styles.previewSubtitle, { color: colors.muted }]}>
                {selectedCount} selected
              </Text>
            </View>
            <Pressable
              onPress={toggleAll}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.toggleAllText, { color: colors.primary }]}>
                {contacts.every((c) => c.selected) ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.optionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.optionContent}>
              <IconSymbol name="message.fill" size={18} color={colors.primary} />
              <Text style={[styles.optionText, { color: colors.foreground }]}>
                Import messages
              </Text>
            </View>
            <Switch
              value={importMessages}
              onValueChange={setImportMessages}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <FlatList
            data={contacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.contactList}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.importFooter}>
            <Pressable
              onPress={handleImport}
              disabled={loading || selectedCount === 0}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                (loading || selectedCount === 0) && { opacity: 0.5 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Import {selectedCount} Contact{selectedCount !== 1 ? "s" : ""}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {step === "done" && (
        <View style={styles.doneContainer}>
          <IconSymbol name="checkmark" size={48} color={colors.success} />
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>Import Complete</Text>
          <Text style={[styles.doneText, { color: colors.muted }]}>
            {selectedCount} contacts have been added to your customer database.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.primaryButtonText}>View Customers</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 17,
  },
  keyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 20,
  },
  keyHeader: {
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  keyTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  keyDescription: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  fieldGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  helpText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  previewHeaderLeft: {
    gap: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  previewSubtitle: {
    fontSize: 14,
  },
  toggleAllText: {
    fontSize: 15,
    fontWeight: "500",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionText: {
    fontSize: 16,
  },
  contactList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
  },
  contactDetail: {
    fontSize: 14,
  },
  importFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  doneText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
