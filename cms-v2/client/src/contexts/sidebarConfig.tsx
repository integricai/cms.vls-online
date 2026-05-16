import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import {
  buildDefaultConfig,
  type SidebarConfig,
  type SidebarConfigGroup,
  type SidebarConfigItem,
  type SidebarConfigSubGroup,
} from '../nav';

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

function mergeItems(
  saved: Array<SidebarConfigItem | SidebarConfigSubGroup>,
  defaults: Array<SidebarConfigItem | SidebarConfigSubGroup>,
): Array<SidebarConfigItem | SidebarConfigSubGroup> {
  const merged = saved.filter(item => {
    if (item.type === 'item') return defaults.some(defaultItem => defaultItem.type === 'item' && defaultItem.id === item.id);
    return defaults.some(defaultItem => defaultItem.type === 'subgroup' && defaultItem.id === item.id);
  });

  for (const defaultItem of defaults) {
    const existing = merged.find(item => item.type === defaultItem.type && item.id === defaultItem.id);
    if (!existing) {
      merged.push(defaultItem);
      continue;
    }
    if (existing.type === 'subgroup' && defaultItem.type === 'subgroup') {
      existing.children = mergeItems(existing.children, defaultItem.children) as SidebarConfigItem[];
    }
  }

  return merged;
}

function mergeWithDefaults(saved: SidebarConfig): SidebarConfig {
  const defaults = buildDefaultConfig();
  const merged: SidebarConfig = [];

  for (const savedGroup of saved) {
    const defaultGroup = defaults.find(group => group.id === savedGroup.id);
    if (!defaultGroup) continue;
    merged.push({
      ...savedGroup,
      children: mergeItems(savedGroup.children, defaultGroup.children),
    });
  }

  for (const defaultGroup of defaults) {
    if (!merged.some(group => group.id === defaultGroup.id)) {
      merged.push(defaultGroup as SidebarConfigGroup);
    }
  }

  return merged;
}

export function SidebarConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SidebarConfig>(buildDefaultConfig);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const row = await api.get<{ key: string; data: unknown }>('/content/vls-sidebar-config');
      if (row?.data && Array.isArray(row.data)) {
        setConfig(mergeWithDefaults(row.data as SidebarConfig));
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
