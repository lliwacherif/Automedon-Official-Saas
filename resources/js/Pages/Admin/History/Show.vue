<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { useTenantLink } from '@/composables/useTenantLink';
import type { Database } from '@/types/supabase';
import { 
    ArrowLeft, 
    Car, 
    TrendingUp, 
    TrendingDown, 
    Wallet, 
    ClipboardList, 
    Wrench, 
    Calendar, 
    User, 
    DollarSign, 
    Loader2, 
    X,
    CircleCheck,
} from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { MAINTENANCE_TYPE_LABELS } from '@/composables/useMaintenanceRecords';

// Types
type CarType = Database['public']['Tables']['cars']['Row'];
type Reservation = Database['public']['Tables']['reservations']['Row'];
type Maintenance = Database['public']['Tables']['maintenance_records']['Row'];

const { t } = useI18n();
const { tenantPath } = useTenantLink();

const route = useRoute();
const carId = route.params.id as string;

const car = ref<CarType | null>(null);
const reservations = ref<Reservation[]>([]);
const maintenanceRecords = ref<Maintenance[]>([]);
const loading = ref(true);

const filterStartDate = ref('');
const filterEndDate = ref('');

onMounted(async () => {
    await fetchData();
});

async function fetchData() {
    loading.value = true;
    try {
        const tenantStore = useTenantStore();
        
        // Fetch Car Details
        let carQuery = supabase
            .from('cars')
            .select('*')
            .eq('id', carId);

        if (tenantStore.currentTenant?.id) {
            carQuery = carQuery.eq('tenant_id', tenantStore.currentTenant.id);
        }

        const { data: carData, error: carError } = await carQuery.single();
        
        if (carError) throw carError;
        car.value = carData;

        // Fetch Reservations
        const { data: resData, error: resError } = await supabase
            .from('reservations')
            .select('*')
            .eq('car_id', carId)
            .order('start_date', { ascending: false });
        
        if (resError) throw resError;
        reservations.value = resData || [];

        // Fetch Maintenance Records
        const { data: maintData, error: maintError } = await supabase
            .from('maintenance_records')
            .select('*')
            .eq('car_id', carId)
            .order('maintenance_date', { ascending: false });

        if (maintError) throw maintError;
        maintenanceRecords.value = maintData || [];

    } catch (error) {
        console.error('Error fetching car history:', error);
    } finally {
        loading.value = false;
    }
}

import { formatDate } from '@/utils/date';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(amount);
};

const toMidnight = (dateInput: string | Date | null | undefined): Date | null => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    date.setHours(0, 0, 0, 0);
    return date;
};

const dateInRange = (startStr: string, endStr?: string) => {
    if (!filterStartDate.value && !filterEndDate.value) return true;
    
    // If it's a point-in-time event (like maintenance)
    if (!endStr) {
        const date = toMidnight(startStr)!;
        const filterStart = toMidnight(filterStartDate.value);
        const filterEnd = toMidnight(filterEndDate.value);

        if (filterStart && date < filterStart) return false;
        if (filterEnd && date > filterEnd) return false;
        return true;
    }

    // Interval overlap check: (StartA <= EndB) and (EndA >= StartB)
    const resStart = toMidnight(startStr)!;
    const resEnd = toMidnight(endStr)!;
    const filterStart = toMidnight(filterStartDate.value);
    const filterEnd = toMidnight(filterEndDate.value);

    if (filterEnd && resStart > filterEnd) return false;
    if (filterStart && resEnd < filterStart) return false;
    
    return true;
};

const filteredReservations = computed(() => {
    return reservations.value.filter(res => dateInRange(res.start_date, res.end_date));
});

const filteredMaintenance = computed(() => {
    return maintenanceRecords.value.filter(rec => dateInRange(rec.maintenance_date));
});

