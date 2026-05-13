<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink } from 'vue-router';
import type { Database } from '@/types/supabase';
import {
    Car,
    Search,
    History,
    ChevronRight,
    Loader2,
    CircleCheck,
    User,
    Wrench,
    TrendingUp,
    Wallet,
    Gauge,
    Hash,
    Clock,
    ArrowDown,
    ArrowUp,
    ImageOff,
    Filter,
    SlidersHorizontal,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

type CarRow = Database['public']['Tables']['cars']['Row'];

const { t } = useI18n();
const { tenantPath } = useTenantLink();

// ───────────────────────────────────────────────
// Data
// ───────────────────────────────────────────────
const cars = ref<CarRow[]>([]);
const loading = ref(true);

interface CarSummary {
    revenue: number;
    reservationsCount: number;
    daysRented: number;
    maintenanceCost: number;
    maintenanceCount: number;
    netProfit: number;
    lastActivity: string | null;
    lastClient: string | null;
}
const summaries = ref<Record<number, CarSummary>>({});

function emptySummary(): CarSummary {
    return {
        revenue: 0,
        reservationsCount: 0,
        daysRented: 0,
        maintenanceCost: 0,
        maintenanceCount: 0,
        netProfit: 0,
        lastActivity: null,
        lastClient: null,
    };
}

onMounted(async () => {
    await fetchAll();
});

async function fetchAll() {
    loading.value = true;
    try {
        const tenantStore = useTenantStore();
        const tenantId = tenantStore.currentTenant?.id;

        // 1. Cars
        let carQuery = supabase.from('cars').select('*');
        if (tenantId) carQuery = carQuery.eq('tenant_id', tenantId);
        const { data: carData } = await carQuery.order('created_at', { ascending: false });
        cars.value = (carData || []) as CarRow[];

        if (cars.value.length === 0) return;

        // 2. Bulk reservations + maintenance for the tenant (lifetime)
        let resQuery = supabase
            .from('reservations')
            .select('car_id, total_price, start_date, end_date, status, client_name')
            .neq('status', 'cancelled');
        if (tenantId) resQuery = resQuery.eq('tenant_id', tenantId);
        const { data: resData } = await resQuery;

        let maintQuery = supabase
            .from('maintenance_records')
            .select('car_id, cost, maintenance_date');
        if (tenantId) maintQuery = maintQuery.eq('tenant_id', tenantId);
        const { data: maintData } = await maintQuery;

        // 3. Aggregate per car
        const map: Record<number, CarSummary> = {};
        for (const c of cars.value) map[c.id] = emptySummary();

        const msPerDay = 1000 * 60 * 60 * 24;
        for (const r of (resData || []) as any[]) {
            const s = map[r.car_id];
            if (!s) continue;
            s.revenue += Number(r.total_price || 0);
            s.reservationsCount += 1;
            const start = new Date(r.start_date);
            const end = new Date(r.end_date);
            const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay));
            s.daysRented += days;
            // Last activity = most recent start_date
            if (!s.lastActivity || r.start_date > s.lastActivity) {
                s.lastActivity = r.start_date;
                s.lastClient = r.client_name || null;
            }
        }

        for (const m of (maintData || []) as any[]) {
            const s = map[m.car_id];
            if (!s) continue;
            s.maintenanceCost += Number(m.cost || 0);
            s.maintenanceCount += 1;
            if (!s.lastActivity || m.maintenance_date > s.lastActivity) {
                s.lastActivity = m.maintenance_date;
            }
        }

        for (const id in map) {
            map[id].netProfit = map[id].revenue - map[id].maintenanceCost;
        }
        summaries.value = map;
    } catch (error) {
        console.error('Error fetching history data:', error);
    } finally {
        loading.value = false;
    }
}

// ───────────────────────────────────────────────
// Filters / sort
// ───────────────────────────────────────────────
const search = ref('');
type StatusFilter = 'all' | 'disponible' | 'loue' | 'maintenance';
const statusFilter = ref<StatusFilter>('all');
const brandFilter = ref<string>('all');

type SortKey = 'recent' | 'revenue' | 'reservations' | 'maintenance' | 'plate';
const sortBy = ref<SortKey>('recent');

const allBrands = computed(() => {
    const set = new Set<string>();
    for (const c of cars.value) if (c.brand) set.add(c.brand);
    return Array.from(set).sort();
});

