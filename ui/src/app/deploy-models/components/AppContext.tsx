import React, {createContext, useContext} from 'react';

interface AppContextValue {
    appName?: string;
    appNamespace?: string;
    projectName?: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({appName, appNamespace, projectName, children}: {appName?: string; appNamespace?: string; projectName?: string; children: React.ReactNode}) {
    return <AppContext.Provider value={{appName, appNamespace, projectName}}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useAppContext must be used inside AppContextProvider');
    return ctx;
}
