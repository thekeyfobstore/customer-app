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

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setPhone(customer.phone);
      setEmail(customer.email);
      setCompany(customer.company);
      setNotes(customer.notes);
      setTagsText(customer.tags.join(", "));
    }
  }, [customer]);

  const handleSave = () => {
    if (!firstName.trim() && !lastName.trim()) {
      Alert.alert("Required", "Please enter at least a first or last name.");
      return;
    }
    if (!customer) return;

    updateCustomer({
      ...customer,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      company: company.trim(),
      notes: notes.trim(),
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
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
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Edit Customer</Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
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
  saveText: {
    fontSize: 17,
    fontWeight: "600",
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24,
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
    borderBottomWidth: 0.5,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
