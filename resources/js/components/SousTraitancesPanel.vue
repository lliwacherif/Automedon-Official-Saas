<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import {
    useSousTraitances,
    type SousTraitance,
    type SousTraitanceVehicle,
    type SousTraitancePayment,
} from '@/composables/useSousTraitances';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    X, Plus, ArrowLeft, Handshake, Car, Trash2, Loader2,
    CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp,
    Calendar, Wallet, Users, TrendingUp, FileText, Hash,
    CircleDollarSign, CalendarClock, PackagePlus, Check,
} from 'lucide-vue-next';
import { getBrandLogo } from '@/utils/carBrandLogo';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const {
    loading, error,
    sousTraitances, currentSousTraitance, currentVehicles,
    totalSousTraitances, totalDelegatedVehicles, totalMonthlyLiability, totalOverdueAmount,
    fetchAll, fetchById, create, update, remove,
    assignVehicle, unassignVehicle, fetchAvailableCarsForAssignment,
    markPaymentPaid, markPaymentUnpaid, generateMorePayments,
    refreshOverdueStatus,
} = useSousTraitances();

// ─── View state ───
type ViewState = 'list' | 'create' | 'edit' | 'detail';
const view = ref<ViewState>('list');
const saving = ref(false);

// ─── Form data ───
const formName = ref('');
const formDescription = ref('');
const formRangeStart = ref('');
const formRangeEnd = ref('');

// ─── Vehicle assignment form ───
const showAssignForm = ref(false);
const availableCars = ref<any[]>([]);
const assignCarId = ref<number | null>(null);
const assignMonthly = ref<number>(0);
const assignDueDay = ref<number>(1);

// ─── Expanded vehicle payments ───
const expandedVehicleIds = ref<Set<number>>(new Set());

function toggleExpand(vehicleId: number) {
    const copy = new Set(expandedVehicleIds.value);
    if (copy.has(vehicleId)) copy.delete(vehicleId);
    else copy.add(vehicleId);
    expandedVehicleIds.value = copy;
}

// ─── Init ───
watch(() => props.show, async (val) => {
    if (val) {
        view.value = 'list';
        await refreshOverdueStatus();
        await fetchAll();
    }
});

// ─── Navigation ───
function goToList() {
    view.value = 'list';
    currentSousTraitance.value = null;
    currentVehicles.value = [];
    expandedVehicleIds.value = new Set();
    showAssignForm.value = false;
}

function goToCreate() {
    formName.value = '';
    formDescription.value = '';
    formRangeStart.value = '';
    formRangeEnd.value = '';
    view.value = 'create';
}

function goToEdit(st: SousTraitance) {
    formName.value = st.name;
    formDescription.value = st.description || '';
    formRangeStart.value = st.contract_range_start || '';
    formRangeEnd.value = st.contract_range_end || '';
    currentSousTraitance.value = st;
    view.value = 'edit';
}

async function goToDetail(st: SousTraitance) {
    await fetchById(st.id);
    showAssignForm.value = false;
    expandedVehicleIds.value = new Set();
    view.value = 'detail';
}

// ─── Actions ───
async function handleSave() {
    if (!formName.value.trim()) return;
    saving.value = true;
    try {
        if (view.value === 'create') {
            await create({
                name: formName.value.trim(),
                description: formDescription.value.trim() || undefined,
                contract_range_start: formRangeStart.value.trim() || undefined,
                contract_range_end: formRangeEnd.value.trim() || undefined,
            });
        } else if (view.value === 'edit' && currentSousTraitance.value) {
            await update(currentSousTraitance.value.id, {
                name: formName.value.trim(),
                description: formDescription.value.trim() || null,
                contract_range_start: formRangeStart.value.trim() || null,
                contract_range_end: formRangeEnd.value.trim() || null,
            });
        }
        goToList();
    } catch (e) {
        // error is set in composable
    } finally {
        saving.value = false;
    }
}

