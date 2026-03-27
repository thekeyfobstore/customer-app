import { useState, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { saveApiKey, saveCloverConfig } from "@/lib/storage";
import { validateCloverCredentials } from "@/lib/clover";

type Step = "welcome" | "openphone" | "clover-token" | "clover-merchant" | "security" | "done";

const STEPS: Step[] = ["welcome", "openphone", "clover-token", "clover-merchant", "security", "done"];

export default function SetupWizardScreen() {
  const colors = useColors();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [openPhoneKey, setOpenPhoneKey] = useState("");
  const [cloverToken, setCloverToken] = useState("");
  const [cloverMerchantId, setCloverMerchantId] = useState("");
  const [validating, setValidating] = useState(false);
  const [openPhoneSaved, setOpenPhoneSaved] = useState(false);
  const [cloverSaved, setCloverSaved] = useState(false);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = stepIndex / (STEPS.length - 1);

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  }, [currentStep]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
  }, [currentStep]);

  const handleSaveOpenPhone = useCallback(async () => {
    const key = openPhoneKey.trim();
    if (!key) {
      goNext(); // Skip if empty
      return;
    }
    await saveApiKey(key);
    setOpenPhoneSaved(true);
    Alert.alert("Saved", "OpenPhone API key saved securely.", [
      { text: "Continue", onPress: goNext },
    ]);
  }, [openPhoneKey, goNext]);

  const handleSaveClover = useCallback(async () => {
    const token = cloverToken.trim();
    const merchant = cloverMerchantId.trim();
    if (!token || !merchant) {
      goNext(); // Skip if empty
      return;
    }

    setValidating(true);
    try {
      const result = await validateCloverCredentials({
        apiToken: token,
        merchantId: merchant,
      });

      if (result.valid) {
        await saveCloverConfig(token, merchant);
        setCloverSaved(true);
        Alert.alert(
          "Connected",
          `Successfully connected to Clover merchant: ${result.merchantName || merchant}`,
          [{ text: "Continue", onPress: goNext }]
        );
      } else {
        Alert.alert(
          "Invalid Credentials",
          "Could not connect to Clover with those credentials. Please double-check your API Token and Merchant ID."
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to validate Clover credentials.");
    } finally {
      setValidating(false);
    }
  }, [cloverToken, cloverMerchantId, goNext]);

  const renderWelcome = () => (
    <View style={styles.stepContent}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
        <IconSymbol name="checkmark" size={40} color={colors.primary} />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Welcome to ClientBook Setup
      </Text>
      <Text style={[styles.stepDescription, { color: colors.muted }]}>
        This wizard will walk you through connecting your OpenPhone and Clover accounts. 
        You can skip any step and set it up later in Settings.
      </Text>
      <View style={[styles.infoCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
        <IconSymbol name="lock.fill" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.foreground }]}>
          All API keys are stored in your device's encrypted keychain — the same security used by banking apps. Keys never leave your device.
        </Text>
      </View>
    </View>
  );

  const renderOpenPhone = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Connect OpenPhone
      </Text>
      <Text style={[styles.stepDescription, { color: colors.muted }]}>
        This lets you import contacts, view messages, and send SMS directly from ClientBook.
      </Text>

      <Text style={[styles.instructionHeader, { color: colors.foreground }]}>
        How to get your API key:
      </Text>

      <View style={styles.instructionList}>
        <InstructionStep number={1} text="Open a browser and go to my.openphone.com" colors={colors} />
        <InstructionStep number={2} text='Log in and click Settings (gear icon)' colors={colors} />
        <InstructionStep number={3} text='Go to "API Keys" or "Integrations → API"' colors={colors} />
        <InstructionStep number={4} text='Click "Create API Key", name it "ClientBook"' colors={colors} />
        <InstructionStep number={5} text="Copy the key and paste it below" colors={colors} />
      </View>

      <Pressable
        onPress={() => Linking.openURL("https://my.openphone.com/settings/api-keys")}
        style={({ pressed }) => [
          styles.linkButton,
          { borderColor: colors.primary },
          pressed && { opacity: 0.7 },
        ]}
      >
        <IconSymbol name="arrow.left" size={14} color={colors.primary} style={{ transform: [{ rotate: "135deg" }] }} />
        <Text style={[styles.linkButtonText, { color: colors.primary }]}>
          Open OpenPhone Settings
        </Text>
      </Pressable>

      <Text style={[styles.inputLabel, { color: colors.muted }]}>API KEY</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        placeholder="Paste your OpenPhone API key here"
        placeholderTextColor={colors.muted}
        value={openPhoneKey}
        onChangeText={setOpenPhoneKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        returnKeyType="done"
      />

      {openPhoneSaved && (
        <View style={[styles.successBadge, { backgroundColor: colors.success + "15" }]}>
          <IconSymbol name="checkmark" size={14} color={colors.success} />
          <Text style={[styles.successText, { color: colors.success }]}>Saved securely</Text>
        </View>
      )}
    </View>
  );

  const renderCloverToken = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Connect Clover — API Token
      </Text>
      <Text style={[styles.stepDescription, { color: colors.muted }]}>
        This lets you send orders to your Clover machine for payment processing.
      </Text>

      <Text style={[styles.instructionHeader, { color: colors.foreground }]}>
        How to get your API token:
      </Text>

      <View style={styles.instructionList}>
        <InstructionStep number={1} text="Log into your Clover Dashboard at clover.com" colors={colors} />
        <InstructionStep number={2} text='Go to "Account & Setup" in the left menu' colors={colors} />
        <InstructionStep number={3} text='Click "API Tokens" (under Business Operations)' colors={colors} />
        <InstructionStep number={4} text='Click "Create Token"' colors={colors} />
      </View>

      <View style={[styles.warningCard, { backgroundColor: colors.warning + "10", borderColor: colors.warning + "30" }]}>
        <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
        <View style={styles.warningContent}>
          <Text style={[styles.warningTitle, { color: colors.foreground }]}>
            Important: Set minimal permissions
          </Text>
          <Text style={[styles.warningText, { color: colors.muted }]}>
            When creating the token, only enable these permissions:{"\n"}
            {"\n"}• Orders — Read & Write{"\n"}
            • Payments — Read only{"\n"}
            {"\n"}Do NOT enable: Merchant, Employees, Inventory, or Financial permissions. 
            This way, even if the token were compromised, it can only view/create orders — not access your bank info or change account settings.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => Linking.openURL("https://www.clover.com/dashboard")}
        style={({ pressed }) => [
          styles.linkButton,
          { borderColor: colors.primary },
          pressed && { opacity: 0.7 },
        ]}
      >
        <IconSymbol name="arrow.left" size={14} color={colors.primary} style={{ transform: [{ rotate: "135deg" }] }} />
        <Text style={[styles.linkButtonText, { color: colors.primary }]}>
          Open Clover Dashboard
        </Text>
      </Pressable>

      <Text style={[styles.inputLabel, { color: colors.muted }]}>API TOKEN</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        placeholder="Paste your Clover API token here"
        placeholderTextColor={colors.muted}
        value={cloverToken}
        onChangeText={setCloverToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        returnKeyType="done"
      />
    </View>
  );

  const renderCloverMerchant = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Connect Clover — Merchant ID
      </Text>
      <Text style={[styles.stepDescription, { color: colors.muted }]}>
        Your Merchant ID identifies your specific Clover business account.
      </Text>

      <Text style={[styles.instructionHeader, { color: colors.foreground }]}>
        How to find your Merchant ID:
      </Text>

      <View style={styles.instructionList}>
        <InstructionStep number={1} text="Log into your Clover Dashboard" colors={colors} />
        <InstructionStep number={2} text='Go to "Account & Setup" → "About Your Business"' colors={colors} />
        <InstructionStep number={3} text="Your Merchant ID is displayed at the top" colors={colors} />
        <InstructionStep number={4} text={"It's also in your dashboard URL after /merchants/"} colors={colors} />
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="info.circle.fill" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.muted }]}>
          Example URL: clover.com/merchants/ABC123DEF456/...{"\n"}
          Your Merchant ID would be: ABC123DEF456
        </Text>
      </View>

      <Text style={[styles.inputLabel, { color: colors.muted }]}>MERCHANT ID</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        placeholder="e.g. ABC123DEF456"
        placeholderTextColor={colors.muted}
        value={cloverMerchantId}
        onChangeText={setCloverMerchantId}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
      />

      {cloverSaved && (
        <View style={[styles.successBadge, { backgroundColor: colors.success + "15" }]}>
          <IconSymbol name="checkmark" size={14} color={colors.success} />
          <Text style={[styles.successText, { color: colors.success }]}>Connected and verified</Text>
        </View>
      )}
    </View>
  );

  const renderSecurity = () => (
    <View style={styles.stepContent}>
      <View style={[styles.iconCircle, { backgroundColor: colors.success + "15" }]}>
        <IconSymbol name="lock.fill" size={40} color={colors.success} />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        How Your Data Is Protected
      </Text>

      <View style={styles.securityList}>
        <SecurityItem
          icon="lock.fill"
          title="Encrypted on Device"
          description="API keys are stored in your device's hardware-encrypted keychain (iOS Keychain / Android Keystore) — the same technology used by banking and payment apps."
          colors={colors}
        />
        <SecurityItem
          icon="xmark"
          title="Keys Never Leave Your Phone"
          description="Your API keys are stored locally on your device only. They are never sent to our servers or any third party. The app communicates directly with OpenPhone and Clover."
          colors={colors}
        />
        <SecurityItem
          icon="exclamationmark.triangle.fill"
          title="Minimal Permissions"
          description="Your Clover token should only have Orders (read/write) and Payments (read) permissions. Even if compromised, no one can access your bank account, process refunds, or change settings."
          colors={colors}
        />
        <SecurityItem
          icon="checkmark"
          title="Instant Revocation"
          description="If you ever suspect a problem, go to your Clover Dashboard → API Tokens → delete the token. It stops working immediately. Then create a new one in the app."
          colors={colors}
        />
      </View>
    </View>
  );

  const renderDone = () => (
    <View style={styles.stepContent}>
      <View style={[styles.iconCircle, { backgroundColor: colors.success + "15" }]}>
        <IconSymbol name="checkmark" size={40} color={colors.success} />
      </View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        You're All Set!
      </Text>
      <Text style={[styles.stepDescription, { color: colors.muted }]}>
        {openPhoneSaved && cloverSaved
          ? "OpenPhone and Clover are both connected. You're ready to import contacts, send messages, and charge customers."
          : openPhoneSaved
          ? "OpenPhone is connected. You can set up Clover later in Settings."
          : cloverSaved
          ? "Clover is connected. You can set up OpenPhone later in Settings."
          : "You can set up your integrations anytime in Settings."}
      </Text>

      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>OpenPhone</Text>
          <View style={[styles.statusPill, { backgroundColor: openPhoneSaved ? colors.success + "15" : colors.muted + "15" }]}>
            <Text style={{ color: openPhoneSaved ? colors.success : colors.muted, fontSize: 13, fontWeight: "600" }}>
              {openPhoneSaved ? "Connected" : "Not Set"}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>Clover</Text>
          <View style={[styles.statusPill, { backgroundColor: cloverSaved ? colors.success + "15" : colors.muted + "15" }]}>
            <Text style={{ color: cloverSaved ? colors.success : colors.muted, fontSize: 13, fontWeight: "600" }}>
              {cloverSaved ? "Connected" : "Not Set"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case "welcome": return renderWelcome();
      case "openphone": return renderOpenPhone();
      case "clover-token": return renderCloverToken();
      case "clover-merchant": return renderCloverMerchant();
      case "security": return renderSecurity();
      case "done": return renderDone();
    }
  };

  const getNextAction = () => {
    switch (currentStep) {
      case "openphone":
        return { label: openPhoneKey.trim() ? "Save & Continue" : "Skip", action: handleSaveOpenPhone };
      case "clover-merchant":
        return {
          label: cloverToken.trim() && cloverMerchantId.trim() ? "Verify & Save" : "Skip",
          action: cloverToken.trim() && cloverMerchantId.trim() ? handleSaveClover : goNext,
        };
      case "done":
        return { label: "Get Started", action: () => router.back() };
      default:
        return { label: "Continue", action: goNext };
    }
  };

  const nextAction = getNextAction();

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        {currentStep !== "welcome" && currentStep !== "done" ? (
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="arrow.left" size={20} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Setup</Text>
        {currentStep !== "done" ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.skipAllText, { color: colors.muted }]}>Close</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.primary, width: `${progress * 100}%` },
          ]}
        />
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={nextAction.action}
          disabled={validating}
          style={({ pressed }) => [
            styles.nextButton,
            {
              backgroundColor: currentStep === "done" ? colors.success : colors.primary,
            },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            validating && { opacity: 0.6 },
          ]}
        >
          {validating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>{nextAction.label}</Text>
          )}
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

