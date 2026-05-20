<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { Trash2, Pause, Play, Plus, ExternalLink, Store, Settings, LogOut, Users, CircleCheck, CirclePause, Building2, Loader2, Upload, X, Globe, Bell, BellOff, CreditCard, Calendar, Check, Minus, ChevronUp, ChevronDown, Clock, AlertTriangle, Camera, ImageIcon, FileText, Sparkles } from 'lucide-vue-next';
import { useFileUpload } from '@/composables/useFileUpload';
import { compressImage } from '@/utils/image';

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
    membership_type: 'monthly' | 'yearly' | null;
    membership_months: number | null;
    membership_paid: boolean;
    contract_template?: 'default' | 'v2';
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
        let logoUrl = '';

        if (selectedLogoFile.value) {
            try {
                let fileToUpload = selectedLogoFile.value;
                if (fileToUpload.type.startsWith('image/') && !fileToUpload.type.includes('svg')) {
                    fileToUpload = await compressImage(fileToUpload, 512, 512, 0.7);
                }
                const url = await uploadFile(fileToUpload, 'car-images', 'logos');
                if (url) logoUrl = url;
            } catch (uploadErr) {
                console.error('Logo upload failed:', uploadErr);
            }

            if (!logoUrl) {
                const proceed = confirm('Logo upload failed (file may be too large). Create client without logo?');
                if (!proceed) {
                    createLoading.value = false;
                    return;
                }
            }
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

// ── Payment alert picker (Off / Banner / Banner + modal popup) ──
type PaymentAlertChoice = 'off' | 'banner' | 'modal';
const showAlertModal = ref(false);
const alertTenant = ref<Tenant | null>(null);
const alertChoice = ref<PaymentAlertChoice>('off');
const alertSaving = ref(false);

const openAlertModal = (tenant: Tenant) => {
    alertTenant.value = tenant;
    if (!tenant.payment_alert) {
        alertChoice.value = 'off';
    } else {
        alertChoice.value = (tenant.payment_alert_type as PaymentAlertChoice) === 'modal' ? 'modal' : 'banner';
    }
    showAlertModal.value = true;
};

const closeAlertModal = () => {
    if (alertSaving.value) return;
    showAlertModal.value = false;
};

const saveAlertChoice = async () => {
    if (!alertTenant.value || alertSaving.value) return;
    alertSaving.value = true;
    try {
        const enabled = alertChoice.value !== 'off';
        const type = alertChoice.value === 'modal' ? 'modal' : 'banner';
        await tenantStore.setPaymentAlertSettings(alertTenant.value.id, enabled, type);
        alertTenant.value.payment_alert = enabled;
        (alertTenant.value as any).payment_alert_type = type;
        showAlertModal.value = false;
    } catch (e: any) {
        alert('Erreur: ' + e.message);
    } finally {
        alertSaving.value = false;
    }
};

const showSubscriptionModal = ref(false);
const subscriptionTenant = ref<Tenant | null>(null);
const subscriptionForm = ref({
    membership_type: null as 'monthly' | 'yearly' | null,
    membership_months: 1 as number,
    membership_paid: false
});
const subscriptionSaving = ref(false);

const openSubscriptionModal = (tenant: Tenant) => {
    subscriptionTenant.value = tenant;
    subscriptionForm.value = {
        membership_type: tenant.membership_type || null,
        membership_months: tenant.membership_months || 1,
        membership_paid: tenant.membership_paid ?? false
    };
    showSubscriptionModal.value = true;
};

const getNextPaymentDate = computed(() => {
    if (!subscriptionTenant.value) return null;
    const created = new Date(subscriptionTenant.value.created_at);
    if (subscriptionForm.value.membership_type === 'monthly') {
        const next = new Date(created);
        next.setMonth(next.getMonth() + subscriptionForm.value.membership_months);
        return next;
    }
    if (subscriptionForm.value.membership_type === 'yearly') {
        const next = new Date(created);
        next.setFullYear(next.getFullYear() + 1);
        return next;
    }
    return null;
});

const isPaymentOverdue = computed(() => {
    if (!getNextPaymentDate.value) return false;
    return getNextPaymentDate.value < new Date();
});

const saveSubscription = async () => {
    if (!subscriptionTenant.value) return;
    subscriptionSaving.value = true;
    try {
        await tenantStore.updateSubscription(
            subscriptionTenant.value.id,
            subscriptionForm.value.membership_type,
            subscriptionForm.value.membership_type === 'monthly' ? subscriptionForm.value.membership_months : null,
            subscriptionForm.value.membership_paid
        );
        subscriptionTenant.value.membership_type = subscriptionForm.value.membership_type;
        subscriptionTenant.value.membership_months = subscriptionForm.value.membership_type === 'monthly' ? subscriptionForm.value.membership_months : null;
        subscriptionTenant.value.membership_paid = subscriptionForm.value.membership_paid;
        showSubscriptionModal.value = false;
    } catch (e: any) {
        alert('Error saving subscription: ' + e.message);
    } finally {
        subscriptionSaving.value = false;
    }
};

// ── Logo edit modal ──
const showLogoModal = ref(false);
const logoTenant = ref<Tenant | null>(null);
const newLogoFile = ref<File | null>(null);
const newLogoPreview = ref<string | null>(null);
const logoSaving = ref(false);
const logoFileInput = ref<HTMLInputElement | null>(null);

const openLogoModal = (tenant: Tenant) => {
    logoTenant.value = tenant;
    newLogoFile.value = null;
    if (newLogoPreview.value && newLogoPreview.value.startsWith('blob:')) {
        URL.revokeObjectURL(newLogoPreview.value);
    }
    newLogoPreview.value = null;
    showLogoModal.value = true;
};

const closeLogoModal = () => {
    showLogoModal.value = false;
    logoTenant.value = null;
    newLogoFile.value = null;
    if (newLogoPreview.value && newLogoPreview.value.startsWith('blob:')) {
        URL.revokeObjectURL(newLogoPreview.value);
    }
    newLogoPreview.value = null;
};

const handleNewLogoSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        newLogoFile.value = file;
        if (newLogoPreview.value && newLogoPreview.value.startsWith('blob:')) {
            URL.revokeObjectURL(newLogoPreview.value);
        }
        newLogoPreview.value = URL.createObjectURL(file);
    }
};