async function handleDelete(st: SousTraitance) {
    if (!confirm(`Supprimer la sous-traitance « ${st.name} » et toutes ses données associées ?`)) return;
    await remove(st.id);
    goToList();
}

// ─── Vehicle Assignment ───
async function openAssignForm() {
    availableCars.value = await fetchAvailableCarsForAssignment();
    assignCarId.value = null;
    assignMonthly.value = 0;
    assignDueDay.value = 1;
    showAssignForm.value = true;
}

async function handleAssignVehicle() {
    if (!assignCarId.value || !currentSousTraitance.value || assignMonthly.value <= 0) return;
    saving.value = true;
    try {
        await assignVehicle(
            currentSousTraitance.value.id,
            assignCarId.value,
            assignMonthly.value,
            assignDueDay.value,
        );
        showAssignForm.value = false;
    } catch (e) {
        // error is set in composable
    } finally {
        saving.value = false;
    }
}

async function handleUnassign(vehicle: SousTraitanceVehicle) {
    if (!currentSousTraitance.value) return;
    const label = vehicle.car ? `${vehicle.car.brand} ${vehicle.car.model} (${vehicle.car.license_plate})` : `#${vehicle.car_id}`;
    if (!confirm(`Retirer le véhicule ${label} de cette sous-traitance ? Les paiements associés seront supprimés.`)) return;
    await unassignVehicle(vehicle.id, currentSousTraitance.value.id);
}

// ─── Payments ───
async function togglePayment(payment: SousTraitancePayment) {
    if (!currentSousTraitance.value) return;
    if (payment.status === 'paid') {
        await markPaymentUnpaid(payment.id, currentSousTraitance.value.id);
    } else {
        await markPaymentPaid(payment.id, currentSousTraitance.value.id);
    }
}

async function handleGenerateMore(vehicleId: number) {
    if (!currentSousTraitance.value) return;
    await generateMorePayments(vehicleId, currentSousTraitance.value.id, 6);
}

// ─── Formatters ───
function formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(v || 0);
}
function formatShortCurrency(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return `${Math.round(v)}`;
}
function formatDate(d: string): string {
    try { return format(new Date(d), 'd MMM yyyy', { locale: fr }); } catch { return d; }
}
function formatMonth(m: string): string {
    try { return format(new Date(m + '-01'), 'MMM yyyy', { locale: fr }); } catch { return m; }
}
</script>

