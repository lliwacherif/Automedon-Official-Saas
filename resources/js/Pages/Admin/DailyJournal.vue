<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useCars } from '@/composables/useCars';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import {
    addDays,
    differenceInDays,
    eachDayOfInterval,
    format,
    isToday,
    isWeekend,
    parseISO,
    startOfDay,
    subDays,
    max as maxDate,
    min as minDate,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    Loader2,
    Orbit,
    Car,
    User,
    Calendar,
    CreditCard,
    CircleCheck,
    List,
    ChevronLeft,
    ChevronRight,
    CalendarRange,
    CalendarDays,
    Clock,
} from 'lucide-vue-next';

const { t } = useI18n();
const { cars, loading, fetchCars } = useCars();
const tenantStore = useTenantStore();

// ───────────────────────────────────────────────
// View Mode
// ───────────────────────────────────────────────
type ViewMode = 'timeline' | 'list';
const viewMode = ref<ViewMode>('timeline');

// ───────────────────────────────────────────────
// Timeline State
// ───────────────────────────────────────────────
type Granularity = 'day' | 'hour';
const granularity = ref<Granularity>('day');

// Number of days visible depends on granularity:
// - day mode: 14 days fit comfortably with day-wide cells
// - hour mode: 7 days, each cell is wider so we can show hour ticks inside
const VISIBLE_DAYS_BY_MODE: Record<Granularity, number> = {
    day: 14,
    hour: 7,
};

const startDate = ref(startOfDay(new Date()));

const allReservations = ref<any[]>([]);
const reservationsLoading = ref(false);

const visibleDaysCount = computed(() => VISIBLE_DAYS_BY_MODE[granularity.value]);

const visibleDays = computed(() =>
    eachDayOfInterval({
        start: startDate.value,
        end: addDays(startDate.value, visibleDaysCount.value - 1),
    })
);

const rangeEnd = computed(() => addDays(startDate.value, visibleDaysCount.value - 1));

// Position (in fractional days from visibleStart) of "right now",
// or null when "now" is outside the visible window.
const nowFracDays = computed<number | null>(() => {
    const now = new Date();
    const visibleStart = startDate.value;
    const visibleEndExclusive = addDays(visibleStart, visibleDaysCount.value);
    if (now < visibleStart || now >= visibleEndExclusive) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    return (now.getTime() - visibleStart.getTime()) / msPerDay;
});

async function fetchTimelineReservations() {
    const tenantId = tenantStore.currentTenant?.id;
    if (!tenantId) return;

    reservationsLoading.value = true;
    try {
        const startIso = startDate.value.toISOString();
        const endExclusiveIso = addDays(startDate.value, visibleDaysCount.value).toISOString();

        const { data, error } = await supabase
            .from('reservations')
            .select('id, car_id, start_date, end_date, client_name, status')
            .eq('tenant_id', tenantId)
            .in('status', ['confirmed', 'active', 'completed'])
            .lt('start_date', endExclusiveIso)
            .gt('end_date', startIso);

        if (error) throw error;
        allReservations.value = data || [];
    } catch (e) {
        console.error('Error fetching timeline reservations:', e);
    } finally {
        reservationsLoading.value = false;
    }
}

// Refetch when granularity changes (visible window size changes with it)
watch(granularity, () => {
    fetchTimelineReservations();
});

const reservationsByCarId = computed(() => {
    const map: Record<number, any[]> = {};
    for (const res of allReservations.value) {
        if (!map[res.car_id]) map[res.car_id] = [];
        map[res.car_id].push(res);
    }
    return map;
});

