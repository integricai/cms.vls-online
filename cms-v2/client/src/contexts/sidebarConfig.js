import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { buildDefaultConfig } from '../nav';
const SidebarConfigContext = createContext({
    config: buildDefaultConfig(),
    loading: false,
    reload: async () => { },
});
export function SidebarConfigProvider({ children }) {
    const [config, setConfig] = useState(buildDefaultConfig);
    const [loading, setLoading] = useState(true);
    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const row = await api.get('/content/vls-sidebar-config');
            if (row?.data && Array.isArray(row.data)) {
                setConfig(row.data);
            }
        }
        catch {
            // No saved config yet — keep default
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { reload(); }, [reload]);
    return (_jsx(SidebarConfigContext.Provider, { value: { config, loading, reload }, children: children }));
}
export function useSidebarConfig() {
    return useContext(SidebarConfigContext);
}
