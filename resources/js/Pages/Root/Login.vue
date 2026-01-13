<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

const username = ref('root');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleLogin = async () => {
    loading.value = true;
    error.value = '';
    try {
        await authStore.loginUser(username.value, password.value, null); // TenantId must be null for Root
    } catch (e: any) {
        error.value = e.message;
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                    Automedon Root
                </h1>
                <p class="text-gray-400 mt-2">Super Admin Access</p>
            </div>

            <form @submit.prevent="handleLogin" class="space-y-6">
                <div v-if="error" class="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded">
                    {{ error }}
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-400 mb-1">Username</label>
                    <input 
                        v-model="username" 
                        type="text" 
                        class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-400 mb-1">Password</label>
                    <input 
                        v-model="password" 
                        type="password" 
                        class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                </div>

                <button 
                    type="submit" 
                    :disabled="loading"
                    class="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                    {{ loading ? 'Accessing...' : 'Enter Root' }}
                </button>
            </form>
        </div>
    </div>
</template>
