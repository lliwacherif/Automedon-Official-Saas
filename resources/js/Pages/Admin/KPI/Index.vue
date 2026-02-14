<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useKPI } from '@/composables/useKPI';
import Chart from 'chart.js/auto';
import { format } from 'date-fns';
import { 
    TrendingUp, 
    Wallet, 
    Calendar, 
    Car, 
    ArrowUpRight, 
    ArrowDownRight,
    Loader2,
    AlertCircle,
    BarChart3,
    CircleCheck,
    CircleX,
    Wrench,
} from 'lucide-vue-next';

const { 
    loading, 
    error, 
    metrics, 
    fleetStatus, 
    revenueChartData, 
    statusChartData, 
    dateRange, 
    periodType, 
    setPeriod, 
    fetchData 
} = useKPI();

const revenueChartCanvas = ref<HTMLCanvasElement | null>(null);
const statusChartCanvas = ref<HTMLCanvasElement | null>(null);
let revenueChartInstance: Chart | null = null;
let statusChartInstance: Chart | null = null;

onMounted(async () => {
    await fetchData();
    renderCharts();
});

watch([revenueChartData, statusChartData], () => {
    renderCharts();
});

function renderCharts() {
    if (revenueChartCanvas.value) {
        if (revenueChartInstance) revenueChartInstance.destroy();
        revenueChartInstance = new Chart(revenueChartCanvas.value, {
            type: 'line',
            data: revenueChartData.value,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        mode: 'index', 
                        intersect: false,
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(243, 244, 246, 0.8)' },
                        ticks: { color: '#9ca3af', font: { size: 11 } },
                        border: { display: false },
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#9ca3af', font: { size: 11 } },
                        border: { display: false },
                    }
                },
                elements: {
                    line: { tension: 0.4, borderWidth: 2.5 },
                    point: { radius: 3, hoverRadius: 6, hitRadius: 20 }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false,
                }
            }
        });
    }

    if (statusChartCanvas.value) {
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statusChartCanvas.value, {
            type: 'doughnut',
            data: statusChartData.value,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 10,
                    }
                }
            }
        });
    }
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(value);
};