interface ReservationSegment {
    id: number;
    leftFracDays: number;
    widthFracDays: number;
    startsBefore: boolean;
    endsAfter: boolean;
    clientName: string;
    status: string;
    startTime: string | null;
    endTime: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getReservationSegments(carId: number): ReservationSegment[] {
    const reservations = reservationsByCarId.value[carId] || [];
    const visibleStart = startDate.value;
    const visibleEndExclusive = addDays(visibleStart, visibleDaysCount.value);
    const visibleEndInclusive = addDays(visibleStart, visibleDaysCount.value - 1);

    const segments: ReservationSegment[] = [];

    for (const res of reservations) {
        const resStart = parseISO(res.start_date);
        const resEnd = parseISO(res.end_date);

        let leftFracDays: number;
        let widthFracDays: number;
        let startsBefore: boolean;
        let endsAfter: boolean;

        if (granularity.value === 'hour') {
            // Hour-precise: position by exact timestamps
            const clippedStart = maxDate([resStart, visibleStart]);
            const clippedEnd = minDate([resEnd, visibleEndExclusive]);

            if (clippedStart >= clippedEnd) continue;

            leftFracDays = (clippedStart.getTime() - visibleStart.getTime()) / MS_PER_DAY;
            widthFracDays = (clippedEnd.getTime() - clippedStart.getTime()) / MS_PER_DAY;

            startsBefore = resStart < visibleStart;
            endsAfter = resEnd > visibleEndExclusive;
        } else {
            // Day-snapped: bar covers full days from start day to end day inclusive
            const resStartDay = startOfDay(resStart);
            const resEndDay = startOfDay(resEnd);

            const clippedStart = maxDate([resStartDay, visibleStart]);
            const clippedEnd = minDate([resEndDay, visibleEndInclusive]);

            if (clippedStart > clippedEnd) continue;

            leftFracDays = differenceInDays(clippedStart, visibleStart);
            widthFracDays = differenceInDays(clippedEnd, clippedStart) + 1;

            startsBefore = resStartDay < visibleStart;
            endsAfter = resEndDay > visibleEndInclusive;
        }

        segments.push({
            id: res.id,
            leftFracDays,
            widthFracDays,
            startsBefore,
            endsAfter,
            clientName: res.client_name || '—',
            status: res.status,
            startTime: granularity.value === 'hour' ? format(resStart, 'HH:mm') : null,
            endTime: granularity.value === 'hour' ? format(resEnd, 'HH:mm') : null,
        });
    }

    return segments;
}

function nextRange() {
    startDate.value = addDays(startDate.value, visibleDaysCount.value);
    fetchTimelineReservations();
}

function prevRange() {
    startDate.value = subDays(startDate.value, visibleDaysCount.value);
    fetchTimelineReservations();
}

function goToToday() {
    startDate.value = startOfDay(new Date());
    fetchTimelineReservations();
}

function formatDayName(day: Date): string {
    return format(day, 'EEE', { locale: fr });
}

function formatDayShort(day: Date): string {
    return format(day, 'd MMM', { locale: fr });
}

function formatRangeText(): string {
    const start = format(startDate.value, 'd MMM', { locale: fr });
    const end = format(rangeEnd.value, 'd MMM yyyy', { locale: fr });
    return `${start} — ${end}`;
}

// ───────────────────────────────────────────────
// Helpers (used by list mode)
// ───────────────────────────────────────────────
function formatPlate(plate: string): string {
    if (!plate) return '';
    return plate.replace(/(\d+)(TN)(\d+)/i, '$1 $2 $3');
}

function getDailyStatus(car: any) {
    if (car.status !== 'loue' || !car.active_reservation) {
        return {
            text: t('admin.fleet.disponible'),
            class: 'status-disponible'
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const res = car.active_reservation;
    if (!res.end_date) return { text: '-', class: '' };

    const endDate = new Date(res.end_date);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return { text: t('daily_journal.return_tomorrow'), class: 'status-tomorrow' };
    if (diffDays === 2) return { text: t('daily_journal.return_after_tomorrow'), class: 'status-after-tomorrow' };
    if (diffDays > 2) return { text: new Date(res.end_date).toLocaleDateString('fr-FR'), class: 'status-later' };
    if (diffDays === 0) return { text: t('daily_journal.return_today'), class: 'status-today' };
    return { text: t('daily_journal.late'), class: 'status-late' };
}

onMounted(async () => {
    await fetchCars();
    await fetchTimelineReservations();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <Orbit class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ t('daily_journal.title') }}</h1>
                        <p class="text-sm text-gray-500">{{ cars.length }} véhicule{{ cars.length !== 1 ? 's' : '' }} dans la flotte</p>
                    </div>
                </div>

                <!-- View Mode Toggle -->
                <div class="inline-flex items-center bg-white p-1 rounded-xl ring-1 ring-gray-100 shadow-sm self-start sm:self-auto">
                    <button
                        type="button"
                        @click="viewMode = 'timeline'"
                        :class="[
                            'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200',
                            viewMode === 'timeline'
                                ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-200/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        ]"
                    >
                        <CalendarRange class="w-3.5 h-3.5" />
                        <span>Chronologie</span>
                    </button>
                    <button
                        type="button"
                        @click="viewMode = 'list'"
                        :class="[
                            'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200',
                            viewMode === 'list'
                                ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-200/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        ]"
                    >
                        <List class="w-3.5 h-3.5" />
                        <span>Liste</span>
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement du tableau...</p>
            </div>

