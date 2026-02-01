import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface FaithfulClient {
    id: number;
    tenant_id: string;
    full_name: string;
    cin: string;
    phone: string;
    email?: string;
    created_at: string;
    updated_at: string;
}

export function useFaithfulClients() {
    const clients = ref<FaithfulClient[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const tenantStore = useTenantStore();

    async function fetchFaithfulClients() {
        loading.value = true;
        error.value = null;

        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            loading.value = false;
            return;
        }

        try {
            const { data, error: supabaseError } = await (supabase
                .from('faithful_clients') as any)
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (supabaseError) throw supabaseError;

            clients.value = data as FaithfulClient[];
        } catch (e: any) {
            console.error('Error fetching faithful clients:', e);
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    }

    async function searchFaithfulClients(query: string) {
        if (!query || query.length < 2) return [];

        loading.value = true;
        const tenantId = tenantStore.currentTenant?.id;

        try {
            let dbQuery = (supabase
                .from('faithful_clients') as any)
                .select('*')
                .eq('tenant_id', tenantId);

            // Search by name OR cin
            // Note: simple OR syntax in supabase .or()
            dbQuery = dbQuery.or(`full_name.ilike.%${query}%,cin.ilike.%${query}%`);

            const { data, error: supabaseError } = await dbQuery.limit(10);

            if (supabaseError) throw supabaseError;

            return data as FaithfulClient[];
        } catch (e: any) {
            console.error('Error searching faithful clients:', e);
            return [];
        } finally {
            loading.value = false;
        }
    }

    async function createFaithfulClient(client: Omit<FaithfulClient, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) {
        loading.value = true;
        error.value = null;

        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            error.value = "No tenant selected";
            loading.value = false;
            return null;
        }

        try {
            const { data, error: supabaseError } = await (supabase
                .from('faithful_clients') as any)
                .insert([
                    {
                        ...client,
                        tenant_id: tenantId
                    }
                ])
                .select()
                .single();

            if (supabaseError) throw supabaseError;

            // Add to local list if it exists
            if (data) {
                clients.value.unshift(data as FaithfulClient);
            }

            return data;
        } catch (e: any) {
            console.error('Error creating faithful client:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function deleteFaithfulClient(id: number) {
        loading.value = true;
        try {
            const { error: supabaseError } = await (supabase
                .from('faithful_clients') as any)
                .delete()
                .eq('id', id);

            if (supabaseError) throw supabaseError;

            clients.value = clients.value.filter(c => c.id !== id);
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return {
        clients,
        loading,
        error,
        fetchFaithfulClients,
        searchFaithfulClients,
        createFaithfulClient,
        deleteFaithfulClient
    };
}
