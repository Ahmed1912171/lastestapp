const colors = {
  light: {
    primary: "#02A452",
    secondary: "#6c757d",
    success: "#28a745",
    danger: "#dc3545",
    warning: "#ffc107",
    info: "#17a2b8",
    background: "#ffffff",
    surface: "#f9fafb",
    card: "#ffffff",
    text: "#212529",
    mutedText: "#6b7280",
    border: "#e5e7eb",
  },
  dark: {
    primary: "#02A452",
    secondary: "#6c757d",
    success: "#28a745",
    danger: "#dc3545",
    warning: "#ffc107",
    info: "#17a2b8",
    background: "#000000",
    surface: "#080808",
    card: "#0d0d0d",
    text: "#f8fafc",
    mutedText: "#a1a1aa",
    border: "#1a1a1a",
  },
};

export type ThemePalette = keyof typeof colors;
export const getPalette = (mode: ThemePalette) => colors[mode];
export default colors;
