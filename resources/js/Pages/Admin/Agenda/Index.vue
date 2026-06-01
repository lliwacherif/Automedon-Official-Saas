<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAgenda, type PlannedReservation } from '@/composables/useAgenda';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink } from 'vue-router';
import {
    CalendarClock, Plus, Edit, Trash2, X, Loader2, Search, User, Phone,
    MapPin, Car, ArrowLeft, CalendarDays, ArrowRight, Wallet,
} from 'lucide-vue-next';

const { items, loading, fetchPlanned, createPlanned, updatePlanned, deletePlanned } = useAgenda();
const { tenantPath } = useTenantLink();

const search = ref('');
const fromDate = ref('');
const toDate = ref('');

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const saving = ref(false);

const blankForm = () => ({
    client_name: '',
    client_phone: '',
    start_date: '',
    end_date: '',
    price_per_day: '' as string | number,
    pickup_location: '',
    return_location: '',
    car_note: '',
});
const form = ref(blankForm());

// Number of rental days for a period. A missing/equal end means 1 day;
// otherwise it's the day span between Du and Au (e.g. 02→05 = 3 jours).
function periodDays(start: string, end: string | null): number {
    if (!start) return 0;
    if (!end || end === start) return 1;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
}

// Live estimate shown in the form.
const formDays = computed(() => periodDays(form.value.start_date, form.value.end_date || null));
const formTotal = computed(() => {
    const ppd = Number(form.value.price_per_day) || 0;
    return ppd > 0 ? ppd * formDays.value : 0;
});

function plannedTotal(p: PlannedReservation): number {
    const ppd = Number(p.price_per_day) || 0;
    return ppd > 0 ? ppd * periodDays(p.start_date, p.end_date) : 0;
}

