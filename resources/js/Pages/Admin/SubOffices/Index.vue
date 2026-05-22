<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSubOffices, type SubOffice } from '@/composables/useSubOffices';
import { useTenantLink } from '@/composables/useTenantLink';
import {
    Building2, Plus, Pencil, Trash2, Car, Users, ArrowLeft,
    Loader2, AlertCircle, CircleCheck, Search, X, Sparkles, KeyRound,
} from 'lucide-vue-next';

const router = useRouter();
const { t } = useI18n();
const { tenantPath } = useTenantLink();
const {
    subOffices,
    loading,
    listSubOffices,
    deleteSubOffice,
} = useSubOffices();

const search = ref('');
const errorMsg = ref('');
const successMsg = ref('');

const showDeleteModal = ref(false);
const deleting = ref(false);
const toDelete = ref<SubOffice | null>(null);

onMounted(async () => {
    await refresh();
});

async function refresh() {
    errorMsg.value = '';
    try {
        await listSubOffices();
    } catch (e: any) {
        errorMsg.value = e?.message || t('admin.sub_offices.error_loading');
    }
}

const filtered = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return subOffices.value;
    return subOffices.value.filter((s) =>
        s.username.toLowerCase().includes(q)
        || (s.label || '').toLowerCase().includes(q),
    );
});

function goCreate() {
    router.push(tenantPath('/admin/sub-offices/create'));
}

function goEdit(id: string) {
    router.push(tenantPath(`/admin/sub-offices/${id}/edit`));
}

function askDelete(office: SubOffice) {
    toDelete.value = office;
    showDeleteModal.value = true;
}

async function confirmDelete() {
    if (!toDelete.value) return;
    deleting.value = true;
    errorMsg.value = '';
    try {
        await deleteSubOffice(toDelete.value.id);
        successMsg.value = t('admin.sub_offices.delete_success', { name: toDelete.value.label || toDelete.value.username });
        showDeleteModal.value = false;
        toDelete.value = null;
        await refresh();
    } catch (e: any) {
        errorMsg.value = e?.message || t('admin.sub_offices.error_delete');
    } finally {
        deleting.value = false;
    }
}

