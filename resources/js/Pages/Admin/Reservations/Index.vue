<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useReservations } from '@/composables/useReservations';
import { useReservationDocuments } from '@/composables/useReservationDocuments';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAppAccess } from '@/composables/useAppAccess';
import { useTenantStore } from '@/stores/tenant';
import UpsellModal from '@/components/Store/UpsellModal.vue';
import { 
    Search, 
    Filter, 
    Calendar, 
    Car, 
    User, 
    FileText, 
    MoreVertical, 
    Edit, 
    Trash2, 
    ChevronDown, 
    ChevronUp,
    Download,
    Eye,
    Lock,
    Plus,
    ClipboardList,
    Loader2,
    Image,
    FileDown,
} from 'lucide-vue-next';

const { t } = useI18n();
const { reservations, loading, fetchReservations, deleteReservation } = useReservations();
const { documents, fetchDocuments } = useReservationDocuments();
const { tenantPath } = useTenantLink();
const { checkAppAccess, fetchAssignedApps } = useAppAccess();
const tenantStore = useTenantStore();
const router = useRouter();

const search = ref('');
const statusFilter = ref('all');
const expandedReservation = ref<number | null>(null);
const showUpsell = ref(false);

onMounted(async () => {
    loadReservations();
    await fetchAssignedApps();
});

async function loadReservations() {
    await fetchReservations(1, search.value, statusFilter.value);
}

function getStatusClass(status: string) {
    switch (status) {
        case 'pending':
            return 'status-pending';
        case 'confirmed':
            return 'status-confirmed';
        case 'active':
            return 'status-active';
        case 'completed':
            return 'status-completed';
        case 'cancelled':
            return 'status-cancelled';
        default:
            return 'status-completed';
    }
}

async function handleDelete(id: number, reservationNumber: string) {
    if (confirm(t('admin.reservations.confirm_delete', { number: reservationNumber }))) {
        await deleteReservation(id);
        loadReservations();
    }
}

