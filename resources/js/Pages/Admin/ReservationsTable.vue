<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useReservations } from '@/composables/useReservations';
import { useI18n } from 'vue-i18n';
import { formatDateTime } from '@/utils/date';
import { Loader2, Edit, FileDown, Lock, FileText, Table, Car, User, Calendar, DollarSign, ClipboardList } from 'lucide-vue-next';
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
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <Table class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Tableau des Réservations</h1>
                        <p class="text-sm text-gray-500">{{ reservations.length }} réservation{{ reservations.length !== 1 ? 's' : '' }} au total</p>
                    </div>
                </div>
                <button 
                    @click="handleExport"
                    :disabled="loading || reservations.length === 0"
                    class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                >
                    <FileDown class="w-4 h-4" />
                    Télécharger Excel
                </button>
            </div>
            
            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement des réservations...</p>
            </div>

            <!-- Table -->
            <div v-else class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full">
                        <thead>
                            <tr class="border-b border-gray-100">
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Voiture & Plaque
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Date Début
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Date Fin
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Client
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Coût Total
                                </th>
                                <th class="px-5 py-3.5 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Facture
                                </th>
                                <th class="px-5 py-3.5 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Modifier
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="reservations.length === 0">
                                <td colspan="7" class="px-5 py-16 text-center">
                                    <div class="flex flex-col items-center">
                                        <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                            <ClipboardList class="w-6 h-6 text-gray-300" />
                                        </div>
                                        <p class="text-gray-400 font-medium">Aucune réservation trouvée.</p>
                                    </div>
                                </td>
                            </tr>
                            <tr 
                                v-for="res in reservations" 
                                :key="res.id" 
                                class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                            >
                                <!-- Car -->
                                <td class="px-5 py-3.5">
                                    <div class="flex items-center gap-2.5">
                                        <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                            <Car class="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div>
                                            <div class="text-sm font-semibold text-gray-900">
                                                {{ res.car?.brand }} {{ res.car?.model }}
                                            </div>
                                            <div class="text-xs text-gray-400 font-mono">
                                                {{ res.car?.plate_number }}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <!-- Start Date -->
                                <td class="px-5 py-3.5">
                                    <div class="flex items-center gap-1.5">
                                        <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                        <span class="text-sm text-gray-600">{{ formatDateTime(res.start_date) }}</span>
                                    </div>
                                </td>

                                <!-- End Date -->
                                <td class="px-5 py-3.5">
                                    <div class="flex items-center gap-1.5">
                                        <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                        <span class="text-sm text-gray-600">{{ formatDateTime(res.end_date) }}</span>
                                    </div>
                                </td>

                                <!-- Client -->
                                <td class="px-5 py-3.5">
                                    <div class="flex items-center gap-2">
                                        <div class="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                            <User class="w-3.5 h-3.5 text-gray-500" />
                                        </div>
                                        <span class="text-sm font-semibold text-gray-900">{{ res.client_name }}</span>
                                    </div>
                                </td>

                                <!-- Cost -->
                                <td class="px-5 py-3.5">
                                    <span class="text-sm font-bold text-gray-900">{{ res.total_price.toFixed(2) }} TND</span>
                                </td>

                                <!-- Invoice -->
                                <td class="px-5 py-3.5 text-center">
                                    <button 
                                        @click="handleInvoiceClick(res)"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto hover:bg-indigo-50 transition-colors"
                                        :title="checkAppAccess('Facture Pro') ? 'Générer Facture' : 'Facture Pro requis'"
                                    >
                                        <FileText v-if="checkAppAccess('Facture Pro')" class="w-4 h-4 text-indigo-500" />
                                        <Lock v-else class="w-4 h-4 text-gray-300" />
                                    </button>
                                </td>

                                <!-- Edit -->
                                <td class="px-5 py-3.5 text-center">
                                    <RouterLink 
                                        :to="tenantPath(`/admin/reservations/${res.id}`)" 
                                        class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto hover:bg-indigo-50 transition-colors"
                                        title="Modifier"
                                    >
                                        <Edit class="w-4 h-4 text-indigo-500" />
                                    </RouterLink>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Mobile Cards -->
            <div class="md:hidden space-y-3" v-if="!loading">
                <div v-if="reservations.length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
                    <ClipboardList class="w-8 h-8 text-gray-300 mb-3" />
                    <p class="text-gray-400 font-medium">Aucune réservation.</p>
                </div>

                <div 
                    v-for="res in reservations" 
                    :key="res.id"
                    class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden"
                >
                    <div class="p-4 space-y-3">
                        <!-- Car -->
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <Car class="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-900">{{ res.car?.brand }} {{ res.car?.model }}</div>
                                <div class="text-xs text-gray-400 font-mono">{{ res.car?.plate_number }}</div>
                            </div>
                        </div>

                        <!-- Client -->
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <User class="w-4 h-4 text-gray-500" />
                            </div>
                            <span class="text-sm font-semibold text-gray-900">{{ res.client_name }}</span>
                        </div>

                        <!-- Dates -->
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <Calendar class="w-4 h-4 text-gray-500" />
                            </div>
                            <div class="text-sm text-gray-600">
                                {{ formatDateTime(res.start_date) }} - {{ formatDateTime(res.end_date) }}
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <span class="text-base font-bold text-gray-900">{{ res.total_price.toFixed(2) }} TND</span>
                        <div class="flex items-center gap-1">
                            <button 
                                @click="handleInvoiceClick(res)"
                                class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                            >
                                <FileText v-if="checkAppAccess('Facture Pro')" class="w-4 h-4 text-indigo-500" />
                                <Lock v-else class="w-4 h-4 text-gray-300" />
                            </button>
                            <RouterLink 
                                :to="tenantPath(`/admin/reservations/${res.id}`)" 
                                class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                            >
                                <Edit class="w-4 h-4 text-indigo-500" />
                            </RouterLink>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <UpsellModal 
            :show="showUpsell" 
            app-name="Facture Pro"
            @close="showUpsell = false" 
        />
    </div>
</template>
