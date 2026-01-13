<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { Loader2 } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const router = useRouter();
const { t } = useI18n();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const tenantName = computed(() => tenantStore.currentTenant?.name || 'Admin Portal');
const tenantLogo = computed(() => tenantStore.currentTenant?.logo_url);

async function handleLogin() {
    error.value = '';
    loading.value = true;
    
    // Ensure we have the tenant context
    const tenantId = tenantStore.currentTenant?.id;
    if (!tenantId) {
        error.value = "Tenant context missing. Refesh the page.";
        loading.value = false;
        return;
    }

    try {
        await authStore.loginUser(username.value, password.value, tenantId);
        // LoginUser handles redirection in the store, but we can double check here
    } catch (e: any) {
        error.value = e.message;
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
            <div class="flex justify-center mb-4" v-if="tenantLogo">
                 <img :src="tenantLogo" alt="Logo" class="h-16 w-auto object-contain" />
            </div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                {{ t('admin.login.title') }} {{ tenantName }}
            </h2>
             <p class="mt-2 text-center text-sm text-gray-600">
                {{ t('admin.login.subtitle') }}
            </p>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <form class="space-y-6" @submit.prevent="handleLogin">
                    <div>
                        <label for="username" class="block text-sm font-medium text-gray-700">
                            {{ t('admin.login.username') }}
                        </label>
                        <div class="mt-1">
                            <input id="username" v-model="username" name="username" type="text" required class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        </div>
                    </div>

                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700">
                            {{ t('admin.login.password') }}
                        </label>
                        <div class="mt-1">
                            <input id="password" v-model="password" name="password" type="password" required class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        </div>
                    </div>

                    <div v-if="error" class="text-red-600 text-sm bg-red-50 p-2 rounded">
                        {{ error }}
                    </div>

                    <div>
                        <button type="submit" :disabled="loading" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                            {{ t('admin.login.submit') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
