<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useKPI, type PeriodType } from '@/composables/useKPI';
import { useExport } from '@/composables/useExport';
import Chart from 'chart.js/auto';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    TrendingUp, TrendingDown, Wallet, Calendar, Car, ArrowUpRight, ArrowDownRight,
    Loader2, AlertCircle, BarChart3, CircleCheck, CircleX, Wrench,
    Users, AlertTriangle, Trophy, Award, Clock, Hash, Download, FileDown,
    PieChart as PieChartIcon, LineChart as LineChartIcon, Activity, Crown,
    Target, Hourglass, Receipt, FileWarning,
} from 'lucide-vue-next';

const {
    loading, error,
    metrics, fleetStatus,
    revenueChartData, statusChartData, revenueSplitChartData, brandRevenueChartData, maintenanceChartData,
    topCars, topClients, brandBreakdown, maintenanceBreakdown,
    dateRange, periodType,
    setPeriod, setCustomRange, fetchData,
} = useKPI();

const { exportToCsv } = useExport();

// ───────────────────────────────────────────────
// Period switcher + custom date inputs
// ───────────────────────────────────────────────
const periods: { key: PeriodType; label: string }[] = [
    { key: 'week',    label: 'Semaine' },
    { key: 'month',   label: 'Mois' },
    { key: 'quarter', label: 'Trim.' },
    { key: 'year',    label: 'Année' },
];

const customStart = ref(format(dateRange.value.start, 'yyyy-MM-dd'));
const customEnd = ref(format(dateRange.value.end, 'yyyy-MM-dd'));

function applyCustomRange() {
    const s = new Date(customStart.value);
    const e = new Date(customEnd.value);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    setCustomRange(s, e);
}

watch(dateRange, (r) => {
    customStart.value = format(r.start, 'yyyy-MM-dd');
    customEnd.value = format(r.end, 'yyyy-MM-dd');
}, { deep: true });

// ───────────────────────────────────────────────
// Chart canvases
// ───────────────────────────────────────────────
const revenueChartCanvas = ref<HTMLCanvasElement | null>(null);
const statusChartCanvas = ref<HTMLCanvasElement | null>(null);
const splitChartCanvas = ref<HTMLCanvasElement | null>(null);
const brandChartCanvas = ref<HTMLCanvasElement | null>(null);
const maintenanceChartCanvas = ref<HTMLCanvasElement | null>(null);

let revenueChart: Chart | null = null;
let statusChart: Chart | null = null;
let splitChart: Chart | null = null;
let brandChart: Chart | null = null;
let maintenanceChart: Chart | null = null;

onMounted(async () => {
    await fetchData();
    renderCharts();
});

watch(
    [revenueChartData, statusChartData, revenueSplitChartData, brandRevenueChartData, maintenanceChartData],
    () => {
        renderCharts();
    },
);

const tooltip = {
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    titleFont: { size: 13, weight: 'bold' as const },
    bodyFont: { size: 12 },
    padding: 12,
    cornerRadius: 10,
    displayColors: true,
    boxPadding: 4,
};

