import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

const assignedApps = ref<Set<string>>(new Set());
const loading = ref(false);
const loaded = ref(false);

export function useAppAccess() {
    const tenantStore = useTenantStore();

    async function fetchAssignedApps() {
        if (!tenantStore.currentTenant?.id) return;

        loading.value = true;
        try {
            // 1. Get all app assignments for this tenant
            const { data, error } = await supabase
                .from('app_assignments')
                .select(`
                    app_id,
                    store_apps (
                        name
                    )
                `)
                .eq('tenant_id', tenantStore.currentTenant.id);

            if (error) throw error;

            // 2. Store the names of assigned apps
            assignedApps.value.clear();
            data?.forEach((assignment: any) => {
                if (assignment.store_apps?.name) {
                    assignedApps.value.add(assignment.store_apps.name);
                }
            });
            loaded.value = true;
        } catch (e) {
            console.error('Error fetching assigned apps:', e);
        } finally {
            loading.value = false;
        }
    }

    function hasAccess(appName: string): boolean {
        // If not loaded yet, maybe trigger load? Or rely on component to call fetch.
        // For simplicity, we assume fetchAssignedApps is called at layout/page level or on mount.
        return assignedApps.value.has(appName);
    }

    return {
        assignedApps,
        loading,
        loaded,
        fetchAssignedApps,
        hasAccess
    };
}
