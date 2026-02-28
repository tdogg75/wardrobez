import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Theme, DarkTheme } from "@/constants/theme";

const THEME_KEY = "wardrobez:dark_mode";

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  theme: typeof Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
  theme: Theme,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "true") setIsDark(true);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? "true" : "false");
      return next;
    });
  }, []);

  const theme = isDark ? DarkTheme : Theme;

  return React.createElement(
    ThemeContext.Provider,
    { value: { isDark, toggleTheme, theme } },
    children
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
