import { useTheme } from "../ctx/theme";

export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme;
}