function renderCharts() {
    if (revenueChartCanvas.value) {
        revenueChart?.destroy();
        revenueChart = new Chart(revenueChartCanvas.value, {
            type: 'line',
            data: revenueChartData.value as any,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 16, font: { size: 11, weight: 'bold' } } },
                    tooltip: { ...tooltip, mode: 'index', intersect: false, callbacks: { label: (c: any) => ` ${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } },
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(243, 244, 246, 0.8)' }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v: any) => formatShortCurrency(v) }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } }, border: { display: false } },
                },
                elements: { line: { tension: 0.4, borderWidth: 2.5 }, point: { radius: 2, hoverRadius: 6, hitRadius: 20 } },
                interaction: { mode: 'nearest', axis: 'x', intersect: false },
            },
        });
    }

    if (statusChartCanvas.value) {
        statusChart?.destroy();
        statusChart = new Chart(statusChartCanvas.value, {
            type: 'doughnut',
            data: statusChartData.value as any,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c: any) => ` ${c.label}: ${c.parsed} véhicule${c.parsed !== 1 ? 's' : ''}` } } },
            },
        });
    }

    if (splitChartCanvas.value) {
        splitChart?.destroy();
        splitChart = new Chart(splitChartCanvas.value, {
            type: 'doughnut',
            data: revenueSplitChartData.value as any,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c: any) => ` ${c.label}: ${formatCurrency(c.parsed)}` } } },
            },
        });
    }

    if (brandChartCanvas.value) {
        brandChart?.destroy();
        brandChart = new Chart(brandChartCanvas.value, {
            type: 'bar',
            data: brandRevenueChartData.value as any,
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c: any) => ` ${formatCurrency(c.parsed.x)}` } } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(243, 244, 246, 0.8)' }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v: any) => formatShortCurrency(v) }, border: { display: false } },
                    y: { grid: { display: false }, ticks: { color: '#374151', font: { size: 12, weight: 'bold' } }, border: { display: false } },
                },
            },
        });
    }

    if (maintenanceChartCanvas.value) {
        maintenanceChart?.destroy();
        maintenanceChart = new Chart(maintenanceChartCanvas.value, {
            type: 'doughnut',
            data: maintenanceChartData.value as any,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c: any) => ` ${c.label}: ${formatCurrency(c.parsed)}` } } },
            },
        });
    }
}

// ───────────────────────────────────────────────
// Formatters
// ───────────────────────────────────────────────
function formatCurrency(v: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(v || 0);
}
function formatShortCurrency(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return `${Math.round(v)}`;
}
function formatPct(v: number, digits = 1): string {
    if (!isFinite(v)) return '—';
    return `${v.toFixed(digits)}%`;
}
function formatDateShort(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return format(d, 'd MMM yyyy', { locale: fr });
}

const dateRangeLabel = computed(() => {
    return `${format(dateRange.value.start, 'd MMM', { locale: fr })} — ${format(dateRange.value.end, 'd MMM yyyy', { locale: fr })}`;
});

// Outstanding balance bar progress
const paidPct = computed(() => Math.max(0, Math.min(100, metrics.value.paidPercentage)));

// ───────────────────────────────────────────────
// CSV export — single comprehensive snapshot
// ───────────────────────────────────────────────
function handleExport() {
    const rangeStr = `${format(dateRange.value.start, 'yyyy-MM-dd')}_to_${format(dateRange.value.end, 'yyyy-MM-dd')}`;

    // Sheet 1: Summary
    const summary = [{
        'Période': dateRangeLabel.value,
        "Chiffre d'Affaires (TND)": metrics.value.totalRevenue.toFixed(2),
        'CA Réservations (TND)': metrics.value.reservationRevenue.toFixed(2),
        'CA Services (TND)': metrics.value.serviceRevenue.toFixed(2),
        'Dépenses Maintenance (TND)': metrics.value.totalExpenses.toFixed(2),
        'Bénéfice Net (TND)': metrics.value.netProfit.toFixed(2),
        'Marge Nette (%)': metrics.value.netMargin.toFixed(1),
        'Réservations': metrics.value.reservationsCount,
        'Services': metrics.value.servicesCount,
        'Total Bookings': metrics.value.totalBookings,
        "Taux d'occupation (%)": metrics.value.occupancyRate.toFixed(1),
        'Durée moyenne (jours)': metrics.value.averageBookingDuration.toFixed(1),
        'Ticket moyen (TND)': metrics.value.averageDailyRate.toFixed(2),
        'Encours impayé (TND)': metrics.value.outstandingBalance.toFixed(2),
        'Réservations impayées': metrics.value.outstandingCount,
        'Annulations': metrics.value.cancelledCount,
        'CA perdu annulations (TND)': metrics.value.cancelledLostRevenue.toFixed(2),
        'Taux annulation (%)': metrics.value.cancellationRate.toFixed(1),
        'Croissance CA (%)': metrics.value.revenueGrowth.toFixed(1),
        'Flotte totale': fleetStatus.value.total,
        'Disponible': fleetStatus.value.available,
        'Loué': fleetStatus.value.rented,
        'Maintenance': fleetStatus.value.maintenance,
    }];
    exportToCsv(`kpi_resume_${rangeStr}.csv`, summary);

    // Sheet 2: Top cars
    if (topCars.value.length > 0) {
        const carsRows = topCars.value.map((r, i) => ({
            'Rang': i + 1,
            'Plaque': r.plate_number,
            'Marque': r.brand,
            'Modèle': r.model,
            'CA (TND)': r.revenue.toFixed(2),
            'Réservations': r.bookings,
            'Jours loués': r.daysRented,
            'Occupation (%)': r.occupancy.toFixed(1),
            'Maintenance (TND)': r.maintenanceCost.toFixed(2),
            'Bénéfice (TND)': r.netProfit.toFixed(2),
        }));
        exportToCsv(`kpi_top_voitures_${rangeStr}.csv`, carsRows);
    }

    // Sheet 3: Top clients
    if (topClients.value.length > 0) {
        const clientRows = topClients.value.map((c, i) => ({
            'Rang': i + 1,
            'Nom': c.name,
            'CIN': c.cin,
            'Réservations': c.bookings,
            'CA (TND)': c.revenue.toFixed(2),
            'Dernière réservation': c.lastBooking ? format(new Date(c.lastBooking), 'yyyy-MM-dd') : '',
        }));
        exportToCsv(`kpi_top_clients_${rangeStr}.csv`, clientRows);
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-6">

            <!-- ──────── Header ──────── -->
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <BarChart3 class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Tableau de Bord KPI</h1>
                        <p class="text-sm text-gray-500">Performance, opérations et clients —
                            <span class="font-semibold text-gray-700 capitalize">{{ dateRangeLabel }}</span>
                        </p>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row md:items-center gap-2.5">
                    <!-- Period switcher -->
                    <div class="flex bg-white rounded-xl p-1 ring-1 ring-gray-200 shadow-sm">
                        <button
                            v-for="p in periods"
                            :key="p.key"
                            type="button"
                            @click="setPeriod(p.key)"
                            class="relative px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap"
                            :class="periodType === p.key
                                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
                        >
                            {{ p.label }}
                        </button>
                    </div>

                    <!-- Custom date range -->
                    <div
                        class="flex items-center bg-white rounded-xl p-1 ring-1 ring-gray-200 shadow-sm gap-1"
                        :class="periodType === 'custom' ? 'ring-indigo-300 ring-2' : ''"
                    >
                        <input
                            type="date"
                            v-model="customStart"
                            class="custom-date-input"
                            aria-label="Date de début"
                        />
                        <span class="text-gray-300">→</span>
                        <input
                            type="date"
                            v-model="customEnd"
                            class="custom-date-input"
                            aria-label="Date de fin"
                        />
                        <button
                            type="button"
                            @click="applyCustomRange"
                            class="px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:text-white hover:bg-indigo-600 bg-indigo-50 rounded-lg transition-colors"
                        >
                            OK
                        </button>
                    </div>

                    <!-- Export -->
                    <button
                        type="button"
                        @click="handleExport"
                        :disabled="loading"
                        class="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <FileDown class="w-3.5 h-3.5" />
                        Exporter CSV
                    </button>
                </div>
            </div>

            <!-- ──────── Loading ──────── -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-24">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement des données...</p>
            </div>

            <!-- ──────── Error ──────── -->
            <div v-else-if="error" class="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl">
                <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
                <span>{{ error }}</span>
            </div>

            <!-- ──────── Dashboard ──────── -->
            <div v-else class="space-y-6">

                <!-- ─── PRIMARY KPI ROW (6 cards) ─── -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

                    <!-- Revenue -->
                    <div class="kpi-card">
                        <div class="flex items-start justify-between">
                            <div class="kpi-card__label">Chiffre d'Affaires</div>
                            <div class="kpi-card__icon kpi-card__icon--emerald"><TrendingUp class="w-4 h-4" /></div>
                        </div>
                        <div class="kpi-card__value">{{ formatCurrency(metrics.totalRevenue) }}</div>
                        <div class="kpi-card__footer">
                            <span class="kpi-growth" :class="metrics.revenueGrowth >= 0 ? 'kpi-growth--up' : 'kpi-growth--down'">
                                <ArrowUpRight v-if="metrics.revenueGrowth >= 0" class="w-3 h-3" />
                                <ArrowDownRight v-else class="w-3 h-3" />
                                {{ formatPct(Math.abs(metrics.revenueGrowth)) }}
                            </span>
                            <span class="text-[11px] text-gray-400">vs préc.</span>
                        </div>
                    </div>

                    <!-- Net Profit -->
                    <div class="kpi-card">
                        <div class="flex items-start justify-between">
                            <div class="kpi-card__label">Bénéfice Net</div>
                            <div class="kpi-card__icon kpi-card__icon--indigo"><Wallet class="w-4 h-4" /></div>
                        </div>
                        <div class="kpi-card__value">{{ formatCurrency(metrics.netProfit) }}</div>
                        <div class="kpi-card__footer">
                            <span class="text-[11px] font-bold text-gray-700">Marge {{ formatPct(metrics.netMargin) }}</span>
                            <span class="text-[11px] text-gray-400">· dépenses {{ formatShortCurrency(metrics.totalExpenses) }}</span>
                        </div>
                    </div>

                    <!-- Bookings -->
                    <div class="kpi-card">
                        <div class="flex items-start justify-between">
                            <div class="kpi-card__label">Réservations</div>
                            <div class="kpi-card__icon kpi-card__icon--blue"><Calendar class="w-4 h-4" /></div>
                        </div>
                        <div class="kpi-card__value">{{ metrics.totalBookings }}</div>
                        <div class="kpi-card__footer">
                            <span class="text-[11px] font-bold text-gray-700">{{ metrics.reservationsCount }}R</span>
                            <span class="text-[11px] text-gray-400">+ {{ metrics.servicesCount }}S · ticket {{ formatShortCurrency(metrics.averageDailyRate) }} TND</span>
                        </div>
                    </div>

                    <!-- Occupancy -->
                    <div class="kpi-card">
                        <div class="flex items-start justify-between">
                            <div class="kpi-card__label">Occupation</div>
                            <div class="kpi-card__icon kpi-card__icon--violet"><Target class="w-4 h-4" /></div>
                        </div>
                        <div class="kpi-card__value">{{ formatPct(metrics.occupancyRate) }}</div>
                        <div class="kpi-card__footer flex-col items-stretch">
                            <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    class="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
                                    :style="{ width: `${Math.min(metrics.occupancyRate, 100)}%` }"
                                ></div>
                            </div>
                            <span class="text-[11px] text-gray-400 mt-1">{{ metrics.rentalDays }}j sur {{ metrics.fleetDays }}j possibles</span>
                        </div>
                    </div>

                    <!-- Outstanding balance -->
                    <div class="kpi-card">
                        <div class="flex items-start justify-between">
                            <div class="kpi-card__label">Encours impayé</div>
                            <div class="kpi-card__icon kpi-card__icon--amber"><Receipt class="w-4 h-4" /></div>
                        </div>
                        <div class="kpi-card__value" :class="metrics.outstandingBalance > 0 ? 'text-amber-700' : ''">
                            {{ formatCurrency(metrics.outstandingBalance) }}
                        </div>
                        <div class="kpi-card__footer flex-col items-stretch">
                            <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                                    :style="{ width: `${paidPct}%` }"
                                ></div>
                            </div>
                            <span class="text-[11px] text-gray-400 mt-1">{{ formatPct(paidPct, 0) }} payé · {{ metrics.outstandingCount }} dossier{{ metrics.outstandingCount !== 1 ? 's' : '' }}</span>
                        </div>
                    </div>

                    <!-- Maintenance / Cancellations -->
                    <div class="kpi-card">
                        <div class="flex items-start justify-between">
                            <div class="kpi-card__label">Maintenance</div>
                            <div class="kpi-card__icon kpi-card__icon--rose"><Wrench class="w-4 h-4" /></div>
                        </div>
                        <div class="kpi-card__value">{{ formatCurrency(metrics.totalExpenses) }}</div>
                        <div class="kpi-card__footer">
                            <span class="kpi-growth" :class="metrics.expensesGrowth <= 0 ? 'kpi-growth--up' : 'kpi-growth--down'">
                                <ArrowDownRight v-if="metrics.expensesGrowth <= 0" class="w-3 h-3" />
                                <ArrowUpRight v-else class="w-3 h-3" />
                                {{ formatPct(Math.abs(metrics.expensesGrowth)) }}
                            </span>
                            <span class="text-[11px] text-gray-400">vs préc.</span>
                        </div>
                    </div>
                </div>

                <!-- ─── REVENUE TREND ─── -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div class="lg:col-span-2 dashboard-card">
                        <div class="dashboard-card__header">
                            <div class="dashboard-card__title">
                                <LineChartIcon class="w-4 h-4 text-indigo-500" />
                                <h3>Évolution du Chiffre d'Affaires</h3>
                            </div>
                            <p class="dashboard-card__subtitle">Réservations + services par jour</p>
                        </div>
                        <div class="px-4 pb-4">
                            <div class="h-72 relative"><canvas ref="revenueChartCanvas"></canvas></div>
                        </div>
                    </div>

                    <!-- Fleet status donut -->
                    <div class="dashboard-card">
                        <div class="dashboard-card__header">
                            <div class="dashboard-card__title">
                                <Car class="w-4 h-4 text-violet-500" />
                                <h3>État de la Flotte</h3>
                            </div>
                            <p class="dashboard-card__subtitle">Répartition actuelle</p>
                        </div>
                        <div class="px-6 pb-2">
                            <div class="h-44 relative flex items-center justify-center">
                                <canvas ref="statusChartCanvas"></canvas>
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div class="text-center">
                                        <p class="text-2xl font-extrabold text-gray-900 tabular-nums">{{ fleetStatus.total }}</p>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Véhicules</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="px-5 pb-5 space-y-2">
                            <div class="legend-row">
                                <span class="legend-dot bg-emerald-500"></span>
                                <span class="legend-label">Disponible</span>
                                <span class="legend-value">{{ fleetStatus.available }}</span>
                                <span v-if="fleetStatus.total" class="legend-pct">{{ formatPct((fleetStatus.available / fleetStatus.total) * 100, 0) }}</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot bg-blue-500"></span>
                                <span class="legend-label">Loué</span>
                                <span class="legend-value">{{ fleetStatus.rented }}</span>
                                <span v-if="fleetStatus.total" class="legend-pct">{{ formatPct((fleetStatus.rented / fleetStatus.total) * 100, 0) }}</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot bg-red-500"></span>
                                <span class="legend-label">Maintenance</span>
                                <span class="legend-value">{{ fleetStatus.maintenance }}</span>
                                <span v-if="fleetStatus.total" class="legend-pct">{{ formatPct((fleetStatus.maintenance / fleetStatus.total) * 100, 0) }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ─── REVENUE SPLIT + BRAND BREAKDOWN ─── -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div class="dashboard-card">
                        <div class="dashboard-card__header">
                            <div class="dashboard-card__title">
                                <PieChartIcon class="w-4 h-4 text-indigo-500" />
                                <h3>Répartition du CA</h3>
                            </div>
                            <p class="dashboard-card__subtitle">Sources de revenu</p>
                        </div>
                        <div class="px-6 pb-2">
                            <div class="h-48 relative flex items-center justify-center">
                                <canvas ref="splitChartCanvas"></canvas>
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div class="text-center">
                                        <p class="text-base font-extrabold text-gray-900 tabular-nums">{{ formatShortCurrency(metrics.totalRevenue) }}</p>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">TND</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="px-5 pb-5 space-y-2">
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #6366F1"></span>
                                <span class="legend-label">Réservations</span>
                                <span class="legend-value">{{ formatShortCurrency(metrics.reservationRevenue) }}</span>
                            </div>
                            <div class="legend-row">
                                <span class="legend-dot" style="background: #10B981"></span>
                                <span class="legend-label">Services</span>
                                <span class="legend-value">{{ formatShortCurrency(metrics.serviceRevenue) }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-2 dashboard-card">
                        <div class="dashboard-card__header">
                            <div class="dashboard-card__title">
                                <Award class="w-4 h-4 text-indigo-500" />
                                <h3>CA par Marque</h3>
                            </div>
                            <p class="dashboard-card__subtitle">Top 8 marques de la flotte</p>
                        </div>
                        <div class="px-4 pb-4">
                            <div v-if="brandRevenueChartData.labels.length === 0" class="h-64 flex items-center justify-center text-sm text-gray-400">
                                Aucune donnée pour cette période.
                            </div>
                            <div v-else class="h-64 relative"><canvas ref="brandChartCanvas"></canvas></div>
                        </div>
                    </div>
                </div>

                <!-- ─── TOP CARS TABLE ─── -->
                <div class="dashboard-card">
                    <div class="dashboard-card__header flex flex-row items-center justify-between">
                        <div>
                            <div class="dashboard-card__title">
                                <Trophy class="w-4 h-4 text-amber-500" />
                                <h3>Top voitures par revenu</h3>
                            </div>
                            <p class="dashboard-card__subtitle">CA, jours loués, occupation, bénéfice</p>
                        </div>
                        <span class="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg ring-1 ring-gray-100">
                            {{ topCars.length }} voitures actives
                        </span>
                    </div>
                    <div v-if="topCars.length === 0" class="px-6 py-12 text-center">
                        <Car class="w-7 h-7 text-gray-300 mx-auto mb-2" />
                        <p class="text-sm text-gray-400">Aucune voiture n'a généré de revenu sur cette période.</p>
                    </div>
                    <div v-else class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead>
                                <tr class="border-y border-gray-100 bg-gray-50/50">
                                    <th class="th-cell w-10">#</th>
                                    <th class="th-cell">Voiture</th>
                                    <th class="th-cell text-right">CA</th>
                                    <th class="th-cell text-right">Réservations</th>
                                    <th class="th-cell text-right">Jours loués</th>
                                    <th class="th-cell">Occupation</th>
                                    <th class="th-cell text-right">Maintenance</th>
                                    <th class="th-cell text-right">Bénéfice</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(car, idx) in topCars.slice(0, 10)"
                                    :key="car.car_id"
                                    class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                                >
                                    <td class="td-cell">
                                        <span
                                            class="rank-badge"
                                            :class="idx === 0 ? 'rank-badge--1' : idx === 1 ? 'rank-badge--2' : idx === 2 ? 'rank-badge--3' : ''"
                                        >
                                            <Crown v-if="idx === 0" class="w-3 h-3" />
                                            <span v-else>{{ idx + 1 }}</span>
                                        </span>
                                    </td>
                                    <td class="td-cell">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 ring-1 ring-gray-200/60 flex items-center justify-center shrink-0">
                                                <Car class="w-3.5 h-3.5 text-gray-500" />
                                            </div>
                                            <div class="min-w-0">
                                                <div class="text-[12px] font-extrabold text-gray-900 font-mono leading-tight tracking-tight">{{ car.plate_number }}</div>
                                                <div class="text-[11px] text-gray-500 font-medium truncate">{{ car.brand }} {{ car.model }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="td-cell text-right font-bold text-gray-900 tabular-nums">{{ formatCurrency(car.revenue) }}</td>
                                    <td class="td-cell text-right text-gray-700 tabular-nums">{{ car.bookings }}</td>
                                    <td class="td-cell text-right text-gray-700 tabular-nums">{{ car.daysRented }}j</td>
                                    <td class="td-cell">
                                        <div class="flex items-center gap-2">
                                            <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                                                <div
                                                    class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                                    :style="{ width: `${Math.min(car.occupancy, 100)}%` }"
                                                ></div>
                                            </div>
                                            <span class="text-[11px] font-bold text-gray-700 tabular-nums">{{ formatPct(car.occupancy, 0) }}</span>
                                        </div>
                                    </td>
                                    <td class="td-cell text-right text-red-500 tabular-nums">{{ car.maintenanceCost > 0 ? formatCurrency(car.maintenanceCost) : '—' }}</td>
                                    <td class="td-cell text-right font-bold tabular-nums" :class="car.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'">
                                        {{ formatCurrency(car.netProfit) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ─── MAINTENANCE BREAKDOWN + TOP CLIENTS ─── -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    <!-- Maintenance breakdown -->
                    <div class="dashboard-card">
                        <div class="dashboard-card__header">
                            <div class="dashboard-card__title">
                                <Wrench class="w-4 h-4 text-rose-500" />
                                <h3>Dépenses Maintenance</h3>
                            </div>
                            <p class="dashboard-card__subtitle">Par type d'intervention</p>
                        </div>
                        <div class="px-6 pb-2">
                            <div v-if="maintenanceBreakdown.length === 0" class="h-48 flex items-center justify-center text-sm text-gray-400">
                                Aucune dépense sur cette période.
                            </div>
                            <div v-else class="h-48 relative flex items-center justify-center">
                                <canvas ref="maintenanceChartCanvas"></canvas>
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div class="text-center">
                                        <p class="text-base font-extrabold text-gray-900 tabular-nums">{{ formatShortCurrency(metrics.totalExpenses) }}</p>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">TND</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="maintenanceBreakdown.length > 0" class="px-5 pb-5 space-y-2">
                            <div
                                v-for="(row, i) in maintenanceBreakdown.slice(0, 5)"
                                :key="row.type"
                                class="legend-row"
                            >
                                <span class="legend-dot" :style="{ background: ['#EF4444','#F59E0B','#6366F1','#10B981','#8B5CF6'][i % 5] }"></span>
                                <span class="legend-label truncate">{{ row.label }}</span>
                                <span class="legend-value">{{ formatShortCurrency(row.cost) }}</span>
                                <span class="legend-pct">{{ row.count }}×</span>
                            </div>
                        </div>
                    </div>

                    <!-- Top clients -->
                    <div class="lg:col-span-2 dashboard-card">
                        <div class="dashboard-card__header flex flex-row items-center justify-between">
                            <div>
                                <div class="dashboard-card__title">
                                    <Users class="w-4 h-4 text-indigo-500" />
                                    <h3>Top clients</h3>
                                </div>
                                <p class="dashboard-card__subtitle">Classés par revenu généré</p>
                            </div>
                            <span class="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg ring-1 ring-gray-100">
                                {{ topClients.length }} clients
                            </span>
                        </div>
                        <div v-if="topClients.length === 0" class="px-6 py-12 text-center">
                            <Users class="w-7 h-7 text-gray-300 mx-auto mb-2" />
                            <p class="text-sm text-gray-400">Aucun client sur cette période.</p>
                        </div>
                        <div v-else class="overflow-x-auto">
                            <table class="min-w-full text-sm">
                                <thead>
                                    <tr class="border-y border-gray-100 bg-gray-50/50">
                                        <th class="th-cell w-10">#</th>
                                        <th class="th-cell">Client</th>
                                        <th class="th-cell text-right">Réservations</th>
                                        <th class="th-cell text-right">CA</th>
                                        <th class="th-cell">Dernière</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="(c, idx) in topClients.slice(0, 8)"
                                        :key="c.cin + idx"
                                        class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                                    >
                                        <td class="td-cell">
                                            <span
                                                class="rank-badge"
                                                :class="idx === 0 ? 'rank-badge--1' : idx === 1 ? 'rank-badge--2' : idx === 2 ? 'rank-badge--3' : ''"
                                            >
                                                <Crown v-if="idx === 0" class="w-3 h-3" />
                                                <span v-else>{{ idx + 1 }}</span>
                                            </span>
                                        </td>
                                        <td class="td-cell">
                                            <div class="flex items-center gap-2.5">
                                                <div class="w-7 h-7 rounded-full bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                                                    {{ c.name.charAt(0) }}
                                                </div>
                                                <div class="min-w-0">
                                                    <div class="text-[12px] font-bold text-gray-900 truncate">{{ c.name }}</div>
                                                    <div class="text-[11px] text-gray-400 font-mono">{{ c.cin }}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="td-cell text-right text-gray-700 tabular-nums">{{ c.bookings }}</td>
                                        <td class="td-cell text-right font-bold text-gray-900 tabular-nums">{{ formatCurrency(c.revenue) }}</td>
                                        <td class="td-cell text-[11px] text-gray-500">{{ formatDateShort(c.lastBooking) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ─── OPERATIONS INSIGHTS ─── -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="insight-card">
                        <div class="insight-card__icon insight-card__icon--violet"><Hourglass class="w-4 h-4" /></div>
                        <div class="insight-card__label">Durée moyenne</div>
                        <div class="insight-card__value">{{ metrics.averageBookingDuration.toFixed(1) }} <span class="text-sm text-gray-400 font-bold">j</span></div>
                        <p class="insight-card__hint">par réservation</p>
                    </div>
                    <div class="insight-card">
                        <div class="insight-card__icon insight-card__icon--blue"><Hash class="w-4 h-4" /></div>
                        <div class="insight-card__label">Ticket moyen</div>
                        <div class="insight-card__value">{{ formatShortCurrency(metrics.averageDailyRate) }}<span class="text-sm text-gray-400 font-bold ml-1">TND</span></div>
                        <p class="insight-card__hint">par booking</p>
                    </div>
                    <div class="insight-card">
                        <div class="insight-card__icon insight-card__icon--rose"><FileWarning class="w-4 h-4" /></div>
                        <div class="insight-card__label">Annulations</div>
                        <div class="insight-card__value">
                            {{ metrics.cancelledCount }}
                            <span class="text-sm text-gray-400 font-bold ml-1">({{ formatPct(metrics.cancellationRate, 0) }})</span>
                        </div>
                        <p class="insight-card__hint">CA perdu {{ formatShortCurrency(metrics.cancelledLostRevenue) }} TND</p>
                    </div>
                    <div class="insight-card">
                        <div class="insight-card__icon insight-card__icon--emerald"><Activity class="w-4 h-4" /></div>
                        <div class="insight-card__label">Marge nette</div>
                        <div class="insight-card__value" :class="metrics.netMargin >= 0 ? 'text-emerald-700' : 'text-red-500'">
                            {{ formatPct(metrics.netMargin) }}
                        </div>
                        <p class="insight-card__hint">{{ formatShortCurrency(metrics.netProfit) }} TND nets</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ─── KPI cards ─── */
.kpi-card {
    background: white;
    padding: 1.125rem;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, border-color 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04);
    border-color: rgb(229 231 235);
}
.kpi-card__label {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgb(107 114 128);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.kpi-card__icon {
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.kpi-card__icon--emerald { background: linear-gradient(135deg, #34d399, #059669); }
.kpi-card__icon--indigo  { background: linear-gradient(135deg, #818cf8, #4f46e5); }
.kpi-card__icon--blue    { background: linear-gradient(135deg, #60a5fa, #2563eb); }
.kpi-card__icon--violet  { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
.kpi-card__icon--amber   { background: linear-gradient(135deg, #fbbf24, #d97706); }
.kpi-card__icon--rose    { background: linear-gradient(135deg, #fb7185, #e11d48); }

.kpi-card__value {
    font-size: 1.375rem;
    font-weight: 800;
    color: rgb(17 24 39);
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    line-height: 1.05;
}
.kpi-card__footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.5rem;
    margin-top: auto;
    border-top: 1px solid rgb(243 244 246);
}

.kpi-growth {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.0625rem 0.375rem;
    font-size: 0.6875rem;
    font-weight: 800;
    border-radius: 0.375rem;
}
.kpi-growth--up   { background: rgb(209 250 229); color: rgb(5 122 85); }
.kpi-growth--down { background: rgb(254 226 226); color: rgb(185 28 28); }

/* ─── Custom date input ─── */
.custom-date-input {
    border: none;
    outline: none;
    background: transparent;
    color: rgb(55 65 81);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.375rem 0.5rem;
    border-radius: 0.5rem;
    font-variant-numeric: tabular-nums;
}
.custom-date-input:focus { background: rgb(238 242 255); }

/* ─── Generic dashboard card ─── */
.dashboard-card {
    background: white;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    overflow: hidden;
}

.dashboard-card__header {
    padding: 1.125rem 1.25rem 0.5rem;
}

.dashboard-card__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.dashboard-card__title h3 {
    font-size: 0.9375rem;
    font-weight: 800;
    color: rgb(17 24 39);
    letter-spacing: -0.005em;
}
.dashboard-card__subtitle {
    font-size: 0.6875rem;
    color: rgb(156 163 175);
    margin-top: 0.125rem;
    margin-left: 1.5rem;
    font-weight: 500;
}

/* ─── Legend ─── */
.legend-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.8125rem;
}
.legend-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    flex-shrink: 0;
}
.legend-label {
    flex: 1;
    color: rgb(75 85 99);
    font-weight: 500;
    min-width: 0;
}
.legend-value {
    font-weight: 800;
    color: rgb(17 24 39);
    font-variant-numeric: tabular-nums;
}
.legend-pct {
    font-size: 0.6875rem;
    color: rgb(156 163 175);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 36px;
    text-align: right;
}

/* ─── Tables ─── */
.th-cell {
    padding: 0.625rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 800;
    color: rgb(107 114 128);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.td-cell {
    padding: 0.75rem 1.25rem;
    color: rgb(31 41 55);
    vertical-align: middle;
}

.rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.5rem;
    background: rgb(243 244 246);
    color: rgb(107 114 128);
    font-size: 0.6875rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}
.rank-badge--1 { background: linear-gradient(135deg, #FCD34D, #F59E0B); color: white; box-shadow: 0 1px 4px rgba(245, 158, 11, 0.35); }
.rank-badge--2 { background: linear-gradient(135deg, #E5E7EB, #9CA3AF); color: white; }
.rank-badge--3 { background: linear-gradient(135deg, #FCA17D, #C2410C); color: white; }

/* ─── Insight cards ─── */
.insight-card {
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
.insight-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
}
.insight-card__icon {
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-bottom: 0.25rem;
}
.insight-card__icon--violet  { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
.insight-card__icon--blue    { background: linear-gradient(135deg, #60a5fa, #2563eb); }
.insight-card__icon--rose    { background: linear-gradient(135deg, #fb7185, #e11d48); }
.insight-card__icon--emerald { background: linear-gradient(135deg, #34d399, #059669); }

.insight-card__label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(107 114 128);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.insight-card__value {
    font-size: 1.25rem;
    font-weight: 800;
    color: rgb(17 24 39);
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
}
.insight-card__hint {
    font-size: 0.6875rem;
    color: rgb(156 163 175);
    font-weight: 500;
}
</style>