const grandTotal = computed(() => {
    if (!filterStartDate.value && !filterEndDate.value) {
        return filteredReservations.value.reduce((sum, res) => sum + (res.total_price || 0), 0);
    }

    return filteredReservations.value.reduce((sum, res) => {
        const resStart = toMidnight(res.start_date)!;
        const resEnd = toMidnight(res.end_date)!;

        const msPerDay = 1000 * 60 * 60 * 24;
        const totalDurationDays = Math.round((resEnd.getTime() - resStart.getTime()) / msPerDay);
        const durationForRate = totalDurationDays > 0 ? totalDurationDays : 1; 
        const dailyRate = (res.total_price || 0) / durationForRate;

        const filterStart = toMidnight(filterStartDate.value) || new Date(-8640000000000000); 
        const filterEnd = toMidnight(filterEndDate.value) || new Date(8640000000000000); 

        const overlapStart = resStart < filterStart ? filterStart : resStart;
        const overlapEnd = resEnd > filterEnd ? filterEnd : resEnd;

        if (overlapStart > overlapEnd) return sum;

        const overlapDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / msPerDay) + 1;
        if (overlapDays <= 0) return sum;

        const revenue = dailyRate * overlapDays;
        return sum + revenue;
    }, 0);
});

const totalMaintenanceCost = computed(() => {
    return filteredMaintenance.value.reduce((sum, rec) => sum + (rec.cost || 0), 0);
});

const netRevenue = computed(() => {
    return grandTotal.value - totalMaintenanceCost.value;
});
</script>

