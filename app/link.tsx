import { useEffect, useState } from "react";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";

/**
 * Deep link handler screen.
 * 
 * Supported URL formats:
 * - clientbook://link?phone=9025551234
 * - clientbook://link?phone=%2B19025551234
 * - exp://...--/link?phone=9025551234
 * 
 * This screen looks up the customer by phone number and redirects
 * to their profile. If not found, shows an option to add them.
 */
export default function DeepLinkScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; action?: string }>();
  const { getCustomerByPhone, customers, loading } = useData();
  const [status, setStatus] = useState<"searching" | "found" | "not_found">("searching");

  useEffect(() => {
    if (loading) return;

    const phone = params.phone;
    if (!phone) {
      setStatus("not_found");
      return;
    }

    const customer = getCustomerByPhone(phone);
    if (customer) {
      setStatus("found");
      // Navigate to customer profile
      if (params.action === "book") {
        // Go directly to add appointment for this customer
        router.replace({
          pathname: "/appointment/add",
          params: { customerId: customer.id },
        });
      } else {
        router.replace({
          pathname: "/customer/[id]",
          params: { id: customer.id },
        });
      }
    } else {
      setStatus("not_found");
      // Navigate to add customer with pre-filled phone
      setTimeout(() => {
        router.replace({
          pathname: "/customer/add",
          params: { phone: phone },
        });
      }, 1500);
    }
  }, [loading, params.phone, params.action, customers]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        {status === "searching" && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.text, { color: colors.foreground }]}>
              Finding customer...
            </Text>
          </>
        )}
        {status === "not_found" && (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Customer Not Found
            </Text>
            <Text style={[styles.text, { color: colors.muted }]}>
              No customer with phone {params.phone} found.{"\n"}
              Redirecting to add new customer...
            </Text>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
