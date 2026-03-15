// Design tokens shared across web (and future mobile)
export const tokens = {
  colors: {
    primary: '#005FF3',
    primaryDark: '#004BBF',
    primaryLight: '#E5EEFF',
    secondary: '#F09AD7',
    secondaryDark: '#C878B0',
    error: '#D93025',
    errorLight: '#F28B82',
    warning: '#F9AB00',
    success: '#1E8E3E',
    background: '#FFFFFF',
    backgroundAlt: '#E5EEFF',
    surface: '#FFFFFF',
    textPrimary: '#000000',
    textSecondary: '#444444',
    border: '#DADCE0',
    borderLight: '#E5EEFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    fontFamily: {
      heading: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      body: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      mono: '"Roboto Mono", "Consolas", monospace',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
      xxxl: 40,
    },
  },
} as const;

export type Tokens = typeof tokens;