function initialsOf(office: SubOffice): string {
    const source = (office.label || office.username || '').trim();
    if (!source) return '?';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function goBack() {
    router.push(tenantPath('/admin/settings'));
}
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">
            <!-- Header -->
            <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        @click="goBack"
                        class="w-9 h-9 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                        :title="$t('common.back')"
                    >
                        <ArrowLeft class="w-4 h-4" />
                    </button>
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-300/60">
                        <Building2 class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ $t('admin.sub_offices.title') }}</h1>
                        <p class="text-sm text-gray-500">{{ $t('admin.sub_offices.subtitle') }}</p>
                    </div>
                </div>

                <button
                    type="button"
                    @click="goCreate"
                    class="inline-flex items-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                >
                    <Plus class="w-4 h-4" />
                    {{ $t('admin.sub_offices.create_cta') }}
                </button>
            </div>

            <!-- Search bar -->
            <div v-if="subOffices.length > 0" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-3.5 flex items-center gap-2">
                <Search class="w-4 h-4 text-gray-400 ml-1 shrink-0" />
                <input
                    v-model="search"
                    type="text"
                    class="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400 px-1"
                    :placeholder="$t('admin.sub_offices.search_placeholder')"
                />
                <button
                    v-if="search"
                    @click="search = ''"
                    type="button"
                    class="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                    <X class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- Status banners -->
            <div v-if="errorMsg" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                <span>{{ errorMsg }}</span>
            </div>
            <div v-if="successMsg" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                <span>{{ successMsg }}</span>
            </div>

            <!-- Loading state -->
            <div v-if="loading && subOffices.length === 0" class="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
                <Loader2 class="w-7 h-7 animate-spin text-indigo-500" />
                <span class="text-sm">{{ $t('common.loading') }}…</span>
            </div>

            <!-- Empty state -->
            <div v-else-if="subOffices.length === 0" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm py-16 px-6 text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-4">
                    <Building2 class="w-8 h-8 text-indigo-600" />
                </div>
                <h2 class="text-lg font-bold text-gray-900 mb-1">{{ $t('admin.sub_offices.empty_title') }}</h2>
                <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">{{ $t('admin.sub_offices.empty_desc') }}</p>
                <button
                    type="button"
                    @click="goCreate"
                    class="inline-flex items-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-200 transition-all"
                >
                    <Sparkles class="w-4 h-4" />
                    {{ $t('admin.sub_offices.empty_cta') }}
                </button>
            </div>

            <!-- No results from search -->
            <div v-else-if="filtered.length === 0" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm py-12 px-6 text-center">
                <Search class="w-7 h-7 mx-auto text-gray-300 mb-3" />
                <p class="text-sm text-gray-500">{{ $t('admin.sub_offices.no_results') }}</p>
            </div>

            <!-- Cards grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div
                    v-for="office in filtered"
                    :key="office.id"
                    class="group bg-white rounded-2xl ring-1 ring-gray-100 hover:ring-indigo-200 hover:shadow-lg hover:shadow-indigo-100/60 shadow-sm overflow-hidden transition-all"
                >
                    <!-- Header band -->
                    <div class="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500"></div>

                    <div class="p-5">
                        <div class="flex items-start gap-3.5 mb-4">
                            <!-- Avatar -->
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-indigo-300/50 shrink-0">
                                {{ initialsOf(office) }}
                            </div>

                            <div class="min-w-0 flex-1">
                                <h3 class="text-[15px] font-bold text-gray-900 truncate">
                                    {{ office.label || office.username }}
                                </h3>
                                <div class="text-[12px] text-gray-500 truncate flex items-center gap-1">
                                    <KeyRound class="w-3 h-3" />
                                    {{ office.username }}
                                </div>
                            </div>
                        </div>

                        <!-- Stats line -->
                        <div class="flex items-center justify-between gap-2 mb-4">
                            <div class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                                <Car class="w-3.5 h-3.5" />
                                <span class="text-[12px] font-semibold">{{ office.cars_count }} {{ office.cars_count === 1 ? $t('admin.sub_offices.car_singular') : $t('admin.sub_offices.car_plural') }}</span>
                            </div>
                            <div class="text-[11px] text-gray-400">
                                {{ new Date(office.created_at).toLocaleDateString() }}
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                @click="goEdit(office.id)"
                                class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-[12.5px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl ring-1 ring-indigo-100 hover:ring-indigo-200 transition-all"
                            >
                                <Pencil class="w-3.5 h-3.5" />
                                {{ $t('admin.sub_offices.modify') }}
                            </button>
                            <button
                                type="button"
                                @click="askDelete(office)"
                                class="inline-flex items-center justify-center w-9 h-9 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl ring-1 ring-red-100 hover:ring-red-200 transition-all"
                                :title="$t('admin.sub_offices.delete')"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div
                    v-if="showDeleteModal && toDelete"
                    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    @click.self="!deleting && (showDeleteModal = false)"
                >
                    <div class="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-100 max-w-md w-full overflow-hidden">
                        <div class="p-6">
                            <div class="flex items-start gap-3 mb-4">
                                <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                    <Trash2 class="w-5 h-5 text-red-500" />
                                </div>
                                <div class="min-w-0">
                                    <h3 class="text-base font-bold text-gray-900">{{ $t('admin.sub_offices.delete_modal_title') }}</h3>
                                    <p class="text-sm text-gray-500 mt-1">
                                        {{ $t('admin.sub_offices.delete_modal_desc', { name: toDelete.label || toDelete.username }) }}
                                    </p>
                                </div>
                            </div>
                            <div class="bg-amber-50 ring-1 ring-amber-100 rounded-xl px-3 py-2.5 text-[12.5px] text-amber-800 flex items-start gap-2">
                                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ $t('admin.sub_offices.delete_modal_warning', { count: toDelete.cars_count }) }}</span>
                            </div>
                        </div>
                        <div class="border-t border-gray-100 p-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                @click="showDeleteModal = false"
                                :disabled="deleting"
                                class="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl disabled:opacity-50"
                            >
                                {{ $t('common.cancel') }}
                            </button>
                            <button
                                type="button"
                                @click="confirmDelete"
                                :disabled="deleting"
                                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-200 disabled:opacity-50"
                            >
                                <Loader2 v-if="deleting" class="w-4 h-4 animate-spin" />
                                <Trash2 v-else class="w-4 h-4" />
                                {{ $t('admin.sub_offices.delete_confirm') }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 180ms ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
