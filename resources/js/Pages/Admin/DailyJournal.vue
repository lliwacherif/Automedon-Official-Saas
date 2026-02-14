<script setup lang="ts">
import { onMounted } from 'vue';
import { useCars } from '@/composables/useCars';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { 
    Loader2, 
    CalendarClock, 
    Car, 
    User, 
    Calendar, 
    Hash, 
    CreditCard,
    CircleCheck,
    Clock,
    AlertTriangle,
} from 'lucide-vue-next';

const { t } = useI18n();
const { cars, loading, fetchCars } = useCars();

onMounted(() => {
    fetchCars(); 
});

// Helper to format plate number
function formatPlate(plate: string): string {
    if (!plate) return '';
    return plate.replace(/(\d+)(TN)(\d+)/i, '$1 $2 $3');
}

// Helper to determine status display
function getDailyStatus(car: any) {
    // If not rented, show Available
    if (car.status !== 'loue' || !car.active_reservation) {
        return {
            text: t('admin.fleet.disponible'),
            class: 'status-disponible'
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const res = car.active_reservation;
    
    // Safety check for end_date
    if (!res.end_date) return { text: '-', class: '' };

    const endDate = new Date(res.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    // Calculate difference in days
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        return {
            text: t('daily_journal.return_tomorrow'), 
            class: 'status-tomorrow'
        };
    } else if (diffDays === 2) {
        return {
            text: t('daily_journal.return_after_tomorrow'), 
            class: 'status-after-tomorrow'
        };
    } else if (diffDays > 2) {
        return {
            text: new Date(res.end_date).toLocaleDateString('fr-FR'), 
            class: 'status-later'
        };
    } else if (diffDays === 0) {
        return {
            text: t('daily_journal.return_today'), 
            class: 'status-today'
        };
    } else {
        return {
            text: t('daily_journal.late'), 
            class: 'status-late'
        };
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-200">
                    <CalendarClock class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ t('daily_journal.title') }}</h1>
                    <p class="text-sm text-gray-500">{{ cars.length }} véhicule{{ cars.length !== 1 ? 's' : '' }} dans la flotte</p>
                </div>
            </div>
            
            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement du tableau...</p>
            </div>

            <!-- Desktop Table -->
            <div v-else class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
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
                                <!-- Car -->
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

                                <!-- Start Date -->
                                <td class="px-5 py-3.5">
                                    <template v-if="car.active_reservation">
                                        <div class="flex items-center gap-1.5">
                                            <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                            <span class="text-sm font-bold text-gray-800">{{ formatDateTime(car.active_reservation.start_date) }}</span>
                                        </div>
                                    </template>
                                    <span v-else class="text-sm text-gray-300">—</span>
                                </td>

                                <!-- End Date -->
                                <td class="px-5 py-3.5">
                                    <template v-if="car.active_reservation">
                                        <div class="flex items-center gap-1.5">
                                            <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                            <span class="text-sm font-bold text-gray-800">{{ formatDateTime(car.active_reservation.end_date) }}</span>
                                        </div>
                                    </template>
                                    <span v-else class="text-sm text-gray-300">—</span>
                                </td>

                                <!-- Client -->
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

                                <!-- Contract ID -->
                                <td class="px-5 py-3.5">
                                    <template v-if="car.active_reservation && car.active_reservation.contract_number">
                                        <span class="inline-flex px-2 py-0.5 text-xs font-bold text-gray-600 bg-gray-50 rounded-md ring-1 ring-gray-200 font-mono">
                                            {{ car.active_reservation.contract_number }}
                                        </span>
                                    </template>
                                    <span v-else class="text-sm text-gray-300">—</span>
                                </td>

                                <!-- Payment -->
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

                                <!-- Status -->
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
            <div v-if="!loading" class="md:hidden space-y-3">
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
                        <!-- Car + Status -->
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
                            <!-- Client -->
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <User class="w-4 h-4 text-gray-500" />
                                </div>
                                <span class="text-sm font-semibold text-gray-900">{{ car.active_reservation.client_name }}</span>
                            </div>

                            <!-- Dates -->
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

                    <!-- Footer -->
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
        </div>
    </div>
</template>

<style scoped>
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
