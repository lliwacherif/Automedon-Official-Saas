import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface FaithfulClient {
    id: number;
    tenant_id: string;
    /** Full display name, kept in sync as "first_name last_name" for autocomplete/search. */
    full_name: string;
    first_name?: string;
    last_name?: string;
    cin: string;
    phone?: string;
    email?: string;
    permit_number?: string;
    cin_date?: string;
    permit_date?: string;
    /** Postal address. Auto-filled into the reservation form on selection. */
    address?: string;
    /** ISO-formatted date string (YYYY-MM-DD). */
    date_of_birth?: string;
    /** URLs of up to 2 personal documents (CIN, permit, etc.). */
    documents?: string[];
    created_at: string;
    updated_at: string;
}

export const FAITHFUL_CLIENT_MAX_DOCUMENTS = 2;

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

    /**
     * Checks whether a faithful client already exists for the given CIN (case-
     * sensitive exact match) in the current tenant. Returns:
     *   - true  → CIN is already registered
     *   - false → CIN is NOT registered
     *   - null  → check failed (tenant missing or RPC error) — caller should
     *             treat as "unknown" and skip any prompts.
     */
    async function isFaithfulClientCinRegistered(cin: string): Promise<boolean | null> {
        if (!cin) return null;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) return null;

        try {
            const { data, error: supabaseError } = await (supabase
                .from('faithful_clients') as any)
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('cin', cin)
                .limit(1);

            if (supabaseError) {
                console.error('Faithful client CIN check failed:', supabaseError);
                return null;
            }
            return Boolean(data && data.length > 0);
        } catch (e: any) {
            console.error('Faithful client CIN check failed:', e);
            return null;
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

    /**
     * Partial update of a faithful client. Unspecified keys are left untouched.
     * Empty strings should be passed as `null` by the caller to clear a field.
     */
    async function updateFaithfulClient(
        id: number,
        updates: Partial<Omit<FaithfulClient, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>>,
    ): Promise<FaithfulClient | null> {
        loading.value = true;
        error.value = null;
        try {
            const payload: Record<string, unknown> = {
                ...updates,
                updated_at: new Date().toISOString(),
            };

            const { data, error: supabaseError } = await (supabase
                .from('faithful_clients') as any)
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (supabaseError) throw supabaseError;

            const updated = data as FaithfulClient;
            const idx = clients.value.findIndex((c) => c.id === id);
            if (idx !== -1) clients.value[idx] = { ...clients.value[idx], ...updated };
            return updated;
        } catch (e: any) {
            console.error('Error updating faithful client:', e);
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

    /**
     * Replace the documents array for a faithful client. The DB constraint
     * caps the array at 2 entries; we mirror that here so the UI fails fast.
     */
    async function setClientDocuments(id: number, documents: string[]): Promise<FaithfulClient | null> {
        if (documents.length > FAITHFUL_CLIENT_MAX_DOCUMENTS) {
            throw new Error(`Maximum ${FAITHFUL_CLIENT_MAX_DOCUMENTS} documents par client.`);
        }

        try {
            const { data, error: supabaseError } = await (supabase
                .from('faithful_clients') as any)
                .update({ documents })
                .eq('id', id)
                .select()
                .single();

            if (supabaseError) throw supabaseError;

            const updated = data as FaithfulClient;
            const idx = clients.value.findIndex(c => c.id === id);
            if (idx !== -1) clients.value[idx] = { ...clients.value[idx], ...updated };
            return updated;
        } catch (e: any) {
            console.error('Error updating client documents:', e);
            error.value = e.message;
            throw e;
        }
    }

    return {
        clients,
        loading,
        error,
        fetchFaithfulClients,
        searchFaithfulClients,
        isFaithfulClientCinRegistered,
        createFaithfulClient,
        updateFaithfulClient,
        deleteFaithfulClient,
        setClientDocuments,
    };
}
