import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { format, addMonths, parseISO } from 'date-fns';

// ───────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────
export interface SousTraitance {
    id: number;
    tenant_id: string;
    name: string;
    description: string | null;
    contract_range_start: string | null;
    contract_range_end: string | null;
    created_at: string;
    updated_at: string;
    // Computed on fetch
    vehicleCount?: number;
    totalPaid?: number;
    totalOutstanding?: number;
    totalOverdue?: number;
    monthlyLiability?: number;
}

export interface SousTraitanceVehicle {
    id: number;
    tenant_id: string;
    sous_traitance_id: number;
    car_id: number;
    monthly_payment: number;
    due_day: number;
    assigned_at: string;
    created_at: string;
    // Joined car info
    car?: {
        id: number;
        brand: string;
        model: string;
        license_plate: string;
        status: string;
    };
    // Computed
    payments?: SousTraitancePayment[];
    totalPaid?: number;
    totalOutstanding?: number;
    totalOverdue?: number;
}

export interface SousTraitancePayment {
    id: number;
    tenant_id: string;
    sous_traitance_vehicle_id: number;
    period_month: string;
    amount: number;
    due_date: string;
    status: 'pending' | 'paid' | 'overdue';
    paid_at: string | null;
    created_at: string;
}

// ───────────────────────────────────────────────
// Composable
// ───────────────────────────────────────────────
export function useSousTraitances() {
    const tenantStore = useTenantStore();

    const loading = ref(false);
    const error = ref<string | null>(null);

    const sousTraitances = ref<SousTraitance[]>([]);
    const currentSousTraitance = ref<SousTraitance | null>(null);
    const currentVehicles = ref<SousTraitanceVehicle[]>([]);

    // Cache of subcontracted car IDs for availability blocking
    const subcontractedCarIds = ref<Set<number>>(new Set());

    // ─── Aggregates ───
    const totalSousTraitances = computed(() => sousTraitances.value.length);
    const totalDelegatedVehicles = computed(() =>
        sousTraitances.value.reduce((sum, st) => sum + (st.vehicleCount || 0), 0)
    );
    const totalMonthlyLiability = computed(() =>
        sousTraitances.value.reduce((sum, st) => sum + (st.monthlyLiability || 0), 0)
    );
    const totalOverdueAmount = computed(() =>
        sousTraitances.value.reduce((sum, st) => sum + (st.totalOverdue || 0), 0)
    );

    // ─── Helpers ───
    function getTenantId(): string {
        const id = tenantStore.currentTenant?.id;
        if (!id) throw new Error('No tenant context');
        return id;
    }

    // ─── CRUD: Sous-Traitances ───

    async function fetchAll() {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();

            // Fetch sous-traitances
            const { data: stData, error: stErr } = await (supabase
                .from('sous_traitances') as any)
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });
            if (stErr) throw stErr;

            // Fetch all vehicles for aggregate computation
            const { data: vData, error: vErr } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .select('id, sous_traitance_id, car_id, monthly_payment')
                .eq('tenant_id', tenantId);
            if (vErr) throw vErr;

            // Fetch all payments for aggregates
            const { data: pData, error: pErr } = await (supabase
                .from('sous_traitance_payments') as any)
                .select('sous_traitance_vehicle_id, amount, status')
                .eq('tenant_id', tenantId);
            if (pErr) throw pErr;

            // Build lookup maps
            const vehiclesByST = new Map<number, any[]>();
            const paymentsByVehicle = new Map<number, any[]>();

            for (const v of (vData || [])) {
                const arr = vehiclesByST.get(v.sous_traitance_id) || [];
                arr.push(v);
                vehiclesByST.set(v.sous_traitance_id, arr);
            }
            for (const p of (pData || [])) {
                const arr = paymentsByVehicle.get(p.sous_traitance_vehicle_id) || [];
                arr.push(p);
                paymentsByVehicle.set(p.sous_traitance_vehicle_id, arr);
            }

            // Build subcontracted car IDs set
            const carIds = new Set<number>();
            for (const v of (vData || [])) carIds.add(v.car_id);
            subcontractedCarIds.value = carIds;

            // Enrich sous-traitances with aggregates
            sousTraitances.value = (stData || []).map((st: any) => {
                const vehicles = vehiclesByST.get(st.id) || [];
                let totalPaid = 0;
                let totalOutstanding = 0;
                let totalOverdue = 0;
                let monthlyLiability = 0;

                for (const v of vehicles) {
                    monthlyLiability += Number(v.monthly_payment || 0);
                    const payments = paymentsByVehicle.get(v.id) || [];
                    for (const p of payments) {
                        if (p.status === 'paid') totalPaid += Number(p.amount || 0);
                        else if (p.status === 'overdue') totalOverdue += Number(p.amount || 0);
                        else totalOutstanding += Number(p.amount || 0);
                    }
                }

                return {
                    ...st,
                    vehicleCount: vehicles.length,
                    totalPaid,
                    totalOutstanding,
                    totalOverdue,
                    monthlyLiability,
                } as SousTraitance;
            });
        } catch (e: any) {
            console.error('Error fetching sous-traitances:', e);
            error.value = e.message || 'Erreur de chargement';
        } finally {
            loading.value = false;
        }
    }

    async function fetchById(id: number) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();

            // Fetch the sous-traitance
            const { data: stData, error: stErr } = await (supabase
                .from('sous_traitances') as any)
                .select('*')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();
            if (stErr) throw stErr;
            currentSousTraitance.value = stData as SousTraitance;

            // Fetch vehicles with car info
            const { data: vData, error: vErr } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .select('*, car:cars(id, brand, model, license_plate, status)')
                .eq('sous_traitance_id', id)
                .eq('tenant_id', tenantId)
                .order('assigned_at', { ascending: true });
            if (vErr) throw vErr;

            // Fetch all payments for these vehicles
            const vehicleIds = (vData || []).map((v: any) => v.id);
            let payments: any[] = [];
            if (vehicleIds.length > 0) {
                const { data: pData, error: pErr } = await (supabase
                    .from('sous_traitance_payments') as any)
                    .select('*')
                    .in('sous_traitance_vehicle_id', vehicleIds)
                    .order('period_month', { ascending: true });
                if (pErr) throw pErr;
                payments = pData || [];
            }

            // Build payments lookup
            const paymentsByVehicle = new Map<number, SousTraitancePayment[]>();
            for (const p of payments) {
                const arr = paymentsByVehicle.get(p.sous_traitance_vehicle_id) || [];
                arr.push(p as SousTraitancePayment);
                paymentsByVehicle.set(p.sous_traitance_vehicle_id, arr);
            }

            // Enrich vehicles
            currentVehicles.value = (vData || []).map((v: any) => {
                const vPayments = paymentsByVehicle.get(v.id) || [];
                let totalPaid = 0;
                let totalOutstanding = 0;
                let totalOverdue = 0;
                for (const p of vPayments) {
                    if (p.status === 'paid') totalPaid += Number(p.amount || 0);
                    else if (p.status === 'overdue') totalOverdue += Number(p.amount || 0);
                    else totalOutstanding += Number(p.amount || 0);
                }
                return {
                    ...v,
                    payments: vPayments,
                    totalPaid,
                    totalOutstanding,
                    totalOverdue,
                } as SousTraitanceVehicle;
            });
        } catch (e: any) {
            console.error('Error fetching sous-traitance detail:', e);
            error.value = e.message || 'Erreur de chargement';
        } finally {
            loading.value = false;
        }
    }

    async function create(data: {
        name: string;
        description?: string;
        contract_range_start?: string;
        contract_range_end?: string;
    }) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();
            const { data: result, error: err } = await (supabase
                .from('sous_traitances') as any)
                .insert({
                    tenant_id: tenantId,
                    name: data.name,
                    description: data.description || null,
                    contract_range_start: data.contract_range_start || null,
                    contract_range_end: data.contract_range_end || null,
                })
                .select()
                .single();
            if (err) throw err;
            await fetchAll();
            return result;
        } catch (e: any) {
            console.error('Error creating sous-traitance:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function update(id: number, data: {
        name?: string;
        description?: string | null;
        contract_range_start?: string | null;
        contract_range_end?: string | null;
    }) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();
            const { error: err } = await (supabase
                .from('sous_traitances') as any)
                .update(data)
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (err) throw err;
            await fetchAll();
        } catch (e: any) {
            console.error('Error updating sous-traitance:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function remove(id: number) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();
            const { error: err } = await (supabase
                .from('sous_traitances') as any)
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (err) throw err;
            await fetchAll();
        } catch (e: any) {
            console.error('Error deleting sous-traitance:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // ─── Vehicle Assignment ───

    async function assignVehicle(
        sousTraitanceId: number,
        carId: number,
        monthlyPayment: number,
        dueDay: number,
        monthsToGenerate = 12
    ) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();

            // Insert the vehicle assignment
            const { data: vehicle, error: vErr } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .insert({
                    tenant_id: tenantId,
                    sous_traitance_id: sousTraitanceId,
                    car_id: carId,
                    monthly_payment: monthlyPayment,
                    due_day: dueDay,
                })
                .select()
                .single();
            if (vErr) throw vErr;

            // Generate payment records for the next N months
            await generatePaymentRecords(vehicle.id, tenantId, monthlyPayment, dueDay, monthsToGenerate);

            // Refresh data
            await fetchById(sousTraitanceId);
            // Update the subcontracted car IDs cache
            subcontractedCarIds.value = new Set([...subcontractedCarIds.value, carId]);

            return vehicle;
        } catch (e: any) {
            console.error('Error assigning vehicle:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function unassignVehicle(vehicleId: number, sousTraitanceId: number) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();

            // Get the car_id before deleting (for cache update)
            const { data: vData } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .select('car_id')
                .eq('id', vehicleId)
                .single();

            // Cascade will delete payments
            const { error: err } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .delete()
                .eq('id', vehicleId)
                .eq('tenant_id', tenantId);
            if (err) throw err;

            // Remove from cache
            if (vData) {
                const newSet = new Set(subcontractedCarIds.value);
                newSet.delete(vData.car_id);
                subcontractedCarIds.value = newSet;
            }

            await fetchById(sousTraitanceId);
        } catch (e: any) {
            console.error('Error unassigning vehicle:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // ─── Payment Management ───

    async function generatePaymentRecords(
        vehicleId: number,
        tenantId: string,
        amount: number,
        dueDay: number,
        months: number,
        startFrom?: Date
    ) {
        const start = startFrom || new Date();
        const records: any[] = [];

        for (let i = 0; i < months; i++) {
            const periodDate = addMonths(start, i);
            const periodMonth = format(periodDate, 'yyyy-MM');
            const year = periodDate.getFullYear();
            const month = periodDate.getMonth(); // 0-indexed
            // Clamp due day to actual days in the month
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const actualDueDay = Math.min(dueDay, daysInMonth);
            const dueDate = format(new Date(year, month, actualDueDay), 'yyyy-MM-dd');

            records.push({
                tenant_id: tenantId,
                sous_traitance_vehicle_id: vehicleId,
                period_month: periodMonth,
                amount,
                due_date: dueDate,
                status: 'pending',
            });
        }

        if (records.length > 0) {
            // Use upsert to avoid duplicates if re-generating
            const { error: err } = await (supabase
                .from('sous_traitance_payments') as any)
                .upsert(records, { onConflict: 'sous_traitance_vehicle_id,period_month' });
            if (err) throw err;
        }
    }

    async function generateMorePayments(vehicleId: number, sousTraitanceId: number, months = 6) {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = getTenantId();

            // Get vehicle info for amount and due_day
            const { data: vehicle, error: vErr } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .select('monthly_payment, due_day')
                .eq('id', vehicleId)
                .single();
            if (vErr) throw vErr;

            // Find the latest payment period for this vehicle
            const { data: latestPayment, error: lpErr } = await (supabase
                .from('sous_traitance_payments') as any)
                .select('period_month')
                .eq('sous_traitance_vehicle_id', vehicleId)
                .order('period_month', { ascending: false })
                .limit(1)
                .single();
            if (lpErr && lpErr.code !== 'PGRST116') throw lpErr; // PGRST116 = no rows

            let startFrom: Date;
            if (latestPayment) {
                // Start from the month after the latest
                startFrom = addMonths(parseISO(latestPayment.period_month + '-01'), 1);
            } else {
                startFrom = new Date();
            }

            await generatePaymentRecords(
                vehicleId,
                tenantId,
                Number(vehicle!.monthly_payment),
                vehicle!.due_day,
                months,
                startFrom
            );

            await fetchById(sousTraitanceId);
        } catch (e: any) {
            console.error('Error generating payments:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function markPaymentPaid(paymentId: number, sousTraitanceId: number) {
        try {
            const { error: err } = await (supabase
                .from('sous_traitance_payments') as any)
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                })
                .eq('id', paymentId);
            if (err) throw err;
            await fetchById(sousTraitanceId);
        } catch (e: any) {
            console.error('Error marking payment paid:', e);
            error.value = e.message;
            throw e;
        }
    }

    async function markPaymentUnpaid(paymentId: number, sousTraitanceId: number) {
        try {
            const today = new Date();
            const { data: payment } = await (supabase
                .from('sous_traitance_payments') as any)
                .select('due_date')
                .eq('id', paymentId)
                .single();

            // If due date has passed, set as overdue; otherwise pending
            const newStatus = payment && new Date(payment.due_date) < today ? 'overdue' : 'pending';

            const { error: err } = await (supabase
                .from('sous_traitance_payments') as any)
                .update({
                    status: newStatus,
                    paid_at: null,
                })
                .eq('id', paymentId);
            if (err) throw err;
            await fetchById(sousTraitanceId);
        } catch (e: any) {
            console.error('Error marking payment unpaid:', e);
            error.value = e.message;
            throw e;
        }
    }

    async function refreshOverdueStatus() {
        try {
            const tenantId = getTenantId();
            const today = format(new Date(), 'yyyy-MM-dd');

            // Find all pending payments where due_date < today
            const { data, error: fetchErr } = await (supabase
                .from('sous_traitance_payments') as any)
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('status', 'pending')
                .lt('due_date', today);
            if (fetchErr) throw fetchErr;

            if (data && data.length > 0) {
                const ids = data.map((p: any) => p.id);
                const { error: updateErr } = await (supabase
                    .from('sous_traitance_payments') as any)
                    .update({ status: 'overdue' })
                    .in('id', ids);
                if (updateErr) throw updateErr;
            }
        } catch (e: any) {
            console.error('Error refreshing overdue status:', e);
        }
    }

    // ─── Subcontracted Car IDs (for availability blocking) ───

    async function fetchSubcontractedCarIds(): Promise<Set<number>> {
        try {
            const tenantId = getTenantId();
            const { data, error: err } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .select('car_id')
                .eq('tenant_id', tenantId);
            if (err) throw err;
            const ids = new Set<number>((data || []).map((v: any) => v.car_id as number));
            subcontractedCarIds.value = ids;
            return ids;
        } catch (e: any) {
            console.error('Error fetching subcontracted car IDs:', e);
            return new Set();
        }
    }

    // ─── Available cars for assignment (not already subcontracted) ───

    async function fetchAvailableCarsForAssignment() {
        try {
            const tenantId = getTenantId();

            // Get all tenant cars
            const { data: allCars, error: cErr } = await (supabase
                .from('cars') as any)
                .select('id, brand, model, license_plate, status, image_url')
                .eq('tenant_id', tenantId)
                .order('brand', { ascending: true });
            if (cErr) throw cErr;

            // Get already assigned to sous-traitance
            const { data: assignedST, error: aErr } = await (supabase
                .from('sous_traitance_vehicles') as any)
                .select('car_id')
                .eq('tenant_id', tenantId);
            if (aErr) throw aErr;

            // Get already assigned to sous-bureau
            const { data: assignedSB, error: sbErr } = await (supabase
                .from('sub_office_cars') as any)
                .select('car_id')
                .eq('tenant_id', tenantId);
            if (sbErr) throw sbErr;

            const excludedIds = new Set<number>([
                ...(assignedST || []).map((v: any) => v.car_id as number),
                ...(assignedSB || []).map((v: any) => v.car_id as number),
            ]);

            return (allCars || []).filter((c: any) => !excludedIds.has(c.id));
        } catch (e: any) {
            console.error('Error fetching available cars:', e);
            return [];
        }
    }

    return {
        loading,
        error,
        sousTraitances,
        currentSousTraitance,
        currentVehicles,
        subcontractedCarIds,
        // Computed
        totalSousTraitances,
        totalDelegatedVehicles,
        totalMonthlyLiability,
        totalOverdueAmount,
        // CRUD
        fetchAll,
        fetchById,
        create,
        update,
        remove,
        // Vehicle assignment
        assignVehicle,
        unassignVehicle,
        fetchAvailableCarsForAssignment,
        fetchSubcontractedCarIds,
        // Payments
        markPaymentPaid,
        markPaymentUnpaid,
        generateMorePayments,
        refreshOverdueStatus,
    };
}