<template>
    <!-- Loading -->
    <div v-if="loading" class="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center">
        <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
        </div>
        <p class="text-gray-500 font-medium">Chargement de l'historique...</p>
    </div>

    <div v-else-if="car" class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Top Bar: Back + Date Filters -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <RouterLink 
                    :to="tenantPath('/admin/history')" 
                    class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
                >
                    <ArrowLeft class="w-4 h-4" />
                    {{ t('admin.history.back_to_list') }}
                </RouterLink>

                <div class="flex items-center gap-3 bg-white rounded-xl ring-1 ring-gray-100 shadow-sm p-2.5">
                    <div class="flex items-center gap-1.5">
                        <label class="text-xs font-bold text-gray-400 uppercase">Du</label>
                        <input 
                            type="date" 
                            v-model="filterStartDate" 
                            class="px-2.5 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" 
                        />
                    </div>
                    <div class="flex items-center gap-1.5">
                        <label class="text-xs font-bold text-gray-400 uppercase">Au</label>
                        <input 
                            type="date" 
                            v-model="filterEndDate" 
                            class="px-2.5 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" 
                        />
                    </div>
                    <button 
                        v-if="filterStartDate || filterEndDate"
                        @click="filterStartDate = ''; filterEndDate = ''"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Réinitialiser"
                    >
                        <X class="w-4 h-4" />
                    </button>
                </div>
            </div>

            <!-- Car Header -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <div class="flex items-center gap-4 p-5">
                    <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center">
                        <img v-if="car.image_url" :src="car.image_url" alt="" class="w-full h-full object-cover">
                        <Car v-else class="w-7 h-7 text-gray-400" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <h2 class="text-xl font-bold text-gray-900 tracking-tight">{{ car.brand }} {{ car.model }}</h2>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="inline-flex px-2.5 py-0.5 text-xs font-bold text-gray-600 bg-gray-50 rounded-lg ring-1 ring-gray-200 font-mono">
                                {{ car.license_plate }}
                            </span>
                            <span 
                                class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg"
                                :class="{
                                    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50': car.status === 'disponible',
                                    'bg-blue-50 text-blue-700 ring-1 ring-blue-200/50': car.status === 'loue',
                                    'bg-red-50 text-red-700 ring-1 ring-red-200/50': car.status === 'maintenance',
                                }"
                            >
                                <CircleCheck v-if="car.status === 'disponible'" class="w-3 h-3" />
                                {{ car.status ? t(`admin.fleet.${car.status}`) : car.status }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <!-- Revenue -->
                <div class="stat-card group">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-500">Revenus</p>
                            <h3 class="text-2xl font-extrabold text-emerald-600 mt-1 tracking-tight">{{ formatCurrency(grandTotal) }}</h3>
                        </div>
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                            <TrendingUp class="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                        {{ filteredReservations.length }} réservation{{ filteredReservations.length !== 1 ? 's' : '' }}
                    </div>
                </div>

                <!-- Expenses -->
                <div class="stat-card group">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-500">Dépenses</p>
                            <h3 class="text-2xl font-extrabold text-red-500 mt-1 tracking-tight">{{ formatCurrency(totalMaintenanceCost) }}</h3>
                        </div>
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-100 group-hover:scale-110 transition-transform">
                            <TrendingDown class="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                        {{ filteredMaintenance.length }} opération{{ filteredMaintenance.length !== 1 ? 's' : '' }}
                    </div>
                </div>

                <!-- Net -->
                <div class="stat-card group">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-500">Revenu Net</p>
                            <h3 
                                class="text-2xl font-extrabold mt-1 tracking-tight"
                                :class="netRevenue >= 0 ? 'text-indigo-600' : 'text-red-600'"
                            >
                                {{ formatCurrency(netRevenue) }}
                            </h3>
                        </div>
                        <div 
                            class="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                            :class="netRevenue >= 0 
                                ? 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-indigo-100' 
                                : 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-100'"
                        >
                            <Wallet class="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                        Revenus - Dépenses
                    </div>
                </div>
            </div>

            <!-- Tables -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

                <!-- Reservations -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <ClipboardList class="w-4 h-4 text-gray-400" />
                            <h3 class="text-base font-bold text-gray-900">{{ t('admin.history.reservations_history') }}</h3>
                        </div>
                        <span class="text-sm font-bold text-emerald-600">{{ formatCurrency(grandTotal) }}</span>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b border-gray-100">
                                    <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{{ t('admin.reservations.client') }}</th>
                                    <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{{ t('admin.reservations.dates') }}</th>
                                    <th class="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">{{ t('admin.reservations.total_price') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="filteredReservations.length === 0">
                                    <td colspan="3" class="px-5 py-12 text-center">
                                        <div class="flex flex-col items-center">
                                            <ClipboardList class="w-6 h-6 text-gray-300 mb-2" />
                                            <p class="text-gray-400 text-sm">{{ t('admin.history.no_reservations') }}</p>
                                        </div>
                                    </td>
                                </tr>
                                <tr 
                                    v-for="res in filteredReservations" 
                                    :key="res.id" 
                                    class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                                >
                                    <td class="px-5 py-3">
                                        <div class="flex items-center gap-2">
                                            <div class="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                                <User class="w-3.5 h-3.5 text-gray-500" />
                                            </div>
                                            <span class="text-sm font-semibold text-gray-900">{{ res.client_name }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3 text-sm text-gray-500">
                                        {{ formatDate(res.start_date) }} - {{ formatDate(res.end_date) }}
                                    </td>
                                    <td class="px-5 py-3 text-right">
                                        <span class="text-sm font-bold text-gray-900">{{ formatCurrency(res.total_price) }}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Maintenance / Costs -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <Wrench class="w-4 h-4 text-gray-400" />
                            <h3 class="text-base font-bold text-gray-900">Historique des Coûts</h3>
                        </div>
                        <span class="text-sm font-bold text-red-500">{{ formatCurrency(totalMaintenanceCost) }}</span>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b border-gray-100">
                                    <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                                    <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th class="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Coût</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="filteredMaintenance.length === 0">
                                    <td colspan="3" class="px-5 py-12 text-center">
                                        <div class="flex flex-col items-center">
                                            <Wrench class="w-6 h-6 text-gray-300 mb-2" />
                                            <p class="text-gray-400 text-sm">Aucun entretien enregistré.</p>
                                        </div>
                                    </td>
                                </tr>
                                <tr 
                                    v-for="rec in filteredMaintenance" 
                                    :key="rec.id" 
                                    class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                                >
                                    <td class="px-5 py-3">
                                        <span class="inline-flex px-2 py-0.5 text-[11px] font-bold rounded-md bg-lime-50 text-lime-700 ring-1 ring-lime-200/50">
                                            {{ MAINTENANCE_TYPE_LABELS[rec.maintenance_type] || rec.maintenance_type }}
                                        </span>
                                    </td>
                                    <td class="px-5 py-3">
                                        <div class="flex items-center gap-1.5">
                                            <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                            <span class="text-sm text-gray-500">{{ formatDate(rec.maintenance_date) }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3 text-right">
                                        <span class="text-sm font-bold text-gray-900">{{ formatCurrency(rec.cost) }}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.stat-card {
    background: white;
    padding: 1.25rem;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(0, 0, 0, 0.02);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.06),
        0 2px 8px rgba(0, 0, 0, 0.04);
    border-color: rgb(229 231 235);
}
</style>
