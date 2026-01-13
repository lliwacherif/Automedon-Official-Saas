import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'vue-router';
import type { User } from '@supabase/supabase-js';
import { useTenantStore } from '@/stores/tenant';

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
            .select('id, password_hash, role, tenant_id')
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

            const sessionData = {
                id: data.id,
                role: data.role,
                tenant_id: data.tenant_id,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('app_session', JSON.stringify(sessionData));

            if (isRoot.value) {
                router.push({ name: 'root.dashboard' });
            } else {
                if (data.role === 'admin') {
                    const slug = tenantStore.currentTenant?.slug;
                    if (slug) router.push({ name: 'admin.dashboard', params: { tenantSlug: slug } });
                } else {
                    const slug = tenantStore.currentTenant?.slug;
                    if (slug) router.push({ name: 'admin.reservations.index', params: { tenantSlug: slug } });
                }
            }
            return true;
        } else {
            throw new Error('Invalid password');
        }
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
        loading,
        initializeAuth,
        loginUser,
        changeAdminPassword: changePassword,
        login,     // Client
        register,  // Client
        signOut,
    };
});
