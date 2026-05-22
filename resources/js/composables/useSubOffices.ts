import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore, hashPassword } from '@/stores/tenant';
import { useAuthStore } from '@/stores/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SubOffice {
    id: string;
    tenant_id: string;
    username: string;
    label: string | null;
    created_at: string;
    cars_count: number;
}

export interface SubOfficeWithCarIds extends SubOffice {
    car_ids: number[];
}

export interface CreateSubOfficeInput {
    username: string;
    password: string;
    label?: string | null;
    carIds?: number[];
}

export interface UpdateSubOfficeInput {
    username?: string;
    label?: string | null;
    /** Provide only when changing the password. */
    password?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache for the current session's assigned car ids. Keyed by
// tenant_user_id so a session that switches users doesn't reuse stale data.
// ─────────────────────────────────────────────────────────────────────────────

let myCarIdsCache: { userId: string; ids: number[] } | null = null;

/** Clear the cached "my assigned cars" set. Call after login/logout. */
export function clearSubOfficeCarCache() {
    myCarIdsCache = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useSubOffices() {
    const subOffices = ref<SubOffice[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const tenantStore = useTenantStore();
    const authStore = useAuthStore();

    /**
     * List every sub_office user for the current tenant, with the number of
     * cars assigned to each (single round-trip + a tiny aggregation on
     * sub_office_cars).
     */
    async function listSubOffices(): Promise<SubOffice[]> {
        loading.value = true;
        error.value = null;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            subOffices.value = [];
            loading.value = false;
            return [];
        }

        try {
            const { data: usersData, error: usersError } = await supabase
                .from('tenant_users')
                .select('id, tenant_id, username, label, created_at')
                .eq('tenant_id', tenantId)
                .eq('role', 'sub_office')
                .order('created_at', { ascending: false });

            if (usersError) throw usersError;

            const ids = (usersData || []).map((u: any) => u.id);
            const countsByUser: Record<string, number> = {};

            if (ids.length > 0) {
                const { data: assignments, error: assignError } = await supabase
                    .from('sub_office_cars')
                    .select('tenant_user_id')
                    .in('tenant_user_id', ids);
                if (assignError) throw assignError;
                for (const a of assignments || []) {
                    const uid = (a as any).tenant_user_id as string;
                    countsByUser[uid] = (countsByUser[uid] || 0) + 1;
                }
            }

            const mapped: SubOffice[] = (usersData || []).map((u: any) => ({
                id: u.id,
                tenant_id: u.tenant_id,
                username: u.username,
                label: u.label ?? null,
                created_at: u.created_at,
                cars_count: countsByUser[u.id] || 0,
            }));

            subOffices.value = mapped;
            return mapped;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error listing sub-offices:', e);
            return [];
        } finally {
            loading.value = false;
        }
    }

    /** Fetch a single sub-office with the list of car ids it owns. */
    async function getSubOffice(id: string): Promise<SubOfficeWithCarIds | null> {
        loading.value = true;
        error.value = null;
        const tenantId = tenantStore.currentTenant?.id;
        try {
            const { data: user, error: userErr } = await supabase
                .from('tenant_users')
                .select('id, tenant_id, username, label, created_at, role')
                .eq('id', id)
                .single();

            if (userErr) throw userErr;
            if (!user || (user as any).role !== 'sub_office') {
                throw new Error('Sous-bureau introuvable.');
            }
            if (tenantId && (user as any).tenant_id !== tenantId) {
                throw new Error('Sous-bureau introuvable.');
            }

            const carIds = await getAssignedCarIds(id);

            return {
                id: (user as any).id,
                tenant_id: (user as any).tenant_id,
                username: (user as any).username,
                label: (user as any).label ?? null,
                created_at: (user as any).created_at,
                cars_count: carIds.length,
                car_ids: carIds,
            };
        } catch (e: any) {
            error.value = e.message;
            console.error('Error fetching sub-office:', e);
            return null;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Create a new sous-bureau user + bulk-assign cars in a single flow.
     * Wraps the two inserts so a failure on the car assignment rolls back
     * the tenant_users insert (best-effort, no transactions on the client).
     */
    async function createSubOffice(input: CreateSubOfficeInput): Promise<SubOffice> {
        loading.value = true;
        error.value = null;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            loading.value = false;
            throw new Error('Aucun tenant sélectionné.');
        }

        try {
            const password_hash = await hashPassword(input.password);
            const insertUser: Record<string, unknown> = {
                tenant_id: tenantId,
                username: input.username,
                password_hash,
                role: 'sub_office',
                label: input.label || null,
            };

            const { data: userRow, error: userErr } = await (supabase
                .from('tenant_users') as any)
                .insert([insertUser])
                .select()
                .single();
            if (userErr) throw userErr;

            const newId = (userRow as any).id as string;
            const carIds = input.carIds || [];

            if (carIds.length > 0) {
                const rows = carIds.map((cid) => ({
                    tenant_user_id: newId,
                    car_id: cid,
                    tenant_id: tenantId,
                }));
                const { error: linkErr } = await (supabase
                    .from('sub_office_cars') as any)
                    .insert(rows);
                if (linkErr) {
                    // Rollback the user insert on failure to keep the data
                    // model clean — best effort, ignore secondary errors.
                    await supabase
                        .from('tenant_users')
                        .delete()
                        .eq('id', newId);
                    throw linkErr;
                }
            }

            return {
                id: newId,
                tenant_id: tenantId,
                username: (userRow as any).username,
                label: (userRow as any).label ?? null,
                created_at: (userRow as any).created_at,
                cars_count: carIds.length,
            };
        } catch (e: any) {
            error.value = e.message;
            console.error('Error creating sub-office:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    /** Partial update — only the fields provided are written. */
    async function updateSubOffice(id: string, input: UpdateSubOfficeInput) {
        loading.value = true;
        error.value = null;
        try {
            const updates: Record<string, unknown> = {};
            if (input.username !== undefined) updates.username = input.username;
            if (input.label !== undefined) updates.label = input.label || null;
            if (input.password) {
                updates.password_hash = await hashPassword(input.password);
            }
            if (Object.keys(updates).length === 0) return;

            const { error: updateErr } = await (supabase
                .from('tenant_users') as any)
                .update(updates)
                .eq('id', id)
                .eq('role', 'sub_office');
            if (updateErr) throw updateErr;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error updating sub-office:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Delete a sous-bureau. ON DELETE CASCADE on sub_office_cars releases
     * the assigned cars; reservations they created keep
     * created_by_tenant_user_id = NULL (ON DELETE SET NULL).
     */
    async function deleteSubOffice(id: string) {
        loading.value = true;
        error.value = null;
        try {
            const { error: delErr } = await supabase
                .from('tenant_users')
                .delete()
                .eq('id', id)
                .eq('role', 'sub_office');
            if (delErr) throw delErr;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error deleting sub-office:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    /** Return the ids of cars assigned to the given sub-office. */
    async function getAssignedCarIds(subOfficeId: string): Promise<number[]> {
        const { data, error: err } = await supabase
            .from('sub_office_cars')
            .select('car_id')
            .eq('tenant_user_id', subOfficeId);
        if (err) {
            console.error('Error fetching assigned car ids:', err);
            return [];
        }
        return (data || []).map((r: any) => Number(r.car_id));
    }

    /**
     * Diff the current car assignment with `carIds` and apply the necessary
     * inserts/deletes so the assignment matches.
     */
    async function setFleet(subOfficeId: string, carIds: number[]) {
        loading.value = true;
        error.value = null;
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            loading.value = false;
            throw new Error('Aucun tenant sélectionné.');
        }

        try {
            const current = new Set(await getAssignedCarIds(subOfficeId));
            const target = new Set(carIds);

            const toAdd: number[] = [];
            const toRemove: number[] = [];
            for (const id of target) if (!current.has(id)) toAdd.push(id);
            for (const id of current) if (!target.has(id)) toRemove.push(id);

            if (toRemove.length > 0) {
                const { error: delErr } = await supabase
                    .from('sub_office_cars')
                    .delete()
                    .eq('tenant_user_id', subOfficeId)
                    .in('car_id', toRemove);
                if (delErr) throw delErr;
            }

            if (toAdd.length > 0) {
                const rows = toAdd.map((cid) => ({
                    tenant_user_id: subOfficeId,
                    car_id: cid,
                    tenant_id: tenantId,
                }));
                const { error: insErr } = await (supabase
                    .from('sub_office_cars') as any)
                    .insert(rows);
                if (insErr) throw insErr;
            }
        } catch (e: any) {
            error.value = e.message;
            console.error('Error updating sub-office fleet:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Lookup of every car_id assigned to a sub-office in the current tenant.
     * Used by the admin UI to render "Indisponibles" tiles tagged with the
     * sous-bureau that holds them.
     */
    async function fetchAllAssignmentsForTenant(): Promise<Record<number, { tenant_user_id: string; label: string | null; username: string }>> {
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) return {};
        const { data, error: err } = await supabase
            .from('sub_office_cars')
            .select('car_id, tenant_user_id, tenant_users!inner(username, label)')
            .eq('tenant_id', tenantId);
        if (err) {
            console.error('Error fetching all assignments:', err);
            return {};
        }
        const map: Record<number, { tenant_user_id: string; label: string | null; username: string }> = {};
        for (const row of (data || []) as any[]) {
            map[Number(row.car_id)] = {
                tenant_user_id: row.tenant_user_id,
                username: row.tenant_users?.username || '',
                label: row.tenant_users?.label ?? null,
            };
        }
        return map;
    }

    /**
     * Cached lookup of the assigned car ids for the *current* session.
     * Returns the empty array when the session is not a sub_office.
     * Reset on login/logout via clearSubOfficeCarCache().
     */
    async function getMyAssignedCarIds(): Promise<number[]> {
        if (authStore.role !== 'sub_office') return [];
        const userId = authStore.currentUserId;
        if (!userId) return [];
        if (myCarIdsCache && myCarIdsCache.userId === userId) {
            return myCarIdsCache.ids;
        }
        const ids = await getAssignedCarIds(userId);
        myCarIdsCache = { userId, ids };
        return ids;
    }

    return {
        // state
        subOffices,
        loading,
        error,
        // CRUD
        listSubOffices,
        getSubOffice,
        createSubOffice,
        updateSubOffice,
        deleteSubOffice,
        // fleet
        getAssignedCarIds,
        setFleet,
        fetchAllAssignmentsForTenant,
        getMyAssignedCarIds,
        clearSubOfficeCarCache,
    };
}
