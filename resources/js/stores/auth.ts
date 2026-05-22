import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'vue-router';
import type { User } from '@supabase/supabase-js';
import { useTenantStore } from '@/stores/tenant';
import { clearSubOfficeCarCache } from '@/composables/useSubOffices';

async function hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const loading = ref(true);
    const router = useRouter();
    const tenantStore = useTenantStore();

    const role = ref<string>('');
    const currentUserId = ref<string | null>(null);
    const isAdmin = ref(false);
    const allowedPages = ref<string[] | null>(null);

    // For Root Admin
    const isRoot = ref(false);

    async function initializeAuth() {
        loading.value = true;
        const { data } = await supabase.auth.getUser();
        user.value = data.user;

        // Check stored admin session
        const storedSession = localStorage.getItem('app_session');
        if (storedSession) {
            try {
                const session = JSON.parse(storedSession);
                isAdmin.value = true;
                role.value = session.role;
                currentUserId.value = session.id;
                isRoot.value = session.role === 'root';
                allowedPages.value = session.allowed_pages ?? null;
            } catch (e) {
                console.error("Invalid session", e);
                localStorage.removeItem('app_session');
            }
        }

        loading.value = false;

        supabase.auth.onAuthStateChange((_event, session) => {
            user.value = session?.user || null;
        });
    }

    async function loginUser(username: string, pass: string, tenantId: string | null = null) {
        const hash = await hashPassword(pass);

        let query = supabase
            .from('tenant_users')
            .select('id, password_hash, role, tenant_id, allowed_pages')
            .eq('username', username);

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        } else {
            query = query.is('tenant_id', null);
        }

        const { data, error } = await query.single() as any;

        if (error || !data) {
            throw new Error('Invalid credentials');
        }

        if (data.password_hash === hash) {
            isAdmin.value = true;
            role.value = data.role;
            currentUserId.value = data.id;
            isRoot.value = data.role === 'root';
            allowedPages.value = data.allowed_pages ?? null;
            clearSubOfficeCarCache();

            const sessionData = {
                id: data.id,
                role: data.role,
                tenant_id: data.tenant_id,
                allowed_pages: data.allowed_pages ?? null,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('app_session', JSON.stringify(sessionData));

            if (isRoot.value) {
                router.push({ name: 'root.dashboard' });
            } else {
                const slug = tenantStore.currentTenant?.slug;
                if (slug) {
                    const target = resolveLandingRoute(data.role, data.allowed_pages ?? null);
                    router.push({ name: target, params: { tenantSlug: slug } });
                }
            }
            return true;
        } else {
            throw new Error('Invalid password');
        }
    }

    /**
     * Pick the first page the user can land on after logging in.
     * Admins → KPI dashboard (existing behaviour).
     * Restricted users → first item in allowed_pages, or reservations as
     * a safe fallback when the list is empty / legacy.
     */
    function resolveLandingRoute(userRole: string, pages: string[] | null): string {
        if (userRole === 'admin') return 'admin.dashboard';
        // A sous-bureau is a mini-tenant: KPI dashboard is the most useful
        // landing page since it summarizes their assigned fleet & bookings.
        if (userRole === 'sub_office') return 'admin.dashboard';

        const pageRouteMap: Record<string, string> = {
            fleet: 'admin.cars.index',
            kpi: 'admin.dashboard',
            reservations: 'admin.reservations.index',
            reservations_table: 'admin.reservations.table',
            services: 'admin.services.index',
            maintenance: 'admin.maintenance.index',
            history: 'admin.history.index',
            reports: 'admin.reports',
            daily_journal: 'admin.daily_journal.index',
            faithful_clients: 'admin.faithful_clients.index',
            store: 'admin.store.index',
        };

        if (pages && pages.length > 0) {
            for (const key of pages) {
                if (pageRouteMap[key]) return pageRouteMap[key];
            }
        }

        return 'admin.reservations.index';
    }

    async function changePassword(currentPass: string, newPass: string) {
        if (!currentUserId.value) throw new Error('Not authenticated');

        const currentHash = await hashPassword(currentPass);

        const { data, error: fetchError } = await (supabase
            .from('tenant_users')
            .select('password_hash')
            .eq('id', currentUserId.value)
            .single() as any);

        if (fetchError || !data || data.password_hash !== currentHash) {
            throw new Error('Current password is incorrect');
        }

        const newHash = await hashPassword(newPass);

        const { error: updateError } = await (supabase
            .from('tenant_users') as any)
            .update({ password_hash: newHash })
            .eq('id', currentUserId.value);

        if (updateError) throw updateError;
    }

    function signOut() {
        if (isAdmin.value) {
            const wasRoot = isRoot.value;
            const currentSlug = tenantStore.currentTenant?.slug;

            isAdmin.value = false;
            role.value = '';
            currentUserId.value = null;
            isRoot.value = false;
            allowedPages.value = null;
            clearSubOfficeCarCache();

            localStorage.removeItem('app_session');

            if (wasRoot) {
                router.push('/root');
            } else if (currentSlug) {
                router.push(`/${currentSlug}/admin`);
            } else {
                router.push('/');
            }
        } else {
            supabase.auth.signOut();
            user.value = null;
            router.push({ name: 'login' });
        }
    }

    // Client Register (Supabase Auth) - Unchanged mostly, but usually clients are global or tenant bound?
    // For now, Supabase Auth is global. We might link them to tenants later via a profile, but
    // the prompt didn't specify client-tenant binding isolation, just UI access.
    async function register(email: string, password: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        user.value = data.user;
        isAdmin.value = false;
        router.push('/');
    }

    // Client Login
    async function login(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        user.value = data.user;
        isAdmin.value = false;
        router.push('/');
    }

    return {
        user,
        isAdmin,
        isRoot,
        role,
        currentUserId,
        allowedPages,
        loading,
        initializeAuth,
        loginUser,
        changeAdminPassword: changePassword,
        login,     // Client
        register,  // Client
        signOut,
    };
});
