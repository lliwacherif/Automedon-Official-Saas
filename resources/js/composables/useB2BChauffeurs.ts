import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface B2BChauffeur {
    id: number;
    tenant_id: string;
    b2b_client_id: number;
    nom: string;
    prenom: string | null;
    permit_number: string | null;
    cin: string | null;
    created_at: string;
}

export interface B2BChauffeurInput {
    nom: string;
    prenom?: string | null;
    permit_number?: string | null;
    cin?: string | null;
}

export function useB2BChauffeurs() {
    // Holds every chauffeur for the current tenant. The page groups them
    // per agency (b2b_client_id) so the cards can show a count and the
    // manager modal can list a single agency's drivers.
    const chauffeurs = ref<B2BChauffeur[]>([]);
    const loading = ref(false);
    const tenantStore = useTenantStore();

    async function fetchChauffeurs() {
        loading.value = true;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) { chauffeurs.value = []; loading.value = false; return; }

        try {
            const { data, error } = await supabase
                .from('b2b_chauffeurs')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: true })
                .limit(2000);
            if (error) throw error;
            chauffeurs.value = (data || []) as B2BChauffeur[];
        } catch (e: any) {
            console.error('Error fetching B2B chauffeurs:', e);
        } finally {
            loading.value = false;
        }
    }

    async function createChauffeur(clientId: number, input: B2BChauffeurInput) {
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) throw new Error('No tenant');
        try {
            const { data, error } = await (supabase.from('b2b_chauffeurs') as any)
                .insert([{
                    tenant_id: tenantId,
                    b2b_client_id: clientId,
                    nom: input.nom,
                    prenom: input.prenom || null,
                    permit_number: input.permit_number || null,
                    cin: input.cin || null,
                }])
                .select()
                .single();
            if (error) throw error;
            chauffeurs.value.push(data as B2BChauffeur);
            return data as B2BChauffeur;
        } catch (e: any) {
            console.error('Error creating B2B chauffeur:', e);
            throw e;
        }
    }

    async function deleteChauffeur(id: number) {
        try {
            const { error } = await supabase.from('b2b_chauffeurs').delete().eq('id', id);
            if (error) throw error;
            chauffeurs.value = chauffeurs.value.filter((c) => c.id !== id);
        } catch (e: any) {
            console.error('Error deleting B2B chauffeur:', e);
            throw e;
        }
    }

    return { chauffeurs, loading, fetchChauffeurs, createChauffeur, deleteChauffeur };
}