const triggerLogoFileInput = () => {
    logoFileInput.value?.click();
};

const saveLogo = async () => {
    if (!logoTenant.value || !newLogoFile.value) return;

    logoSaving.value = true;
    try {
        let fileToUpload: File = newLogoFile.value;
        if (fileToUpload.type.startsWith('image/') && !fileToUpload.type.includes('svg')) {
            try {
                fileToUpload = await compressImage(fileToUpload, 512, 512, 0.7);
            } catch (compressErr) {
                console.warn('Logo compression failed, using original:', compressErr);
            }
        }

        const url = await uploadFile(fileToUpload, 'car-images', 'logos');
        if (!url) {
            alert('Logo upload failed. Please try again.');
            return;
        }

        await tenantStore.updateTenantLogo(logoTenant.value.id, url);

        const idx = tenants.value.findIndex((t) => t.id === logoTenant.value!.id);
        if (idx !== -1) tenants.value[idx].logo_url = url;

        closeLogoModal();
    } catch (e: any) {
        alert('Error updating logo: ' + e.message);
    } finally {
        logoSaving.value = false;
    }
};

// ── Contract template modal ──
const showTemplateModal = ref(false);
const templateTenant = ref<Tenant | null>(null);
const templateChoice = ref<'default' | 'v2'>('default');
const templateSaving = ref(false);

const openTemplateModal = (tenant: Tenant) => {
    templateTenant.value = tenant;
    templateChoice.value = (tenant.contract_template as any) || 'default';
    showTemplateModal.value = true;
};

const closeTemplateModal = () => {
    showTemplateModal.value = false;
    templateTenant.value = null;
};

