import { useState, useEffect } from "react";
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
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { ROUTE_CODES, ROUTE_LABELS } from "@/lib/types";

export default function EditCustomerScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomerById, updateCustomer } = useData();

  const customer = getCustomerById(id || "");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [route, setRoute] = useState("");

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setPhone(customer.phone);
      setEmail(customer.email);
      setCompany(customer.company);
      setNotes(customer.notes);
      setTagsText(customer.tags.join(", "));
      if (customer.address) {
        setStreet(customer.address.street || "");
        setCity(customer.address.city || "");
        setState(customer.address.state || "");
        setZip(customer.address.zip || "");
      }
      setRoute(customer.route || "");
    }
  }, [customer]);

  const handleSave = () => {
    if (!firstName.trim() && !lastName.trim()) {
      Alert.alert("Required", "Please enter at least a first or last name.");
      return;
    }
    if (!customer) return;

    const hasAddress = street.trim() || city.trim() || state.trim() || zip.trim();

    updateCustomer({
      ...customer,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      company: company.trim(),
      notes: notes.trim(),
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      address: hasAddress
        ? { street: street.trim(), city: city.trim(), state: state.trim(), zip: zip.trim() }
        : customer.address,
      route: route.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    router.back();
  };

  if (!customer) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted, fontSize: 16 }}>Customer not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Edit Customer</Text>
        <Pressable onPress={handleSave} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
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
              style={[styles.input, styles.halfInput, { color: colors.foreground, borderRightWidth: 0.5, borderRightColor: colors.border }]}
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

        {/* Route */}
        <Text style={[styles.label, { color: colors.muted }]}>ROUTE</Text>
        <View style={[styles.fieldGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
            <Pressable
              onPress={() => setRoute("")}
              style={({ pressed }) => [
                { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
                !route
                  ? { backgroundColor: "#D1FAE5", borderColor: "#065F46" }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: !route ? "#065F46" : colors.muted, fontSize: 14, fontWeight: !route ? "700" : "500" }}>None</Text>
            </Pressable>
            {ROUTE_CODES.map((code) => {
              const isActive = route.startsWith(code);
              return (
                <Pressable
                  key={code}
                  onPress={() => setRoute(isActive ? "" : code)}
                  style={({ pressed }) => [
                    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
                    isActive
                      ? { backgroundColor: "#D1FAE5", borderColor: "#065F46" }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: isActive ? "#065F46" : colors.muted, fontSize: 14, fontWeight: isActive ? "700" : "500" }}>{code} - {ROUTE_LABELS[code]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {route ? (
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={`Location detail (e.g., ${route.split(" ")[0] || route} - Bedford)`}
              placeholderTextColor={colors.muted}
              value={route}
              onChangeText={setRoute}
              returnKeyType="next"
            />
          ) : null}
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
});
