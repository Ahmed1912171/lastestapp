// ctx/theme.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import colors, { getPalette } from "../app/_theme/colors";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

type ColorScheme = "light" | "dark";

type ThemeContextType = {
  isDarkMode: boolean;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleDarkMode: () => void;
  palette: ReturnType<typeof getPalette>;
};

const THEME_STORAGE_KEY = "APP_THEME_SCHEME";

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  colorScheme: "light",
  setColorScheme: () => {},
  toggleDarkMode: () => {},
  palette: getPalette("light"),
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme =
    (Appearance.getColorScheme() as ColorScheme | null) ?? "light";
  const [colorScheme, setColorSchemeState] =
    useState<ColorScheme>(systemScheme);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setColorSchemeState(stored);
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  const persistScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    try {
      AsyncStorage.setItem(THEME_STORAGE_KEY, scheme);
    } catch {
      // ignore storage errors, theme will still update
    }
  };

  const toggleDarkMode = () => {
    const nextScheme = colorScheme === "dark" ? "light" : "dark";
    persistScheme(nextScheme);
  };

  const palette = getPalette(colorScheme);

  const contextValue = useMemo(
    () => ({
      isDarkMode: colorScheme === "dark",
      colorScheme,
      setColorScheme: persistScheme,
      toggleDarkMode,
      palette,
    }),
    [colorScheme, palette]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {isReady ? children : null}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
