import { useEffect, useRef, useState } from "react";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-context";
import { mapServerContactToCustomer } from "@/lib/server-contact";
import { trpc } from "@/lib/trpc";

/**
 * Deep link handler screen.
 *
 * Supported URL formats:
 * - clientbook://link?phone=9025551234
 * - clientbook://link?phone=%2B19025551234
 * - exp://...--/link?phone=9025551234
 * - https://<clientbook-host>/link?phone=9025551234
 */
export default function DeepLinkScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; action?: string }>();
  const { getCustomerByPhone, customers, loading, addCustomer } = useData();
  const [status, setStatus] = useState<
    "searching" | "found" | "not_found" | "error"
  >("searching");
  const navigationStarted = useRef(false);

  const phone = typeof params.phone === "string" ? params.phone : "";
  const serverContact = trpc.contacts.findByPhone.useQuery(
    { phone: phone || "0000000" },
    {
      enabled: !loading && phone.replace(/\D/g, "").length >= 7,
      retry: 1,
    },
  );

  useEffect(() => {
    if (loading || navigationStarted.current) return;

    if (!phone) {
      setStatus("not_found");
      return;
    }

    const navigateToCustomer = (customerId: string) => {
      navigationStarted.current = true;
      setStatus("found");
      if (params.action === "book") {
        router.replace({
          pathname: "/appointment/add",
          params: { customerId },
        });
      } else {
        router.replace({
          pathname: "/customer/[id]",
          params: { id: customerId },
        });
      }
    };

    const localCustomer = getCustomerByPhone(phone);
    if (localCustomer) {
      navigateToCustomer(localCustomer.id);
      return;
    }

    if (serverContact.isLoading || serverContact.isFetching) {
      setStatus("searching");
      return;
    }

    if (serverContact.data) {
      const mappedCustomer = mapServerContactToCustomer(serverContact.data);
      addCustomer(mappedCustomer);
      navigateToCustomer(mappedCustomer.id);
      return;
    }

    if (serverContact.isError) {
      setStatus("error");
      return;
    }

    setStatus("not_found");
    const timer = setTimeout(() => {
      navigationStarted.current = true;
      router.replace({
        pathname: "/customer/add",
        params: { phone },
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    loading,
    phone,
    params.action,
    customers,
    getCustomerByPhone,
    addCustomer,
    router,
    serverContact.data,
    serverContact.isLoading,
    serverContact.isFetching,
    serverContact.isError,
  ]);

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
              No customer with phone {phone} found.{"\n"}
              Redirecting to add new customer...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Unable to Load Customer
            </Text>
            <Text style={[styles.text, { color: colors.muted }]}>
              ClientBook could not reach the customer database. Please try the
              link again.
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
