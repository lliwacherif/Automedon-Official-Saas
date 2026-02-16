<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { Loader2, Lock, User, LogIn, AlertCircle, Shield } from 'lucide-vue-next';
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
    <div class="min-h-screen bg-gray-50/50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        
        <!-- Background decoration -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-100 rounded-full opacity-30 blur-3xl"></div>
            <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-100 rounded-full opacity-30 blur-3xl"></div>
        </div>

        <div class="relative sm:mx-auto sm:w-full sm:max-w-md">
            
            <!-- Logo & Title -->
            <div class="text-center mb-8">
                <div v-if="tenantLogo" class="flex justify-center mb-5">
                    <div class="p-3 bg-white rounded-2xl shadow-md ring-1 ring-gray-100">
                        <img :src="tenantLogo" alt="Logo" class="h-14 w-14 object-contain" />
                    </div>
                </div>
                <div v-else class="flex justify-center mb-5">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Shield class="w-8 h-8 text-white" />
                    </div>
                </div>
                <h2 class="text-3xl font-extrabold text-gray-900 tracking-tight">
                    {{ t('admin.login.title') }} {{ tenantName }}
                </h2>
            </div>

            <!-- Login Card -->
            <div class="bg-white rounded-2xl shadow-xl ring-1 ring-gray-100 overflow-hidden">
                <div class="p-6 sm:p-8">
                    <p class="text-sm text-gray-500 mb-6 text-center">
                        {{ t('admin.login.subtitle') }}
                    </p>

                    <form class="space-y-4" @submit.prevent="handleLogin">
                        <!-- Username -->
                        <div>
                            <label for="username" class="form-label">
                                {{ t('admin.login.username') }}
                            </label>
                            <div class="form-input-wrapper">
                                <User class="form-input-icon" />
                                <input 
                                    id="username" 
                                    v-model="username" 
                                    name="username" 
                                    type="text" 
                                    required 
                                    class="form-input"
                                    :placeholder="t('admin.login.username')"
                                >
                            </div>
                        </div>

                        <!-- Password -->
                        <div>
                            <label for="password" class="form-label">
                                {{ t('admin.login.password') }}
                            </label>
                            <div class="form-input-wrapper">
                                <Lock class="form-input-icon" />
                                <input 
                                    id="password" 
                                    v-model="password" 
                                    name="password" 
                                    type="password" 
                                    required 
                                    class="form-input"
                                    :placeholder="t('admin.login.password')"
                                >
                            </div>
                        </div>

                        <!-- Error -->
                        <div v-if="error" class="flex items-start gap-2 bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                            <span>{{ error }}</span>
                        </div>

                        <!-- Submit -->
                        <button 
                            type="submit" 
                            :disabled="loading" 
                            class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                        >
                            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
                            <LogIn v-else class="w-4 h-4" />
                            {{ t('admin.login.submit') }}
                        </button>
                    </form>
                </div>

                <!-- Footer -->
                <div class="px-6 sm:px-8 py-4 bg-gray-50/50 border-t border-gray-100 text-center">
                    <p class="text-xs text-gray-400">
                        Connexion sécurisée · {{ tenantName }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.form-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgb(55 65 81);
    margin-bottom: 0.3rem;
}

.form-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid rgb(229 231 235);
    border-radius: 0.75rem;
    transition: all 0.15s ease;
    overflow: hidden;
}

.form-input-wrapper:focus-within {
    border-color: rgb(129 140 248);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-input-icon {
    width: 1rem;
    height: 1rem;
    color: rgb(156 163 175);
    margin-left: 0.75rem;
    flex-shrink: 0;
}

.form-input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    font-size: 0.875rem;
    color: rgb(17 24 39);
    background: transparent;
    border: none;
    outline: none;
}

.form-input::placeholder {
    color: rgb(156 163 175);
}
</style>
