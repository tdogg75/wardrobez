const lightColors = {
  primary: "#6C63FF",
  primaryLight: "#8B85FF",
  primaryDark: "#4A42CC",
  secondary: "#FF6584",
  accent: "#43E97B",
  background: "#F8F9FE",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F1F8",
  text: "#1A1A2E",
  textSecondary: "#6B7280",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  error: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  shadow: "rgba(0, 0, 0, 0.08)",
};

const darkColors = {
  primary: "#8B85FF",
  primaryLight: "#A5A0FF",
  primaryDark: "#6C63FF",
  secondary: "#FF6584",
  accent: "#43E97B",
  background: "#0F0F1A",
  surface: "#1A1A2E",
  surfaceAlt: "#252540",
  text: "#F0F0F5",
  textSecondary: "#9CA3AF",
  textLight: "#6B7280",
  border: "#2D2D44",
  error: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  shadow: "rgba(0, 0, 0, 0.3)",
};

export const Theme = {
  colors: lightColors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    title: 34,
  },
} as const;

export const DarkTheme = {
  ...Theme,
  colors: darkColors,
} as const;

export type ThemeColors = typeof lightColors;

export function getTheme(isDark: boolean) {
  return isDark ? DarkTheme : Theme;
}