const visibleCars = computed(() => {
    let list = cars.value;
    const term = search.value.trim().toLowerCase();
    if (term) {
        list = list.filter(c =>
            (c.brand?.toLowerCase().includes(term)) ||
            c.model.toLowerCase().includes(term) ||
            c.license_plate.toLowerCase().includes(term)
        );
    }
    if (statusFilter.value !== 'all') {
        list = list.filter(c => c.status === statusFilter.value);
    }
    if (brandFilter.value !== 'all') {
        list = list.filter(c => c.brand === brandFilter.value);
    }
    const sorted = [...list].sort((a, b) => {
        const sa = summaries.value[a.id] || emptySummary();
        const sb = summaries.value[b.id] || emptySummary();
        switch (sortBy.value) {
            case 'revenue':       return sb.revenue - sa.revenue;
            case 'reservations':  return sb.reservationsCount - sa.reservationsCount;
            case 'maintenance':   return sb.maintenanceCost - sa.maintenanceCost;
            case 'plate':         return a.license_plate.localeCompare(b.license_plate);
            case 'recent':
            default: {
                const aDate = sa.lastActivity || a.created_at;
                const bDate = sb.lastActivity || b.created_at;
                return (bDate || '').localeCompare(aDate || '');
            }
        }
    });
    return sorted;
});

// ───────────────────────────────────────────────
// Aggregates for hero stats
// ───────────────────────────────────────────────
const totalRevenue = computed(() => Object.values(summaries.value).reduce((s, x) => s + x.revenue, 0));
const totalMaintenance = computed(() => Object.values(summaries.value).reduce((s, x) => s + x.maintenanceCost, 0));
const totalNet = computed(() => totalRevenue.value - totalMaintenance.value);
const totalReservations = computed(() => Object.values(summaries.value).reduce((s, x) => s + x.reservationsCount, 0));

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(v || 0);
}
function formatShort(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return `${Math.round(v)}`;
}
function formatPlate(plate: string): string {
    if (!plate) return '';
    return plate.replace(/(\d+)(TU|TN)(\d+)/i, '$1 $2 $3');
}
function relativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Aucune activité';
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return 'Aucune activité';
    const diffMs = Date.now() - ts;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return 'À venir';
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
    if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
    const years = Math.floor(days / 365);
    return `Il y a ${years} an${years > 1 ? 's' : ''}`;
}
function getBrandLogo(brand: string | null | undefined): string {
    return `/images/${brand || ''}.png`;
}
function statusMeta(status: string | null) {
    if (status === 'maintenance') return { label: 'Maintenance', class: 'car-status car-status--maintenance', Icon: Wrench };
    if (status === 'loue') return { label: 'Loué', class: 'car-status car-status--loue', Icon: User };
    return { label: 'Disponible', class: 'car-status car-status--disponible', Icon: CircleCheck };
}
function getSummary(id: number): CarSummary {
    return summaries.value[id] || emptySummary();
}

const sortOptions: { key: SortKey; label: string; Icon: any }[] = [
    { key: 'recent',       label: 'Activité récente', Icon: Clock },
    { key: 'revenue',      label: 'CA décroissant',   Icon: TrendingUp },
    { key: 'reservations', label: 'Réservations',     Icon: Hash },
    { key: 'maintenance',  label: 'Maintenance',      Icon: Wrench },
    { key: 'plate',        label: 'Plaque (A-Z)',     Icon: ArrowDown },
];

