import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    status: 'active' | 'inactive';
}

// Helper: SHA-256 for password hashing (matches Auth Store)
async function hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useTenantStore = defineStore('tenant', () => {
    const currentTenant = ref<Tenant | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchTenantBySlug(slug: string) {
        // If we already have the correct tenant loaded, skip
        if (currentTenant.value?.slug === slug) return currentTenant.value;

        loading.value = true;
        error.value = null;

        try {
            const { data, error: fetchError } = await supabase
                .from('tenants')
                .select('*')
                .eq('slug', slug)
                .single();

            if (fetchError) throw fetchError;
            if (!data) throw new Error('Tenant not found');

            currentTenant.value = data as Tenant;
            return currentTenant.value;
        } catch (e: any) {
            console.error('Error fetching tenant:', e);
            error.value = e.message;
            currentTenant.value = null;
            throw e;
        } finally {
            loading.value = false;
        }
    }

    // For Root Admin to create new tenants
    async function createTenant(name: string, slug: string, logoUrl: string, adminUsername: string, adminPassword: string) {
        loading.value = true;
        try {
            // 1. Create Tenant
            const { data: tenant, error: tenantError } = await (supabase
                .from('tenants')
                .insert([{
                    name,
                    slug,
                    logo_url: logoUrl,
                    status: 'active'
                }])
                .select()
                .single() as any);

            if (tenantError) throw tenantError;

            // 2. Hash Password
            const passwordHash = await hashPassword(adminPassword);

            // 3. Create Default Admin for this Tenant
            const { error: userError } = await (supabase
                .from('tenant_users') as any)
                .insert([
                    {
                        tenant_id: tenant.id,
                        username: adminUsername,
                        password_hash: passwordHash,
                        role: 'admin'
                    },
                    {
                        tenant_id: tenant.id,
                        username: 'assistant',
                        password_hash: passwordHash,
                        role: 'assistant'
                    }
                ]);

            if (userError) {
                // Determine if we should rollback tenant creation? ignoring for now as per minimal viable.
                console.error('Failed to create admin users for tenant', userError);
                throw userError;
            }

            return tenant;
        } finally {
            loading.value = false;
        }
    }

    async function deleteTenant(id: string) {
        loading.value = true;
        try {
            const { error: deleteError } = await supabase
                .from('tenants')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
        } catch (e: any) {
            console.error('Error deleting tenant:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return {
        currentTenant,
        loading,
        error,
        fetchTenantBySlug,
        createTenant,
        deleteTenant
    };
});
