<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { Building2, Lock, User, Loader2, AlertTriangle } from 'lucide-vue-next';

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
        await authStore.loginUser(username.value, password.value, null);
    } catch (e: any) {
        error.value = e.message;
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 relative overflow-hidden">
        <!-- Background Pattern -->
        <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 40px 40px;"></div>
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-red-500/10 to-transparent rounded-full blur-3xl"></div>

        <div class="relative w-full max-w-sm">
            <!-- Logo -->
            <div class="text-center mb-8">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/20">
                    <Building2 class="w-7 h-7 text-white" />
                </div>
                <h1 class="text-2xl font-bold text-white tracking-tight">Automedon</h1>
                <div class="flex items-center justify-center gap-2 mt-2">
                    <div class="h-px w-8 bg-white/10"></div>
                    <span class="text-xs font-semibold text-white/25 uppercase tracking-[0.2em]">Root Access</span>
                    <div class="h-px w-8 bg-white/10"></div>
                </div>
            </div>

            <!-- Card -->
            <div class="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-7 shadow-2xl">
                <!-- Error -->
                <div v-if="error" class="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                    <AlertTriangle class="w-4 h-4 shrink-0" />
                    <span>{{ error }}</span>
                </div>

                <form @submit.prevent="handleLogin" class="space-y-5">
                    <!-- Username -->
                    <div>
                        <label class="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Username</label>
                        <div class="relative">
                            <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input 
                                v-model="username" 
                                type="text" 
                                class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition"
                                placeholder="root"
                            />
                        </div>
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Password</label>
                        <div class="relative">
                            <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input 
                                v-model="password" 
                                type="password" 
                                class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <!-- Submit -->
                    <button 
                        type="submit" 
                        :disabled="loading"
                        class="w-full flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-gray-100 font-semibold text-sm py-3 px-4 rounded-xl transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
                        {{ loading ? 'Authenticating...' : 'Enter Root' }}
                    </button>
                </form>
            </div>

            <!-- Footer -->
            <p class="text-center text-white/15 text-xs mt-6">Automedon SaaS &middot; Restricted Access</p>
        </div>
    </div>
</template>