const STATUS_BUTTONS: { key: StatusFilter; label: string }[] = [
    { key: 'all',          label: 'Tous' },
    { key: 'disponible',   label: 'Disponible' },
    { key: 'loue',         label: 'Loué' },
    { key: 'maintenance',  label: 'Maintenance' },
];
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- ───── Header ───── -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-200">
                    <History class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ t('admin.history.title') }}</h1>
                    <p class="text-sm text-gray-500">
                        {{ cars.length }} véhicule{{ cars.length !== 1 ? 's' : '' }} ·
                        <span class="font-bold text-gray-700">{{ totalReservations }}</span> réservations ·
                        <span class="font-bold text-emerald-700">{{ formatCurrency(totalRevenue) }}</span> de CA cumulé
                    </p>
                </div>
            </div>

            <!-- ───── Hero stats (4 cards) ───── -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div class="hero-stat">
                    <div class="hero-stat__icon hero-stat__icon--violet"><Car class="w-4 h-4" /></div>
                    <div class="hero-stat__label">Voitures</div>
                    <div class="hero-stat__value">{{ cars.length }}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat__icon hero-stat__icon--emerald"><TrendingUp class="w-4 h-4" /></div>
                    <div class="hero-stat__label">CA total</div>
                    <div class="hero-stat__value">{{ formatCurrency(totalRevenue) }}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat__icon hero-stat__icon--rose"><Wrench class="w-4 h-4" /></div>
                    <div class="hero-stat__label">Maintenance</div>
                    <div class="hero-stat__value">{{ formatCurrency(totalMaintenance) }}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat__icon hero-stat__icon--indigo"><Wallet class="w-4 h-4" /></div>
                    <div class="hero-stat__label">Bénéfice net</div>
                    <div class="hero-stat__value" :class="totalNet >= 0 ? '' : 'text-red-600'">
                        {{ formatCurrency(totalNet) }}
                    </div>
                </div>
            </div>

            <!-- ───── Toolbar ───── -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-3 md:p-4">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">

                    <!-- Search -->
                    <div class="relative flex-1 min-w-[220px]">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            v-model="search"
                            type="text"
                            class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                            :placeholder="t('admin.history.search_placeholder')"
                        />
                    </div>

                    <!-- Status segmented -->
                    <div class="inline-flex items-center bg-gray-50 p-0.5 rounded-xl ring-1 ring-gray-100">
                        <Filter class="w-3.5 h-3.5 text-gray-400 ml-2 mr-0.5" />
                        <button
                            v-for="b in STATUS_BUTTONS"
                            :key="b.key"
                            type="button"
                            @click="statusFilter = b.key"
                            :class="[
                                'px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all',
                                statusFilter === b.key
                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                    : 'text-gray-500 hover:text-gray-700'
                            ]"
                        >
                            {{ b.label }}
                        </button>
                    </div>

                    <!-- Brand dropdown -->
                    <div class="relative">
                        <select
                            v-model="brandFilter"
                            class="appearance-none pl-9 pr-8 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer text-gray-700"
                        >
                            <option value="all">Toutes marques</option>
                            <option v-for="b in allBrands" :key="b" :value="b">{{ b }}</option>
                        </select>
                        <Car class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <ChevronRight class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none rotate-90" />
                    </div>

                    <!-- Sort dropdown -->
                    <div class="relative">
                        <select
                            v-model="sortBy"
                            class="appearance-none pl-9 pr-8 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer text-gray-700"
                        >
                            <option v-for="opt in sortOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                        </select>
                        <SlidersHorizontal class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <ChevronRight class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none rotate-90" />
                    </div>

                    <!-- Match counter -->
                    <span class="hidden md:inline-flex items-center text-[11px] font-bold text-gray-400 ml-auto">
                        {{ visibleCars.length }} / {{ cars.length }}
                    </span>
                </div>
            </div>

            <!-- ───── Loading ───── -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">{{ t('admin.history.loading') }}</p>
            </div>

            <!-- ───── Empty ───── -->
            <div
                v-else-if="visibleCars.length === 0"
                class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-12 text-center"
            >
                <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                    <Car class="w-7 h-7 text-gray-300" />
                </div>
                <p class="text-gray-400 font-medium">
                    {{ cars.length === 0 ? t('admin.history.no_cars') : 'Aucun véhicule ne correspond aux filtres.' }}
                </p>
            </div>

            <!-- ───── Cars grid ───── -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                <RouterLink
                    v-for="car in visibleCars"
                    :key="car.id"
                    :to="tenantPath(`/admin/history/${car.id}`)"
                    class="history-card group"
                >
                    <!-- Image -->
                    <div class="history-card__image">
                        <img
                            v-if="car.image_url"
                            :src="car.image_url"
                            :alt="`${car.brand} ${car.model}`"
                            class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                            @error="($event.target as HTMLImageElement).style.display='none'"
                        />
                        <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageOff class="w-9 h-9" />
                        </div>

                        <!-- Status pill -->
                        <span :class="statusMeta(car.status).class">
                            <component :is="statusMeta(car.status).Icon" class="w-3 h-3" />
                            {{ statusMeta(car.status).label }}
                        </span>

                        <!-- Brand logo -->
                        <div v-if="car.brand" class="history-card__brand">
                            <img
                                :src="getBrandLogo(car.brand)"
                                :alt="car.brand"
                                class="w-7 h-7 object-contain"
                                @error="($event.target as HTMLImageElement).style.display='none'"
                            />
                        </div>
                    </div>

                    <!-- Body -->
                    <div class="p-4 flex flex-col gap-3">
                        <!-- Plate (hero) -->
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="history-card__plate">{{ formatPlate(car.license_plate) }}</div>
                                <div class="text-[12px] font-semibold text-gray-500 truncate mt-0.5">
                                    {{ car.brand }} {{ car.model }}<span v-if="car.year" class="text-gray-400"> · {{ car.year }}</span>
                                </div>
                            </div>
                            <div v-if="car.mileage" class="hidden sm:flex items-center gap-1 text-[11px] text-gray-500 font-bold tabular-nums shrink-0 mt-0.5">
                                <Gauge class="w-3 h-3 text-gray-400" />
                                {{ Number(car.mileage).toLocaleString() }} km
                            </div>
                        </div>

                        <!-- 4-cell stats grid -->
                        <div class="history-card__stats">
                            <div class="history-card__stat">
                                <div class="history-card__stat-label">CA</div>
                                <div class="history-card__stat-value text-emerald-600">{{ formatShort(getSummary(car.id).revenue) }}</div>
                            </div>
                            <div class="history-card__stat">
                                <div class="history-card__stat-label">Rés.</div>
                                <div class="history-card__stat-value">{{ getSummary(car.id).reservationsCount }}</div>
                            </div>
                            <div class="history-card__stat">
                                <div class="history-card__stat-label">Maint.</div>
                                <div class="history-card__stat-value text-red-500">
                                    {{ getSummary(car.id).maintenanceCost > 0 ? formatShort(getSummary(car.id).maintenanceCost) : '—' }}
                                </div>
                            </div>
                            <div class="history-card__stat">
                                <div class="history-card__stat-label">Net</div>
                                <div
                                    class="history-card__stat-value"
                                    :class="getSummary(car.id).netProfit >= 0 ? 'text-indigo-600' : 'text-red-500'"
                                >
                                    {{ formatShort(getSummary(car.id).netProfit) }}
                                </div>
                            </div>
                        </div>

                        <!-- Footer: last activity + CTA -->
                        <div class="history-card__footer">
                            <div class="flex items-center gap-1.5 text-[11px] text-gray-500 min-w-0">
                                <Clock class="w-3 h-3 text-gray-400 shrink-0" />
                                <span class="truncate">{{ relativeTime(getSummary(car.id).lastActivity) }}</span>
                                <span
                                    v-if="getSummary(car.id).lastClient"
                                    class="text-gray-400 truncate hidden sm:inline"
                                >· {{ getSummary(car.id).lastClient }}</span>
                            </div>
                            <span class="history-card__cta">
                                {{ t('admin.history.view_history') }}
                                <ChevronRight class="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </RouterLink>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ───── Hero stats ───── */
