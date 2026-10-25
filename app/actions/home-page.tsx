// Delete this file and put your own home page in app/actions/controller.tsx
import { css } from 'remix/component'

import { Document } from './document.tsx'
import { Counter } from './public/counter.tsx'

const mainStyle = css({
  minBlockSize: '100vh',
  paddingBlock: 'var(--space-8)',
  paddingInline: 'var(--space-6)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-4)',
})

export function HomePage() {
  return () => (
    <Document>
      <main mix={mainStyle}>
        <p>Taqyeem</p>
        <Counter initialCount={1} />
      </main>
    </Document>
  )
}
