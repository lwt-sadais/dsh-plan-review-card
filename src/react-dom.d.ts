declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react'

  /** Render children outside their logical React parent while preserving context and event bubbling. */
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: null | string): ReactPortal
}
