<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useCars, type Car as FleetCar } from '@/composables/useCars';
import { useSubOffices } from '@/composables/useSubOffices';
import { useTenantLink } from '@/composables/useTenantLink';
import { getBrandLogo } from '@/utils/carBrandLogo';
import {
    Loader2, Save, AlertCircle, CircleCheck, ArrowLeft, Users, Lock, IdCard,
    Search, Plus, Minus, X, Car, ImageOff, Building2, KeyRound, Sparkles, ShieldCheck, Tag, Filter,
} from 'lucide-vue-next';

const props = defineProps<{
    mode: 'create' | 'edit';
    subOfficeId?: string;
}>();

const router = useRouter();
const { t } = useI18n();
const { tenantPath } = useTenantLink();

const { cars, fetchCars, loading: carsLoading } = useCars();
const {
    getSubOffice,
    createSubOffice,
    updateSubOffice,
    setFleet,
    fetchAllAssignmentsForTenant,
} = useSubOffices();

// ─── Form state ─────────────────────────────────────────────────
const username = ref('');
const label = ref('');
const password = ref('');
const changePassword = ref(props.mode === 'create');
const assignedIds = ref<Set<number>>(new Set());
const initialAssigned = ref<Set<number>>(new Set());

const search = ref('');
const brandFilter = ref<string | 'all'>('all');

const loading = ref(false);
const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const otherAssignments = ref<Record<number, { tenant_user_id: string; label: string | null; username: string }>>({});

// ─── Lifecycle ──────────────────────────────────────────────────
onMounted(async () => {
    loading.value = true;
    try {
        await Promise.all([
            fetchCars(),
            loadOtherAssignments(),
            props.mode === 'edit' && props.subOfficeId ? loadOffice(props.subOfficeId) : Promise.resolve(),
        ]);
    } catch (e: any) {
        errorMsg.value = e?.message || t('admin.sub_offices.error_loading');
    } finally {
        loading.value = false;
    }
});

async function loadOffice(id: string) {
    const office = await getSubOffice(id);
    if (!office) {
        errorMsg.value = t('admin.sub_offices.not_found');
        return;
    }
    username.value = office.username;
    label.value = office.label || '';
    assignedIds.value = new Set(office.car_ids);
    initialAssigned.value = new Set(office.car_ids);
}

async function loadOtherAssignments() {
    otherAssignments.value = await fetchAllAssignmentsForTenant();
}

// ─── Car filtering / partitioning ──────────────────────────────
const allBrands = computed(() => {
    const set = new Set<string>();
    for (const c of cars.value) set.add(c.brand);
    return Array.from(set).sort();
});

function isAvailable(car: FleetCar): boolean {
    // A car is available when it's not assigned to ANOTHER sub-office.
    const assignment = otherAssignments.value[car.id];
    if (!assignment) return true;
    if (props.mode === 'edit' && props.subOfficeId && assignment.tenant_user_id === props.subOfficeId) {
        return true;
    }
    return false;
}

function matchesSearch(car: FleetCar): boolean {
    const q = search.value.trim().toLowerCase();
    if (!q) return true;
    return (
        car.brand.toLowerCase().includes(q)
        || car.model.toLowerCase().includes(q)
        || car.plate_number.toLowerCase().includes(q)
    );
}

function matchesBrand(car: FleetCar): boolean {
    return brandFilter.value === 'all' || car.brand === brandFilter.value;
}

const availableCars = computed(() =>
    cars.value.filter((c) => isAvailable(c) && !assignedIds.value.has(c.id) && matchesSearch(c) && matchesBrand(c)),
);
const selectedCars = computed(() =>
    cars.value.filter((c) => assignedIds.value.has(c.id) && matchesSearch(c) && matchesBrand(c)),
);
const lockedCars = computed(() =>
    cars.value.filter((c) => !isAvailable(c) && matchesSearch(c) && matchesBrand(c)),
);

// ─── Selection actions ─────────────────────────────────────────
function toggleCar(carId: number) {
    if (assignedIds.value.has(carId)) {
        assignedIds.value.delete(carId);
    } else {
        assignedIds.value.add(carId);
    }
    // Force reactivity (Set mutations don't trigger refs by themselves)
    assignedIds.value = new Set(assignedIds.value);
}

function selectAllVisible() {
    const next = new Set(assignedIds.value);
    for (const c of availableCars.value) next.add(c.id);
    assignedIds.value = next;
}

function deselectAll() {
    if (props.mode === 'create') {
        assignedIds.value = new Set();
    } else {
        // Only deselect cars currently visible (respecting search/brand filter)
        // so the admin can keep parts of the fleet intact.
        const next = new Set(assignedIds.value);
        for (const c of selectedCars.value) next.delete(c.id);
        assignedIds.value = next;
    }
}