const saveTemplate = async () => {
    if (!templateTenant.value) return;
    templateSaving.value = true;
    try {
        await tenantStore.updateContractTemplate(templateTenant.value.id, templateChoice.value);
        const idx = tenants.value.findIndex((t) => t.id === templateTenant.value!.id);
        if (idx !== -1) tenants.value[idx].contract_template = templateChoice.value;
        closeTemplateModal();
    } catch (e: any) {
        alert('Error updating contract template: ' + e.message);
    } finally {
        templateSaving.value = false;
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
                            <button
                                type="button"
                                @click="openLogoModal(tenant)"
                                class="relative group/logo w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden transition-all"
                                :class="tenant.status !== 'active' ? 'bg-white/[0.03]' : 'bg-white/[0.06]'"
                                title="Change logo"
                            >
                                <img v-if="tenant.logo_url" :src="tenant.logo_url" class="w-full h-full object-contain p-1.5" :class="{ 'grayscale opacity-50': tenant.status !== 'active' }" />
                                <Building2 v-else class="w-6 h-6 text-white/20" />
                                <span class="pointer-events-none absolute inset-0 bg-black/55 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
                                    <Camera class="w-4 h-4 text-white" />
                                </span>
                            </button>
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
                                @click="openAlertModal(tenant)"
                                class="relative flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                                :class="tenant.payment_alert
                                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                                    : 'text-white/20 hover:text-amber-400 hover:bg-amber-500/10'"
                                :title="tenant.payment_alert
                                    ? (tenant.payment_alert_type === 'modal'
                                        ? 'Alerte paiement (Type 2 — bandeau + popup)'
                                        : 'Alerte paiement (Type 1 — bandeau)')
                                    : 'Configurer l\'alerte de paiement'"
                            >
                                <Bell v-if="!tenant.payment_alert" class="w-4 h-4" />
                                <BellOff v-else class="w-4 h-4" />
                                <!-- Tiny double-ring badge for Type 2 (popup mode) -->
                                <span
                                    v-if="tenant.payment_alert && tenant.payment_alert_type === 'modal'"
                                    class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-gray-900"
                                    aria-hidden="true"
                                ></span>
                            </button>
                            <button 
                                @click="openSubscriptionModal(tenant)"
                                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                                :class="tenant.membership_type 
                                    ? 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20' 
                                    : 'text-white/20 hover:text-violet-400 hover:bg-violet-500/10'"
                                title="Subscription"
                            >
                                <CreditCard class="w-4 h-4" />
                            </button>
                            <button
                                @click="openTemplateModal(tenant)"
                                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                                :class="tenant.contract_template === 'v2'
                                    ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
                                    : 'text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10'"
                                :title="tenant.contract_template === 'v2' ? 'Contract template: V2' : 'Contract template: Default'"
                            >
                                <FileText class="w-4 h-4" />
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

        <!-- Subscription Modal -->
        <Transition name="modal">
            <div v-if="showSubscriptionModal && subscriptionTenant" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showSubscriptionModal = false"></div>
                <div class="relative w-full max-w-md bg-[#1a1b23] border border-white/[0.08] rounded-2xl shadow-2xl">
                    <!-- Modal Header -->
                    <div class="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                <CreditCard class="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-white">Subscription</h3>
                                <p class="text-xs text-white/30 mt-0.5">{{ subscriptionTenant.name }}</p>
                            </div>
                        </div>
                        <button @click="showSubscriptionModal = false" class="text-white/30 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-6 space-y-6">
                        <!-- Client Creation Date -->
                        <div class="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                <Calendar class="w-4.5 h-4.5 text-indigo-400" />
                            </div>
                            <div>
                                <p class="text-xs font-semibold text-white/40 uppercase tracking-wider">Client Since</p>
                                <p class="text-sm font-semibold text-white mt-0.5">{{ formatDate(subscriptionTenant.created_at) }}</p>
                            </div>
                        </div>

                        <!-- Membership Type -->
                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Membership Type</label>
                            <div class="grid grid-cols-2 gap-3">
                                <button 
                                    type="button"
                                    @click="subscriptionForm.membership_type = 'monthly'"
                                    class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                                    :class="subscriptionForm.membership_type === 'monthly' 
                                        ? 'border-violet-500/50 bg-violet-500/10' 
                                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'"
                                >
                                    <div v-if="subscriptionForm.membership_type === 'monthly'" class="absolute top-2 right-2">
                                        <Check class="w-4 h-4 text-violet-400" />
                                    </div>
                                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="subscriptionForm.membership_type === 'monthly' ? 'bg-violet-500/20' : 'bg-white/[0.04]'">
                                        <Calendar class="w-5 h-5" :class="subscriptionForm.membership_type === 'monthly' ? 'text-violet-400' : 'text-white/30'" />
                                    </div>
                                    <span class="text-sm font-semibold" :class="subscriptionForm.membership_type === 'monthly' ? 'text-violet-300' : 'text-white/50'">Monthly</span>
                                </button>
                                <button 
                                    type="button"
                                    @click="subscriptionForm.membership_type = 'yearly'"
                                    class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                                    :class="subscriptionForm.membership_type === 'yearly' 
                                        ? 'border-violet-500/50 bg-violet-500/10' 
                                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'"
                                >
                                    <div v-if="subscriptionForm.membership_type === 'yearly'" class="absolute top-2 right-2">
                                        <Check class="w-4 h-4 text-violet-400" />
                                    </div>
                                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="subscriptionForm.membership_type === 'yearly' ? 'bg-violet-500/20' : 'bg-white/[0.04]'">
                                        <CreditCard class="w-5 h-5" :class="subscriptionForm.membership_type === 'yearly' ? 'text-violet-400' : 'text-white/30'" />
                                    </div>
                                    <span class="text-sm font-semibold" :class="subscriptionForm.membership_type === 'yearly' ? 'text-violet-300' : 'text-white/50'">Yearly</span>
                                </button>
                            </div>
                        </div>

                        <!-- Months Subscribed (only for monthly) -->
                        <div v-if="subscriptionForm.membership_type === 'monthly'">
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Months Subscribed</label>
                            <div class="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                                <div class="flex items-center gap-3 flex-1">
                                    <button 
                                        type="button"
                                        @click="subscriptionForm.membership_months = Math.max(1, subscriptionForm.membership_months - 1)"
                                        class="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 hover:text-white transition-all"
                                    >
                                        <Minus class="w-4 h-4" />
                                    </button>
                                    <div class="flex-1 text-center">
                                        <span class="text-2xl font-bold text-white">{{ subscriptionForm.membership_months }}</span>
                                        <span class="text-sm text-white/30 ml-1.5">{{ subscriptionForm.membership_months === 1 ? 'month' : 'months' }}</span>
                                    </div>
                                    <button 
                                        type="button"
                                        @click="subscriptionForm.membership_months = Math.min(24, subscriptionForm.membership_months + 1)"
                                        class="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/50 hover:text-white transition-all"
                                    >
                                        <Plus class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-2">
                                <button 
                                    v-for="q in [1, 3, 6, 12]" :key="q"
                                    type="button"
                                    @click="subscriptionForm.membership_months = q"
                                    class="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all"
                                    :class="subscriptionForm.membership_months === q 
                                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                                        : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/50'"
                                >
                                    {{ q }}mo
                                </button>
                            </div>
                        </div>

                        <!-- Next Payment Date -->
                        <div v-if="getNextPaymentDate" class="flex items-center gap-3 p-4 rounded-xl border" :class="isPaymentOverdue ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.03] border-white/[0.06]'">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" :class="isPaymentOverdue ? 'bg-red-500/10' : 'bg-amber-500/10'">
                                <AlertTriangle v-if="isPaymentOverdue" class="w-4.5 h-4.5 text-red-400" />
                                <Clock v-else class="w-4.5 h-4.5 text-amber-400" />
                            </div>
                            <div class="flex-1">
                                <p class="text-xs font-semibold uppercase tracking-wider" :class="isPaymentOverdue ? 'text-red-400/60' : 'text-white/40'">Next Payment</p>
                                <p class="text-sm font-semibold mt-0.5" :class="isPaymentOverdue ? 'text-red-300' : 'text-white'">{{ formatDate(getNextPaymentDate.toISOString()) }}</p>
                            </div>
                            <span 
                                v-if="isPaymentOverdue"
                                class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-red-500/15 text-red-400"
                            >Overdue</span>
                        </div>

                        <!-- Paid Toggle -->
                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Payment Status</label>
                            <div 
                                class="flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer"
                                :class="subscriptionForm.membership_paid 
                                    ? 'border-emerald-500/30 bg-emerald-500/5' 
                                    : 'border-white/[0.06] bg-white/[0.02]'"
                                @click="subscriptionForm.membership_paid = !subscriptionForm.membership_paid"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="subscriptionForm.membership_paid ? 'bg-emerald-500/15' : 'bg-white/[0.04]'">
                                        <Check v-if="subscriptionForm.membership_paid" class="w-5 h-5 text-emerald-400" />
                                        <X v-else class="w-5 h-5 text-white/25" />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold" :class="subscriptionForm.membership_paid ? 'text-emerald-300' : 'text-white/50'">
                                            {{ subscriptionForm.membership_paid ? 'Paid' : 'Not Paid' }}
                                        </p>
                                        <p class="text-xs mt-0.5" :class="subscriptionForm.membership_paid ? 'text-emerald-400/50' : 'text-white/20'">
                                            {{ subscriptionForm.membership_paid ? 'Subscription payment received' : 'Awaiting payment' }}
                                        </p>
                                    </div>
                                </div>
                                <!-- Toggle Switch -->
                                <div 
                                    class="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                                    :class="subscriptionForm.membership_paid ? 'bg-emerald-500' : 'bg-white/10'"
                                >
                                    <div 
                                        class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform"
                                        :class="subscriptionForm.membership_paid ? 'translate-x-[22px]' : 'translate-x-0.5'"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
                        <button type="button" @click="showSubscriptionModal = false" class="text-sm text-white/40 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/[0.06] transition">
                            Cancel
                        </button>
                        <button 
                            @click="saveSubscription"
                            :disabled="subscriptionSaving" 
                            class="flex items-center gap-2 bg-violet-500 text-white hover:bg-violet-400 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Loader2 v-if="subscriptionSaving" class="w-4 h-4 animate-spin" />
                            {{ subscriptionSaving ? 'Saving...' : 'Save Changes' }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Change Logo Modal -->
        <Transition name="modal">
            <div v-if="showLogoModal && logoTenant" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeLogoModal"></div>
                <div class="relative w-full max-w-md bg-[#1a1b23] border border-white/[0.08] rounded-2xl shadow-2xl">
                    <!-- Modal Header -->
                    <div class="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <ImageIcon class="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-white">Change Logo</h3>
                                <p class="text-xs text-white/30 mt-0.5">{{ logoTenant.name }}</p>
                            </div>
                        </div>
                        <button @click="closeLogoModal" class="text-white/30 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-6 space-y-5">
                        <!-- Compare: Current vs New -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 text-center">Current</p>
                                <div class="aspect-square rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                                    <img v-if="logoTenant.logo_url" :src="logoTenant.logo_url" class="w-full h-full object-contain p-3" />
                                    <Building2 v-else class="w-8 h-8 text-white/20" />
                                </div>
                            </div>
                            <div>
                                <p class="text-[10px] font-bold uppercase tracking-wider mb-2 text-center" :class="newLogoPreview ? 'text-indigo-400' : 'text-white/40'">New</p>
                                <button
                                    type="button"
                                    @click="triggerLogoFileInput"
                                    class="aspect-square w-full rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all"
                                    :class="newLogoPreview
                                        ? 'border-indigo-500/50 bg-indigo-500/5'
                                        : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]'"
                                >
                                    <img v-if="newLogoPreview" :src="newLogoPreview" class="w-full h-full object-contain p-3" />
                                    <div v-else class="flex flex-col items-center gap-1.5">
                                        <Upload class="w-5 h-5 text-white/30" />
                                        <span class="text-[11px] font-medium text-white/40">Choose file</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <input
                            ref="logoFileInput"
                            type="file"
                            accept="image/*"
                            class="hidden"
                            @change="handleNewLogoSelect"
                        />

                        <p class="text-[11px] text-white/30 text-center">
                            PNG, JPG or SVG. Recommended: square aspect ratio, transparent background.
                        </p>
                    </div>

                    <!-- Modal Footer -->
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
                        <button type="button" @click="closeLogoModal" class="text-sm text-white/40 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/[0.06] transition">
                            Cancel
                        </button>
                        <button
                            @click="saveLogo"
                            :disabled="!newLogoFile || logoSaving || uploadingLogo"
                            class="flex items-center gap-2 bg-indigo-500 text-white hover:bg-indigo-400 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Loader2 v-if="logoSaving || uploadingLogo" class="w-4 h-4 animate-spin" />
                            <Check v-else class="w-4 h-4" />
                            {{ logoSaving || uploadingLogo ? 'Saving...' : 'Save Logo' }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Payment Alert Type Modal -->
        <Teleport to="body">
            <div v-if="showAlertModal && alertTenant" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeAlertModal"></div>
                <div class="relative w-full max-w-md rounded-2xl bg-gray-900 ring-1 ring-white/10 shadow-2xl overflow-hidden">
                    <!-- Header -->
                    <div class="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-amber-500/10 to-orange-500/10 flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/30">
                                <AlertTriangle class="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white">Alerte de paiement</h3>
                                <p class="text-[11px] text-white/60 truncate max-w-[240px]">{{ alertTenant.name }}</p>
                            </div>
                        </div>
                        <button @click="closeAlertModal" :disabled="alertSaving" class="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-40">
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Body — three picker cards -->
                    <div class="p-5 space-y-2.5">
                        <button
                            type="button"
                            @click="alertChoice = 'off'"
                            class="w-full text-left rounded-xl p-3 ring-1 transition-all"
                            :class="alertChoice === 'off'
                                ? 'bg-white/[0.06] ring-white/30 shadow-inner'
                                : 'bg-white/[0.02] ring-white/10 hover:bg-white/[0.04] hover:ring-white/20'"
                        >
                            <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                     :class="alertChoice === 'off' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.05] text-white/40'">
                                    <BellOff class="w-4 h-4" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-bold text-white">Aucune alerte</span>
                                        <Check v-if="alertChoice === 'off'" class="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <p class="text-[11px] text-white/50 mt-0.5">Le tenant ne voit aucune notification de paiement.</p>
                                </div>
                            </div>
                        </button>

                        <button
                            type="button"
                            @click="alertChoice = 'banner'"
                            class="w-full text-left rounded-xl p-3 ring-1 transition-all"
                            :class="alertChoice === 'banner'
                                ? 'bg-amber-500/10 ring-amber-400/40 shadow-inner'
                                : 'bg-white/[0.02] ring-white/10 hover:bg-white/[0.04] hover:ring-white/20'"
                        >
                            <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                     :class="alertChoice === 'banner' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.05] text-white/40'">
                                    <AlertTriangle class="w-4 h-4" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-sm font-bold text-white">Type 1 · Bandeau</span>
                                        <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/60">Discret</span>
                                        <Check v-if="alertChoice === 'banner'" class="w-3.5 h-3.5 text-amber-300" />
                                    </div>
                                    <p class="text-[11px] text-white/50 mt-0.5">Bandeau orange sous la navbar, dismissable par session.</p>
                                </div>
                            </div>
                        </button>

                        <button
                            type="button"
                            @click="alertChoice = 'modal'"
                            class="w-full text-left rounded-xl p-3 ring-1 transition-all"
                            :class="alertChoice === 'modal'
                                ? 'bg-orange-500/10 ring-orange-400/50 shadow-inner'
                                : 'bg-white/[0.02] ring-white/10 hover:bg-white/[0.04] hover:ring-white/20'"
                        >
                            <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative"
                                     :class="alertChoice === 'modal' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/[0.05] text-white/40'">
                                    <AlertTriangle class="w-4 h-4" />
                                    <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-gray-900"></span>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-sm font-bold text-white">Type 2 · Bandeau + Popup</span>
                                        <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">Insistant</span>
                                        <Check v-if="alertChoice === 'modal'" class="w-3.5 h-3.5 text-orange-300" />
                                    </div>
                                    <p class="text-[11px] text-white/50 mt-0.5">Popup central à la connexion <span class="text-white/70">+</span> bandeau sous la navbar. Le tenant peut fermer le popup.</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    <!-- Footer -->
                    <div class="px-5 py-3.5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-end gap-2">
                        <button
                            type="button"
                            @click="closeAlertModal"
                            :disabled="alertSaving"
                            class="text-sm text-white/50 hover:text-white px-4 py-2 rounded-lg hover:bg-white/[0.06] transition disabled:opacity-40"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            @click="saveAlertChoice"
                            :disabled="alertSaving"
                            class="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md shadow-amber-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Loader2 v-if="alertSaving" class="w-4 h-4 animate-spin" />
                            <Check v-else class="w-4 h-4" />
                            Enregistrer
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Contract Template Modal -->
        <Transition name="modal">
            <div v-if="showTemplateModal && templateTenant" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeTemplateModal"></div>
                <div class="relative w-full max-w-lg bg-[#1a1b23] border border-white/[0.08] rounded-2xl shadow-2xl">
                    <!-- Modal Header -->
                    <div class="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                                <FileText class="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-white">Contract Template</h3>
                                <p class="text-xs text-white/30 mt-0.5">{{ templateTenant.name }}</p>
                            </div>
                        </div>
                        <button @click="closeTemplateModal" class="text-white/30 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-6 space-y-3">
                        <p class="text-xs text-white/40 mb-2">Choisir le modèle de contrat affiché dans le builder de ce tenant.</p>

                        <button
                            type="button"
                            @click="templateChoice = 'default'"
                            class="w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all"
                            :class="templateChoice === 'default'
                                ? 'border-cyan-500/50 bg-cyan-500/5'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'"
                        >
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="templateChoice === 'default' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/[0.04] text-white/40'">
                                <FileText class="w-5 h-5" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-semibold" :class="templateChoice === 'default' ? 'text-cyan-300' : 'text-white/80'">Default</p>
                                    <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">Original</span>
                                </div>
                                <p class="text-xs text-white/40 mt-0.5">Modèle bilingue Premier/Second conducteur en deux colonnes, avec section Encaissement détaillée.</p>
                            </div>
                            <Check v-if="templateChoice === 'default'" class="w-4 h-4 text-cyan-400 mt-1 shrink-0" />
                        </button>

                        <button
                            type="button"
                            @click="templateChoice = 'v2'"
                            class="w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all"
                            :class="templateChoice === 'v2'
                                ? 'border-cyan-500/50 bg-cyan-500/5'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'"
                        >
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="templateChoice === 'v2' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/[0.04] text-white/40'">
                                <Sparkles class="w-5 h-5" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-semibold" :class="templateChoice === 'v2' ? 'text-cyan-300' : 'text-white/80'">V2 — Tesla style</p>
                                    <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">New</span>
                                </div>
                                <p class="text-xs text-white/40 mt-0.5">Mise en page dense, en-tête avec contacts, sections Premier/2ème conducteur en grille 3 colonnes, payement & règlement structuré.</p>
                            </div>
                            <Check v-if="templateChoice === 'v2'" class="w-4 h-4 text-cyan-400 mt-1 shrink-0" />
                        </button>

                        <p class="text-[11px] text-white/25 pt-2">
                            La page 2 (Conditions Générales) reste identique pour les deux modèles.
                        </p>
                    </div>

                    <!-- Modal Footer -->
                    <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
                        <button type="button" @click="closeTemplateModal" class="text-sm text-white/40 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/[0.06] transition">
                            Cancel
                        </button>
                        <button
                            @click="saveTemplate"
                            :disabled="templateSaving"
                            class="flex items-center gap-2 bg-cyan-500 text-white hover:bg-cyan-400 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Loader2 v-if="templateSaving" class="w-4 h-4 animate-spin" />
                            <Check v-else class="w-4 h-4" />
                            {{ templateSaving ? 'Saving...' : 'Apply' }}
                        </button>
                    </div>
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
