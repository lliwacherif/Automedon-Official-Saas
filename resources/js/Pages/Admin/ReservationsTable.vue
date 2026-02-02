<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useReservations } from '@/composables/useReservations';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { Loader2, Edit, FileDown, Lock, FileText } from 'lucide-vue-next';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink, useRouter } from 'vue-router';
import { useExport } from '@/composables/useExport';
import { useAppAccess } from '@/composables/useAppAccess';
import { useTenantStore } from '@/stores/tenant';
import UpsellModal from '@/components/Store/UpsellModal.vue';

const { t } = useI18n();
const { reservations, loading, fetchReservations } = useReservations();
const { tenantPath } = useTenantLink();
const { exportToCsv } = useExport();
const { checkAppAccess, fetchAssignedApps } = useAppAccess();
const tenantStore = useTenantStore();
const router = useRouter();

// Modal State
const showUpsell = ref(false);

function handleExport() {
    const data = reservations.value.map(res => ({
        'Voiture & Plaque': `${res.car?.brand} ${res.car?.model}\n${res.car?.plate_number}`,
        'Date Début': formatDateTime(res.start_date),
        'Date Fin': formatDateTime(res.end_date),
        'Client': res.client_name,
        'Coût Total': `${res.total_price.toFixed(2)} TND`,
        'Contract ID': res.contract_number || ''
    }));
    exportToCsv(`reservations_${new Date().toISOString().split('T')[0]}.csv`, data);
}

function handleInvoiceClick(reservation: any) {
    if (checkAppAccess('Facture Pro')) {
        // Navigate to Invoice Page
        if (tenantStore.currentTenant?.slug) {
            router.push({ 
                name: 'admin.invoices.build', 
                params: { 
                    tenantSlug: tenantStore.currentTenant.slug,
                    id: reservation.id 
                } 
            });
        }
    } else {
        showUpsell.value = true;
    }
}

onMounted(async () => {
    fetchReservations();
    await fetchAssignedApps();
});
</script>

<template>
    <div class="p-6">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800">Tableau des Réservations</h1>
            <button 
                @click="handleExport"
                :disabled="loading || reservations.length === 0"
                class="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FileDown class="w-4 h-4 mr-2" />
                Télécharger Excel
            </button>
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
                                Coût Total
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Facture
                            </th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Modifier
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-if="reservations.length === 0">
                            <td colspan="7" class="px-6 py-4 text-center text-gray-500">
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
                            <td class="px-6 py-4 whitespace-nowrap text-center">
                                <button 
                                    @click="handleInvoiceClick(res)"
                                    class="text-gray-500 hover:text-indigo-600 focus:outline-none transition-colors"
                                    :title="checkAppAccess('Facture Pro') ? 'Générer Facture' : 'Facture Pro requis'"
                                >
                                    <FileText v-if="checkAppAccess('Facture Pro')" class="h-5 w-5" />
                                    <Lock v-else class="h-4 w-4 text-gray-400" />
                                </button>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                 <RouterLink 
                                    :to="tenantPath(`/admin/reservations/${res.id}`)" 
                                    class="text-indigo-600 hover:text-indigo-900 flex items-center justify-center p-2 rounded-full hover:bg-indigo-50"
                                    title="Modifier"
                                >
                                    <Edit class="h-4 w-4" />
                                </RouterLink>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <UpsellModal 
            :show="showUpsell" 
            app-name="Facture Pro"
            @close="showUpsell = false" 
        />
    </div>
</template>