// ─── Submit ─────────────────────────────────────────────────────
async function onSubmit() {
    errorMsg.value = '';
    successMsg.value = '';

    if (!username.value.trim()) {
        errorMsg.value = t('admin.sub_offices.error_username_required');
        return;
    }
    if (props.mode === 'create' || changePassword.value) {
        if (!password.value || password.value.length < 6) {
            errorMsg.value = t('admin.settings.password_min_length');
            return;
        }
    }

    saving.value = true;
    try {
        if (props.mode === 'create') {
            await createSubOffice({
                username: username.value.trim(),
                password: password.value,
                label: label.value.trim() || null,
                carIds: Array.from(assignedIds.value),
            });
            successMsg.value = t('admin.sub_offices.create_success', { name: label.value || username.value });
            router.push(tenantPath('/admin/sub-offices'));
            return;
        }

        if (!props.subOfficeId) return;
        await updateSubOffice(props.subOfficeId, {
            username: username.value.trim(),
            label: label.value.trim() || null,
            password: changePassword.value ? password.value : undefined,
        });
        await setFleet(props.subOfficeId, Array.from(assignedIds.value));
        successMsg.value = t('admin.sub_offices.update_success');
        initialAssigned.value = new Set(assignedIds.value);
        password.value = '';
        changePassword.value = false;
    } catch (e: any) {
        // Detect the unique-violation on sub_office_cars.car_id and show a
        // friendlier error so the admin knows which car conflicted.
        const msg = e?.message || '';
        if (msg.includes('sub_office_cars') && msg.toLowerCase().includes('unique')) {
            errorMsg.value = t('admin.sub_offices.error_car_already_assigned');
        } else {
            errorMsg.value = msg || t('admin.sub_offices.error_save');
        }
    } finally {
        saving.value = false;
    }
}

function goBack() {
    router.push(tenantPath('/admin/sub-offices'));
}

// Image fallback: hide <img> on broken URLs, parent shows the brand glyph.
function onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
}

