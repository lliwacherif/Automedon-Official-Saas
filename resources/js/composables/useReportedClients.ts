import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface ReportedClient {
    id: number;
    tenant_id: string;
    client_name: string;
    client_cin: string;
    client_phone: string;
    description: string;
    created_at: string;
}

export function useReportedClients() {
    const tenantStore = useTenantStore();
    const reportedClients = ref<ReportedClient[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchReportedClients() {
        loading.value = true;
        error.value = null;
        try {
            const { data, error: err } = await supabase
                .from('reported_clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (err) throw err;
            reportedClients.value = data || [];
        } catch (e: any) {
            console.error('Error fetching reported clients:', e);
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    }

    async function addReport(client: Omit<ReportedClient, 'id' | 'created_at' | 'tenant_id'>) {
        if (!tenantStore.currentTenant?.id) return;

        loading.value = true;
        error.value = null;
        try {
            const { error: err } = await supabase
                .from('reported_clients')
                .insert([{
                    ...client,
                    tenant_id: tenantStore.currentTenant.id
                }]);

            if (err) throw err;
            await fetchReportedClients();
        } catch (e: any) {
            console.error('Error adding report:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function checkClientStatus(cin: string): Promise<ReportedClient | null> {
        if (!cin) return null;
        try {
            const { data, error: err } = await supabase
                .from('reported_clients')
                .select('*')
                .eq('client_cin', cin)
                .maybeSingle();

            if (err) throw err;
            return data;
        } catch (e) {
            console.error('Error checking client status:', e);
            return null;
        }
    }

    return {
        reportedClients,
        loading,
        error,
        fetchReportedClients,
        addReport,
        checkClientStatus
    };
}
