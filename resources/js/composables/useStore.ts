import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
// Tenant context NOT needed for fetching global apps, 
// but auth context might be needed if we restrict "buying" later.

export interface StoreApp {
    id: number;
    created_at: string;
    // tenant_id removed for global apps
    name: string;
    description: string;
    price: number;
    icon_url?: string;
    is_active: boolean; // Added is_active
}

export interface AppAssignment {
    id: number;
    app_id: number;
    tenant_id: string;
    created_at: string;
    status: string;
}

export function useStore() {
    const apps = ref<StoreApp[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    // Fetch ALL active apps (Global Store)
    async function fetchApps() {
        loading.value = true;
        error.value = null;

        try {
            const { data, error: fetchError } = await (supabase
                .from('store_apps')
                .select('*')
                .eq('is_active', true) // Only active apps
                .order('created_at', { ascending: false }) as any);

            if (fetchError) throw fetchError;

            apps.value = data || [];
        } catch (e: any) {
            error.value = e.message;
            console.error('Error fetching apps:', e);
        } finally {
            loading.value = false;
        }
    }

    // Root Admin: Add App
    async function addApp(appData: Omit<StoreApp, 'id' | 'created_at' | 'is_active'>, iconFile?: File) {
        loading.value = true;
        error.value = null;

        try {
            let iconUrl = appData.icon_url || null;

            // Upload icon if provided
            if (iconFile) {
                const fileExt = iconFile.name.split('.').pop();
                const fileName = `global/${Math.random()}.${fileExt}`; // Store in global folder?

                const { error: uploadError } = await supabase.storage
                    .from('store-icons')
                    .upload(fileName, iconFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('store-icons')
                    .getPublicUrl(fileName);

                iconUrl = data.publicUrl;
            }

            const { data, error: insertError } = await (supabase
                .from('store_apps')
                .insert([
                    {
                        name: appData.name,
                        description: appData.description,
                        price: appData.price,
                        icon_url: iconUrl,
                        is_active: true
                    }
                ] as any)
                .select()
                .single() as any);

            if (insertError) throw insertError;

            // Refresh list
            await fetchApps();
            return data;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error adding app:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // Root Admin: Delete App
    async function deleteApp(id: number) {
        loading.value = true;
        error.value = null;

        try {
            const { error: deleteError } = await supabase
                .from('store_apps')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            // Remove from local list
            apps.value = apps.value.filter(a => a.id !== id);
        } catch (e: any) {
            error.value = e.message;
            console.error('Error deleting app:', e);
        } finally {
            loading.value = false;
        }
    }

    async function assignAppToTenant(appId: number, tenantId: string) {
        loading.value = true;
        error.value = null;

        try {
            const { error: insertError } = await (supabase
                .from('app_assignments') as any)
                .insert([
                    {
                        app_id: appId,
                        tenant_id: tenantId,
                        status: 'active'
                    }
                ]);

            if (insertError) throw insertError;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error assigning app:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // Root Admin: Unassign App from Tenant
    async function unassignAppFromTenant(appId: number, tenantId: string) {
        loading.value = true;
        error.value = null;

        try {
            const { error: deleteError } = await supabase
                .from('app_assignments')
                .delete()
                .eq('app_id', appId)
                .eq('tenant_id', tenantId);

            if (deleteError) throw deleteError;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error unassigning app:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // Fetch assignments for a specific app
    async function fetchAppAssignments(appId: number) {
        try {
            const { data, error: fetchError } = await (supabase
                .from('app_assignments')
                .select('*')
                .eq('app_id', appId) as any);

            if (fetchError) throw fetchError;
            return data as AppAssignment[];
        } catch (e: any) {
            console.error('Error fetching assignments:', e);
            return [];
        }
    }

    return {
        apps,
        loading,
        error,
        fetchApps,
        addApp,
        deleteApp,
        assignAppToTenant,
        unassignAppFromTenant,
        fetchAppAssignments
    };
}