.hero-stat {
    background: white;
    padding: 1rem;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
}
.hero-stat:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
}
.hero-stat__icon {
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-bottom: 0.25rem;
}
.hero-stat__icon--violet  { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
.hero-stat__icon--emerald { background: linear-gradient(135deg, #34d399, #059669); }
.hero-stat__icon--rose    { background: linear-gradient(135deg, #fb7185, #e11d48); }
.hero-stat__icon--indigo  { background: linear-gradient(135deg, #818cf8, #4f46e5); }

.hero-stat__label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(107 114 128);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.hero-stat__value {
    font-size: 1.125rem;
    font-weight: 800;
    color: rgb(17 24 39);
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
}

/* ───── Car card ───── */
.history-card {
    text-align: left;
    background: white;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                border-color 0.25s ease;
}

.history-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.07), 0 4px 10px rgba(0, 0, 0, 0.04);
    border-color: rgb(229 231 235);
}

.history-card__image {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    background: linear-gradient(180deg, rgb(249 250 251), rgb(243 244 246));
    overflow: hidden;
}

.history-card__brand {
    position: absolute;
    bottom: 0.625rem;
    right: 0.625rem;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Status pill */
.car-status {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 800;
    border-radius: 999px;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: white;
    letter-spacing: 0.02em;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.car-status--disponible { background: rgba(16, 185, 129, 0.92); }
.car-status--loue       { background: rgba(245, 158, 11, 0.92); }
.car-status--maintenance{ background: rgba(239, 68, 68, 0.92); }

/* Plate hero */
.history-card__plate {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 1.0625rem;
    font-weight: 900;
    color: rgb(17 24 39);
    line-height: 1;
    letter-spacing: -0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Stats grid */
.history-card__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    padding-top: 0.625rem;
    border-top: 1px solid rgb(243 244 246);
}

.history-card__stat {
    text-align: center;
    padding: 0 0.25rem;
}

.history-card__stat + .history-card__stat {
    border-left: 1px solid rgb(243 244 246);
}

.history-card__stat-label {
    font-size: 0.625rem;
    font-weight: 800;
    color: rgb(156 163 175);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.history-card__stat-value {
    margin-top: 0.125rem;
    font-size: 0.875rem;
    font-weight: 800;
    color: rgb(17 24 39);
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
}

/* Footer */
.history-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgb(243 244 246);
}

.history-card__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3125rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 800;
    color: rgb(67 56 202);
    background: rgb(238 242 255);
    border-radius: 0.5rem;
    box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.15);
    transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
    flex-shrink: 0;
}

.history-card:hover .history-card__cta {
    background: rgb(99 102 241);
    color: white;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}
</style>
