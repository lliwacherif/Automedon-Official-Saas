<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { Pause } from 'lucide-vue-next';

const route = useRoute();

const isPaused = ref(false);
const tenantName = ref('');
const checking = ref(true);

async function checkTenantStatus() {
    const slug = route.params.tenantSlug as string;
    if (!slug) { checking.value = false; return; }

    try {
        const { data } = await supabase
            .from('tenants')
            .select('status, name')
            .eq('slug', slug)
            .single();

        if (data) {
            tenantName.value = data.name;
            isPaused.value = data.status !== 'active';
        }
    } catch (e) {
        console.error('Failed to check tenant status:', e);
    } finally {
        checking.value = false;
    }
}

onMounted(checkTenantStatus);

watch(() => route.params.tenantSlug, checkTenantStatus);
</script>

<template>
    <div v-if="checking" class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>

    <div v-else-if="isPaused" class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div class="max-w-md w-full text-center">
            <div class="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Pause class="w-8 h-8 text-red-600" />
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-3">Account Suspended</h1>
                <p class="text-gray-600 mb-6">
                    <span class="font-semibold">{{ tenantName }}</span> has been temporarily suspended.
                    Please contact the administrator to restore access.
                </p>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    If you believe this is an error or wish to reactivate your account,
                    please reach out to support.
                </div>
                <RouterLink :to="{ name: 'home' }" class="inline-block mt-6 text-sm text-blue-600 hover:text-blue-800 font-medium">
                    &larr; Back to home
                </RouterLink>
            </div>
        </div>
    </div>

    <div v-else class="tenant-layout">
        <RouterView />
    </div>
</template>
