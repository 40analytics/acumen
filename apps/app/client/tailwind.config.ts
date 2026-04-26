import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface palette — matches Astro marketing site
        bg: '#EDF1E7',
        surface: '#FFFFFF',
        'surface-alt': '#E2E9D5',
        ink: '#0A0A0B',
        'ink-soft': '#27272A',
        muted: '#71717A',
        faint: '#A1A1AA',
        border: '#E7E5E0',
        'border-soft': '#F0EFEB',

        // Accent palette — academic premium
        accent: {
          DEFAULT: '#9A3412',
          soft: '#FED7AA',
        },
        honey: {
          DEFAULT: '#CA8A04',
          soft: '#FDE68A',
        },
        sage: {
          DEFAULT: '#166534',
          soft: '#BBF7D0',
        },
        coral: {
          DEFAULT: '#BE185D',
          soft: '#FBCFE8',
        },
        plum: {
          DEFAULT: '#1E40AF',
          soft: '#DBEAFE',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(10,10,11,0.04)',
        DEFAULT: '0 1px 3px rgba(10,10,11,0.07), 0 1px 2px rgba(10,10,11,0.04)',
        md: '0 4px 12px rgba(10,10,11,0.08)',
        lg: '0 20px 40px rgba(10,10,11,0.1)',
        focus: '0 0 0 3px rgba(10,10,11,0.05)',
      },
      animation: {
        pulse: 'pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
