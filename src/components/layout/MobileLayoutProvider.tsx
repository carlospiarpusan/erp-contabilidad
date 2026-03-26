'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface MobileLayoutContextValue {
  isMobile: boolean
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  closeSidebar: () => void
}

const MobileLayoutContext = createContext<MobileLayoutContextValue>({
  isMobile: false,
  sidebarOpen: false,
  setSidebarOpen: () => {},
  closeSidebar: () => {},
})

export function MobileLayoutProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <MobileLayoutContext.Provider value={{ isMobile, sidebarOpen, setSidebarOpen, closeSidebar }}>
      {children}
    </MobileLayoutContext.Provider>
  )
}

export function useMobileLayout() {
  return useContext(MobileLayoutContext)
}