<template>
    <!-- Backdrop -->
    <Teleport to="body">
        <Transition name="st-drawer">
            <div v-if="show" class="st-backdrop" @click.self="emit('close')">
                <div class="st-panel">

                        <!-- ──── Panel Header ──── -->
                        <div class="st-panel__header">
                            <div class="flex items-center gap-3">
                                <button v-if="view !== 'list'" @click="view === 'detail' ? goToList() : goToList()" class="st-back-btn">
                                    <ArrowLeft class="w-4 h-4" />
                                </button>
                                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200">
                                    <Handshake class="w-4.5 h-4.5 text-white" />
                                </div>
                                <div>
                                    <h2 class="text-lg font-extrabold text-gray-900 tracking-tight">
                                        {{ view === 'list' ? 'Sous-Traitances' : view === 'create' ? 'Nouvelle Sous-Traitance' : view === 'edit' ? 'Modifier' : currentSousTraitance?.name }}
                                    </h2>
                                    <p class="text-xs text-gray-400 font-medium">
                                        {{ view === 'list' ? 'Gestion des véhicules délégués' : view === 'detail' ? 'Véhicules et paiements' : 'Informations de la sous-traitance' }}
                                    </p>
                                </div>
                            </div>
                            <button @click="emit('close')" class="st-close-btn">
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- ──── Loading ──── -->
                        <div v-if="loading && view === 'list'" class="st-panel__loading">
                            <Loader2 class="w-7 h-7 text-orange-500 animate-spin" />
                            <p class="text-sm text-gray-400 mt-2">Chargement…</p>
                        </div>

                        <!-- ──── Error ──── -->
                        <div v-if="error" class="mx-5 mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{{ error }}</span>
                        </div>

                        <!-- ════════════════════════════════════════ -->
                        <!-- VIEW: LIST                              -->
                        <!-- ════════════════════════════════════════ -->
                        <div v-if="view === 'list' && !loading" class="st-panel__body">

                            <!-- Summary Cards -->
                            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                                <div class="st-stat-card">
                                    <div class="st-stat-card__icon st-stat-card__icon--orange"><Handshake class="w-4 h-4" /></div>
                                    <div class="st-stat-card__label">Sous-Traitances</div>
                                    <div class="st-stat-card__value">{{ totalSousTraitances }}</div>
                                </div>
                                <div class="st-stat-card">
                                    <div class="st-stat-card__icon st-stat-card__icon--blue"><Car class="w-4 h-4" /></div>
                                    <div class="st-stat-card__label">Véhicules délégués</div>
                                    <div class="st-stat-card__value">{{ totalDelegatedVehicles }}</div>
                                </div>
                                <div class="st-stat-card">
                                    <div class="st-stat-card__icon st-stat-card__icon--violet"><Wallet class="w-4 h-4" /></div>
                                    <div class="st-stat-card__label">Cambiale mensuelle</div>
                                    <div class="st-stat-card__value">{{ formatShortCurrency(totalMonthlyLiability) }} <span class="text-xs text-gray-400">TND</span></div>
                                </div>
                                <div class="st-stat-card">
                                    <div class="st-stat-card__icon st-stat-card__icon--red"><AlertTriangle class="w-4 h-4" /></div>
                                    <div class="st-stat-card__label">Impayés en retard</div>
                                    <div class="st-stat-card__value" :class="totalOverdueAmount > 0 ? 'text-red-600' : ''">{{ formatShortCurrency(totalOverdueAmount) }} <span class="text-xs text-gray-400">TND</span></div>
                                </div>
                            </div>

                            <!-- Create Button -->
                            <div class="flex justify-end mb-4">
                                <button @click="goToCreate" class="st-primary-btn">
                                    <Plus class="w-4 h-4" />
                                    Créer une sous-traitance
                                </button>
                            </div>

                            <!-- Table -->
                            <div v-if="sousTraitances.length === 0" class="st-empty">
                                <Handshake class="w-8 h-8 text-gray-300 mb-2" />
                                <p>Aucune sous-traitance créée.</p>
                            </div>
                            <div v-else class="st-table-wrap">
                                <table class="st-table">
                                    <thead>
                                        <tr>
                                            <th class="st-th">Nom</th>
                                            <th class="st-th text-center">Véhicules</th>
                                            <th class="st-th">Plage contrats</th>
                                            <th class="st-th text-right">Payé</th>
                                            <th class="st-th text-right">En attente</th>
                                            <th class="st-th text-right">En retard</th>
                                            <th class="st-th text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="st in sousTraitances"
                                            :key="st.id"
                                            class="st-tr"
                                            @click="goToDetail(st)"
                                        >
                                            <td class="st-td">
                                                <div class="font-bold text-gray-900 text-[13px]">{{ st.name }}</div>
                                                <div v-if="st.description" class="text-[11px] text-gray-400 truncate max-w-[200px]">{{ st.description }}</div>
                                            </td>
                                            <td class="st-td text-center">
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                                                    <Car class="w-3 h-3" /> {{ st.vehicleCount }}
                                                </span>
                                            </td>
                                            <td class="st-td">
                                                <span v-if="st.contract_range_start" class="text-xs font-mono text-gray-600">
                                                    {{ st.contract_range_start }} → {{ st.contract_range_end }}
                                                </span>
                                                <span v-else class="text-xs text-gray-300">—</span>
                                            </td>
                                            <td class="st-td text-right font-bold text-emerald-600 tabular-nums">{{ formatCurrency(st.totalPaid || 0) }}</td>
                                            <td class="st-td text-right text-gray-500 tabular-nums">{{ formatCurrency(st.totalOutstanding || 0) }}</td>
                                            <td class="st-td text-right">
                                                <span v-if="(st.totalOverdue || 0) > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-xs font-bold">
                                                    <AlertTriangle class="w-3 h-3" /> {{ formatCurrency(st.totalOverdue || 0) }}
                                                </span>
                                                <span v-else class="text-xs text-gray-300">—</span>
                                            </td>
                                            <td class="st-td text-right" @click.stop>
                                                <div class="flex items-center justify-end gap-1">
                                                    <button @click.stop="goToEdit(st)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors" title="Modifier">
                                                        <FileText class="w-3.5 h-3.5 text-indigo-500" />
                                                    </button>
                                                    <button @click.stop="handleDelete(st)" class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="Supprimer">
                                                        <Trash2 class="w-3.5 h-3.5 text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- ════════════════════════════════════════ -->
                        <!-- VIEW: CREATE / EDIT                     -->
                        <!-- ════════════════════════════════════════ -->
                        <div v-if="view === 'create' || view === 'edit'" class="st-panel__body">
                            <div class="st-form">
                                <div class="st-form__group">
                                    <label class="st-form__label">Nom <span class="text-red-400">*</span></label>
                                    <input v-model="formName" type="text" class="st-form__input" placeholder="ex: Société Transport ABC" />
                                </div>
                                <div class="st-form__group">
                                    <label class="st-form__label">Description</label>
                                    <textarea v-model="formDescription" rows="2" class="st-form__input" placeholder="Description optionnelle…"></textarea>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="st-form__group">
                                        <label class="st-form__label">Plage contrats — début</label>
                                        <input v-model="formRangeStart" type="text" class="st-form__input font-mono" placeholder="ex: 002888" />
                                    </div>
                                    <div class="st-form__group">
                                        <label class="st-form__label">Plage contrats — fin</label>
                                        <input v-model="formRangeEnd" type="text" class="st-form__input font-mono" placeholder="ex: 003888" />
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 pt-4">
                                    <button @click="handleSave" :disabled="!formName.trim() || saving" class="st-primary-btn">
                                        <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                                        {{ view === 'create' ? 'Créer' : 'Enregistrer' }}
                                    </button>
                                    <button @click="goToList" class="st-secondary-btn">Annuler</button>
                                </div>
                            </div>
                        </div>

                        <!-- ════════════════════════════════════════ -->
                        <!-- VIEW: DETAIL                            -->
                        <!-- ════════════════════════════════════════ -->
                        <div v-if="view === 'detail' && currentSousTraitance" class="st-panel__body">

                            <!-- Detail Header Info -->
                            <div class="flex flex-wrap items-center gap-3 mb-5">
                                <span v-if="currentSousTraitance.contract_range_start" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 ring-1 ring-gray-200 text-xs font-bold text-gray-600">
                                    <Hash class="w-3 h-3" />
                                    <span class="font-mono">{{ currentSousTraitance.contract_range_start }} → {{ currentSousTraitance.contract_range_end }}</span>
                                </span>
                                <span v-if="currentSousTraitance.description" class="text-xs text-gray-400">{{ currentSousTraitance.description }}</span>
                            </div>

                            <!-- Vehicles Section -->
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Véhicules assignés</h3>
                                <button @click="openAssignForm" class="st-primary-btn st-primary-btn--sm">
                                    <Plus class="w-3.5 h-3.5" />
                                    Ajouter véhicule
                                </button>
                            </div>

                            <!-- Assignment Form -->
                            <div v-if="showAssignForm" class="st-assign-form mb-4">
                                <!-- Step 1: Pick a car -->
                                <div class="mb-4">
                                    <label class="st-form__label mb-2">Choisir un véhicule</label>
                                    <div v-if="availableCars.length === 0" class="text-xs text-gray-400 text-center py-4">
                                        Aucun véhicule disponible à assigner.
                                    </div>
                                    <div v-else class="st-car-picker">
                                        <div
                                            v-for="car in availableCars"
                                            :key="car.id"
                                            class="st-car-picker__card"
                                            :class="{ 'st-car-picker__card--selected': assignCarId === car.id }"
                                            @click="assignCarId = car.id"
                                        >
                                            <!-- Selected check -->
                                            <div v-if="assignCarId === car.id" class="st-car-picker__check">
                                                <Check class="w-3 h-3" />
                                            </div>
                                            <!-- Car image -->
                                            <div class="st-car-picker__img-wrap">
                                                <img
                                                    v-if="car.image_url"
                                                    :src="car.image_url"
                                                    :alt="car.model"
                                                    class="st-car-picker__img"
                                                    @error="($event.target as HTMLImageElement).style.display='none'"
                                                />
                                                <div v-else class="st-car-picker__img-placeholder">
                                                    <img :src="getBrandLogo(car.brand)" :alt="car.brand" class="w-7 h-7 object-contain opacity-40" @error="($event.target as HTMLImageElement).style.display='none'" />
                                                </div>
                                            </div>
                                            <!-- Car info -->
                                            <div class="st-car-picker__info">
                                                <div class="st-car-picker__plate">{{ car.license_plate }}</div>
                                                <div class="st-car-picker__model">{{ car.brand }} {{ car.model }}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Step 2: Financial rules -->
                                <div v-if="assignCarId" class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-orange-200">
                                    <div class="st-form__group">
                                        <label class="st-form__label">Cambiale (TND/mois)</label>
                                        <input v-model.number="assignMonthly" type="number" min="0" step="0.01" class="st-form__input" placeholder="0.00" />
                                    </div>
                                    <div class="st-form__group">
                                        <label class="st-form__label">Jour du paiement mensuel</label>
                                        <input v-model.number="assignDueDay" type="number" min="1" max="28" class="st-form__input" placeholder="ex: 15" />
                                        <span class="text-[10px] text-gray-400 mt-0.5">Le jour du mois où le paiement est dû (1-28)</span>
                                    </div>
                                    <div class="flex items-end gap-2">
                                        <button @click="handleAssignVehicle" :disabled="!assignCarId || assignMonthly <= 0 || saving" class="st-primary-btn st-primary-btn--sm">
                                            <Loader2 v-if="saving" class="w-3.5 h-3.5 animate-spin" />
                                            <CheckCircle2 v-else class="w-3.5 h-3.5" />
                                            Assigner
                                        </button>
                                        <button @click="showAssignForm = false" class="st-secondary-btn st-secondary-btn--sm">
                                            <X class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Vehicles List -->
                            <div v-if="currentVehicles.length === 0 && !showAssignForm" class="st-empty">
                                <Car class="w-8 h-8 text-gray-300 mb-2" />
                                <p>Aucun véhicule assigné.</p>
                            </div>
                            <div v-else class="space-y-3">
                                <div
                                    v-for="vehicle in currentVehicles"
                                    :key="vehicle.id"
                                    class="st-vehicle-card"
                                >
                                    <!-- Vehicle Header Row -->
                                    <div class="st-vehicle-card__header" @click="toggleExpand(vehicle.id)">
                                        <div class="flex items-center gap-3 flex-1 min-w-0">
                                            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 ring-1 ring-gray-200/60 flex items-center justify-center shrink-0">
                                                <Car class="w-4 h-4 text-gray-500" />
                                            </div>
                                            <div class="min-w-0">
                                                <div class="text-[12px] font-extrabold text-gray-900 font-mono">{{ vehicle.car?.license_plate || '—' }}</div>
                                                <div class="text-[11px] text-gray-500">{{ vehicle.car?.brand }} {{ vehicle.car?.model }}</div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-4 text-xs">
                                            <div class="text-right">
                                                <div class="text-gray-400 font-medium">Cambiale</div>
                                                <div class="font-bold text-gray-900 tabular-nums">{{ formatCurrency(vehicle.monthly_payment) }}</div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-gray-400 font-medium">Payé</div>
                                                <div class="font-bold text-emerald-600 tabular-nums">{{ formatCurrency(vehicle.totalPaid || 0) }}</div>
                                            </div>
                                            <div class="text-right" v-if="(vehicle.totalOverdue || 0) > 0">
                                                <div class="text-gray-400 font-medium">Retard</div>
                                                <div class="font-bold text-red-500 tabular-nums">{{ formatCurrency(vehicle.totalOverdue || 0) }}</div>
                                            </div>
                                            <component :is="expandedVehicleIds.has(vehicle.id) ? ChevronUp : ChevronDown" class="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>

                                    <!-- Expanded: Payment Timeline -->
                                    <div v-if="expandedVehicleIds.has(vehicle.id)" class="st-vehicle-card__payments">
                                        <div class="flex items-center justify-between mb-3">
                                            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Historique des paiements</span>
                                            <div class="flex items-center gap-2">
                                                <button @click.stop="handleGenerateMore(vehicle.id)" class="st-secondary-btn st-secondary-btn--xs">
                                                    <PackagePlus class="w-3 h-3" /> +6 mois
                                                </button>
                                                <button @click.stop="handleUnassign(vehicle)" class="st-danger-btn st-danger-btn--xs">
                                                    <Trash2 class="w-3 h-3" /> Retirer
                                                </button>
                                            </div>
                                        </div>

                                        <div v-if="!vehicle.payments || vehicle.payments.length === 0" class="text-xs text-gray-400 text-center py-4">
                                            Aucun paiement généré.
                                        </div>
                                        <div v-else class="st-payment-grid">
                                            <div
                                                v-for="payment in vehicle.payments"
                                                :key="payment.id"
                                                class="st-payment-cell"
                                                :class="{
                                                    'st-payment-cell--paid': payment.status === 'paid',
                                                    'st-payment-cell--pending': payment.status === 'pending',
                                                    'st-payment-cell--overdue': payment.status === 'overdue',
                                                }"
                                                @click.stop="togglePayment(payment)"
                                                :title="payment.status === 'paid' ? 'Cliquer pour annuler' : 'Cliquer pour marquer payé'"
                                            >
                                                <div class="st-payment-cell__month">{{ formatMonth(payment.period_month) }}</div>
                                                <div class="st-payment-cell__amount">{{ formatCurrency(payment.amount) }}</div>
                                                <div class="st-payment-cell__status">
                                                    <CheckCircle2 v-if="payment.status === 'paid'" class="w-3.5 h-3.5 text-emerald-500" />
                                                    <Clock v-else-if="payment.status === 'pending'" class="w-3.5 h-3.5 text-amber-500" />
                                                    <AlertTriangle v-else class="w-3.5 h-3.5 text-red-500" />
                                                    <span>{{ payment.status === 'paid' ? 'Payé' : payment.status === 'pending' ? 'En attente' : 'En retard' }}</span>
                                                </div>
                                                <div v-if="payment.paid_at" class="st-payment-cell__date">
                                                    {{ formatDate(payment.paid_at) }}
                                                </div>
                                                <div v-else class="st-payment-cell__date text-gray-400">
                                                    Éch. {{ formatDate(payment.due_date) }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* ─── Backdrop & Panel ─── */
.st-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: flex-end;
}
.st-panel {
    width: 100%;
    max-width: 920px;
    height: 100%;
    background: rgb(249 250 251);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.12);
}

