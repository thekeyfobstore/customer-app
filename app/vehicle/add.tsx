import { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId } from "@/lib/helpers";
import { buildCompanyField, updateOpenPhoneContact } from "@/lib/openphone";
import { loadApiKey } from "@/lib/storage";
import type { Vehicle } from "@/lib/types";

export default function AddVehicleScreen() {
  const colors = useColors();
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { getCustomerById, updateCustomer } = useData();

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [keyCode, setKeyCode] = useState("");
  const [dealerComparison, setDealerComparison] = useState("");
  const [partNumber, setPartNumber] = useState("");

  const customer = getCustomerById(customerId || "");

  const handleSave = async () => {
    if (!year.trim() && !make.trim() && !model.trim()) {
      Alert.alert("Required", "Please enter at least year, make, or model.");
      return;
    }
    if (!customer) return;

    const vehicle: Vehicle = {
      id: generateId(),
      year: year.trim(),
      make: make.trim(),
      model: model.trim(),
      vin: vin.trim(),
      keyCode: keyCode.trim(),
      dealerComparison: dealerComparison.trim(),
      partNumber: partNumber.trim(),
    };

    const updatedCustomer = {
      ...customer,
      vehicles: [...(customer.vehicles || []), vehicle],
      updatedAt: new Date().toISOString(),
    };

    // Two-way sync: update OpenPhone company field with new vehicle info
    if (customer.openPhoneContactId && !customer.openPhoneContactId.startsWith("conv-")) {
      try {
        const apiKey = await loadApiKey();
        if (apiKey) {
          const companyField = buildCompanyField(updatedCustomer);
          await updateOpenPhoneContact(apiKey, customer.openPhoneContactId, {
            company: companyField,
          });
          updatedCustomer.company = companyField;
        }
      } catch {
        // Continue even if OpenPhone sync fails
      }
    }

    updateCustomer(updatedCustomer);
    router.back();
  };
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Add Vehicle</Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconHeader, { backgroundColor: colors.primary + "12" }]}>
          <IconSymbol name="car.fill" size={40} color={colors.primary} />
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>VEHICLE INFO</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Year (e.g., 2023)"
            placeholderTextColor={colors.muted}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Make (e.g., Toyota)"
            placeholderTextColor={colors.muted}
            value={make}
            onChangeText={setMake}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Model (e.g., Camry)"
            placeholderTextColor={colors.muted}
            value={model}
            onChangeText={setModel}
            returnKeyType="next"
          />
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>IDENTIFICATION</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="VIN (optional)"
            placeholderTextColor={colors.muted}
            value={vin}
            onChangeText={setVin}
            autoCapitalize="characters"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Key Code"
            placeholderTextColor={colors.muted}
            value={keyCode}
            onChangeText={setKeyCode}
            autoCapitalize="characters"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Dealer Comparison & Part #"
            placeholderTextColor={colors.muted}
            value={dealerComparison}
            onChangeText={setDealerComparison}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Part Number"
            placeholderTextColor={colors.muted}
            value={partNumber}
            onChangeText={setPartNumber}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  navTitle: { fontSize: 17, fontWeight: "600" },
  cancelText: { fontSize: 17 },
  saveText: { fontSize: 17, fontWeight: "600" },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  iconHeader: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center", alignSelf: "center", marginVertical: 16 },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  fieldGroup: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderBottomWidth: 0.5 },
});