function fmtMoney(v: number): string {
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// Dynamic search: matches name / phone / locations / car note, plus an
// optional date range (from / to). All filters combine (AND). For the date
// filter, a planned period matches when it overlaps the [from, to] window.
const filtered = computed<PlannedReservation[]>(() => {
    const term = search.value.trim().toLowerCase();
    const from = fromDate.value;
    const to = toDate.value;
    return items.value.filter((p) => {
        if (term) {
            const haystack = [
                p.client_name, p.client_phone, p.pickup_location,
                p.return_location, p.car_note,
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(term)) return false;
        }
        // Treat a missing end_date as a single-day period (= start_date).
        const pStart = p.start_date;
        const pEnd = p.end_date || p.start_date;
        if (from && pEnd < from) return false;
        if (to && pStart > to) return false;
        return true;
    });
});

const hasActiveFilters = computed(() => Boolean(search.value || fromDate.value || toDate.value));

function clearFilters() {
    search.value = '';
    fromDate.value = '';
    toDate.value = '';
}

function openAdd() {
    isEdit.value = false;
    editId.value = null;
    form.value = blankForm();
    showModal.value = true;
}

function openEdit(p: PlannedReservation) {
    isEdit.value = true;
    editId.value = p.id;
    form.value = {
        client_name: p.client_name,
        client_phone: p.client_phone || '',
        start_date: p.start_date,
        end_date: p.end_date || '',
        price_per_day: p.price_per_day ?? '',
        pickup_location: p.pickup_location || '',
        return_location: p.return_location || '',
        car_note: p.car_note || '',
    };
    showModal.value = true;
}

async function handleSubmit() {
    if (!form.value.client_name.trim() || !form.value.start_date) return;
    // If both dates are set, the end must not precede the start.
    if (form.value.end_date && form.value.end_date < form.value.start_date) {
        alert('La date « Au » doit être postérieure ou égale à la date « Du ».');
        return;
    }
    saving.value = true;
    try {
        const payload = {
            ...form.value,
            price_per_day: form.value.price_per_day === '' ? null : Number(form.value.price_per_day),
        };
        if (isEdit.value && editId.value) {
            await updatePlanned(editId.value, payload);
        } else {
            await createPlanned(payload);
        }
        showModal.value = false;
    } catch (e: any) {
        alert('Erreur: ' + e.message);
    } finally {
        saving.value = false;
    }
}

async function handleDelete(id: number) {
    if (!confirm('Supprimer cette réservation planifiée ?')) return;
    await deletePlanned(id);
}

function formatLong(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// A planned period is "past" once its end (or its start, if no end) is before today.
function isPast(p: PlannedReservation): boolean {
    const ref = p.end_date || p.start_date;
    if (!ref) return false;
    const d = new Date(ref + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
}

// "Du 02 juin → Au 05 juin 2026" (or a single date when there's no end).
function formatPeriod(p: PlannedReservation): string {
    const start = formatLong(p.start_date);
    if (!p.end_date || p.end_date === p.start_date) return start;
    return `${start} → ${formatLong(p.end_date)}`;
}

onMounted(fetchPlanned);
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1200px] mx-auto p-5 md:p-6 space-y-5">
            <!-- Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <RouterLink :to="tenantPath('/admin/reservations')" class="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                        <ArrowLeft class="w-4 h-4 text-gray-600" />
                    </RouterLink>
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-200">
                        <CalendarClock class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Agenda — Réservations potentielles</h1>
                        <p class="text-sm text-gray-500">{{ filtered.length }} réservation{{ filtered.length !== 1 ? 's' : '' }} planifiée{{ filtered.length !== 1 ? 's' : '' }}</p>
                    </div>
                </div>
                <button @click="openAdd" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 rounded-xl shadow-md shadow-sky-200 transition-all">
                    <Plus class="w-4 h-4" /> Nouvelle planification
                </button>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="lg:col-span-2">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Rechercher</label>
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                v-model="search"
                                type="text"
                                placeholder="Nom, téléphone, lieu, type de voiture..."
                                class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
                            >
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Du</label>
                        <div class="relative">
                            <CalendarDays class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input v-model="fromDate" type="date" class="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Au</label>
                        <div class="relative">
                            <CalendarDays class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input v-model="toDate" type="date" class="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all">
                        </div>
                    </div>
                </div>
                <div v-if="hasActiveFilters" class="flex justify-end mt-3">
                    <button @click="clearFilters" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition">
                        <X class="w-3.5 h-3.5" /> Réinitialiser les filtres
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading && items.length === 0" class="flex flex-col items-center py-20">
                <Loader2 class="w-8 h-8 text-sky-600 animate-spin mb-3" />
                <p class="text-gray-400">Chargement...</p>
            </div>

            <!-- Empty -->
            <div v-else-if="filtered.length === 0" class="flex flex-col items-center py-20 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                <CalendarClock class="w-12 h-12 text-gray-300 mb-3" />
                <p class="text-gray-400 font-medium mb-1">{{ hasActiveFilters ? 'Aucun résultat' : 'Aucune réservation planifiée' }}</p>
                <p class="text-sm text-gray-300 mb-4">{{ hasActiveFilters ? 'Essayez d\'autres critères de recherche.' : 'Planifiez vos futures réservations potentielles.' }}</p>
                <button v-if="!hasActiveFilters" @click="openAdd" class="text-sm font-medium text-sky-600 hover:text-sky-700">+ Ajouter</button>
            </div>

            <!-- Cards Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div v-for="p in filtered" :key="p.id" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden hover:shadow-md transition flex flex-col">
                    <!-- Date banner (période Du → Au) -->
                    <div class="px-5 py-3 flex items-center justify-between gap-2"
                        :class="isPast(p) ? 'bg-gray-50' : 'bg-gradient-to-r from-sky-50 to-cyan-50'">
                        <div class="flex items-center gap-2 min-w-0">
                            <CalendarDays class="w-4 h-4 shrink-0" :class="isPast(p) ? 'text-gray-400' : 'text-sky-600'" />
                            <span class="text-[13px] font-bold truncate" :class="isPast(p) ? 'text-gray-500' : 'text-sky-700'">{{ formatPeriod(p) }}</span>
                        </div>
                        <span v-if="isPast(p)" class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">Passée</span>
                    </div>

                    <div class="p-5 pt-4 flex-1 space-y-3">
                        <!-- Client -->
                        <div class="flex items-start gap-2.5">
                            <div class="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                                <User class="w-4 h-4 text-sky-600" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <h3 class="text-base font-bold text-gray-900 truncate">{{ p.client_name }}</h3>
                                <p v-if="p.client_phone" class="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Phone class="w-3 h-3" /> {{ p.client_phone }}</p>
                            </div>
                        </div>

                        <!-- Locations -->
                        <div v-if="p.pickup_location || p.return_location" class="flex items-start gap-2 text-sm text-gray-600 bg-gray-50/70 rounded-lg p-2.5">
                            <MapPin class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <div class="min-w-0 flex items-center gap-1.5 flex-wrap">
                                <span v-if="p.pickup_location" class="truncate">{{ p.pickup_location }}</span>
                                <ArrowRight v-if="p.pickup_location && p.return_location" class="w-3 h-3 text-gray-300 shrink-0" />
                                <span v-if="p.return_location" class="truncate">{{ p.return_location }}</span>
                            </div>
                        </div>

                        <!-- Car note -->
                        <div v-if="p.car_note" class="flex items-start gap-2 text-sm text-gray-600">
                            <Car class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <span class="text-[13px]">{{ p.car_note }}</span>
                        </div>

                        <!-- Price estimate -->
                        <div v-if="Number(p.price_per_day) > 0" class="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-dashed border-gray-100">
                            <div class="flex items-center gap-2 text-[13px] text-gray-500">
                                <Wallet class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{{ fmtMoney(Number(p.price_per_day)) }} DT/j × {{ periodDays(p.start_date, p.end_date) }}j</span>
                            </div>
                            <div class="text-sm font-bold text-emerald-600">{{ fmtMoney(plannedTotal(p)) }} DT</div>
                        </div>
                    </div>

                    <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-1">
                        <button @click="openEdit(p)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-sky-50 transition"><Edit class="w-4 h-4 text-sky-500" /></button>
                        <button @click="handleDelete(p.id)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition"><Trash2 class="w-4 h-4 text-red-400" /></button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showModal = false"></div>
                    <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center"><CalendarClock class="w-4 h-4 text-sky-600" /></div>
                                <h3 class="text-base font-bold text-gray-900">{{ isEdit ? 'Modifier la planification' : 'Nouvelle planification' }}</h3>
                            </div>
                            <button @click="showModal = false" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X class="w-5 h-5" /></button>
                        </div>
                        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nom &amp; Prénom *</label>
                                    <input v-model="form.client_name" type="text" required class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" placeholder="Nom complet du client" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Numéro <span class="text-[10px] font-medium text-gray-400 normal-case">(optionnel)</span></label>
                                    <input v-model="form.client_phone" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" placeholder="Téléphone" />
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Période de la réservation *</label>
                                <div class="grid grid-cols-2 gap-3">
                                    <div>
                                        <span class="block text-[10px] font-medium text-gray-400 mb-1">Du</span>
                                        <input v-model="form.start_date" type="date" required class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                                    </div>
                                    <div>
                                        <span class="block text-[10px] font-medium text-gray-400 mb-1">Au</span>
                                        <input v-model="form.end_date" type="date" :min="form.start_date || undefined" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Prix par jour <span class="text-[10px] font-medium text-gray-400 normal-case">(DT)</span></label>
                                <div class="relative">
                                    <Wallet class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input v-model="form.price_per_day" type="number" min="0" step="any" class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" placeholder="Ex: 80" />
                                </div>
                                <!-- Live estimated total -->
                                <div v-if="formTotal > 0" class="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 ring-1 ring-emerald-100 px-3.5 py-2.5">
                                    <span class="text-xs font-semibold text-emerald-700">Coût total estimé</span>
                                    <span class="text-sm font-bold text-emerald-700">
                                        {{ fmtMoney(Number(form.price_per_day)) }} DT × {{ formDays }}j = {{ fmtMoney(formTotal) }} DT
                                    </span>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Lieu de prise</label>
                                    <input v-model="form.pickup_location" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" placeholder="Ex: Aéroport Tunis" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Lieu de remise</label>
                                    <input v-model="form.return_location" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" placeholder="Ex: Agence Centre-ville" />
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Type de voiture souhaité</label>
                                <textarea v-model="form.car_note" rows="2" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" placeholder="Ex: Automatique, grande, familiale..."></textarea>
                            </div>
                            <div class="flex justify-end gap-3 pt-3 border-t border-gray-100">
                                <button type="button" @click="showModal = false" class="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition">Annuler</button>
                                <button type="submit" :disabled="saving" class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md disabled:opacity-50 transition">
                                    <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                                    {{ saving ? 'Enregistrement...' : (isEdit ? 'Modifier' : 'Planifier') }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
