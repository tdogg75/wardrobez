import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
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
      </Stack>
    </>
  );
}
