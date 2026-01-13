// resources/js/composables/useTenantLink.ts
import { computed } from 'vue';
import { useTenantStore } from '@/stores/tenant';
import { useRoute } from 'vue-router';

export function useTenantLink() {
    const tenantStore = useTenantStore();
    const route = useRoute();

    // Helper to get current slug, falling back to route params if store isn't ready
    const currentSlug = computed(() => {
        return tenantStore.currentTenant?.slug || (route.params.tenantSlug as string) || '';
    });

    // Generate a path prefixed with the tenant slug
    function tenantPath(path: string) {
        // If no slug (e.g. root or home), return original path ?
        // Or assume this is only used in tenant context
        if (!currentSlug.value) return path;

        // Remove leading slash to avoid double slash
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `/${currentSlug.value}/${cleanPath}`;
    }

    return {
        currentSlug,
        tenantPath
    };
}
