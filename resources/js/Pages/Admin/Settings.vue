<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { useSubOffices } from '@/composables/useSubOffices';
import { useTenantLink } from '@/composables/useTenantLink';
import {
    Loader2, Lock, UserPlus, KeyRound, Shield, Settings, Users,
    AlertCircle, CircleCheck, Check, LayoutGrid, Sparkles,
    Building2, Car, ChevronRight,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { PAGE_DEFINITIONS, DEFAULT_ALLOWED_PAGES, type PageKey } from '@/utils/pagePermissions';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const router = useRouter();
const { tenantPath } = useTenantLink();
const { t } = useI18n();

// ─── Sub-Offices summary (admin only) ───────────────────────────
const subOfficeCount = ref<number | null>(null);
const subOfficeCarsCount = ref<number | null>(null);

async function loadSubOfficeStats() {
    if (authStore.role !== 'admin') return;
    const { listSubOffices, fetchAllAssignmentsForTenant } = useSubOffices();
    try {
        const list = await listSubOffices();
        subOfficeCount.value = list.length;
        const assignments = await fetchAllAssignmentsForTenant();
        subOfficeCarsCount.value = Object.keys(assignments).length;
    } catch (e) {
        // Non-blocking: the page itself still works without the stats.
        subOfficeCount.value = subOfficeCount.value ?? 0;
        subOfficeCarsCount.value = subOfficeCarsCount.value ?? 0;
    }
}

onMounted(() => {
    loadSubOfficeStats();
});

function goToSubOffices() {
    router.push(tenantPath('/admin/sub-offices'));
}

// ─── Change Password ────────────────────────────────────────────
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
        error.value = t('admin.settings.password_mismatch');
        return;
    }

    if (newPassword.value.length < 6) {
        error.value = t('admin.settings.password_min_length');
        return;
    }

    loading.value = true;

    try {
        await authStore.changeAdminPassword(currentPassword.value, newPassword.value);
        success.value = t('admin.settings.password_success');
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    } catch (e: any) {
        error.value = e.message || t('admin.settings.password_error');
    } finally {
        loading.value = false;
    }
};

// ─── Create User ────────────────────────────────────────────────
const newUserUsername = ref('');
const newUserPassword = ref('');
const newUserLoading = ref(false);
const newUserError = ref('');
const newUserSuccess = ref('');
const selectedPages = ref<PageKey[]>([...DEFAULT_ALLOWED_PAGES]);

const togglePage = (key: PageKey) => {
    const idx = selectedPages.value.indexOf(key);
    if (idx === -1) selectedPages.value.push(key);
    else selectedPages.value.splice(idx, 1);
};

const selectAllPages = () => {
    selectedPages.value = PAGE_DEFINITIONS.map((p) => p.key);
};

const deselectAllPages = () => {
    selectedPages.value = [];
};

const isPageSelected = (key: PageKey) => selectedPages.value.includes(key);

const allSelected = computed(
    () => selectedPages.value.length === PAGE_DEFINITIONS.length,
);

