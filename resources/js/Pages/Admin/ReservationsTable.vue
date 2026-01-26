<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useReservations } from '@/composables/useReservations';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { Loader2 } from 'lucide-vue-next';

const { t } = useI18n();
const { reservations, loading, fetchReservations } = useReservations();

onMounted(() => {
    fetchReservations(); // Load all reservations
});
</script>

<template>
    <div class="p-6">
        <h1 class="text-2xl font-bold mb-6 text-gray-800">Tableau des Réservations</h1>
        
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
                                Coût Total
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contract ID
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-if="reservations.length === 0">
                            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                Aucune réservation trouvée.
                            </td>
                        </tr>
                        <tr v-for="res in reservations" :key="res.id" class="hover:bg-gray-50">
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
                             <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                {{ res.total_price.toFixed(2) }} TND
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                NAN
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