async function toggleExpand(id: number) {
    if (expandedReservation.value === id) {
        expandedReservation.value = null;
    } else {
        expandedReservation.value = id;
        await fetchDocuments(id);
    }
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

import { formatDate, formatDateTime } from '@/utils/date';
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <ClipboardList class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ t('admin.reservations.title') }}</h1>
                        <p class="text-sm text-gray-500">{{ reservations.length }} réservation{{ reservations.length !== 1 ? 's' : '' }}</p>
                    </div>
                </div>
                <RouterLink 
                    :to="tenantPath('/admin/reservations/new')" 
                    class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                >
                    <Plus class="w-4 h-4" />
                    {{ t('admin.reservations.new_reservation') }}
                </RouterLink>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                            {{ t('admin.reservations.search') }}
                        </label>
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                v-model="search"
                                @input="loadReservations"
                                type="text"
                                :placeholder="t('admin.reservations.search_placeholder')"
                                class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                            >
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                            {{ t('admin.reservations.status_filter') }}
                        </label>
                        <div class="relative">
                            <Filter class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select 
                                v-model="statusFilter"
                                @change="loadReservations"
                                class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 appearance-none cursor-pointer transition-all"
                            >
                                <option value="all">{{ t('admin.reservations.all_statuses') }}</option>
                                <option value="pending">{{ t('admin.reservations.status_pending') }}</option>
                                <option value="confirmed">{{ t('admin.reservations.status_confirmed') }}</option>
                                <option value="active">{{ t('admin.reservations.status_active') }}</option>
                                <option value="completed">{{ t('admin.reservations.status_completed') }}</option>
                                <option value="cancelled">{{ t('admin.reservations.status_cancelled') }}</option>
                            </select>
                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">{{ t('common.loading') }}...</p>
            </div>

            <!-- Content -->
            <div v-else>

                <!-- Desktop Table -->
                <div class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <table class="min-w-full">
                        <thead>
                            <tr class="border-b border-gray-100">
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('admin.reservations.reservation_number') }}
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('admin.reservations.client') }}
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('admin.reservations.car') }}
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('admin.reservations.dates') }}
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('admin.reservations.total') }}
                                </th>
                                <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('common.status') }}
                                </th>
                                <th class="px-5 py-3.5 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Docs
                                </th>
                                <th class="px-5 py-3.5 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Facture
                                </th>
                                <th class="px-5 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    {{ t('common.actions') }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="reservations.length === 0">
                                <td colspan="9" class="px-5 py-16 text-center">
                                    <div class="flex flex-col items-center">
                                        <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                            <ClipboardList class="w-6 h-6 text-gray-300" />
                                        </div>
                                        <p class="text-gray-400 font-medium">{{ t('admin.reservations.no_reservations') }}</p>
                                    </div>
                                </td>
                            </tr>
                            <template v-for="res in reservations" :key="res.id">
                                <tr 
                                    class="border-b border-gray-50 hover:bg-indigo-50/30 cursor-pointer transition-colors"
                                    @click="toggleExpand(res.id)"
                                >
                                    <td class="px-5 py-3.5">
                                        <span class="text-sm font-bold text-indigo-600">{{ res.reservation_number }}</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <User class="w-4 h-4 text-gray-500" />
                                            </div>
                                            <div>
                                                <div class="text-sm font-semibold text-gray-900">{{ res.client_name }}</div>
                                                <div class="text-xs text-gray-400">{{ res.client_cin }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <Car class="w-4 h-4 text-gray-500" />
                                            </div>
                                            <div>
                                                <div class="text-sm font-semibold text-gray-900">{{ res.car?.brand }} {{ res.car?.model }}</div>
                                                <div class="text-xs text-gray-400">{{ res.car?.plate_number }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <div class="text-sm text-gray-700">{{ formatDateTime(res.start_date) }}</div>
                                        <div class="text-sm text-gray-700">{{ formatDateTime(res.end_date) }}</div>
                                        <div class="text-[11px] text-gray-400 font-medium mt-0.5">{{ res.duration_days }} {{ t('admin.reservations.days') }}</div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span class="text-sm font-bold text-gray-900">${{ res.total_price.toFixed(2) }}</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span :class="getStatusClass(res.status)" class="status-badge">
                                            {{ t(`admin.reservations.status_${res.status}`) }}
                                        </span>
                                    </td>
                                    <td class="px-5 py-3.5 text-center">
                                        <button class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto hover:bg-gray-100 transition-colors">
                                            <ChevronDown 
                                                class="w-4 h-4 text-gray-400 transition-transform duration-200" 
                                                :class="{ 'rotate-180': expandedReservation === res.id }" 
                                            />
                                        </button>
                                    </td>
                                    <td class="px-5 py-3.5 text-center" @click.stop>
                                        <button 
                                            @click="handleInvoiceClick(res)"
                                            class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto hover:bg-indigo-50 transition-colors"
                                            :title="checkAppAccess('Facture Pro') ? 'Générer Facture' : 'Facture Pro requis'"
                                        >
                                            <FileText v-if="checkAppAccess('Facture Pro')" class="w-4 h-4 text-indigo-500" />
                                            <Lock v-else class="w-4 h-4 text-gray-300" />
                                        </button>
                                    </td>
                                    <td class="px-5 py-3.5 text-right" @click.stop>
                                        <div class="flex items-center justify-end gap-1">
                                            <RouterLink 
                                                :to="tenantPath(`/admin/reservations/${res.id}`)" 
                                                class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit class="w-4 h-4 text-indigo-500" />
                                            </RouterLink>
                                            <button 
                                                @click="handleDelete(res.id, res.reservation_number)"
                                                class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 class="w-4 h-4 text-red-400" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Expanded Documents -->
                                <tr v-if="expandedReservation === res.id">
                                    <td colspan="9" class="px-5 py-4 bg-gray-50/70">
                                        <div class="max-w-4xl">
                                            <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                                <FileText class="w-3.5 h-3.5" />
                                                Documents du Contrat
                                            </h4>
                                            <div v-if="documents.length > 0" class="space-y-2">
                                                <div v-for="doc in documents" :key="doc.id" class="flex items-center justify-between bg-white p-3 rounded-xl ring-1 ring-gray-100">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                                            :class="doc.file_name.toLowerCase().endsWith('.pdf') ? 'bg-red-50' : 'bg-indigo-50'"
                                                        >
                                                            <FileText v-if="doc.file_name.toLowerCase().endsWith('.pdf')" class="w-4 h-4 text-red-500" />
                                                            <Image v-else class="w-4 h-4 text-indigo-500" />
                                                        </div>
                                                        <div>
                                                            <div class="text-sm font-semibold text-gray-900">{{ doc.file_name }}</div>
                                                            <div class="text-xs text-gray-400">{{ formatDateTime(doc.uploaded_at) }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center gap-1.5">
                                                        <a 
                                                            :href="doc.file_url" target="_blank" download 
                                                            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                                        >
                                                            <FileDown class="w-3 h-3" />
                                                            Télécharger
                                                        </a>
                                                        <a 
                                                            :href="doc.file_url" target="_blank"
                                                            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 ring-1 ring-gray-200 transition-colors"
                                                        >
                                                            <Eye class="w-3 h-3" />
                                                            Voir
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                            <div v-else class="text-sm text-gray-400 italic py-2">
                                                Aucun document disponible.
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Card View -->
                <div class="md:hidden space-y-3">
                    <div v-if="reservations.length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
                        <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                            <ClipboardList class="w-6 h-6 text-gray-300" />
                        </div>
                        <p class="text-gray-400 font-medium">{{ t('admin.reservations.no_reservations') }}</p>
                    </div>
                    
                    <div 
                        v-for="res in reservations" 
                        :key="res.id" 
                        class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden"
                    >
                        <!-- Card Header -->
                        <div class="p-4 space-y-3">
                            <div class="flex justify-between items-start">
                                <div>
                                    <span class="text-sm font-bold text-indigo-600">#{{ res.reservation_number }}</span>
                                    <div class="text-[11px] text-gray-400 mt-0.5">{{ formatDateTime(res.created_at) }}</div>
                                </div>
                                <span :class="getStatusClass(res.status)" class="status-badge">
                                    {{ t(`admin.reservations.status_${res.status}`) }}
                                </span>
                            </div>

                            <!-- Client -->
                            <div class="flex items-center gap-2.5 pt-2.5 border-t border-gray-100">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <User class="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                    <div class="text-sm font-semibold text-gray-900">{{ res.client_name }}</div>
                                    <div class="text-xs text-gray-400">{{ res.client_phone }}</div>
                                </div>
                            </div>

                            <!-- Car -->
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <Car class="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                    <div class="text-sm font-semibold text-gray-900">{{ res.car?.brand }} {{ res.car?.model }}</div>
                                    <div class="text-xs text-gray-400">{{ res.car?.plate_number }}</div>
                                </div>
                            </div>

                            <!-- Dates -->
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <Calendar class="w-4 h-4 text-gray-500" />
                                </div>
                                <div class="text-sm text-gray-600">
                                    {{ formatDateTime(res.start_date) }} - {{ formatDateTime(res.end_date) }}
                                    <span class="text-xs text-gray-400 ml-1">({{ res.duration_days }}j)</span>
                                </div>
                            </div>
                        </div>

                        <!-- Card Footer -->
                        <div class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                            <div class="text-base font-bold text-gray-900">
                                {{ res.total_price.toFixed(2) }} TND
                            </div>
                            <div class="flex items-center gap-1">
                                <button 
                                    @click="handleInvoiceClick(res)"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                                >
                                    <FileText v-if="checkAppAccess('Facture Pro')" class="w-4 h-4 text-indigo-500" />
                                    <Lock v-else class="w-4 h-4 text-gray-300" />
                                </button>
                                <button 
                                    @click="toggleExpand(res.id)" 
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                                >
                                    <ChevronDown 
                                        class="w-4 h-4 text-gray-400 transition-transform duration-200" 
                                        :class="{ 'rotate-180': expandedReservation === res.id }" 
                                    />
                                </button>
                                <RouterLink 
                                    :to="tenantPath(`/admin/reservations/${res.id}`)" 
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                >
                                    <Edit class="w-4 h-4 text-indigo-500" />
                                </RouterLink>
                                <button 
                                    @click="handleDelete(res.id, res.reservation_number)"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 class="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>

                        <!-- Expanded Documents (Mobile) -->
                        <div v-if="expandedReservation === res.id" class="px-4 py-3 border-t border-gray-100 bg-gray-50/70">
                            <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Documents</h4>
                            <div v-if="documents.length > 0" class="space-y-1.5">
                                <div v-for="doc in documents" :key="doc.id" class="flex items-center justify-between bg-white p-2.5 rounded-xl ring-1 ring-gray-100">
                                    <span class="text-xs font-semibold text-gray-700 truncate max-w-[150px]">{{ doc.file_name }}</span>
                                    <div class="flex items-center gap-1">
                                        <a :href="doc.file_url" target="_blank" download class="w-7 h-7 rounded-md flex items-center justify-center text-indigo-500 hover:bg-indigo-50 transition-colors">
                                            <Download class="w-3.5 h-3.5" />
                                        </a>
                                        <a :href="doc.file_url" target="_blank" class="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                                            <Eye class="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="text-xs text-gray-400 italic text-center py-2">
                                Aucun document.
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
}

.status-pending {
    background: rgb(254 249 195);
    color: rgb(133 77 14);
    box-shadow: inset 0 0 0 1px rgba(202, 138, 4, 0.15);
}

.status-confirmed {
    background: rgb(219 234 254);
    color: rgb(30 64 175);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.15);
}

.status-active {
    background: rgb(209 250 229);
    color: rgb(22 101 52);
    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.15);
}

.status-completed {
    background: rgb(243 244 246);
    color: rgb(55 65 81);
    box-shadow: inset 0 0 0 1px rgba(107, 114, 128, 0.15);
}

.status-cancelled {
    background: rgb(254 226 226);
    color: rgb(153 27 27);
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.15);
}
</style>
