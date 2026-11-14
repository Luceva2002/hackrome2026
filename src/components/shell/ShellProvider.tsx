'use client';

import { createContext, useContext, useMemo, useState } from 'react';

interface ShellValue {
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const value = useMemo(
    () => ({ searchOpen, openSearch: () => setSearchOpen(true), closeSearch: () => setSearchOpen(false) }),
    [searchOpen],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell fuori da ShellProvider');
  return ctx;
}