// Tailwind safelist helpers — keep classes explicit so JIT picks them up.
const colorClasses: Record<string, { ring: string; bg: string; icon: string; gradient: string; shadow: string; }> = {
    indigo:  { ring: 'ring-indigo-400',  bg: 'bg-indigo-50',  icon: 'text-indigo-600',  gradient: 'from-indigo-500 to-indigo-600',   shadow: 'shadow-indigo-200/60' },
    blue:    { ring: 'ring-blue-400',    bg: 'bg-blue-50',    icon: 'text-blue-600',    gradient: 'from-blue-500 to-blue-600',       shadow: 'shadow-blue-200/60' },
    emerald: { ring: 'ring-emerald-400', bg: 'bg-emerald-50', icon: 'text-emerald-600', gradient: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-200/60' },
    amber:   { ring: 'ring-amber-400',   bg: 'bg-amber-50',   icon: 'text-amber-600',   gradient: 'from-amber-500 to-amber-600',     shadow: 'shadow-amber-200/60' },
    orange:  { ring: 'ring-orange-400',  bg: 'bg-orange-50',  icon: 'text-orange-600',  gradient: 'from-orange-500 to-orange-600',   shadow: 'shadow-orange-200/60' },
    cyan:    { ring: 'ring-cyan-400',    bg: 'bg-cyan-50',    icon: 'text-cyan-600',    gradient: 'from-cyan-500 to-cyan-600',       shadow: 'shadow-cyan-200/60' },
    pink:    { ring: 'ring-pink-400',    bg: 'bg-pink-50',    icon: 'text-pink-600',    gradient: 'from-pink-500 to-pink-600',       shadow: 'shadow-pink-200/60' },
    red:     { ring: 'ring-red-400',     bg: 'bg-red-50',     icon: 'text-red-600',     gradient: 'from-red-500 to-red-600',         shadow: 'shadow-red-200/60' },
    purple:  { ring: 'ring-purple-400',  bg: 'bg-purple-50',  icon: 'text-purple-600',  gradient: 'from-purple-500 to-purple-600',   shadow: 'shadow-purple-200/60' },
    slate:   { ring: 'ring-slate-400',   bg: 'bg-slate-50',   icon: 'text-slate-600',   gradient: 'from-slate-500 to-slate-600',     shadow: 'shadow-slate-200/60' },
    fuchsia: { ring: 'ring-fuchsia-400', bg: 'bg-fuchsia-50', icon: 'text-fuchsia-600', gradient: 'from-fuchsia-500 to-fuchsia-600', shadow: 'shadow-fuchsia-200/60' },
};

const handleCreateUser = async () => {
    newUserError.value = '';
    newUserSuccess.value = '';

    if (newUserPassword.value.length < 6) {
        newUserError.value = t('admin.settings.password_min_length');
        return;
    }

    if (selectedPages.value.length === 0) {
        newUserError.value = t('admin.settings.no_pages_warning');
        return;
    }

    newUserLoading.value = true;

    try {
        await tenantStore.createTenantUser(
            newUserUsername.value,
            newUserPassword.value,
            'user',
            [...selectedPages.value],
        );
        newUserSuccess.value = t('admin.settings.user_created_success', { username: newUserUsername.value });
        newUserUsername.value = '';
        newUserPassword.value = '';
        selectedPages.value = [...DEFAULT_ALLOWED_PAGES];
    } catch (e: any) {
        newUserError.value = e.message || t('admin.settings.create_user_error');
    } finally {
        newUserLoading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg shadow-gray-300">
                    <Settings class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ $t('admin.settings.title') }}</h1>
                    <p class="text-sm text-gray-500">Gérez vos paramètres de sécurité et vos préférences.</p>
                </div>
            </div>

            <!-- Sous-Bureaux row (admin only) -->
            <div v-if="authStore.role === 'admin'" class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div class="lg:col-span-3 bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-2xl ring-1 ring-indigo-100 shadow-sm overflow-hidden">
                    <div class="p-5 flex flex-col md:flex-row md:items-center gap-5">
                        <!-- Icon + title -->
                        <div class="flex items-center gap-3 md:flex-1">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-300/60 shrink-0">
                                <Building2 class="w-6 h-6 text-white" />
                            </div>
                            <div class="min-w-0">
                                <h2 class="text-base font-bold text-gray-900 truncate">{{ $t('admin.settings.sub_offices.title') }}</h2>
                                <p class="text-[12.5px] text-gray-500 leading-snug">{{ $t('admin.settings.sub_offices.subtitle') }}</p>
                            </div>
                        </div>

                        <!-- Stats -->
                        <div class="grid grid-cols-2 gap-3 md:gap-4 md:shrink-0">
                            <div class="bg-white/70 backdrop-blur-sm rounded-xl px-3.5 py-2 ring-1 ring-indigo-100/80 flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <Users class="w-4 h-4 text-indigo-600" />
                                </div>
                                <div class="leading-tight">
                                    <div class="text-base font-bold text-gray-900">
                                        <span v-if="subOfficeCount === null" class="inline-block w-6 h-3.5 bg-gray-200 rounded animate-pulse"></span>
                                        <span v-else>{{ subOfficeCount }}</span>
                                    </div>
                                    <div class="text-[10.5px] uppercase tracking-wide text-gray-500 font-semibold">{{ $t('admin.settings.sub_offices.stat_offices') }}</div>
                                </div>
                            </div>
                            <div class="bg-white/70 backdrop-blur-sm rounded-xl px-3.5 py-2 ring-1 ring-indigo-100/80 flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                    <Car class="w-4 h-4 text-violet-600" />
                                </div>
                                <div class="leading-tight">
                                    <div class="text-base font-bold text-gray-900">
                                        <span v-if="subOfficeCarsCount === null" class="inline-block w-6 h-3.5 bg-gray-200 rounded animate-pulse"></span>
                                        <span v-else>{{ subOfficeCarsCount }}</span>
                                    </div>
                                    <div class="text-[10.5px] uppercase tracking-wide text-gray-500 font-semibold">{{ $t('admin.settings.sub_offices.stat_cars') }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- CTA -->
                        <button
                            type="button"
                            @click="goToSubOffices"
                            class="md:shrink-0 inline-flex items-center justify-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                        >
                            <Building2 class="w-4 h-4" />
                            {{ $t('admin.settings.sub_offices.cta') }}
                            <ChevronRight class="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Top row: Password + (Admin) Quick info -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

                <!-- Change Password (1 col on desktop) -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden lg:col-span-1">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <KeyRound class="w-4 h-4 text-blue-600" />
                        </div>
                        <h2 class="text-base font-bold text-gray-900">{{ $t('admin.settings.change_password_title') }}</h2>
                    </div>

                    <div class="p-5">
                        <form @submit.prevent="handleChangePassword" class="space-y-3">
                            <div>
                                <label class="form-label">{{ $t('admin.settings.current_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="currentPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.current_password')">
                                </div>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.settings.new_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="newPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.new_password')">
                                </div>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.settings.confirm_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="confirmPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.confirm_password')">
                                </div>
                            </div>

                            <div v-if="error" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ error }}</span>
                            </div>
                            <div v-if="success" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ success }}</span>
                            </div>

                            <button 
                                type="submit" 
                                :disabled="loading"
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-xl shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                            >
                                <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
                                <KeyRound v-else class="w-4 h-4" />
                                {{ $t('admin.settings.change_password_submit') }}
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Create User (Admin Only) — spans 2 cols for the pages grid -->
                <div v-if="authStore.role === 'admin'" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden flex flex-col lg:col-span-2">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Shield class="w-4 h-4 text-emerald-600" />
                        </div>
                        <h2 class="text-base font-bold text-gray-900">{{ $t('admin.settings.create_user_title') }}</h2>
                    </div>

                    <div class="p-5 flex-1 flex flex-col">
                        <p class="text-sm text-gray-500 mb-4 bg-gray-50 p-3 rounded-xl ring-1 ring-gray-100 leading-relaxed" v-html="$t('admin.settings.create_user_desc')"></p>

                        <form @submit.prevent="handleCreateUser" class="space-y-4 flex-1 flex flex-col">

                            <!-- Identity fields -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="form-label">{{ $t('admin.settings.username') }}</label>
                                    <div class="form-input-wrapper">
                                        <Users class="form-input-icon" />
                                        <input v-model="newUserUsername" type="text" required class="form-input" placeholder="e.g. staff1">
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">{{ $t('admin.settings.initial_password') }}</label>
                                    <div class="form-input-wrapper">
                                        <Lock class="form-input-icon" />
                                        <input v-model="newUserPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.initial_password')">
                                    </div>
                                </div>
                            </div>

                            <!-- Pages selector -->
                            <div class="pages-section">
                                <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                                    <div class="flex items-center gap-2">
                                        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-200">
                                            <LayoutGrid class="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <div>
                                            <h3 class="text-sm font-bold text-gray-900">{{ $t('admin.settings.accessible_pages') }}</h3>
                                            <p class="text-[11px] text-gray-500">{{ $t('admin.settings.accessible_pages_hint') }}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                                            <Sparkles class="w-3 h-3" />
                                            {{ $t('admin.settings.pages_selected', { count: selectedPages.length, total: PAGE_DEFINITIONS.length }) }}
                                        </span>
                                        <button
                                            type="button"
                                            @click="allSelected ? deselectAllPages() : selectAllPages()"
                                            class="text-[11px] font-semibold text-gray-500 hover:text-indigo-600 px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                                        >
                                            {{ allSelected ? $t('admin.settings.deselect_all') : $t('admin.settings.select_all') }}
                                        </button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                                    <button
                                        v-for="page in PAGE_DEFINITIONS"
                                        :key="page.key"
                                        type="button"
                                        @click="togglePage(page.key)"
                                        :class="[
                                            'page-card group relative',
                                            isPageSelected(page.key)
                                                ? ['page-card-selected', colorClasses[page.color].ring, colorClasses[page.color].shadow]
                                                : 'page-card-idle'
                                        ]"
                                    >
                                        <!-- Icon tile -->
                                        <div
                                            :class="[
                                                'icon-tile',
                                                isPageSelected(page.key)
                                                    ? ['bg-gradient-to-br', colorClasses[page.color].gradient, 'text-white', colorClasses[page.color].shadow, 'shadow-md']
                                                    : [colorClasses[page.color].bg, colorClasses[page.color].icon]
                                            ]"
                                        >
                                            <component :is="page.icon" class="w-4 h-4" />
                                        </div>

                                        <div class="flex-1 min-w-0 text-left">
                                            <div class="text-[12.5px] font-semibold text-gray-900 truncate">
                                                {{ $t(page.labelKey) }}
                                            </div>
                                            <div class="text-[10.5px] text-gray-500 truncate">
                                                {{ $t(page.descKey) }}
                                            </div>
                                        </div>

                                        <!-- Checkmark badge -->
                                        <div
                                            :class="[
                                                'check-badge',
                                                isPageSelected(page.key)
                                                    ? ['bg-gradient-to-br', colorClasses[page.color].gradient, 'opacity-100', 'scale-100']
                                                    : 'bg-gray-200 opacity-60 scale-90'
                                            ]"
                                        >
                                            <Check v-if="isPageSelected(page.key)" class="w-3 h-3 text-white" :stroke-width="3" />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div v-if="newUserError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ newUserError }}</span>
                            </div>
                            <div v-if="newUserSuccess" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ newUserSuccess }}</span>
                            </div>

                            <button 
                                type="submit" 
                                :disabled="newUserLoading"
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all mt-auto"
                            >
                                <Loader2 v-if="newUserLoading" class="w-4 h-4 animate-spin" />
                                <UserPlus v-else class="w-4 h-4" />
                                {{ $t('admin.settings.create_user_submit') }}
                            </button>
                        </form>
                    </div>
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

