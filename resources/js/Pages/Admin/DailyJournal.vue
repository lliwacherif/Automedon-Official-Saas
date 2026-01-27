<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useReservations } from '@/composables/useReservations';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { Loader2, CalendarClock } from 'lucide-vue-next';

const { t } = useI18n();
const { reservations, loading, fetchReservations } = useReservations();

// Filter for only 'active' (Loué) reservations
// "Loué" cars are those with status 'active' OR 'confirmed' but currently ongoing (start_date <= now)
const activeReservations = computed(() => {
    const now = new Date();
    return reservations.value.filter(res => {
        if (res.status === 'active') return true;
        
        if (res.status === 'confirmed') {
             const startDate = new Date(res.start_date);
             // If start date is in the past (or now), it's considered active/loué
             return startDate <= now;
        }
        
        return false;
    });
});

onMounted(() => {
    fetchReservations(); 
});

// Helper to determine status display
function getDailyStatus(res: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
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
         return {
            text: formatDateTime(res.end_date), 
            class: 'bg-green-100 text-green-800 border border-green-200 font-bold'
        };
    } else if (diffDays === 0) {
         // Returns Today
        return {
            text: t('daily_journal.return_today'), 
            class: 'bg-red-600 text-white font-bold animate-pulse'
        };
    } else {
        // Overdue?
         return {
            text: t('daily_journal.late'), 
            class: 'bg-red-800 text-white font-bold'
        };
    }
    
    // Fallback logic
    return {
        text: t(`admin.reservations.status_${res.status}`),
        class: 'bg-gray-100 text-gray-800'
    };
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
                                Statut
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-if="activeReservations.length === 0">
                            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                Aucune voiture louée actuellement.
                            </td>
                        </tr>
                        <tr v-for="res in activeReservations" :key="res.id" class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900">
                                    {{ res.car?.brand }} {{ res.car?.model }}
                                </div>
                                <div class="text-xs text-gray-500">
                                    {{ res.car?.plate_number }}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {{ formatDateTime(res.start_date) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {{ formatDateTime(res.end_date) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900">{{ res.client_name }}</div>
                            </td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                {{ res.contract_number || '-' }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <span 
                                    :class="getDailyStatus(res).class"
                                    class="px-2 py-1 inline-flex text-xs leading-5 rounded-full"
                                >
                                    {{ getDailyStatus(res).text }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
