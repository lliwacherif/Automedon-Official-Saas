<script setup lang="ts">
import { onMounted } from 'vue';
import { useCars } from '@/composables/useCars';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { Loader2, CalendarClock } from 'lucide-vue-next';

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
            text: t('admin.fleet.disponible'), // "Disponible"
            class: 'bg-green-100 text-green-800 border border-green-200 font-bold'
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
        // Returns tomorrow
        return {
            text: t('daily_journal.return_tomorrow'), 
            class: 'bg-red-100 text-red-800 border border-red-200 font-bold'
        };
    } else if (diffDays === 2) {
        // Returns after tomorrow
        return {
            text: t('daily_journal.return_after_tomorrow'), 
            class: 'bg-orange-100 text-orange-800 border border-orange-200 font-bold'
        };
    } else if (diffDays > 2) {
        // Returns later (show date)
        // Extract date part only for cleaner display? formatDateTime includes time usually.
        // Assuming formatDateTime handles it well or we prefer date string.
        return {
            text: new Date(res.end_date).toLocaleDateString('fr-FR'), 
            class: 'bg-green-100 text-green-800 border border-green-200 font-bold'
        };
    } else if (diffDays === 0) {
         // Returns Today
        return {
            text: t('daily_journal.return_today'), 
            class: 'bg-red-600 text-white font-bold animate-pulse'
        };
    } else {
        // Overdue
         return {
            text: t('daily_journal.late'), 
            class: 'bg-red-800 text-white font-bold'
        };
    }
}
</script>

<template>
    <div class="p-6">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800 flex items-center">
                <CalendarClock class="w-8 h-8 mr-3 text-indigo-600" />
                {{ t('daily_journal.title') }}
            </h1>
        </div>
        
        <div v-if="loading" class="flex justify-center py-12">
            <Loader2 class="animate-spin h-8 w-8 text-indigo-600" />
        </div>

        <div v-else class="bg-white shadow-md rounded-lg overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Voiture & Plaque
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date Début
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date Fin
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Client
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contract ID
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Paiement
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Statut
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-if="cars.length === 0">
                            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                Aucun véhicule dans la flotte.
                            </td>
                        </tr>
                        <tr v-for="car in cars" :key="car.id" class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900">
                                    {{ car.brand }} {{ car.model }}
                                </div>
                                <div class="text-sm font-bold text-gray-700">
                                    {{ formatPlate(car.plate_number) }}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                {{ car.active_reservation ? formatDateTime(car.active_reservation.start_date) : '-' }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                {{ car.active_reservation ? formatDateTime(car.active_reservation.end_date) : '-' }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900">
                                    {{ car.active_reservation ? car.active_reservation.client_name : '-' }}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                {{ car.active_reservation ? (car.active_reservation.contract_number || '-') : '-' }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <template v-if="car.active_reservation">
                                    <span v-if="(car.active_reservation.total_price - car.active_reservation.advance_payment) <= 0" class="text-green-600 font-bold">
                                        Payé
                                    </span>
                                    <span v-else class="text-red-600 font-bold">
                                        Reste: {{ (car.active_reservation.total_price - car.active_reservation.advance_payment).toFixed(2) }} DT
                                    </span>
                                </template>
                                <span v-else>-</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <span 
                                    :class="getDailyStatus(car).class"
                                    class="px-2 py-1 inline-flex text-xs leading-5 rounded-full"
                                >
                                    {{ getDailyStatus(car).text }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
