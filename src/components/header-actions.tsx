'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface HeaderActionsContextType {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType>({
  actions: null,
  setActions: () => {},
});

export const HeaderActionsProvider = ({ children }: { children: ReactNode }) => {
  const [actions, setActions] = useState<ReactNode | null>(null);
  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </HeaderActionsContext.Provider>
  );
};

export const useHeaderActions = () => useContext(HeaderActionsContext);

/**
 * Component to be used within pages to "push" content into the layout header.
 */
export const PageHeaderActions = ({ children }: { children: ReactNode }) => {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions(children);
    return () => setActions(null);
  }, [children, setActions]);

  return null;
};

/**
 * Component to be used in the layout to display the actions.
 */
export const HeaderActionsDisplay = () => {
  const { actions } = useHeaderActions();
  return actions ? <div className="flex items-center gap-2 w-full">{actions}</div> : null;
};
