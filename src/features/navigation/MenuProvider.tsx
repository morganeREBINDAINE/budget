import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Drawer } from '@/design-system';

import { AppMenu } from './AppMenu';

type MenuContextValue = { open: () => void; close: () => void };

const MenuContext = createContext<MenuContextValue | null>(null);

// Un seul tiroir pour tous les écrans de (app), affiché par-dessus la pile.
export function MenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <MenuContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <Drawer open={isOpen} onClose={close}>
          <AppMenu onNavigate={close} />
        </Drawer>
      </View>
    </MenuContext.Provider>
  );
}

export function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('useMenu doit être utilisé dans MenuProvider');
  return ctx;
}
