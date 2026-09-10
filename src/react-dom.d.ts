declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react'

  /** Render children outside their logical React parent while preserving context and event bubbling. */
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: null | string): ReactPortal
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react'

  /** A mounted React root controlling its own DOM container. */
  export interface Root {
    render(children: ReactNode): void
    unmount(): void
  }

  /** Create a React root that owns one DOM container for the plugin lifetime. */
  export function createRoot(container: Element): Root
}
