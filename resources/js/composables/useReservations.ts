import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { Car } from './useCars';
import { useTenantStore } from '@/stores/tenant';

export interface Reservation {
    id: number;
    reservation_number: string;
    // User Reference
    user_id: string | null;
    // Client Information
    client_name: string;
    client_cin: string;
    client_phone: string;
    client_email: string | null;
    // Reservation Details
    car_id: number;
    start_date: string;
    end_date: string;
    duration_days: number;
    // Pricing
    price_per_day: number;
    total_price: number;
    advance_payment: number;
    // Status
    status: string;
    // Optional
    pickup_location: string | null;
    return_location: string | null;
    notes: string | null;
    // Timestamps
    created_at: string;
    updated_at: string;
    // Relations
    car?: Car;
}

export function useReservations() {
    const reservations = ref<Reservation[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const total = ref(0);
    const tenantStore = useTenantStore();

    // Helper to map DB result to Reservation interface (handling nested Car mapping)
    const mapReservation = (dbRes: any): Reservation => {
        const res = { ...dbRes } as Reservation;

        if (dbRes.car) {
            res.car = {
                ...dbRes.car,
                plate_number: dbRes.car.license_plate // Map license_plate to plate_number for nested car
            };
        }

        return res;
    };

    // Fetch all reservations (for admin)
    async function fetchReservations(page = 1, search = '', status = 'all') {
        loading.value = true;
        error.value = null;

        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            reservations.value = [];
            loading.value = false;
            return;
        }

        try {
            let query = supabase
                .from('reservations')
                .select('*, car:cars(*)', { count: 'exact' })
                .eq('tenant_id', tenantId);

            if (search) {
                query = query.or(`reservation_number.ilike.%${search}%,client_name.ilike.%${search}%,client_cin.ilike.%${search}%`);
            }

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            const from = (page - 1) * 10;
            const to = from + 9;

            const { data, count, error: supabaseError } = await query
                .range(from, to)
                .order('created_at', { ascending: false });

            if (supabaseError) throw supabaseError;

            reservations.value = (data || []).map(mapReservation);
            total.value = count || 0;
        } catch (e: any) {
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    }

    // Fetch reservations for a specific user (for client portal)
    async function fetchUserReservations(userId: string, page = 1, status = 'all') {
        loading.value = true;
        error.value = null;

        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            console.warn('Fetching user reservations without tenant context');
        }

        try {
            let query = supabase
                .from('reservations')
                .select('*, car:cars(*)', { count: 'exact' })
                .eq('user_id', userId);

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            const from = (page - 1) * 10;
            const to = from + 9;

            const { data, count, error: supabaseError } = await query
                .range(from, to)
                .order('created_at', { ascending: false });

            if (supabaseError) throw supabaseError;

            reservations.value = (data || []).map(mapReservation);
            total.value = count || 0;
        } catch (e: any) {
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    }

    async function getReservation(id: number) {
        loading.value = true;

        const tenantId = tenantStore.currentTenant?.id;

        try {
            let query = supabase
                .from('reservations')
                .select('*, car:cars(*)')
                .eq('id', id);

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            // Apply single() at the end to execute
            const { data, error: supabaseError } = await query.single();

            if (supabaseError) throw supabaseError;
            return mapReservation(data);
        } catch (e: any) {
            error.value = e.message;
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function createReservation(reservation: Database['public']['Tables']['reservations']['Insert']) {
        loading.value = true;

        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            loading.value = false;
            throw new Error("Cannot create reservation: No Tenant Context found.");
        }

        try {
            const reservationWithTenant = {
                ...reservation,
                tenant_id: tenantId,
                reservation_number: `RES-${Date.now()}`
            };

            // Remove user_id if it exists in the payload but not expected by DB
            // (or if it's causing issues as the error suggests)
            if ('user_id' in reservationWithTenant) {
                delete (reservationWithTenant as any).user_id;
            }

            if (!reservationWithTenant.reservation_number) {
                reservationWithTenant.reservation_number = `RES-${Math.floor(Math.random() * 1000000)}`;
            }

            const { data, error: supabaseError } = await (supabase
                .from('reservations') as any)
                .insert(reservationWithTenant)
                .select();

            if (supabaseError) throw supabaseError;

            // Return the first inserted record
            return data?.[0] || null;
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function updateReservation(id: number, reservation: Database['public']['Tables']['reservations']['Update']) {
        loading.value = true;
        try {
            const { data, error: supabaseError } = await (supabase
                .from('reservations') as any)
                .update(reservation)
                .eq('id', id)
                .select();

            if (supabaseError) throw supabaseError;

            // Return the first updated record
            return data?.[0] || null;
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function deleteReservation(id: number) {
        loading.value = true;
        try {
            const { error: supabaseError } = await supabase
                .from('reservations')
                .delete()
                .eq('id', id);

            if (supabaseError) throw supabaseError;
        } catch (e: any) {
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // Check availability for a specific car and date range
    async function checkAvailability(carId: number, startDate: string, endDate: string, excludeReservationId?: number) {
        loading.value = true;

        const tenantId = tenantStore.currentTenant?.id;

        try {
            let query = supabase
                .from('reservations')
                .select('id')
                .eq('car_id', carId)
                .in('status', ['confirmed', 'active'])
                .lt('start_date', endDate)
                .gt('end_date', startDate);

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            if (excludeReservationId) {
                query = query.neq('id', excludeReservationId);
            }

            const { data, error: supabaseError } = await query;

            if (supabaseError) throw supabaseError;

            return data && data.length === 0;
        } catch (e: any) {
            console.error('Availability check failed:', e);
            return false;
        } finally {
            loading.value = false;
        }
    }

    return {
        reservations,
        loading,
        error,
        total,
        fetchReservations,
        fetchUserReservations,
        getReservation,
        createReservation,
        updateReservation,
        deleteReservation,
        checkAvailability,
    };
}