            <!-- ────────────────────────────────────────── -->
            <!-- TIMELINE VIEW (default)                      -->
            <!-- ────────────────────────────────────────── -->
            <template v-else-if="viewMode === 'timeline'">
                <!-- Date navigation toolbar -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <!-- Range navigation -->
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            @click="prevRange"
                            class="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Période précédente"
                        >
                            <ChevronLeft class="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            @click="goToToday"
                            class="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg ring-1 ring-indigo-100 transition-colors"
                        >
                            Aujourd'hui
                        </button>
                        <button
                            type="button"
                            @click="nextRange"
                            class="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Période suivante"
                        >
                            <ChevronRight class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Range label + granularity toggle -->
                    <div class="flex items-center gap-3 flex-wrap">
                        <div class="flex items-center gap-2 text-sm font-bold text-gray-700 tracking-tight">
                            <Calendar class="w-4 h-4 text-gray-400" />
                            <span class="capitalize">{{ formatRangeText() }}</span>
                            <Loader2 v-if="reservationsLoading" class="w-3.5 h-3.5 text-indigo-500 animate-spin ml-1" />
                        </div>

                        <!-- Day / Hour granularity switch -->
                        <div class="inline-flex items-center bg-gray-50 p-0.5 rounded-lg ring-1 ring-gray-100">
                            <button
                                type="button"
                                @click="granularity = 'day'"
                                :class="[
                                    'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all',
                                    granularity === 'day'
                                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                        : 'text-gray-500 hover:text-gray-700'
                                ]"
                            >
                                <CalendarDays class="w-3 h-3" />
                                <span>Jour</span>
                            </button>
                            <button
                                type="button"
                                @click="granularity = 'hour'"
                                :class="[
                                    'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all',
                                    granularity === 'hour'
                                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                        : 'text-gray-500 hover:text-gray-700'
                                ]"
                            >
                                <Clock class="w-3 h-3" />
                                <span>Heure</span>
                            </button>
                        </div>
                    </div>

                    <!-- Legend -->
                    <div class="flex items-center gap-3 text-[11px]">
                        <div class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded bg-gradient-to-br from-emerald-300 to-emerald-400 ring-1 ring-emerald-500/20"></span>
                            <span class="text-gray-500 font-bold uppercase tracking-wider">Disponible</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded bg-gradient-to-br from-orange-400 to-orange-500 ring-1 ring-orange-600/20"></span>
                            <span class="text-gray-500 font-bold uppercase tracking-wider">Réservé</span>
                        </div>
                    </div>
                </div>

                <!-- Timeline grid -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div v-if="cars.length === 0" class="py-16 text-center">
                        <div class="inline-flex flex-col items-center">
                            <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                <Car class="w-6 h-6 text-gray-300" />
                            </div>
                            <p class="text-gray-400 font-medium">Aucun véhicule dans la flotte.</p>
                        </div>
                    </div>

                    <div
                        v-else
                        class="timeline-scroll"
                        :class="{ 'is-hour-mode': granularity === 'hour' }"
                    >
                        <!-- Header row: car label + day labels -->
                        <div class="timeline-header">
                            <div class="timeline-cars-header">
                                <Car class="w-3.5 h-3.5 text-gray-400" />
                                <span>Véhicule</span>
                            </div>
                            <div class="timeline-days-header">
                                <div
                                    v-for="day in visibleDays"
                                    :key="day.toISOString()"
                                    :class="[
                                        'timeline-day-header',
                                        isToday(day) && 'is-today',
                                        isWeekend(day) && 'is-weekend',
                                    ]"
                                >
                                    <div class="day-name">{{ formatDayName(day) }}</div>
                                    <div class="day-num">{{ formatDayShort(day) }}</div>
                                    <div v-if="granularity === 'hour'" class="day-hours" aria-hidden="true">
                                        <span class="hour-label hour-06">06</span>
                                        <span class="hour-label hour-12">12</span>
                                        <span class="hour-label hour-18">18</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Body rows: one per car -->
                        <div class="timeline-body">
                            <div
                                v-for="car in cars"
                                :key="car.id"
                                class="timeline-row"
                            >
                                <div class="timeline-car-cell">
                                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center shrink-0 ring-1 ring-gray-200/50">
                                        <Car class="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="plate-number">{{ formatPlate(car.plate_number) }}</div>
                                        <div class="car-subtitle">{{ car.brand }} {{ car.model }}</div>
                                    </div>
                                </div>

                                <div class="timeline-track">
                                    <!-- Available (green) day cells -->
                                    <div
                                        v-for="day in visibleDays"
                                        :key="day.toISOString()"
                                        :class="[
                                            'timeline-bg-cell',
                                            isToday(day) && 'is-today',
                                            isWeekend(day) && 'is-weekend',
                                        ]"
                                    ></div>

                                    <!-- Vertical marker at exact "now" position -->
                                    <div
                                        v-if="nowFracDays !== null"
                                        class="today-marker"
                                        :style="{ left: `calc(${nowFracDays} * var(--day-w))` }"
                                    ></div>

                                    <!-- Reservation bars (orange) -->
                                    <div
                                        v-for="seg in getReservationSegments(car.id)"
                                        :key="seg.id"
                                        :class="[
                                            'reservation-bar',
                                            seg.startsBefore && 'starts-before',
                                            seg.endsAfter && 'ends-after',
                                        ]"
                                        :style="{
                                            left: `calc(${seg.leftFracDays} * var(--day-w))`,
                                            width: `calc(${seg.widthFracDays} * var(--day-w))`,
                                        }"
                                        :title="seg.startTime ? `${seg.clientName} · ${seg.startTime} → ${seg.endTime}` : seg.clientName"
                                    >
                                        <span class="reservation-name">{{ seg.clientName }}</span>
                                        <span v-if="seg.startTime" class="reservation-time">
                                            {{ seg.startTime }} → {{ seg.endTime }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- ────────────────────────────────────────── -->
            <!-- LIST VIEW (alternate)                       -->
            <!-- ────────────────────────────────────────── -->
            <template v-else>
                <!-- Desktop Table -->
                <div class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b border-gray-100">
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Voiture & Plaque</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date Début</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date Fin</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Client</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contract ID</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Paiement</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="cars.length === 0">
                                    <td colspan="7" class="px-5 py-16 text-center">
                                        <div class="flex flex-col items-center">
                                            <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                                <Car class="w-6 h-6 text-gray-300" />
                                            </div>
                                            <p class="text-gray-400 font-medium">Aucun véhicule dans la flotte.</p>
                                        </div>
                                    </td>
                                </tr>
                                <tr
                                    v-for="car in cars"
                                    :key="car.id"
                                    class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                                >
                                    <td class="px-5 py-3.5">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <Car class="w-4 h-4 text-gray-500" />
                                            </div>
                                            <div>
                                                <div class="text-sm font-semibold text-gray-900">{{ car.brand }} {{ car.model }}</div>
                                                <div class="text-xs font-bold text-gray-500 font-mono">{{ formatPlate(car.plate_number) }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <template v-if="car.active_reservation">
                                            <div class="flex items-center gap-1.5">
                                                <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                                <span class="text-sm font-bold text-gray-800">{{ formatDateTime(car.active_reservation.start_date) }}</span>
                                            </div>
                                        </template>
                                        <span v-else class="text-sm text-gray-300">—</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <template v-if="car.active_reservation">
                                            <div class="flex items-center gap-1.5">
                                                <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                                <span class="text-sm font-bold text-gray-800">{{ formatDateTime(car.active_reservation.end_date) }}</span>
                                            </div>
                                        </template>
                                        <span v-else class="text-sm text-gray-300">—</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <template v-if="car.active_reservation">
                                            <div class="flex items-center gap-2">
                                                <div class="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                                    <User class="w-3.5 h-3.5 text-gray-500" />
                                                </div>
                                                <span class="text-sm font-semibold text-gray-900">{{ car.active_reservation.client_name }}</span>
                                            </div>
                                        </template>
                                        <span v-else class="text-sm text-gray-300">—</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <template v-if="car.active_reservation && car.active_reservation.contract_number">
                                            <span class="inline-flex px-2 py-0.5 text-xs font-bold text-gray-600 bg-gray-50 rounded-md ring-1 ring-gray-200 font-mono">
                                                {{ car.active_reservation.contract_number }}
                                            </span>
                                        </template>
                                        <span v-else class="text-sm text-gray-300">—</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <template v-if="car.active_reservation">
                                            <span
                                                v-if="(car.active_reservation.total_price - car.active_reservation.advance_payment) <= 0"
                                                class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg ring-1 ring-emerald-200/50"
                                            >
                                                <CircleCheck class="w-3 h-3" />
                                                Payé
                                            </span>
                                            <span
                                                v-else
                                                class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-red-700 bg-red-50 rounded-lg ring-1 ring-red-200/50"
                                            >
                                                <CreditCard class="w-3 h-3" />
                                                {{ (car.active_reservation.total_price - car.active_reservation.advance_payment).toFixed(2) }} DT
                                            </span>
                                        </template>
                                        <span v-else class="text-sm text-gray-300">—</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span :class="getDailyStatus(car).class" class="status-badge">
                                            {{ getDailyStatus(car).text }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Mobile Cards -->
                <div class="md:hidden space-y-3">
                    <div v-if="cars.length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
                        <Car class="w-8 h-8 text-gray-300 mb-3" />
                        <p class="text-gray-400 font-medium">Aucun véhicule.</p>
                    </div>

                    <div
                        v-for="car in cars"
                        :key="car.id"
                        class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden"
                    >
                        <div class="p-4 space-y-2.5">
                            <div class="flex items-start justify-between">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                        <Car class="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-bold text-gray-900">{{ car.brand }} {{ car.model }}</div>
                                        <div class="text-xs font-bold text-gray-500 font-mono">{{ formatPlate(car.plate_number) }}</div>
                                    </div>
                                </div>
                                <span :class="getDailyStatus(car).class" class="status-badge">
                                    {{ getDailyStatus(car).text }}
                                </span>
                            </div>

                            <template v-if="car.active_reservation">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                        <User class="w-4 h-4 text-gray-500" />
                                    </div>
                                    <span class="text-sm font-semibold text-gray-900">{{ car.active_reservation.client_name }}</span>
                                </div>

                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                        <Calendar class="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div class="text-sm text-gray-600">
                                        {{ formatDateTime(car.active_reservation.start_date) }} — {{ formatDateTime(car.active_reservation.end_date) }}
                                    </div>
                                </div>
                            </template>
                        </div>

                        <div v-if="car.active_reservation" class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                            <template v-if="car.active_reservation.contract_number">
                                <span class="inline-flex px-2 py-0.5 text-[11px] font-bold text-gray-500 bg-white rounded-md ring-1 ring-gray-200 font-mono">
                                    {{ car.active_reservation.contract_number }}
                                </span>
                            </template>
                            <span v-else></span>

                            <span
                                v-if="(car.active_reservation.total_price - car.active_reservation.advance_payment) <= 0"
                                class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg ring-1 ring-emerald-200/50"
                            >
                                <CircleCheck class="w-3 h-3" />
                                Payé
                            </span>
                            <span
                                v-else
                                class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-red-700 bg-red-50 rounded-lg ring-1 ring-red-200/50"
                            >
                                {{ (car.active_reservation.total_price - car.active_reservation.advance_payment).toFixed(2) }} DT
                            </span>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
/* ───────────────────────────────────────────────
 * TIMELINE STYLES
 * ─────────────────────────────────────────────── */
.timeline-scroll {
    --day-w: 84px;
    --car-col-w: 220px;
    overflow-x: auto;
    overflow-y: visible;
    position: relative;
}

/* Hour mode: wider day cells so hour ticks fit comfortably */
.timeline-scroll.is-hour-mode {
    --day-w: 192px;
}

@media (max-width: 768px) {
    .timeline-scroll {
        --day-w: 64px;
        --car-col-w: 168px;
    }
    .timeline-scroll.is-hour-mode {
        --day-w: 132px;
    }
}

/* Custom scrollbar */
.timeline-scroll::-webkit-scrollbar {
    height: 8px;
}
.timeline-scroll::-webkit-scrollbar-track {
    background: rgb(249 250 251);
}
.timeline-scroll::-webkit-scrollbar-thumb {
    background: rgb(209 213 219);
    border-radius: 4px;
}
.timeline-scroll::-webkit-scrollbar-thumb:hover {
    background: rgb(156 163 175);
}

/* Header row */
.timeline-header {
    display: flex;
    align-items: stretch;
    background: white;
    border-bottom: 1px solid rgb(243 244 246);
    min-width: max-content;
}

.timeline-cars-header {
    position: sticky;
    left: 0;
    z-index: 4;
    width: var(--car-col-w);
    min-width: var(--car-col-w);
    background: white;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(156 163 175);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-right: 1px solid rgb(243 244 246);
    box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.04);
}

.timeline-days-header {
    display: flex;
}

.timeline-day-header {
    width: var(--day-w);
    flex: none;
    padding: 0.55rem 0.25rem;
    text-align: center;
    border-right: 1px solid rgb(249 250 251);
    transition: background 0.2s;
}

.timeline-day-header.is-weekend {
    background: rgb(249 250 251 / 0.6);
}

.timeline-day-header.is-today {
    background: linear-gradient(180deg, rgb(238 242 255 / 0.7), rgb(238 242 255 / 0.3));
    box-shadow: inset 0 -2px 0 0 rgb(99 102 241);
}

.timeline-day-header .day-name {
    font-size: 0.625rem;
    font-weight: 800;
    color: rgb(156 163 175);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.timeline-day-header.is-today .day-name {
    color: rgb(99 102 241);
}

.timeline-day-header .day-num {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgb(55 65 81);
    margin-top: 2px;
    text-transform: capitalize;
}

.timeline-day-header.is-today .day-num {
    color: rgb(67 56 202);
}

/* Hour-mode: small hour labels under the day name */
.timeline-day-header .day-hours {
    position: relative;
    height: 11px;
    margin-top: 4px;
}

.timeline-day-header .hour-label {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    font-size: 9px;
    font-weight: 800;
    color: rgb(156 163 175);
    letter-spacing: 0.02em;
    line-height: 1;
}

.timeline-day-header.is-today .hour-label {
    color: rgb(99 102 241 / 0.75);
}

.hour-label.hour-06 { left: 25%; }
.hour-label.hour-12 { left: 50%; }
.hour-label.hour-18 { left: 75%; }

/* Body */
.timeline-body {
    min-width: max-content;
}

.timeline-row {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid rgb(249 250 251);
    height: 60px;
}

.timeline-row:last-child {
    border-bottom: none;
}

.timeline-row:hover .timeline-bg-cell {
    filter: brightness(0.97);
}

/* Sticky car label */
.timeline-car-cell {
    position: sticky;
    left: 0;
    z-index: 3;
    width: var(--car-col-w);
    min-width: var(--car-col-w);
    background: white;
    padding: 0 1rem;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    border-right: 1px solid rgb(243 244 246);
    box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.04);
    transition: background 0.2s;
}

.timeline-row:hover .timeline-car-cell {
    background: rgb(238 242 255 / 0.4);
}

/* Plate number is now the visual primary (large, bold, monospaced) */
.timeline-car-cell .plate-number {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.95rem;
    font-weight: 900;
    color: rgb(17 24 39);
    line-height: 1.05;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.timeline-car-cell .car-subtitle {
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgb(107 114 128);
    line-height: 1.2;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (max-width: 768px) {
    .timeline-car-cell .plate-number {
        font-size: 0.85rem;
    }
}

/* Timeline track (where the bars live) */
.timeline-track {
    position: relative;
    display: flex;
    flex: none;
    align-items: stretch;
}

/* Background day cell — green = available */
.timeline-bg-cell {
    width: var(--day-w);
    flex: none;
    background: linear-gradient(180deg, rgb(167 243 208 / 0.55), rgb(110 231 183 / 0.45));
    border-right: 1px solid rgb(255 255 255 / 0.85);
    transition: filter 0.2s;
}

.timeline-bg-cell.is-weekend {
    background: linear-gradient(180deg, rgb(167 243 208 / 0.45), rgb(110 231 183 / 0.35));
}

.timeline-bg-cell.is-today {
    background:
        linear-gradient(180deg, rgb(99 102 241 / 0.07), rgb(99 102 241 / 0.04)),
        linear-gradient(180deg, rgb(167 243 208 / 0.55), rgb(110 231 183 / 0.45));
}

/* Hour-mode: subtle vertical ticks every 6 hours (25%, 50%, 75%) */
.is-hour-mode .timeline-bg-cell {
    background-image:
        linear-gradient(90deg,
            transparent 0,
            transparent calc(25% - 0.5px),
            rgb(255 255 255 / 0.55) 25%,
            transparent calc(25% + 0.5px),
            transparent calc(50% - 0.5px),
            rgb(255 255 255 / 0.85) 50%,
            transparent calc(50% + 0.5px),
            transparent calc(75% - 0.5px),
            rgb(255 255 255 / 0.55) 75%,
            transparent calc(75% + 0.5px),
            transparent),
        linear-gradient(180deg, rgb(167 243 208 / 0.55), rgb(110 231 183 / 0.45));
}

.is-hour-mode .timeline-bg-cell.is-weekend {
    background-image:
        linear-gradient(90deg,
            transparent 0,
            transparent calc(25% - 0.5px),
            rgb(255 255 255 / 0.55) 25%,
            transparent calc(25% + 0.5px),
            transparent calc(50% - 0.5px),
            rgb(255 255 255 / 0.85) 50%,
            transparent calc(50% + 0.5px),
            transparent calc(75% - 0.5px),
            rgb(255 255 255 / 0.55) 75%,
            transparent calc(75% + 0.5px),
            transparent),
        linear-gradient(180deg, rgb(167 243 208 / 0.45), rgb(110 231 183 / 0.35));
}

.is-hour-mode .timeline-bg-cell.is-today {
    background-image:
        linear-gradient(90deg,
            transparent 0,
            transparent calc(25% - 0.5px),
            rgb(255 255 255 / 0.55) 25%,
            transparent calc(25% + 0.5px),
            transparent calc(50% - 0.5px),
            rgb(255 255 255 / 0.85) 50%,
            transparent calc(50% + 0.5px),
            transparent calc(75% - 0.5px),
            rgb(255 255 255 / 0.55) 75%,
            transparent calc(75% + 0.5px),
            transparent),
        linear-gradient(180deg, rgb(99 102 241 / 0.07), rgb(99 102 241 / 0.04)),
        linear-gradient(180deg, rgb(167 243 208 / 0.55), rgb(110 231 183 / 0.45));
}

/* Today vertical marker line */
.today-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 1.5px dashed rgb(99 102 241 / 0.5);
    pointer-events: none;
    z-index: 1;
}

/* Reservation bar — orange = reserved */
.reservation-bar {
    position: absolute;
    top: 8px;
    bottom: 8px;
    background: linear-gradient(135deg, rgb(251 146 60), rgb(249 115 22));
    border-radius: 8px;
    box-shadow:
        0 2px 4px rgba(249, 115, 22, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 0 0.5rem;
    overflow: hidden;
    cursor: default;
    z-index: 2;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.reservation-bar:hover {
    transform: translateY(-1px);
    box-shadow:
        0 4px 10px rgba(249, 115, 22, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    z-index: 3;
}

.reservation-bar.starts-before {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    background: linear-gradient(135deg, rgb(234 88 12), rgb(249 115 22));
}

.reservation-bar.ends-after {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
}

.reservation-name {
    max-width: 100%;
    font-size: 0.75rem;
    font-weight: 800;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
    letter-spacing: 0.01em;
    line-height: 1.1;
}

.reservation-time {
    max-width: 100%;
    font-size: 0.625rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    letter-spacing: 0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

/* ───────────────────────────────────────────────
 * LIST VIEW STATUS BADGES (existing)
 * ─────────────────────────────────────────────── */
.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 0.5rem;
    letter-spacing: 0.025em;
    white-space: nowrap;
}

.status-disponible {
    background: rgb(209 250 229);
    color: rgb(22 101 52);
    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.2);
}

.status-later {
    background: rgb(209 250 229);
    color: rgb(22 101 52);
    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.2);
}

.status-after-tomorrow {
    background: rgb(255 237 213);
    color: rgb(154 52 18);
    box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.2);
}

.status-tomorrow {
    background: rgb(254 226 226);
    color: rgb(153 27 27);
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.2);
}

.status-today {
    background: rgb(220 38 38);
    color: white;
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.3);
    animation: pulse-status 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.status-late {
    background: rgb(127 29 29);
    color: white;
    box-shadow: 0 0 0 2px rgba(127, 29, 29, 0.3);
}

@keyframes pulse-status {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
}
</style>
