<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router'; // Added router for back navigation if needed
import { Loader2, ArrowLeft } from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');

const handleChangePassword = async () => {
    error.value = '';
    success.value = '';

    if (newPassword.value !== confirmPassword.value) {
        error.value = 'New passwords do not match';
        return;
    }

    if (newPassword.value.length < 6) {
        error.value = 'Password must be at least 6 characters';
        return;
    }

    loading.value = true;

    try {
        // Reuse the same action as it works for currently authenticated user (including root)
        await authStore.changeAdminPassword(currentPassword.value, newPassword.value);
        success.value = 'Root password changed successfully';
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    } catch (e: any) {
        error.value = e.message || 'Failed to change password';
    } finally {
        loading.value = false;
    }
};

const goBack = () => {
    router.push({ name: 'root.dashboard' });
};
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-gray-900 text-white shadow">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                        Automedon Root
                    </span>
                </div>
                <div>
                     <button @click="goBack" class="text-gray-300 hover:text-white flex items-center gap-1">
                        <ArrowLeft class="w-4 h-4" /> Back to Dashboard
                    </button>
                </div>
            </div>
        </header>

        <div class="p-6 max-w-7xl mx-auto">
            <div class="max-w-md mx-auto bg-white rounded-lg shadow p-6 mt-10">
                <h2 class="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Change Root Password</h2>

                <form @submit.prevent="handleChangePassword" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                        <input 
                            v-model="currentPassword"
                            type="password"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="Enter current password"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input 
                            v-model="newPassword"
                            type="password"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="Enter new password"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <input 
                            v-model="confirmPassword"
                            type="password"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="Confirm new password"
                        />
                    </div>

                    <div v-if="error" class="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                        {{ error }}
                    </div>

                    <div v-if="success" class="text-green-600 text-sm bg-green-50 p-3 rounded-md">
                        {{ success }}
                    </div>

                    <button 
                        type="submit" 
                        :disabled="loading"
                        class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Change Password
                    </button>
                </form>
            </div>
        </div>
    </div>
</template>
