import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClothingItemsProvider } from "@/hooks/useClothingItems";
import { OutfitsProvider } from "@/hooks/useOutfits";
import {
  requestNotificationPermission,
  scheduleDailyReminder,
} from "@/services/notifications";

export default function RootLayout() {
  useEffect(() => {
    // Schedule daily 9pm reminder on app launch
    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleDailyReminder();
      }
    })();
  }, []);

  return (
    <ClothingItemsProvider>
      <OutfitsProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="add-item"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Add Item",
            }}
          />
          <Stack.Screen
            name="edit-item"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Edit Item",
            }}
          />
          <Stack.Screen
            name="outfit-detail"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Outfit",
            }}
          />
          <Stack.Screen
            name="gmail-purchases"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Gmail Purchases",
            }}
          />
        </Stack>
      </OutfitsProvider>
    </ClothingItemsProvider>
  );
}
