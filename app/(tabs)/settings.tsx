import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { loadApiKey, saveApiKey, clearApiKey, exportAllData } from "@/lib/storage";

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customers, appointments } = useData();

  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadApiKey().then((key) => {
      setSavedKey(key);
      setApiKey(key);
    });
  }, []);

  const handleSaveKey = useCallback(async () => {
    await saveApiKey(apiKey.trim());
    setSavedKey(apiKey.trim());
    setEditing(false);
    Alert.alert("Saved", "Your OpenPhone API key has been saved.");
  }, [apiKey]);

  const handleClearKey = useCallback(() => {
    Alert.alert("Remove API Key", "Are you sure you want to remove your OpenPhone API key?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await clearApiKey();
          setApiKey("");
          setSavedKey("");
          setEditing(false);
        },
      },
    ]);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const data = await exportAllData();
      if (Platform.OS === "web") {
        // Web: create a downloadable blob
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "clientbook-export.json";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: data,
          title: "ClientBook Data Export",
        });
      }
    } catch (err: any) {
      Alert.alert("Export Error", err.message || "Failed to export data.");
    }
  }, []);

  const maskedKey = savedKey
    ? savedKey.substring(0, 8) + "..." + savedKey.substring(savedKey.length - 4)
    : "";

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* OpenPhone Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>OPENPHONE</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <IconSymbol name="key.fill" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>API Key</Text>
              {!editing ? (
                <Text style={[styles.sectionRowValue, { color: colors.muted }]}>
                  {savedKey ? maskedKey : "Not configured"}
                </Text>
              ) : null}
            </View>
            {!editing ? (
              <Pressable
                onPress={() => setEditing(true)}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.actionLink, { color: colors.primary }]}>
                  {savedKey ? "Edit" : "Add"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {editing && (
            <View style={styles.editKeyContainer}>
              <TextInput
                style={[styles.keyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Enter OpenPhone API key"
                placeholderTextColor={colors.muted}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
                returnKeyType="done"
              />
              <View style={styles.editKeyActions}>
                <Pressable
                  onPress={() => setShowKey(!showKey)}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.actionLink, { color: colors.muted }]}>
                    {showKey ? "Hide" : "Show"}
                  </Text>
                </Pressable>
                <View style={styles.editKeyButtons}>
                  <Pressable
                    onPress={() => {
                      setApiKey(savedKey);
                      setEditing(false);
                    }}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.actionLink, { color: colors.muted }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveKey}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.actionLink, { color: colors.primary }]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {savedKey ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => router.push("/import-contacts" as any)}
                style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}
              >
                <IconSymbol name="arrow.down.doc.fill" size={20} color={colors.primary} />
                <Text style={[styles.sectionRowTitle, { color: colors.foreground, flex: 1 }]}>
                  Re-import Contacts
                </Text>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={handleClearKey}
                style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}
              >
                <IconSymbol name="trash.fill" size={20} color={colors.error} />
                <Text style={[styles.sectionRowTitle, { color: colors.error, flex: 1 }]}>
                  Remove API Key
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Data Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>DATA</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={handleExport}
            style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>
                Export Data
              </Text>
              <Text style={[styles.sectionRowValue, { color: colors.muted }]}>
                Export as JSON
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* Stats Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>SUMMARY</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {customers.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Customers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {appointments.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Appointments</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {appointments.filter((a) => a.status === "completed").length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>
                ClientBook
              </Text>
              <Text style={[styles.sectionRowValue, { color: colors.muted }]}>Version 1.0.0</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  sectionRowContent: {
    flex: 1,
    gap: 2,
  },
  sectionRowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  sectionRowValue: {
    fontSize: 13,
  },
  actionLink: {
    fontSize: 15,
    fontWeight: "500",
  },
  divider: {
    height: 0.5,
    marginLeft: 46,
  },
  editKeyContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  keyInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  editKeyActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editKeyButtons: {
    flexDirection: "row",
    gap: 16,
  },
  statsGrid: {
    flexDirection: "row",
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  statDivider: {
    width: 0.5,
    marginVertical: 4,
  },
});