// --- Sub-components ---

function InstructionStep({
  number,
  text,
  colors,
}: {
  number: number;
  text: string;
  colors: any;
}) {
  return (
    <View style={styles.instructionRow}>
      <View style={[styles.stepNumber, { backgroundColor: colors.primary + "15" }]}>
        <Text style={[styles.stepNumberText, { color: colors.primary }]}>{number}</Text>
      </View>
      <Text style={[styles.instructionText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

function SecurityItem({
  icon,
  title,
  description,
  colors,
}: {
  icon: any;
  title: string;
  description: string;
  colors: any;
}) {
  return (
    <View style={styles.securityItem}>
      <View style={[styles.securityIcon, { backgroundColor: colors.success + "10" }]}>
        <IconSymbol name={icon} size={18} color={colors.success} />
      </View>
      <View style={styles.securityText}>
        <Text style={[styles.securityTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.securityDesc, { color: colors.muted }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerButton: { width: 60 },
  skipAllText: { fontSize: 15, textAlign: "right" },
  progressTrack: {
    height: 3,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  stepContent: { gap: 16 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  stepTitle: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  stepDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  instructionHeader: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  instructionList: { gap: 12 },
  instructionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontSize: 14, fontWeight: "700" },
  instructionText: { fontSize: 15, flex: 1, lineHeight: 20 },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 4,
  },
  linkButtonText: { fontSize: 15, fontWeight: "600" },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 8,
    marginLeft: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  warningCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    alignItems: "flex-start",
    marginTop: 4,
  },
  warningContent: { flex: 1 },
  warningTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  warningText: { fontSize: 13, lineHeight: 20 },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  successText: { fontSize: 13, fontWeight: "600" },
  securityList: { gap: 20, marginTop: 8 },
  securityItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  securityText: { flex: 1 },
  securityTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  securityDesc: { fontSize: 13, lineHeight: 19 },
  summaryCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginTop: 8 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  summaryLabel: { fontSize: 15, fontWeight: "500" },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  divider: { height: 0.5 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
});
