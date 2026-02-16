import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { useTenantStore } from '@/stores/tenant';
import { useCars } from './useCars';
import type { Car } from './useCars';

export type ServiceType = 'transfert' | 'excursion';

export interface Service {
    id: number;
    tenant_id: string;
    service_type: ServiceType;
    car_id: number;
    start_date: string;
    end_date: string;
    chauffeur_name: string;
    chauffeur_cin: string;
    price: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    car?: Car;
}

export function useServices() {
    const services = ref<Service[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const tenantStore = useTenantStore();
    const { updateCar } = useCars();

    async function fetchServices() {
        loading.value = true;
        error.value = null;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) { services.value = []; loading.value = false; return; }

        try {
            const { data, error: err } = await supabase
                .from('services')
                .select('*, car:cars(*)')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (err) throw err;

            services.value = (data || []).map((s: any) => {
                const svc = { ...s } as Service;
                if (s.car) {
                    svc.car = { ...s.car, plate_number: s.car.license_plate };
                }
                return svc;
            });
        } catch (e: any) {
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    }

    async function createService(service: Database['public']['Tables']['services']['Insert']) {
        loading.value = true;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) throw new Error('Pas de contexte tenant.');

        try {
            const payload = { ...service, tenant_id: tenantId };
            const { data, error: err } = await (supabase.from('services') as any)
                .insert(payload)
                .select();
            if (err) throw err;

            // Set car as 'loue' if service is currently active
            const now = new Date();
            const start = new Date(service.start_date);
            const end = new Date(service.end_date);
            if (start <= now && end >= now) {
                await updateCar(service.car_id, { status: 'loue' });
            }

            await fetchServices();
            return data?.[0] || null;
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function updateService(id: number, service: Database['public']['Tables']['services']['Update']) {
        loading.value = true;
        try {
            const { data, error: err } = await (supabase.from('services') as any)
                .update(service)
                .eq('id', id)
                .select();
            if (err) throw err;
            await fetchServices();
            return data?.[0] || null;
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function deleteService(id: number) {
        loading.value = true;
        try {
            // Get the service to know the car_id before deleting
            const { data: svcData } = await supabase.from('services').select('car_id').eq('id', id).single();
            const carId = svcData?.car_id;

            const { error: err } = await supabase.from('services').delete().eq('id', id);
            if (err) throw err;

            // Check if car has any other active reservation or service; if not, set disponible
            if (carId) {
                const now = new Date().toISOString();
                const tenantId = tenantStore.currentTenant?.id;

                let resQuery = supabase.from('reservations').select('id')
                    .eq('car_id', carId).in('status', ['confirmed', 'active'])
                    .lte('start_date', now).gte('end_date', now);
                if (tenantId) resQuery = resQuery.eq('tenant_id', tenantId);
                const { data: activeRes } = await resQuery;

                let svcQuery = supabase.from('services').select('id')
                    .eq('car_id', carId).lte('start_date', now).gte('end_date', now);
                if (tenantId) svcQuery = svcQuery.eq('tenant_id', tenantId);
                const { data: activeSvc } = await svcQuery;

                if ((!activeRes || activeRes.length === 0) && (!activeSvc || activeSvc.length === 0)) {
                    await updateCar(carId, { status: 'disponible' });
                }
            }

            await fetchServices();
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function checkServiceAvailability(carId: number, startDate: string, endDate: string, excludeId?: number) {
        const tenantId = tenantStore.currentTenant?.id;
        try {
            // Check reservations conflict
            let resQuery = supabase
                .from('reservations')
                .select('id')
                .eq('car_id', carId)
                .in('status', ['confirmed', 'active'])
                .lt('start_date', endDate)
                .gt('end_date', startDate);
            if (tenantId) resQuery = resQuery.eq('tenant_id', tenantId);
            const { data: resConflicts } = await resQuery;

            if (resConflicts && resConflicts.length > 0) {
                return { available: false, reason: 'Ce véhicule a une réservation qui chevauche ces dates.' };
            }

            // Check services conflict
            let svcQuery = supabase
                .from('services')
                .select('id')
                .eq('car_id', carId)
                .lt('start_date', endDate)
                .gt('end_date', startDate);
            if (tenantId) svcQuery = svcQuery.eq('tenant_id', tenantId);
            if (excludeId) svcQuery = svcQuery.neq('id', excludeId);
            const { data: svcConflicts } = await svcQuery;

            if (svcConflicts && svcConflicts.length > 0) {
                return { available: false, reason: 'Ce véhicule a un service qui chevauche ces dates.' };
            }

            return { available: true, reason: '' };
        } catch {
            return { available: false, reason: 'Erreur lors de la vérification de disponibilité.' };
        }
    }

    return {
        services,
        loading,
        error,
        fetchServices,
        createService,
        updateService,
        deleteService,
        checkServiceAvailability,
    };
}