/* Transitions */
.st-drawer-enter-active {
    transition: opacity 0.3s ease;
}
.st-drawer-leave-active {
    transition: opacity 0.2s ease 0.1s;
}
.st-drawer-enter-from,
.st-drawer-leave-to {
    opacity: 0;
}

.st-drawer-enter-active .st-panel {
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.st-drawer-leave-active .st-panel {
    transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.st-drawer-enter-from .st-panel,
.st-drawer-leave-to .st-panel {
    transform: translateX(100%);
}

/* ─── Header ─── */
.st-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: white;
    border-bottom: 1px solid rgb(243 244 246);
    flex-shrink: 0;
}
.st-back-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgb(107 114 128);
    transition: all 0.15s;
}
.st-back-btn:hover {
    background: rgb(243 244 246);
    color: rgb(17 24 39);
}
.st-close-btn {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgb(156 163 175);
    transition: all 0.15s;
}
.st-close-btn:hover {
    background: rgb(254 226 226);
    color: rgb(239 68 68);
}

/* ─── Body ─── */
.st-panel__body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
}
.st-panel__loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

/* ─── Stat Cards ─── */
.st-stat-card {
    background: white;
    padding: 0.875rem;
    border-radius: 0.875rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.st-stat-card__icon {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-bottom: 0.125rem;
}
.st-stat-card__icon--orange { background: linear-gradient(135deg, #fb923c, #ea580c); }
.st-stat-card__icon--blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
.st-stat-card__icon--violet { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
.st-stat-card__icon--red { background: linear-gradient(135deg, #fb7185, #e11d48); }

.st-stat-card__label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(107 114 128);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.st-stat-card__value {
    font-size: 1.125rem;
    font-weight: 800;
    color: rgb(17 24 39);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
}

/* ─── Table ─── */
.st-table-wrap {
    overflow-x: auto;
    background: white;
    border-radius: 0.875rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.st-table {
    min-width: 100%;
    font-size: 0.8125rem;
}
.st-th {
    padding: 0.625rem 1rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 800;
    color: rgb(107 114 128);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid rgb(243 244 246);
    background: rgb(249 250 251);
}
.st-tr {
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid rgb(249 250 251);
}
.st-tr:hover { background: rgba(99, 102, 241, 0.04); }
.st-tr:last-child { border-bottom: none; }
.st-td { padding: 0.75rem 1rem; vertical-align: middle; }

/* ─── Empty State ─── */
.st-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: rgb(156 163 175);
    font-size: 0.875rem;
}

/* ─── Buttons ─── */
.st-primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, #f97316, #ea580c);
    border-radius: 0.625rem;
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);
    transition: all 0.15s;
    white-space: nowrap;
}
.st-primary-btn:hover { box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35); transform: translateY(-1px); }
.st-primary-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.st-primary-btn--sm { padding: 0.375rem 0.75rem; font-size: 0.6875rem; }

.st-secondary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: rgb(107 114 128);
    background: white;
    border: 1px solid rgb(229 231 235);
    border-radius: 0.625rem;
    transition: all 0.15s;
    white-space: nowrap;
}
.st-secondary-btn:hover { background: rgb(249 250 251); color: rgb(55 65 81); }
.st-secondary-btn--sm { padding: 0.375rem 0.75rem; font-size: 0.6875rem; }
.st-secondary-btn--xs { padding: 0.25rem 0.5rem; font-size: 0.625rem; border-radius: 0.375rem; }

.st-danger-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(239 68 68);
    background: rgb(254 242 242);
    border: 1px solid rgb(254 202 202);
    border-radius: 0.5rem;
    transition: all 0.15s;
    white-space: nowrap;
}
.st-danger-btn:hover { background: rgb(254 226 226); }
.st-danger-btn--xs { padding: 0.25rem 0.5rem; font-size: 0.625rem; border-radius: 0.375rem; }

/* ─── Form ─── */
.st-form {
    background: white;
    padding: 1.25rem;
    border-radius: 0.875rem;
    border: 1px solid rgb(243 244 246);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.st-form__group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}
.st-form__label {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgb(55 65 81);
}
.st-form__input {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    border: 1px solid rgb(229 231 235);
    border-radius: 0.5rem;
    color: rgb(17 24 39);
    background: white;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.st-form__input:focus {
    border-color: rgb(249 115 22);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}
.st-form__input::placeholder { color: rgb(209 213 219); }

/* ─── Assign form ─── */
.st-assign-form {
    background: rgb(255 247 237);
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid rgb(254 215 170);
}

/* ─── Car Picker Grid ─── */
.st-car-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.625rem;
    max-height: 260px;
    overflow-y: auto;
    padding: 0.25rem;
}
.st-car-picker__card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    border-radius: 0.75rem;
    background: white;
    border: 2px solid rgb(229 231 235);
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
}
.st-car-picker__card:hover {
    border-color: rgb(251 146 60);
    box-shadow: 0 2px 12px rgba(251, 146, 60, 0.15);
    transform: translateY(-2px);
}
.st-car-picker__card--selected {
    border-color: rgb(249 115 22);
    background: rgb(255 247 237);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15), 0 4px 16px rgba(249, 115, 22, 0.12);
}
.st-car-picker__check {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
}
.st-car-picker__img-wrap {
    width: 100%;
    height: 60px;
    border-radius: 0.5rem;
    overflow: hidden;
    margin-bottom: 0.375rem;
    background: rgb(249 250 251);
    display: flex;
    align-items: center;
    justify-content: center;
}
.st-car-picker__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.st-car-picker__img-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgb(249 250 251), rgb(243 244 246));
}
.st-car-picker__info {
    text-align: center;
    width: 100%;
}
.st-car-picker__plate {
    font-size: 0.6875rem;
    font-weight: 800;
    color: rgb(17 24 39);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    letter-spacing: 0.03em;
    line-height: 1.2;
}
.st-car-picker__model {
    font-size: 0.5625rem;
    font-weight: 600;
    color: rgb(107 114 128);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ─── Vehicle Cards ─── */
.st-vehicle-card {
    background: white;
    border-radius: 0.875rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    transition: border-color 0.15s;
}
.st-vehicle-card:hover {
    border-color: rgb(229 231 235);
}
.st-vehicle-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    cursor: pointer;
    transition: background 0.15s;
}
.st-vehicle-card__header:hover { background: rgb(249 250 251); }

