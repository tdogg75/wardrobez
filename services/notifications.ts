import { Platform, Alert } from "react-native";

/**
 * Simplified notification scheduling for daily outfit reminders.
 * Uses expo-notifications if available, otherwise falls back to a no-op.
 *
 * In production, install expo-notifications and update this to use the real API.
 * For now, this provides the scheduling structure that the app calls.
 */

let Notifications: any = null;

async function loadNotifications() {
  try {
    Notifications = require("expo-notifications");
  } catch {
    // expo-notifications not installed — notifications will be no-ops
  }
}

loadNotifications();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedule a daily reminder at 9pm to log today's outfit.
 */
export async function scheduleDailyReminder(): Promise<void> {
  if (!Notifications) {
    // Fallback: show a one-time alert explaining the feature
    return;
  }

  try {
    // Cancel existing daily reminders first
    await cancelDailyReminder();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "What did you wear today?",
        body: "Tap to log today's outfit and track your wardrobe stats!",
        sound: true,
      },
      trigger: {
        hour: 21,
        minute: 0,
        repeats: true,
      },
    });
  } catch {
    // Silently fail — notifications are optional
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Silently fail
  }
}
