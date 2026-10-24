// Delete this file and put your own home page in app/actions/controller.tsx
import { css } from 'remix/component'

import { Document } from './document.tsx'
import { Counter } from './public/counter.tsx'

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function HomePage() {
  return () => (
    <Document>
      <main
        mix={css({
          // Light-mode design tokens (default).
          '--surface-0': '#dee2e6',
          '--surface-3': '#f0f4f7',
          '--surface-4': '#f7fbff',
          '--text-primary': '#313539',
          '--text-tertiary': '#94989c',
          '--brand-blue': '#2dacf9',
          // Dark-mode overrides.
          '@media (prefers-color-scheme: dark)': {
            '--surface-0': '#1e2226',
            '--surface-3': '#313539',
            '--surface-4': '#363a3e',
            '--text-primary': '#dee2e6',
            '--text-tertiary': '#94989c',
          },
          '& *, & *::before, & *::after': { boxSizing: 'border-box' },
          margin: 0,
          padding: '48px 24px',
          minHeight: '100vh',
          background: 'var(--surface-0)',
          color: 'var(--text-primary)',
          fontFamily: FONT_STACK,
          fontSize: '14px',
          lineHeight: 1.5,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <p>Taqyeem</p>
        <Counter initialCount={1}/>
      </main>
    </Document>
  )
}
