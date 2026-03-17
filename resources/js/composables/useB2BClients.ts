import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface B2BClient {
    id: number;
    tenant_id: string;
    company_name: string;
    contact_name: string | null;
    address: string | null;
    mf: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    created_at: string;
}

export function useB2BClients() {
    const clients = ref<B2BClient[]>([]);
    const loading = ref(false);
    const tenantStore = useTenantStore();

    async function fetchClients() {
        loading.value = true;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) { clients.value = []; loading.value = false; return; }

        try {
            const { data, error } = await supabase
                .from('b2b_clients')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('company_name', { ascending: true })
                .limit(500);
            if (error) throw error;
            clients.value = (data || []) as B2BClient[];
        } catch (e: any) {
            console.error('Error fetching B2B clients:', e);
        } finally {
            loading.value = false;
        }
    }

    async function createClient(client: Partial<B2BClient>) {
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) throw new Error('No tenant');
        loading.value = true;
        try {
            const { data, error } = await (supabase.from('b2b_clients') as any)
                .insert([{ ...client, tenant_id: tenantId }])
                .select()
                .single();
            if (error) throw error;
            await fetchClients();
            return data;
        } catch (e: any) {
            console.error('Error creating B2B client:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function updateClient(id: number, client: Partial<B2BClient>) {
        loading.value = true;
        try {
            const { data, error } = await (supabase.from('b2b_clients') as any)
                .update(client)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            await fetchClients();
            return data;
        } catch (e: any) {
            console.error('Error updating B2B client:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function deleteClient(id: number) {
        loading.value = true;
        try {
            const { error } = await supabase.from('b2b_clients').delete().eq('id', id);
            if (error) throw error;
            await fetchClients();
        } catch (e: any) {
            console.error('Error deleting B2B client:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return { clients, loading, fetchClients, createClient, updateClient, deleteClient };
}
