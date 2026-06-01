import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface PlannedReservation {
    id: number;
    tenant_id: string;
    client_name: string;
    client_phone: string | null;
    start_date: string; // YYYY-MM-DD — début de la période prévue
    end_date: string | null; // YYYY-MM-DD — fin de la période prévue
    price_per_day: number | null; // prix par jour estimé
    pickup_location: string | null;
    return_location: string | null;
    car_note: string | null;
    created_at: string;
}

export interface PlannedReservationInput {
    client_name: string;
    client_phone?: string | null;
    start_date: string;
    end_date?: string | null;
    price_per_day?: number | null;
    pickup_location?: string | null;
    return_location?: string | null;
    car_note?: string | null;
}

export function useAgenda() {
    const items = ref<PlannedReservation[]>([]);
    const loading = ref(false);
    const tenantStore = useTenantStore();

    async function fetchPlanned() {
        loading.value = true;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) { items.value = []; loading.value = false; return; }

        try {
            const { data, error } = await supabase
                .from('planned_reservations')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('start_date', { ascending: true })
                .limit(2000);
            if (error) throw error;
            items.value = (data || []) as PlannedReservation[];
        } catch (e: any) {
            console.error('Error fetching planned reservations:', e);
        } finally {
            loading.value = false;
        }
    }

    async function createPlanned(input: PlannedReservationInput) {
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) throw new Error('No tenant');
        loading.value = true;
        try {
            const { data, error } = await (supabase.from('planned_reservations') as any)
                .insert([{
                    tenant_id: tenantId,
                    client_name: input.client_name,
                    client_phone: input.client_phone || null,
                    start_date: input.start_date,
                    end_date: input.end_date || null,
                    price_per_day: input.price_per_day ?? null,
                    pickup_location: input.pickup_location || null,
                    return_location: input.return_location || null,
                    car_note: input.car_note || null,
                }])
                .select()
                .single();
            if (error) throw error;
            await fetchPlanned();
            return data;
        } catch (e: any) {
            console.error('Error creating planned reservation:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function updatePlanned(id: number, input: Partial<PlannedReservationInput>) {
        loading.value = true;
        try {
            const { data, error } = await (supabase.from('planned_reservations') as any)
                .update(input)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            await fetchPlanned();
            return data;
        } catch (e: any) {
            console.error('Error updating planned reservation:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function deletePlanned(id: number) {
        loading.value = true;
        try {
            const { error } = await supabase.from('planned_reservations').delete().eq('id', id);
            if (error) throw error;
            items.value = items.value.filter((i) => i.id !== id);
        } catch (e: any) {
            console.error('Error deleting planned reservation:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return { items, loading, fetchPlanned, createPlanned, updatePlanned, deletePlanned };
}
