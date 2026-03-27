import { useState, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId } from "@/lib/helpers";
import { loadApiKey } from "@/lib/storage";
import { createOpenPhoneContact } from "@/lib/openphone";
import type { Customer } from "@/lib/types";

export default function AddCustomerScreen() {
  const colors = useColors();
  const router = useRouter();
  const { addCustomer } = useData();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone || "");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [syncToOpenPhone, setSyncToOpenPhone] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!firstName.trim() && !lastName.trim()) {
      Alert.alert("Required", "Please enter at least a first or last name.");
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const hasAddress = street.trim() || city.trim() || state.trim() || zip.trim();

    const customer: Customer = {
      id: generateId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      company: company.trim(),
      notes: notes.trim(),
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      vehicles: [],
      address: hasAddress
        ? { street: street.trim(), city: city.trim(), state: state.trim(), zip: zip.trim() }
        : undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Sync to OpenPhone if enabled
    if (syncToOpenPhone && phone.trim()) {
      try {
        const apiKey = await loadApiKey();
        if (apiKey) {
          // Build company field in the user's preferred format:
          // "FirstName LastName Year Make Model Location"
          const companyForOP = customer.company || [customer.firstName, customer.lastName].filter(Boolean).join(" ");
          const opId = await createOpenPhoneContact(apiKey, {
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            email: customer.email,
            company: companyForOP,
          });
          if (opId) customer.openPhoneContactId = opId;
        }
      } catch {
        // Continue even if OpenPhone sync fails
      }
    }

    addCustomer(customer);
    setSaving(false);
    router.back();
  }, [firstName, lastName, phone, email, company, notes, tagsText, street, city, state, zip, syncToOpenPhone, addCustomer, router]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>New Customer</Text>
        <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Text style={[styles.label, { color: colors.muted }]}>NAME</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="First Name"
            placeholderTextColor={colors.muted}
            value={firstName}
            onChangeText={setFirstName}
            returnKeyType="next"
            autoFocus
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Last Name"
            placeholderTextColor={colors.muted}
            value={lastName}
            onChangeText={setLastName}
            returnKeyType="next"
          />
        </View>

        {/* Contact */}
        <Text style={[styles.label, { color: colors.muted }]}>CONTACT</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Phone Number"
            placeholderTextColor={colors.muted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Company"
            placeholderTextColor={colors.muted}
            value={company}
            onChangeText={setCompany}
            returnKeyType="next"
          />
        </View>

        {/* Address */}
        <Text style={[styles.label, { color: colors.muted }]}>ADDRESS</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Street Address"
            placeholderTextColor={colors.muted}
            value={street}
            onChangeText={setStreet}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="City"
            placeholderTextColor={colors.muted}
            value={city}
            onChangeText={setCity}
            returnKeyType="next"
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput, { color: colors.foreground, borderBottomColor: colors.border, borderRightWidth: 0.5, borderRightColor: colors.border }]}
              placeholder="State"
              placeholderTextColor={colors.muted}
              value={state}
              onChangeText={setState}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, styles.halfInput, { color: colors.foreground }]}
              placeholder="ZIP Code"
              placeholderTextColor={colors.muted}
              value={zip}
              onChangeText={setZip}
              keyboardType="number-pad"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Notes & Tags */}
        <Text style={[styles.label, { color: colors.muted }]}>OTHER</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, styles.multilineInput, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Notes"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Tags (comma separated)"
            placeholderTextColor={colors.muted}
            value={tagsText}
            onChangeText={setTagsText}
            returnKeyType="done"
          />
        </View>

        {/* OpenPhone Sync Toggle */}
        <Pressable
          onPress={() => setSyncToOpenPhone(!syncToOpenPhone)}
          style={({ pressed }) => [
            styles.toggleRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="phone.fill" size={18} color={colors.primary} />
          <Text style={[styles.toggleText, { color: colors.foreground }]}>
            Also create in OpenPhone
          </Text>
          <View style={[styles.toggle, { backgroundColor: syncToOpenPhone ? colors.primary : colors.muted + "40" }]}>
            <View style={[styles.toggleKnob, { transform: [{ translateX: syncToOpenPhone ? 18 : 2 }] }]} />
          </View>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  navTitle: { fontSize: 17, fontWeight: "600" },
  cancelText: { fontSize: 17 },
  saveText: { fontSize: 17, fontWeight: "600" },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  fieldGroup: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderBottomWidth: 0.5 },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row" },
  halfInput: { flex: 1, borderBottomWidth: 0 },
  toggleRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12, marginTop: 16 },
  toggleText: { flex: 1, fontSize: 16, fontWeight: "500" },
  toggle: { width: 44, height: 28, borderRadius: 14, justifyContent: "center" },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
});
