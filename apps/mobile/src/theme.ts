// ─── Pulse design system ─────────────────────────────────────────────────
// Premium, dark, calm. Electric-indigo brand. Built so the product feels
// high-end out of the box (vision: "one clean dashboard, zero learning curve").

export const colors = {
  bg: '#141726',
  bgElevated: '#1B1F31',
  surface: '#232840',
  surfaceAlt: '#2C3250',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  text: '#F5F7FE',
  textDim: '#B8BED4',
  textFaint: '#838AAA',

  brand: '#8B73FF',
  brandSoft: '#B7AAFF',
  accent: '#4DE2FF',

  critical: '#FF6B86',
  warning: '#FFC04D',
  info: '#6FB4FF',
  success: '#3CE0AE',
} as const;

export const gradients = {
  brand: ['#9B82FF', '#5BD0FF'] as const,
  hero: ['#2E2470', '#1A1E33'] as const,
  critical: ['#FF7E97', '#FF4D6B'] as const,
  card: ['#262C46', '#1E2338'] as const,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;

export const font = {
  h1: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  glow: {
    shadowColor: colors.brand,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};

export const severityColor = (s: string) =>
  s === 'critical'
    ? colors.critical
    : s === 'warning'
      ? colors.warning
      : s === 'success'
        ? colors.success
        : colors.info;