watch(brandFilter, () => {
    // Reset focus/scroll subtly is unnecessary, just trigger reactivity.
});
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
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">
                            {{ props.mode === 'create' ? $t('admin.sub_offices.create_title') : $t('admin.sub_offices.edit_title') }}
                        </h1>
                        <p class="text-sm text-gray-500">
                            {{ props.mode === 'create' ? $t('admin.sub_offices.create_subtitle') : $t('admin.sub_offices.edit_subtitle') }}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    @click="onSubmit"
                    :disabled="saving || loading"
                    class="inline-flex items-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                    <Save v-else class="w-4 h-4" />
                    {{ props.mode === 'create' ? $t('admin.sub_offices.save_create') : $t('admin.sub_offices.save_edit') }}
                </button>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm py-16 flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 class="w-7 h-7 animate-spin text-indigo-500" />
                <span class="text-sm">{{ $t('common.loading') }}…</span>
            </div>

            <template v-else>
                <!-- Status banners -->
                <div v-if="errorMsg" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                    <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{{ errorMsg }}</span>
                </div>
                <div v-if="successMsg" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                    <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{{ successMsg }}</span>
                </div>

                <!-- Identity section -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Users class="w-4 h-4 text-indigo-600" />
                        </div>
                        <h2 class="text-base font-bold text-gray-900">{{ $t('admin.sub_offices.identity_title') }}</h2>
                    </div>

                    <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label class="form-label">{{ $t('admin.sub_offices.label_label') }}</label>
                            <div class="form-input-wrapper">
                                <Tag class="form-input-icon" />
                                <input v-model="label" type="text" class="form-input" :placeholder="$t('admin.sub_offices.label_placeholder')" />
                            </div>
                        </div>
                        <div>
                            <label class="form-label">{{ $t('admin.settings.username') }}</label>
                            <div class="form-input-wrapper">
                                <IdCard class="form-input-icon" />
                                <input v-model="username" type="text" required class="form-input" placeholder="e.g. bureau1" />
                            </div>
                        </div>
                        <div>
                            <label class="form-label flex items-center justify-between gap-2">
                                <span>{{ props.mode === 'create' ? $t('admin.settings.initial_password') : $t('admin.sub_offices.new_password') }}</span>
                                <label v-if="props.mode === 'edit'" class="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer select-none">
                                    <input type="checkbox" v-model="changePassword" class="w-3.5 h-3.5 accent-indigo-600" />
                                    {{ $t('admin.sub_offices.change_password_toggle') }}
                                </label>
                            </label>
                            <div class="form-input-wrapper" :class="{ 'opacity-50': props.mode === 'edit' && !changePassword }">
                                <Lock class="form-input-icon" />
                                <input
                                    v-model="password"
                                    type="password"
                                    class="form-input"
                                    :placeholder="props.mode === 'create' ? $t('admin.settings.initial_password') : $t('admin.sub_offices.new_password_placeholder')"
                                    :disabled="props.mode === 'edit' && !changePassword"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Fleet section -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                <Car class="w-4 h-4 text-violet-600" />
                            </div>
                            <div>
                                <h2 class="text-base font-bold text-gray-900">{{ $t('admin.sub_offices.fleet_title') }}</h2>
                                <p class="text-[11.5px] text-gray-500">{{ $t('admin.sub_offices.fleet_subtitle') }}</p>
                            </div>
                        </div>
                        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 ring-1 ring-indigo-100 text-[12px] font-semibold text-indigo-700">
                            <Sparkles class="w-3.5 h-3.5" />
                            {{ $t('admin.sub_offices.selected_count', { count: assignedIds.size }) }}
                        </div>
                    </div>

                    <!-- Filters -->
                    <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                        <div class="form-input-wrapper flex-1 min-w-[200px]">
                            <Search class="form-input-icon" />
                            <input v-model="search" type="text" class="form-input" :placeholder="$t('admin.sub_offices.fleet_search_placeholder')" />
                        </div>
                        <div class="form-input-wrapper">
                            <Filter class="form-input-icon" />
                            <select v-model="brandFilter" class="form-input pr-8 bg-transparent">
                                <option value="all">{{ $t('admin.sub_offices.brand_all') }}</option>
                                <option v-for="b in allBrands" :key="b" :value="b">{{ b }}</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            @click="selectAllVisible"
                            :disabled="availableCars.length === 0"
                            class="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {{ $t('admin.sub_offices.select_all_visible') }}
                        </button>
                        <button
                            type="button"
                            @click="deselectAll"
                            :disabled="assignedIds.size === 0"
                            class="text-[12px] font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {{ $t('admin.sub_offices.deselect_all') }}
                        </button>
                    </div>

                    <div class="p-5">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <!-- Left: available pool -->
                            <div class="fleet-column">
                                <div class="fleet-column-header">
                                    <span class="text-[12px] uppercase font-bold tracking-wider text-gray-500">{{ $t('admin.sub_offices.col_available') }}</span>
                                    <span class="text-[11px] text-gray-400">{{ availableCars.length }}</span>
                                </div>
                                <div class="fleet-column-body" :class="{ 'fleet-column-empty': availableCars.length === 0 }">
                                    <button
                                        v-for="car in availableCars"
                                        :key="`a-${car.id}`"
                                        type="button"
                                        @click="toggleCar(car.id)"
                                        class="car-tile group"
                                    >
                                        <div class="car-tile-image">
                                            <img v-if="car.image_url" :src="car.image_url" :alt="`${car.brand} ${car.model}`" class="object-cover w-full h-full" @error="onImageError" />
                                            <img v-else-if="getBrandLogo(car.brand)" :src="getBrandLogo(car.brand) || undefined" :alt="car.brand" class="object-contain w-3/4 h-3/4 opacity-70" @error="onImageError" />
                                            <ImageOff v-else class="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div class="car-tile-body">
                                            <div class="car-tile-title">{{ car.brand }} {{ car.model }}</div>
                                            <div class="car-tile-plate">{{ car.plate_number }}</div>
                                        </div>
                                        <div class="car-tile-action add">
                                            <Plus class="w-3.5 h-3.5" />
                                        </div>
                                    </button>
                                    <div v-if="availableCars.length === 0" class="text-center py-8 text-xs text-gray-400">
                                        {{ $t('admin.sub_offices.col_available_empty') }}
                                    </div>
                                </div>
                            </div>

                            <!-- Right: assigned -->
                            <div class="fleet-column fleet-column-selected">
                                <div class="fleet-column-header">
                                    <span class="text-[12px] uppercase font-bold tracking-wider text-indigo-600">{{ $t('admin.sub_offices.col_assigned') }}</span>
                                    <span class="text-[11px] text-indigo-500">{{ selectedCars.length }}</span>
                                </div>
                                <div class="fleet-column-body" :class="{ 'fleet-column-empty': selectedCars.length === 0 }">
                                    <button
                                        v-for="car in selectedCars"
                                        :key="`s-${car.id}`"
                                        type="button"
                                        @click="toggleCar(car.id)"
                                        class="car-tile car-tile-selected group"
                                    >
                                        <div class="car-tile-image">
                                            <img v-if="car.image_url" :src="car.image_url" :alt="`${car.brand} ${car.model}`" class="object-cover w-full h-full" @error="onImageError" />
                                            <img v-else-if="getBrandLogo(car.brand)" :src="getBrandLogo(car.brand) || undefined" :alt="car.brand" class="object-contain w-3/4 h-3/4 opacity-70" @error="onImageError" />
                                            <ImageOff v-else class="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div class="car-tile-body">
                                            <div class="car-tile-title">{{ car.brand }} {{ car.model }}</div>
                                            <div class="car-tile-plate">{{ car.plate_number }}</div>
                                        </div>
                                        <div class="car-tile-action remove">
                                            <Minus class="w-3.5 h-3.5" />
                                        </div>
                                    </button>
                                    <div v-if="selectedCars.length === 0" class="text-center py-8 text-xs text-gray-400">
                                        {{ $t('admin.sub_offices.col_assigned_empty') }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Locked (assigned to another sub-office) -->
                        <div v-if="lockedCars.length > 0" class="mt-5">
                            <div class="flex items-center gap-2 mb-2">
                                <ShieldCheck class="w-4 h-4 text-gray-400" />
                                <span class="text-[12px] uppercase font-bold tracking-wider text-gray-500">{{ $t('admin.sub_offices.col_locked') }}</span>
                                <span class="text-[11px] text-gray-400">{{ lockedCars.length }}</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                <div
                                    v-for="car in lockedCars"
                                    :key="`l-${car.id}`"
                                    class="car-tile car-tile-locked"
                                >
                                    <div class="car-tile-image">
                                        <img v-if="car.image_url" :src="car.image_url" :alt="`${car.brand} ${car.model}`" class="object-cover w-full h-full opacity-60" @error="onImageError" />
                                        <img v-else-if="getBrandLogo(car.brand)" :src="getBrandLogo(car.brand) || undefined" :alt="car.brand" class="object-contain w-3/4 h-3/4 opacity-40" @error="onImageError" />
                                        <ImageOff v-else class="w-5 h-5 text-gray-300" />
                                    </div>
                                    <div class="car-tile-body">
                                        <div class="car-tile-title">{{ car.brand }} {{ car.model }}</div>
                                        <div class="car-tile-plate">{{ car.plate_number }}</div>
                                        <div class="text-[10.5px] text-amber-600 truncate flex items-center gap-1 mt-0.5">
                                            <KeyRound class="w-2.5 h-2.5" />
                                            <span class="truncate">
                                                {{ otherAssignments[car.id]?.label || otherAssignments[car.id]?.username || '—' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
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

.fleet-column {
    background: linear-gradient(180deg, rgba(249, 250, 251, 0.7), rgba(249, 250, 251, 0.3));
    border: 1px dashed rgb(229 231 235);
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.fleet-column-selected {
    background: linear-gradient(180deg, rgba(238, 242, 255, 0.5), rgba(238, 242, 255, 0.15));
    border-color: rgb(199 210 254);
}

.fleet-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0.9rem;
    border-bottom: 1px dashed rgb(229 231 235);
}

.fleet-column-body {
    padding: 0.6rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    max-height: 480px;
    overflow-y: auto;
}

.fleet-column-empty {
    grid-template-columns: 1fr;
    min-height: 100px;
}

.car-tile {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem;
    background: white;
    border-radius: 0.75rem;
    box-shadow: inset 0 0 0 1px rgb(229 231 235);
    transition:
        transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
        box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1),
        background 200ms ease;
    cursor: pointer;
    text-align: left;
    position: relative;
    overflow: hidden;
    width: 100%;
}

.car-tile:hover:not(.car-tile-locked) {
    transform: translateY(-1px);
    box-shadow:
        inset 0 0 0 1px rgb(199 210 254),
        0 4px 10px -3px rgba(99, 102, 241, 0.18);
}

.car-tile-selected {
    background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
    box-shadow:
        inset 0 0 0 1.5px rgb(165 180 252),
        0 6px 18px -8px rgba(99, 102, 241, 0.35);
}

.car-tile-locked {
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.7);
    box-shadow: inset 0 0 0 1px rgb(229 231 235);
}

.car-tile-image {
    width: 3rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    background: rgb(249 250 251);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
}

.car-tile-body {
    flex: 1;
    min-width: 0;
}

.car-tile-title {
    font-size: 12.5px;
    font-weight: 600;
    color: rgb(17 24 39);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.car-tile-plate {
    font-size: 11px;
    color: rgb(107 114 128);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.car-tile-action {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.car-tile-action.add {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
}

.car-tile-action.remove {
    background: linear-gradient(135deg, #f43f5e, #ef4444);
}

.car-tile:hover .car-tile-action {
    transform: scale(1.08);
}
</style>