.st-vehicle-card__payments {
    padding: 0.75rem 1rem 1rem;
    border-top: 1px solid rgb(243 244 246);
    background: rgb(249 250 251);
}

/* ─── Payment Grid ─── */
.st-payment-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
    gap: 0.5rem;
}
.st-payment-cell {
    padding: 0.625rem 0.75rem;
    border-radius: 0.625rem;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}
.st-payment-cell:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

.st-payment-cell--paid {
    background: rgb(209 250 229);
    border: 1px solid rgb(167 243 208);
}
.st-payment-cell--pending {
    background: rgb(254 249 195);
    border: 1px solid rgb(253 230 138);
}
.st-payment-cell--overdue {
    background: rgb(254 226 226);
    border: 1px solid rgb(254 202 202);
}

.st-payment-cell__month {
    font-size: 0.6875rem;
    font-weight: 800;
    color: rgb(55 65 81);
    text-transform: capitalize;
}
.st-payment-cell__amount {
    font-size: 0.8125rem;
    font-weight: 800;
    color: rgb(17 24 39);
    font-variant-numeric: tabular-nums;
}
.st-payment-cell__status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.625rem;
    font-weight: 700;
}
.st-payment-cell--paid .st-payment-cell__status { color: rgb(5 122 85); }
.st-payment-cell--pending .st-payment-cell__status { color: rgb(146 64 14); }
.st-payment-cell--overdue .st-payment-cell__status { color: rgb(185 28 28); }

.st-payment-cell__date {
    font-size: 0.625rem;
    color: rgb(107 114 128);
    font-variant-numeric: tabular-nums;
}
</style>
