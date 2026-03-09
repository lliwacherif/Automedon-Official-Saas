<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { Trash2, Pause, Play, Plus, ExternalLink, Store, Settings, LogOut, Users, CircleCheck, CirclePause, Building2, Loader2, Upload, X, Globe, Bell, BellOff } from 'lucide-vue-next';
import { useFileUpload } from '@/composables/useFileUpload';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const { uploadFile, uploading: uploadingLogo } = useFileUpload();

interface Tenant {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    status: string;
    created_at: string;
    payment_alert: boolean;
}

const tenants = ref<Tenant[]>([]);
const loading = ref(true);

const showCreateModal = ref(false);
const newTenant = ref({
    name: '',
    slug: '',
    logo_url: '',
    admin_password: 'admin'
});
const selectedLogoFile = ref<File | null>(null);
const logoPreview = ref<string | null>(null);
const createLoading = ref(false);

const activeCount = computed(() => tenants.value.filter(t => t.status === 'active').length);
const pausedCount = computed(() => tenants.value.filter(t => t.status !== 'active').length);

const fetchTenants = async () => {
    loading.value = true;
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) tenants.value = data as Tenant[];
    loading.value = false;
};

const handleLogoSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        selectedLogoFile.value = file;
        logoPreview.value = URL.createObjectURL(file);
    }
};

const createTenant = async () => {
    createLoading.value = true;
    try {
        let logoUrl = newTenant.value.logo_url;

        if (selectedLogoFile.value) {
            const url = await uploadFile(selectedLogoFile.value, 'car-images', 'logos');
            if (url) logoUrl = url;
        }

        await tenantStore.createTenant(
            newTenant.value.name,
            newTenant.value.slug,
            logoUrl,
            'admin',
            newTenant.value.admin_password
        );
        showCreateModal.value = false;
        newTenant.value = { name: '', slug: '', logo_url: '', admin_password: 'admin' };
        selectedLogoFile.value = null;
        logoPreview.value = null;
        
        await fetchTenants();
    } catch (e: any) {
        alert('Error creating tenant: ' + e.message);
    } finally {
        createLoading.value = false;
    }
};

const togglingStatus = ref<string | null>(null);

