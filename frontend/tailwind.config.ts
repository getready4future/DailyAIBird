import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Editorial paper — kâğıt his, pure white değil
        paper: {
          DEFAULT: '#FBFAF7',
          50:  '#FDFCFA',
          100: '#F6F4EE',
          200: '#EDEAE0',
          300: '#DCD7C9',
        },
        // Ink — pure black yerine sıcak siyah
        ink: {
          DEFAULT: '#161513',
          900: '#161513',
          700: '#2A2825',
          500: '#5A554D',
          400: '#8C8780',
          300: '#B8B3AA',
        },
        // Brand — petrol/teal: warm tech, "startup blue"dan uzak
        brand: {
          50:  '#EEF6F6',
          100: '#D5E9E8',
          200: '#A9D2D0',
          300: '#7DBAB7',
          400: '#3F8F8B',
          500: '#1F7773',
          600: '#175E5B',
          700: '#114744',
          800: '#0D3735',
          900: '#0A2D2B',
        },
        // Accent — warm ochre for "Featured" highlights
        accent: {
          50:  '#FBF3E0',
          100: '#F4E4B6',
          400: '#E8B84B',
          500: '#C9921F',
          700: '#8B6210',
        },
      },
      fontFamily: {
        sans:  ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Iowan Old Style"', 'Georgia', 'Cambria', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        'reading':    '68ch',  // ~640px — Verge-style
        'reading-lg': '74ch',  // ~720px — Stratechery-style
      },
      letterSpacing: {
        'tightest-2': '-0.025em',
      },
      typography: ({ theme }: { theme: (k: string) => string }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.ink.700'),
            '--tw-prose-headings': theme('colors.ink.DEFAULT'),
            '--tw-prose-links': theme('colors.brand.600'),
            '--tw-prose-bold': theme('colors.ink.DEFAULT'),
            '--tw-prose-quotes': theme('colors.ink.700'),
            '--tw-prose-quote-borders': theme('colors.brand.500'),
            '--tw-prose-bullets': theme('colors.ink.300'),
            '--tw-prose-hr': theme('colors.paper.200'),
            'p, li': { fontFamily: 'Source Serif 4, Iowan Old Style, Georgia, serif' },
            'h1, h2, h3, h4': {
              fontFamily: 'Source Serif 4, Iowan Old Style, Georgia, serif',
              letterSpacing: '-0.01em',
              fontWeight: '600',
            },
            a: { textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
            blockquote: {
              fontFamily: 'Source Serif 4, Iowan Old Style, Georgia, serif',
              fontStyle: 'italic',
            },
            code: { fontFamily: 'JetBrains Mono, ui-monospace, monospace' },
          },
        },
      }),
    },
  },
  plugins: [typography],
} satisfies Config
