import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '420px',
      ...defaultTheme.screens,
    },
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))', soft: 'hsl(var(--primary-soft))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        surface: 'hsl(var(--surface))',
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: '0 0% 100%', soft: 'hsl(var(--destructive-soft))' },
        warning: { DEFAULT: 'hsl(var(--warning))', soft: 'hsl(var(--warning-soft))' },
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        navy: '#0B1F3A',
        blue: { DEFAULT: '#1877F2' },
      },
      borderRadius: { lg: '0.75rem', xl: '1rem', '2xl': '1.25rem' },
      boxShadow: { card: '0 1px 2px rgba(11,31,58,0.04), 0 1px 1px rgba(11,31,58,0.03)' },
    },
  },
  plugins: [],
};
export default config;