const periods = [
    { key: 'week', label: 'Semaine' },
    { key: 'month', label: 'Mois' },
    { key: 'year', label: 'Année' },
];
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-6">

            <!-- Header -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <BarChart3 class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Tableau de Bord KPI</h1>
                        <p class="text-sm text-gray-500">Analysez la performance de votre flotte</p>
                    </div>
                </div>
                
                <!-- Period Selector -->
                <div class="flex bg-white rounded-xl p-1 ring-1 ring-gray-200 shadow-sm">
                    <button 
                        v-for="p in periods"
                        :key="p.key"
                        @click="setPeriod(p.key as any)"
                        class="relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap"
                        :class="periodType === p.key 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
                    >
                        {{ p.label }}
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement des données...</p>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl">
                <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
                <span>{{ error }}</span>
            </div>

            <div v-else class="space-y-6">

                <!-- Summary Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                    <!-- Revenue Card -->
                    <div class="kpi-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Chiffre d'Affaires</p>
                                <h3 class="text-2xl font-extrabold text-gray-900 mt-1.5 tracking-tight">{{ formatCurrency(metrics.totalRevenue) }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                                <TrendingUp class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-4 pt-3 border-t border-gray-100 flex items-center text-sm">
                            <span 
                                class="font-bold flex items-center"
                                :class="metrics.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'"
                            >
                                <ArrowUpRight v-if="metrics.revenueGrowth >= 0" class="w-4 h-4 mr-0.5" />
                                <ArrowDownRight v-else class="w-4 h-4 mr-0.5" />
                                {{ Math.abs(metrics.revenueGrowth) }}%
                            </span>
                            <span class="text-gray-400 ml-2 text-xs">vs période préc.</span>
                        </div>
                    </div>

                    <!-- Net Profit Card -->
                    <div class="kpi-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Bénéfice Net</p>
                                <h3 class="text-2xl font-extrabold text-gray-900 mt-1.5 tracking-tight">{{ formatCurrency(metrics.netProfit) }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                                <Wallet class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-4 pt-3 border-t border-gray-100 text-sm">
                            <span class="text-gray-400 text-xs">Dépenses:</span>
                            <span class="font-bold text-red-500 ml-1">{{ formatCurrency(metrics.totalExpenses) }}</span>
                        </div>
                    </div>

                    <!-- Bookings Card -->
                    <div class="kpi-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Réservations</p>
                                <h3 class="text-2xl font-extrabold text-gray-900 mt-1.5 tracking-tight">{{ metrics.totalBookings }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                                <Calendar class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-4 pt-3 border-t border-gray-100">
                            <div class="flex items-center justify-between text-sm mb-1.5">
                                <span class="text-gray-400 text-xs">Taux d'occupation</span>
                                <span class="font-bold text-gray-900">{{ metrics.occupancyRate.toFixed(1) }}%</span>
                            </div>
                            <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    class="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
                                    :style="{ width: `${Math.min(metrics.occupancyRate, 100)}%` }"
                                ></div>
                            </div>
                        </div>
                    </div>

                    <!-- Fleet Card -->
                    <div class="kpi-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Flotte Totale</p>
                                <h3 class="text-2xl font-extrabold text-gray-900 mt-1.5 tracking-tight">{{ fleetStatus.total }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-100 group-hover:scale-110 transition-transform">
                                <Car class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg ring-1 ring-emerald-200/50">
                                <CircleCheck class="w-3 h-3" />
                                {{ fleetStatus.available }}
                            </span>
                            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg ring-1 ring-blue-200/50">
                                <CircleX class="w-3 h-3" />
                                {{ fleetStatus.rented }}
                            </span>
                            <span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-lg ring-1 ring-amber-200/50">
                                <Wrench class="w-3 h-3" />
                                {{ fleetStatus.maintenance }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Charts -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    <!-- Revenue Chart -->
                    <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
                        <div class="px-6 pt-5 pb-2 flex items-center justify-between">
                            <div>
                                <h3 class="text-base font-bold text-gray-900">Évolution du Chiffre d'Affaires</h3>
                                <p class="text-xs text-gray-400 mt-0.5">Revenus sur la période sélectionnée</p>
                            </div>
                            <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                <TrendingUp class="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                        <div class="px-4 pb-4">
                            <div class="h-72 relative">
                                <canvas ref="revenueChartCanvas"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Fleet Status Chart -->
                    <div class="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
                        <div class="px-6 pt-5 pb-2">
                            <h3 class="text-base font-bold text-gray-900">État de la Flotte</h3>
                            <p class="text-xs text-gray-400 mt-0.5">Répartition actuelle</p>
                        </div>
                        <div class="px-6 pb-2">
                            <div class="h-48 relative flex items-center justify-center">
                                <canvas ref="statusChartCanvas"></canvas>
                                <!-- Center label -->
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div class="text-center">
                                        <p class="text-2xl font-extrabold text-gray-900">{{ fleetStatus.total }}</p>
                                        <p class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Véhicules</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Legend -->
                        <div class="px-6 pb-5 space-y-2.5">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                    <span class="text-sm text-gray-600">Disponible</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-bold text-gray-900">{{ fleetStatus.available }}</span>
                                    <span v-if="fleetStatus.total" class="text-xs text-gray-400">
                                        ({{ ((fleetStatus.available / fleetStatus.total) * 100).toFixed(0) }}%)
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                    <span class="text-sm text-gray-600">Loué</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-bold text-gray-900">{{ fleetStatus.rented }}</span>
                                    <span v-if="fleetStatus.total" class="text-xs text-gray-400">
                                        ({{ ((fleetStatus.rented / fleetStatus.total) * 100).toFixed(0) }}%)
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                    <span class="text-sm text-gray-600">Maintenance</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-bold text-gray-900">{{ fleetStatus.maintenance }}</span>
                                    <span v-if="fleetStatus.total" class="text-xs text-gray-400">
                                        ({{ ((fleetStatus.maintenance / fleetStatus.total) * 100).toFixed(0) }}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.kpi-card {
    background: white;
    padding: 1.25rem;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(0, 0, 0, 0.02);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.06),
        0 2px 8px rgba(0, 0, 0, 0.04);
    border-color: rgb(229 231 235);
}
</style>
