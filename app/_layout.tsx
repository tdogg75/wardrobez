import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClothingItemsProvider } from "@/hooks/useClothingItems";
import { OutfitsProvider } from "@/hooks/useOutfits";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import {
  requestNotificationPermission,
  scheduleDailyReminder,
} from "@/services/notifications";

function AppContent() {
  const { isDark, theme } = useTheme();

  useEffect(() => {
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
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
          }}
        >
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
            name="item-detail"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Item",
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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
