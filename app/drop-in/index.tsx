import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { generateId } from "@/lib/helpers";
import { formatAddress, geocodeAddress } from "@/lib/geocoding";

export default function DropInLocationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { dropInLocations, addDropInLocation, deleteDropInLocation } = useData();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setStreet("");
    setCity("");
    setState("");
    setZip("");
    setNotes("");
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a location name");
      return;
    }
    if (!street.trim() && !city.trim()) {
      Alert.alert("Error", "Please enter at least a street or city");
      return;
    }

    setSaving(true);
    const address = { street: street.trim(), city: city.trim(), state: state.trim(), zip: zip.trim() };
    const coords = await geocodeAddress(address);

    addDropInLocation({
      id: generateId(),
      name: name.trim(),
      address,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });

    setSaving(false);
    resetForm();
  };

  const handleDelete = (id: string, locationName: string) => {
    Alert.alert("Delete Location", `Remove "${locationName}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteDropInLocation(id) },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Drop-in Locations</Text>
          <TouchableOpacity onPress={() => setShowForm(!showForm)}>
            <IconSymbol name={showForm ? "xmark" : "plus"} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>New Drop-in Location</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Location name (e.g., Walmart Parking Lot)"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Street address"
              placeholderTextColor={colors.muted}
              value={street}
              onChangeText={setStreet}
              returnKeyType="done"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="City"
                placeholderTextColor={colors.muted}
                value={city}
                onChangeText={setCity}
                returnKeyType="done"
              />
              <TextInput
                style={[styles.input, styles.stateInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="ST"
                placeholderTextColor={colors.muted}
                value={state}
                onChangeText={setState}
                maxLength={2}
                autoCapitalize="characters"
                returnKeyType="done"
              />
              <TextInput
                style={[styles.input, styles.zipInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="ZIP"
                placeholderTextColor={colors.muted}
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
                maxLength={5}
                returnKeyType="done"
              />
            </View>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Location"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {dropInLocations.length === 0 && !showForm ? (
          <View style={styles.emptyState}>
            <IconSymbol name="location.fill" size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Drop-in Locations</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Add your regular meeting spots where customers come to you
            </Text>
            <TouchableOpacity
              style={[styles.addFirstBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.addFirstBtnText}>Add First Location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={dropInLocations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.locationHeader}>
                  <View style={[styles.locationIcon, { backgroundColor: colors.primary + "15" }]}>
                    <IconSymbol name="location.fill" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={[styles.locationName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.locationAddress, { color: colors.muted }]}>{formatAddress(item.address)}</Text>
                    {item.notes ? (
                      <Text style={[styles.locationNotes, { color: colors.muted }]}>{item.notes}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
                    <IconSymbol name="trash" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                {item.latitude && item.longitude && (
                  <Text style={[styles.coordsText, { color: colors.muted }]}>
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 17, fontWeight: "600" },
  formCard: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  formTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  stateInput: { width: 50 },
  zipInput: { width: 70 },
  saveButton: { paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  listContent: { padding: 16, paddingBottom: 100 },
  locationCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  locationHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  locationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  locationInfo: { flex: 1 },
  locationName: { fontSize: 16, fontWeight: "600" },
  locationAddress: { fontSize: 13, marginTop: 2 },
  locationNotes: { fontSize: 12, marginTop: 4, fontStyle: "italic" },
  coordsText: { fontSize: 11, marginTop: 6, marginLeft: 52 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: "center", marginTop: 4, paddingHorizontal: 40 },
  addFirstBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 16 },
  addFirstBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
