import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Theme, DarkTheme, OledTheme, type ThemeMode } from "@/constants/theme";

const THEME_KEY = "wardrobez:theme_mode";

interface ThemeContextValue {
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  theme: typeof Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  themeMode: "light",
  setThemeMode: () => {},
  toggleTheme: () => {},
  theme: Theme,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "dark" || val === "oled") setThemeModeState(val);
      // Legacy: "true" meant dark mode
      else if (val === "true") setThemeModeState("dark");
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_KEY, mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const theme = themeMode === "oled" ? OledTheme : themeMode === "dark" ? DarkTheme : Theme;
  const isDark = themeMode !== "light";

  return React.createElement(
    ThemeContext.Provider,
    { value: { isDark, themeMode, setThemeMode, toggleTheme, theme } },
    children
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