/* ───────── Pages selector ───────── */
.pages-section {
    background: linear-gradient(180deg, rgba(249, 250, 251, 0.7), rgba(249, 250, 251, 0.3));
    border: 1px dashed rgb(229 231 235);
    border-radius: 1rem;
    padding: 0.85rem;
}

.page-card {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.7rem;
    background: white;
    border-radius: 0.75rem;
    transition:
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
        box-shadow 220ms cubic-bezier(0.32, 0.72, 0, 1),
        background 220ms ease;
    cursor: pointer;
    text-align: left;
    position: relative;
    overflow: hidden;
}

.page-card-idle {
    --tw-ring-color: rgb(229 231 235);
    box-shadow: inset 0 0 0 1px rgb(229 231 235);
}

.page-card-idle:hover {
    transform: translateY(-1px);
    box-shadow:
        inset 0 0 0 1px rgb(199 210 254),
        0 4px 10px -3px rgba(99, 102, 241, 0.18);
}

.page-card-selected {
    box-shadow:
        inset 0 0 0 1.5px var(--tw-ring-color, rgb(129 140 248)),
        0 6px 18px -8px var(--tw-shadow-color, rgba(99, 102, 241, 0.35));
    transform: translateY(-1px);
}

/* Selected state: subtle inner glow tint */
.page-card-selected::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, transparent 60%);
    pointer-events: none;
    border-radius: inherit;
}

.icon-tile {
    width: 2rem;
    height: 2rem;
    border-radius: 0.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

.page-card:hover .icon-tile {
    transform: scale(1.06) rotate(-2deg);
}

.check-badge {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 2px white;
    transition:
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 220ms ease,
        background 220ms ease;
}
</style>