const handleToggleStatus = async (tenant: Tenant) => {
    const action = tenant.status === 'active' ? 'pause' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} "${tenant.name}"?`)) return;

    togglingStatus.value = tenant.id;
    try {
        const newStatus = await tenantStore.toggleTenantStatus(tenant.id, tenant.status);
        tenant.status = newStatus;
    } catch (e: any) {
        alert('Error updating status: ' + e.message);
    } finally {
        togglingStatus.value = null;
    }
};

const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this client? This action is irreversible and will delete all associated data (Cars, Reservations, Users).')) {
        try {
            await tenantStore.deleteTenant(id);
            tenants.value = tenants.value.filter(t => t.id !== id);
        } catch (e: any) {
            alert('Error deleting tenant: ' + e.message);
        }
    }
};

const handleToggleAlert = async (tenant: Tenant) => {
    try {
        const newVal = await tenantStore.togglePaymentAlert(tenant.id, tenant.payment_alert);
        tenant.payment_alert = newVal;
    } catch (e: any) {
        alert('Error toggling alert: ' + e.message);
    }
};

const logout = () => {
    authStore.signOut();
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

onMounted(() => {
    fetchTenants();
});
</script>

<template>
    <div class="min-h-screen bg-[#0f1117]">
        <!-- Header -->
        <header class="border-b border-white/[0.06] bg-[#0f1117]/80 backdrop-blur-xl sticky top-0 z-40">
            <div class="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                        <Building2 class="w-4 h-4 text-white" />
                    </div>
                    <span class="text-lg font-semibold text-white tracking-tight">Automedon</span>
                    <span class="text-xs font-medium text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">ROOT</span>
                </div>
                <nav class="flex items-center gap-1">
                    <RouterLink :to="{ name: 'root.store' }" class="flex items-center gap-2 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] px-3 py-2 rounded-lg transition-all">
                        <Store class="w-4 h-4" />
                        <span class="hidden sm:inline">Store</span>
                    </RouterLink>
                    <RouterLink :to="{ name: 'root.settings' }" class="flex items-center gap-2 text-sm text-white/50 hover:text-white hover:bg-white/[0.06] px-3 py-2 rounded-lg transition-all">
                        <Settings class="w-4 h-4" />
                        <span class="hidden sm:inline">Settings</span>
                    </RouterLink>
                    <div class="w-px h-6 bg-white/[0.08] mx-2"></div>
                    <button @click="logout" class="flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all">
                        <LogOut class="w-4 h-4" />
                        <span class="hidden sm:inline">Logout</span>
                    </button>
                </nav>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-[1400px] mx-auto px-6 py-8">
            <!-- Stats Row -->
            <div class="grid grid-cols-3 gap-4 mb-8">
                <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                            <Users class="w-4 h-4 text-indigo-400" />
                        </div>
                        <span class="text-xs font-medium text-white/40 uppercase tracking-wider">Total Clients</span>
                    </div>
                    <p class="text-3xl font-bold text-white">{{ tenants.length }}</p>
                </div>
                <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <CircleCheck class="w-4 h-4 text-emerald-400" />
                        </div>
                        <span class="text-xs font-medium text-white/40 uppercase tracking-wider">Active</span>
                    </div>
                    <p class="text-3xl font-bold text-emerald-400">{{ activeCount }}</p>
                </div>
                <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <CirclePause class="w-4 h-4 text-red-400" />
                        </div>
                        <span class="text-xs font-medium text-white/40 uppercase tracking-wider">Paused</span>
                    </div>
                    <p class="text-3xl font-bold text-red-400">{{ pausedCount }}</p>
                </div>
            </div>

            <!-- Section Header -->
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-xl font-semibold text-white">Managed Clients</h1>
                    <p class="text-sm text-white/30 mt-0.5">Create, manage and monitor your tenants</p>
                </div>
                <button 
                    @click="showCreateModal = true"
                    class="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-white/5"
                >
                    <Plus class="w-4 h-4" />
                    New Client
                </button>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-24">
                <Loader2 class="w-8 h-8 text-white/20 animate-spin mb-4" />
                <p class="text-sm text-white/30">Loading clients...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="tenants.length === 0" class="flex flex-col items-center justify-center py-24 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl">
                <div class="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <Building2 class="w-7 h-7 text-white/20" />
                </div>
                <p class="text-white/40 font-medium mb-1">No clients yet</p>
                <p class="text-white/20 text-sm mb-6">Create your first client to get started</p>
                <button @click="showCreateModal = true" class="flex items-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg transition">
                    <Plus class="w-4 h-4" />
                    New Client
                </button>
            </div>
            
            <!-- Tenant Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div 
                    v-for="tenant in tenants" 
                    :key="tenant.id" 
                    class="group relative bg-white/[0.03] border rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/[0.05]"
                    :class="tenant.status !== 'active' ? 'border-red-500/20' : 'border-white/[0.06] hover:border-white/[0.12]'"
                >
                    <!-- Paused Overlay Bar -->
                    <div v-if="tenant.status !== 'active'" class="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center gap-2">
                        <CirclePause class="w-3.5 h-3.5 text-red-400" />
                        <span class="text-xs font-semibold text-red-400 uppercase tracking-wider">Suspended</span>
                    </div>

                    <div class="p-5">
                        <!-- Top: Logo + Info -->
                        <div class="flex items-start gap-4 mb-5">
                            <div class="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden" :class="tenant.status !== 'active' ? 'bg-white/[0.03]' : 'bg-white/[0.06]'">
                                <img v-if="tenant.logo_url" :src="tenant.logo_url" class="w-full h-full object-contain p-1.5" :class="{ 'grayscale opacity-50': tenant.status !== 'active' }" />
                                <Building2 v-else class="w-6 h-6 text-white/20" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-base font-semibold text-white truncate">{{ tenant.name }}</h3>
                                <div class="flex items-center gap-1.5 mt-1">
                                    <Globe class="w-3 h-3 text-white/25" />
                                    <span class="text-xs text-white/30 font-mono truncate">/{{ tenant.slug }}</span>
                                </div>
                                <p class="text-xs text-white/20 mt-1">{{ formatDate(tenant.created_at) }}</p>
                            </div>
                            <!-- Status Indicator -->
                            <div class="flex-shrink-0">
                                <span 
                                    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                    :class="tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full" :class="tenant.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'"></span>
                                    {{ tenant.status === 'active' ? 'Active' : 'Paused' }}
                                </span>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 pt-4 border-t border-white/[0.06]">
                            <button 
                                @click="handleToggleStatus(tenant)" 
                                :disabled="togglingStatus === tenant.id"
                                class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                                :class="tenant.status === 'active' 
                                    ? 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20' 
                                    : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'"
                            >
                                <Loader2 v-if="togglingStatus === tenant.id" class="w-3.5 h-3.5 animate-spin" />
                                <Pause v-else-if="tenant.status === 'active'" class="w-3.5 h-3.5" />
                                <Play v-else class="w-3.5 h-3.5" />
                                {{ tenant.status === 'active' ? 'Pause' : 'Activate' }}
                            </button>
                            <a 
                                :href="`/${tenant.slug}/admin`" 
                                target="_blank" 
                                class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                            >
                                <ExternalLink class="w-3.5 h-3.5" />
                                Access
                            </a>
                            <button 
                                @click="handleToggleAlert(tenant)"
                                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                                :class="tenant.payment_alert 
                                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                                    : 'text-white/20 hover:text-amber-400 hover:bg-amber-500/10'"
                                :title="tenant.payment_alert ? 'Désactiver alerte paiement' : 'Activer alerte paiement'"
                            >
                                <Bell v-if="!tenant.payment_alert" class="w-4 h-4" />
                                <BellOff v-else class="w-4 h-4" />
                            </button>
                            <button 
                                @click="handleDelete(tenant.id)" 
                                class="flex items-center justify-center w-9 h-9 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all" 
                                title="Delete Client"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        
        <!-- Create Modal -->
        <Transition name="modal">
            <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showCreateModal = false"></div>
                <div class="relative w-full max-w-lg bg-[#1a1b23] border border-white/[0.08] rounded-2xl shadow-2xl">
                    <!-- Modal Header -->
                    <div class="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                        <div>
                            <h3 class="text-lg font-semibold text-white">New Client</h3>
                            <p class="text-xs text-white/30 mt-0.5">Set up a new tenant workspace</p>
                        </div>
                        <button @click="showCreateModal = false" class="text-white/30 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <form @submit.prevent="createTenant" class="p-6 space-y-5">
                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Client Name</label>
                            <input 
                                v-model="newTenant.name" 
                                type="text" 
                                required 
                                class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" 
                                placeholder="e.g. GS Cars Rent Car"
                            >
                        </div>
                        
                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Slug (URL)</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">/</span>
                                <input 
                                    v-model="newTenant.slug" 
                                    type="text" 
                                    required 
                                    class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-7 pr-4 py-3 text-sm text-white font-mono placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" 
                                    placeholder="gs-cars"
                                >
                            </div>
                            <p class="text-xs text-white/20 mt-1.5 flex items-center gap-1">
                                <Globe class="w-3 h-3" />
                                domain.com/<span class="text-white/40">{{ newTenant.slug || 'slug' }}</span>/admin
                            </p>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Logo</label>
                            <div class="flex items-center gap-3">
                                <div class="w-14 h-14 rounded-xl border border-dashed flex items-center justify-center overflow-hidden flex-shrink-0" :class="logoPreview ? 'border-white/[0.12] bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'">
                                    <img v-if="logoPreview" :src="logoPreview" class="w-full h-full object-contain p-1" />
                                    <Upload v-else class="w-5 h-5 text-white/15" />
                                </div>
                                <div class="flex-1">
                                    <input 
                                        @change="handleLogoSelect" 
                                        type="file" 
                                        accept="image/*"
                                        class="block w-full text-xs text-white/40 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/[0.06] file:text-white/60 hover:file:bg-white/[0.1] file:cursor-pointer file:transition"
                                    >
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Admin Password</label>
                            <input 
                                v-model="newTenant.admin_password" 
                                type="text" 
                                required 
                                class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition"
                            >
                            <p class="text-xs text-white/20 mt-1.5">Username: <span class="text-white/40 font-mono">admin</span></p>
                        </div>

                        <!-- Modal Footer -->
                        <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
                            <button type="button" @click="showCreateModal = false" class="text-sm text-white/40 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/[0.06] transition">
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                :disabled="createLoading" 
                                class="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Loader2 v-if="createLoading" class="w-4 h-4 animate-spin" />
                                {{ createLoading ? 'Creating...' : 'Create Client' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
    transform: scale(0.95) translateY(10px);
}
</style>
