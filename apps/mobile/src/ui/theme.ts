export const colors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F7FB",
  text: "#111827",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  primary: "#0F172A",
  primaryBlue: "#2563EB",
  agent: "#EEF2FF",
  agentStrong: "#4F46E5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#DC2626",
  border: "#E2E8F0",
  reportDark: "#101827"
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999
} as const;

export const typeScale = {
  caption: 12,
  label: 14,
  body: 16,
  title: 24,
  largeTitle: 34,
  score: 72
} as const;

export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  }
} as const;
