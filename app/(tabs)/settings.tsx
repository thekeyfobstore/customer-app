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
import {
  loadApiKey,
  saveApiKey,
  clearApiKey,
  loadCloverConfig,
  saveCloverConfig,
  clearCloverConfig,
  exportAllData,
} from "@/lib/storage";
import { validateCloverCredentials } from "@/lib/clover";
import {
  requestNotificationPermissions,
  scheduleAllReminders,
  cancelAllReminders,
} from "@/lib/notifications";

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customers, appointments, getCustomerById } = useData();

  // OpenPhone state
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);

  // Clover state
  const [cloverToken, setCloverToken] = useState("");
  const [cloverMerchant, setCloverMerchant] = useState("");
  const [savedCloverToken, setSavedCloverToken] = useState("");
  const [savedCloverMerchant, setSavedCloverMerchant] = useState("");
  const [editingClover, setEditingClover] = useState(false);
  const [validatingClover, setValidatingClover] = useState(false);

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    loadApiKey().then((key) => {
      setSavedKey(key);
      setApiKey(key);
    });
    loadCloverConfig().then((cfg) => {
      setSavedCloverToken(cfg.apiToken);
      setSavedCloverMerchant(cfg.merchantId);
      setCloverToken(cfg.apiToken);
      setCloverMerchant(cfg.merchantId);
    });
  }, []);

  // OpenPhone handlers
  const handleSaveKey = useCallback(async () => {
    await saveApiKey(apiKey.trim());
    setSavedKey(apiKey.trim());
    setEditingKey(false);
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
          setEditingKey(false);
        },
      },
    ]);
  }, []);

  // Clover handlers
  const handleSaveClover = useCallback(async () => {
    const token = cloverToken.trim();
    const merchant = cloverMerchant.trim();
    if (!token || !merchant) {
      Alert.alert("Required", "Both API Token and Merchant ID are required.");
      return;
    }
    setValidatingClover(true);
    try {
      const result = await validateCloverCredentials({ apiToken: token, merchantId: merchant });
      if (result.valid) {
        await saveCloverConfig(token, merchant);
        setSavedCloverToken(token);
        setSavedCloverMerchant(merchant);
        setEditingClover(false);
        Alert.alert("Connected", `Clover connected to: ${result.merchantName || "your merchant account"}`);
      } else {
        Alert.alert("Invalid Credentials", "Could not connect to Clover. Please check your API token and Merchant ID.");
      }
    } catch {
      // Save anyway if validation fails due to network
      await saveCloverConfig(token, merchant);
      setSavedCloverToken(token);
      setSavedCloverMerchant(merchant);
      setEditingClover(false);
      Alert.alert("Saved", "Clover credentials saved. Connection could not be verified — please check them on next use.");
    } finally {
      setValidatingClover(false);
    }
  }, [cloverToken, cloverMerchant]);

  const handleClearClover = useCallback(() => {
    Alert.alert("Remove Clover", "Are you sure you want to remove your Clover credentials?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await clearCloverConfig();
          setCloverToken("");
          setCloverMerchant("");
          setSavedCloverToken("");
          setSavedCloverMerchant("");
          setEditingClover(false);
        },
      },
    ]);
  }, []);

  // Notification handlers
  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermissions();
    if (granted) {
      setNotificationsEnabled(true);
      const count = await scheduleAllReminders(
        appointments,
        (customerId) => {
          const c = getCustomerById(customerId);
          return c ? `${c.firstName} ${c.lastName}` : "Customer";
        },
        30
      );
      Alert.alert("Reminders Enabled", `Scheduled ${count} upcoming appointment reminders (30 min before each).`);
    } else {
      Alert.alert("Permission Denied", "Please enable notifications in your device settings.");
    }
  }, [appointments, getCustomerById]);

  const handleDisableNotifications = useCallback(async () => {
    await cancelAllReminders();
    setNotificationsEnabled(false);
    Alert.alert("Reminders Disabled", "All appointment reminders have been cancelled.");
  }, []);

  // Export
  const handleExport = useCallback(async () => {
    try {
      const data = await exportAllData();
      if (Platform.OS === "web") {
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "clientbook-export.json";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: data, title: "ClientBook Data Export" });
      }
    } catch (err: any) {
      Alert.alert("Export Error", err.message || "Failed to export data.");
    }
  }, []);

  const maskedKey = savedKey
    ? savedKey.substring(0, 8) + "..." + savedKey.substring(savedKey.length - 4)
    : "";
  const maskedClover = savedCloverToken
    ? savedCloverToken.substring(0, 8) + "..." + savedCloverToken.substring(savedCloverToken.length - 4)
    : "";

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Setup Wizard */}
        {(!savedKey || !savedCloverToken) && (
          <Pressable
            onPress={() => router.push("/setup-wizard" as any)}
            style={({ pressed }) => [
              styles.wizardBanner,
              { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.wizardIcon, { backgroundColor: colors.primary + "20" }]}>
              <IconSymbol name="checkmark" size={22} color={colors.primary} />
            </View>
            <View style={styles.wizardText}>
              <Text style={[styles.wizardTitle, { color: colors.foreground }]}>Setup Wizard</Text>
              <Text style={[styles.wizardSubtitle, { color: colors.muted }]}>
                Step-by-step guide to connect OpenPhone and Clover
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.primary} />
          </Pressable>
        )}

        {/* Security Info */}
        <Pressable
          onPress={() => router.push("/setup-wizard" as any)}
          style={({ pressed }) => [
            styles.securityBanner,
            { backgroundColor: colors.success + "08", borderColor: colors.success + "25" },
            pressed && { opacity: 0.8 },
          ]}
        >
          <IconSymbol name="lock.fill" size={16} color={colors.success} />
          <Text style={[styles.securityText, { color: colors.muted }]}>
            API keys are encrypted on-device. Tap to learn more.
          </Text>
        </Pressable>

        {/* OpenPhone Section */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>OPENPHONE</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <IconSymbol name="key.fill" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>API Key</Text>
              {!editingKey && (
                <Text style={[styles.sectionRowValue, { color: colors.muted }]}>
                  {savedKey ? maskedKey : "Not configured"}
                </Text>
              )}
            </View>
            {!editingKey && (
              <Pressable onPress={() => setEditingKey(true)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <Text style={[styles.actionLink, { color: colors.primary }]}>{savedKey ? "Edit" : "Add"}</Text>
              </Pressable>
            )}
          </View>
          {editingKey && (
            <View style={styles.editContainer}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Enter OpenPhone API key"
                placeholderTextColor={colors.muted}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
                returnKeyType="done"
              />
              <View style={styles.editActions}>
                <Pressable onPress={() => setShowKey(!showKey)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Text style={[styles.actionLink, { color: colors.muted }]}>{showKey ? "Hide" : "Show"}</Text>
                </Pressable>
                <View style={styles.editButtons}>
                  <Pressable onPress={() => { setApiKey(savedKey); setEditingKey(false); }} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <Text style={[styles.actionLink, { color: colors.muted }]}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveKey} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <Text style={[styles.actionLink, { color: colors.primary }]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          {savedKey ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable onPress={() => router.push("/import-contacts" as any)} style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}>
                <IconSymbol name="arrow.down.doc.fill" size={20} color={colors.primary} />
                <Text style={[styles.sectionRowTitle, { color: colors.foreground, flex: 1 }]}>Re-import Contacts</Text>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable onPress={handleClearKey} style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}>
                <IconSymbol name="trash.fill" size={20} color={colors.error} />
                <Text style={[styles.sectionRowTitle, { color: colors.error, flex: 1 }]}>Remove API Key</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Clover Section */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>CLOVER</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <IconSymbol name="creditcard.fill" size={20} color={colors.success} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>Clover POS</Text>
              {!editingClover && (
                <Text style={[styles.sectionRowValue, { color: colors.muted }]}>
                  {savedCloverToken ? `Connected · ${maskedClover}` : "Not configured"}
                </Text>
              )}
            </View>
            {!editingClover && (
              <Pressable onPress={() => setEditingClover(true)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <Text style={[styles.actionLink, { color: colors.primary }]}>{savedCloverToken ? "Edit" : "Add"}</Text>
              </Pressable>
            )}
          </View>
          {editingClover && (
            <View style={styles.editContainer}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Clover API Token"
                placeholderTextColor={colors.muted}
                value={cloverToken}
                onChangeText={setCloverToken}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Merchant ID"
                placeholderTextColor={colors.muted}
                value={cloverMerchant}
                onChangeText={setCloverMerchant}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              <View style={styles.editActions}>
                <Text style={[styles.hintText, { color: colors.muted }]}>
                  Find these in Clover Dashboard → Account & Setup → API Tokens
                </Text>
                <View style={styles.editButtons}>
                  <Pressable
                    onPress={() => { setCloverToken(savedCloverToken); setCloverMerchant(savedCloverMerchant); setEditingClover(false); }}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.actionLink, { color: colors.muted }]}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveClover} disabled={validatingClover} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                    <Text style={[styles.actionLink, { color: colors.primary }]}>
                      {validatingClover ? "Verifying..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          {savedCloverToken ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable onPress={handleClearClover} style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}>
                <IconSymbol name="trash.fill" size={20} color={colors.error} />
                <Text style={[styles.sectionRowTitle, { color: colors.error, flex: 1 }]}>Remove Clover</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={notificationsEnabled ? handleDisableNotifications : handleEnableNotifications}
            style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="bell.fill" size={20} color={notificationsEnabled ? colors.success : colors.muted} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>Appointment Reminders</Text>
              <Text style={[styles.sectionRowValue, { color: colors.muted }]}>
                {notificationsEnabled ? "Enabled — 30 min before" : "Tap to enable"}
              </Text>
            </View>
            <View style={[styles.toggleDot, { backgroundColor: notificationsEnabled ? colors.success : colors.muted }]} />
          </Pressable>
        </View>

        {/* Data Section */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>DATA</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={handleExport} style={({ pressed }) => [styles.sectionRow, pressed && { opacity: 0.6 }]}>
            <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>Export Data</Text>
              <Text style={[styles.sectionRowValue, { color: colors.muted }]}>Export as JSON</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* Stats Section */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>SUMMARY</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{customers.length}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Customers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{appointments.length}</Text>
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

        {/* Deep Link */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>OPENPHONE DEEP LINK</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <IconSymbol name="paperplane.fill" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>Quick Open from OpenPhone</Text>
              <Text style={[styles.sectionRowValue, { color: colors.muted }]}>
                Add this link format as a note in OpenPhone contacts to jump straight to their profile in ClientBook
              </Text>
              <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: colors.primary }} selectable>
                  {`https://custcrmapp-nxdjk2u8.manus.space/link?phone=PHONE_NUMBER`}
                </Text>
              </View>
              <Text style={[styles.hintText, { color: colors.muted, marginTop: 6 }]}>
                Replace PHONE_NUMBER with the customer's 10-digit number (e.g. 9025551234). When tapped, it opens their profile or lets you add them as a new customer.
              </Text>
              <Text style={[styles.hintText, { color: colors.muted, marginTop: 4 }]}>
                Add ?action=book to go directly to booking (e.g. ...?phone=9025551234&action=book)
              </Text>
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionRow}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <View style={styles.sectionRowContent}>
              <Text style={[styles.sectionRowTitle, { color: colors.foreground }]}>ClientBook</Text>
              <Text style={[styles.sectionRowValue, { color: colors.muted }]}>Version 1.1.0</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  section: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  sectionRowContent: { flex: 1, gap: 2 },
  sectionRowTitle: { fontSize: 16, fontWeight: "500" },
  sectionRowValue: { fontSize: 13 },
  actionLink: { fontSize: 15, fontWeight: "500" },
  divider: { height: 0.5, marginLeft: 46 },
  editContainer: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderRadius: 10, borderWidth: 1 },
  editActions: { gap: 8 },
  editButtons: { flexDirection: "row", gap: 16, justifyContent: "flex-end" },
  hintText: { fontSize: 12, lineHeight: 18 },
  toggleDot: { width: 12, height: 12, borderRadius: 6 },
  statsGrid: { flexDirection: "row", padding: 16 },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statNumber: { fontSize: 28, fontWeight: "700" },
  statLabel: { fontSize: 12, fontWeight: "500" },
  statDivider: { width: 0.5, marginVertical: 4 },
  wizardBanner: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12, marginBottom: 4 },
  wizardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  wizardText: { flex: 1, gap: 2 },
  wizardTitle: { fontSize: 16, fontWeight: "600" },
  wizardSubtitle: { fontSize: 13 },
  securityBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, gap: 8, marginBottom: 4 },
  securityText: { fontSize: 13, flex: 1 },
});
