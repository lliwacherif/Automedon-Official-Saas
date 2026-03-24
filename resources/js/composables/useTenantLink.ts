// resources/js/composables/useTenantLink.ts
import { computed, watch } from 'vue';
import { useTenantStore } from '@/stores/tenant';
import { useRoute } from 'vue-router';

const SLUG_STORAGE_KEY = 'automedon_tenant_slug';

export function useTenantLink() {
    const tenantStore = useTenantStore();
    const route = useRoute();

    const currentSlug = computed(() => {
        const storeSlug = tenantStore.currentTenant?.slug;
        const routeSlug = route.params.tenantSlug as string | undefined;
        const resolved = storeSlug || routeSlug || '';

        if (resolved) {
            try { sessionStorage.setItem(SLUG_STORAGE_KEY, resolved); } catch {}
            return resolved;
        }

        // Last resort: recover from sessionStorage so slug is never lost mid-session
        try { return sessionStorage.getItem(SLUG_STORAGE_KEY) || ''; } catch { return ''; }
    });

    function tenantPath(path: string) {
        if (!currentSlug.value) return path;

        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `/${currentSlug.value}/${cleanPath}`;
    }

    return {
        currentSlug,
        tenantPath
    };
}
