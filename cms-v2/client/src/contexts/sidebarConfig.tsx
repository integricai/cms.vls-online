import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { buildDefaultConfig, type SidebarConfig } from '../nav';

interface SidebarConfigCtx {
  config: SidebarConfig;
  loading: boolean;
  reload: () => Promise<void>;
}

const SidebarConfigContext = createContext<SidebarConfigCtx>({
  config: buildDefaultConfig(),
  loading: false,
  reload: async () => {},
});

export function SidebarConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SidebarConfig>(buildDefaultConfig);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const row = await api.get<{ key: string; data: unknown }>('/content/vls-sidebar-config');
      if (row?.data && Array.isArray(row.data)) {
        setConfig(row.data as SidebarConfig);
      }
    } catch {
      // No saved config yet — keep default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <SidebarConfigContext.Provider value={{ config, loading, reload }}>
      {children}
    </SidebarConfigContext.Provider>
  );
}

export function useSidebarConfig(): SidebarConfigCtx {
  return useContext(SidebarConfigContext);
}
