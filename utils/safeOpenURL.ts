import { Alert, Linking } from "react-native";

/**
 * Opens a URL only if it uses the http: or https: scheme.
 * Prevents user-supplied URLs from triggering tel:, sms:, intent:, etc.
 */
export function safeOpenURL(url: string): void {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    Linking.openURL(trimmed);
  } else {
    Alert.alert("Invalid URL", "Only http and https links can be opened.");
  }
}
