<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useReservations, type Reservation } from '@/composables/useReservations';
import { useReservationDocuments } from '@/composables/useReservationDocuments';
import { useCars } from '@/composables/useCars';
import { useTenantLink } from '@/composables/useTenantLink';
import { useReportedClients, type ReportedClient } from '@/composables/useReportedClients';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { useFaithfulClients, type FaithfulClient } from '@/composables/useFaithfulClients';

const { t } = useI18n();
const { searchFaithfulClients } = useFaithfulClients();
const { getReservation, createReservation, updateReservation, checkAvailability } = useReservations();

// Autocomplete State
const clientSuggestions = ref<FaithfulClient[]>([]);
const showClientSuggestions = ref(false);
const isSearchingClients = ref(false);

const handleClientNameInput = async () => {
    const query = reservation.value.client_name;
    if (!query || query.length < 2) {
        clientSuggestions.value = [];
        showClientSuggestions.value = false;
        return;
    }

    isSearchingClients.value = true;
    try {
        const results = await searchFaithfulClients(query);
        clientSuggestions.value = results;
        showClientSuggestions.value = results.length > 0;
    } catch (e) {
        console.error('Error searching clients:', e);
    } finally {
        isSearchingClients.value = false;
    }
};

const selectClient = (client: FaithfulClient) => {
    reservation.value.client_name = client.full_name;
    reservation.value.client_cin = client.cin;
    reservation.value.client_phone = client.phone;
    if (client.email) {
        reservation.value.client_email = client.email;
    }
    
    showClientSuggestions.value = false;
    clientSuggestions.value = [];
};

// Close suggestions when clicking outside (simple version relies on blur with delay)
const closeSuggestionsWithDelay = () => {
    setTimeout(() => {
        showClientSuggestions.value = false;
    }, 200);
};
const { documents, loading: docsLoading, fetchDocuments, uploadDocument, deleteDocument } = useReservationDocuments();
const { cars, fetchCars, updateCar, fetchCarById } = useCars();
const { tenantPath } = useTenantLink();
const { checkClientStatus } = useReportedClients();
const route = useRoute();
const router = useRouter();

const isEditMode = computed(() => !!route.params.id && route.params.id !== 'new');
const loading = ref(false);
const initialLoading = ref(true);
const previewFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const showPreview = ref(false);

// Reported Client State
const reportedClientWarning = ref<ReportedClient | null>(null);
const showReportWarning = ref(false);
const proceededWithReportedClient = ref(false);

const reservation = ref<Partial<Reservation>>({
    client_name: '',
    client_cin: '',
    client_phone: '',
    client_email: '',
    client_permit_number: '',
    second_driver_name: '',
    second_driver_cin: '',
    second_driver_phone: '',
    second_driver_email: '',
    second_driver_permit_number: '',
    start_date: '',
    end_date: '',
    duration_days: 0,
    price_per_day: 0,
    total_price: 0,
    advance_payment: 0,
    car_id: 0,
    status: 'confirmed',
    pickup_location: '',
    return_location: '',
    notes: '',
    contract_number: '',
});

const showSecondDriver = ref(false);

// Helper function to format ISO date to datetime-local format
function formatDateForInput(isoDate: string): string {
    if (!isoDate) return '';
    try {
        const date = new Date(isoDate);
        // Format: YYYY-MM-DDTHH:mm
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
        return '';
    }
}

// Fetch cars and reservation data
onMounted(async () => {
    await fetchCars();
    
    if (isEditMode.value) {
        const data = await getReservation(Number(route.params.id));
        if (data) {
            // Format dates for datetime-local input
            reservation.value = {
                ...data,
                start_date: formatDateForInput(data.start_date),
                end_date: formatDateForInput(data.end_date),
            };
            // Show second driver section if any second driver data exists
            if (data.second_driver_name || data.second_driver_cin || data.second_driver_phone) {
                showSecondDriver.value = true;
            }
            // Fetch documents
            await fetchDocuments(Number(route.params.id));
        }
    }
    
    initialLoading.value = false;
});

// Auto-calculate duration when dates change (skip during initial load)
watch([() => reservation.value.start_date, () => reservation.value.end_date], () => {
    if (initialLoading.value) return;
    
    if (reservation.value.start_date && reservation.value.end_date) {
        const start = new Date(reservation.value.start_date);
        const end = new Date(reservation.value.end_date);
        const diff = end.getTime() - start.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        reservation.value.duration_days = days > 0 ? days : 0;
        calculateTotal();
    }
});

// Auto-calculate total when price per day or duration changes (skip during initial load)
watch([() => reservation.value.price_per_day, () => reservation.value.duration_days], () => {
    if (initialLoading.value) return;
    calculateTotal();
});

// Watcher removed as per user request (check only on submit)


function calculateTotal() {
    const days = reservation.value.duration_days || 0;
    const pricePerDay = reservation.value.price_per_day || 0;
    reservation.value.total_price = days * pricePerDay;
}

const restToPay = computed(() => {
    const total = reservation.value.total_price || 0;
    const advance = reservation.value.advance_payment || 0;
    return Math.max(0, total - advance);
});

async function handleSubmit() {
    loading.value = true;
    try {
        // Validation
        if (!reservation.value.client_name || !reservation.value.client_cin || 
            !reservation.value.client_phone || !reservation.value.car_id ||
            !reservation.value.start_date || !reservation.value.end_date) {
            alert(t('admin.reservations.validation_error'));
            loading.value = false;
            return;
        }

        // Final check for reported client if not already proceeded
        if (!proceededWithReportedClient.value && reservation.value.client_cin) {
             const report = await checkClientStatus(reservation.value.client_cin);
             if (report) {
                 reportedClientWarning.value = report;
                 showReportWarning.value = true;
                 loading.value = false;
                 return;
             }
        }

        if ((reservation.value.duration_days || 0) <= 0) {
            alert(t('admin.reservations.invalid_dates'));
            loading.value = false;
            return;
        }

        const data = {
            client_name: reservation.value.client_name!,
            client_cin: reservation.value.client_cin!,
            client_phone: reservation.value.client_phone!,
            client_email: reservation.value.client_email || null,
            client_permit_number: reservation.value.client_permit_number || null,
            second_driver_name: showSecondDriver.value ? (reservation.value.second_driver_name || null) : null,
            second_driver_cin: showSecondDriver.value ? (reservation.value.second_driver_cin || null) : null,
            second_driver_phone: showSecondDriver.value ? (reservation.value.second_driver_phone || null) : null,
            second_driver_email: showSecondDriver.value ? (reservation.value.second_driver_email || null) : null,
            second_driver_permit_number: showSecondDriver.value ? (reservation.value.second_driver_permit_number || null) : null,
            car_id: reservation.value.car_id!,
            start_date: new Date(reservation.value.start_date!).toISOString(),
            end_date: new Date(reservation.value.end_date!).toISOString(),
            duration_days: reservation.value.duration_days!,
            price_per_day: reservation.value.price_per_day!,
            total_price: reservation.value.total_price!,
            advance_payment: reservation.value.advance_payment || 0,
            status: reservation.value.status || 'confirmed',
            pickup_location: reservation.value.pickup_location || null,
            return_location: reservation.value.return_location || null,
            notes: reservation.value.notes || null,
            contract_number: reservation.value.contract_number || null,
        };

        // Check availability
        const isAvailable = await checkAvailability(
            reservation.value.car_id!,
            data.start_date, // Use the UTC converted date
            data.end_date,   // Use the UTC converted date
            isEditMode.value ? Number(route.params.id) : undefined
        );

        if (!isAvailable) {
            alert(t('admin.reservations.error_dates_conflict') || 'These dates conflict with another confirmed or active reservation.');
            loading.value = false;
            return;
        }

        // Validate 'Active' status - can only be set if start_date is today or in the past
        if (reservation.value.status === 'active') {
            const startDate = new Date(reservation.value.start_date!);
            const now = new Date();
            // Reset hours to ignore time for simple date comparison if needed, 
            // but strict comparison is safer. Let's start with strict timestamp comparison.
            // Actually user said: "only in that future day can make it active"
            // So we check if start_date > now.
            
            if (startDate > now) {
                alert('⚠️ Impossible de mettre le statut sur "Actif" pour une réservation future. Veuillez utiliser "Confirmé".');
                loading.value = false;
                return;
            }
        }

        if (isEditMode.value) {
            await updateReservation(Number(route.params.id), data);
            
            // Update car status based on reservation status
            const carId = reservation.value.car_id || reservation.value.car?.id;
            if (carId && carId > 0) {
                // Check if we're trying to activate this reservation
                if (data.status === 'active') {
                   // Force car status to 'loue'
                    await updateCar(carId, { status: 'loue' });
                    // alert(`✅ Réservation activée.`);
                } else if (data.status === 'completed' || data.status === 'cancelled') {
                    // When reservation is completed or cancelled, car becomes available
                    // BUT only if there isn't another active reservation right now? 
                    // For simplicity, we set it to available. The next active reservation will set it to rented.
                    await updateCar(carId, { status: 'disponible' });
                }
            }
        } else {
             // NO longer checking if selectedCar.status === 'loue' to block.
             
            await createReservation(data);
            const carId = reservation.value.car_id || reservation.value.car?.id;
            if (carId && carId > 0 && data.status === 'active') {
                await updateCar(carId, { status: 'loue' });
            } else {
                alert(t('admin.reservations.saved_success'));
            }
        }
        router.push(tenantPath('/admin/reservations'));
    } catch (error: any) {
        alert(t('admin.reservations.save_error') + ': ' + error.message);
    } finally {
        loading.value = false;
    }
}

// Filter available cars
const availableCars = computed(() => cars.value || []);

async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        previewFile.value = file;
        
        // Create preview URL for images
        if (file.type.startsWith('image/')) {
            previewUrl.value = URL.createObjectURL(file);
        } else {
            previewUrl.value = null;
        }
        
        showPreview.value = true;
        // Clear input
        input.value = '';
    }
}

async function confirmUpload() {
    if (previewFile.value && isEditMode.value && route.params.id) {
        try {
            await uploadDocument(Number(route.params.id), previewFile.value);
            cancelPreview();
        } catch (e) {
            alert(t('admin.reservations.upload_error'));
        }
    }
}

function cancelPreview() {
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
    }
    previewFile.value = null;
    previewUrl.value = null;
    showPreview.value = false;
}

import { formatDateTime } from '@/utils/date';
import DateTimeInput from '@/components/DateTimeInput.vue';
import { 
    ClipboardList, User, CreditCard, Phone, Mail, IdCard, Car, Calendar, Clock, Hash, 
    DollarSign, Wallet, MapPin, FileText, Plus, Minus, Loader2, CircleCheck, 
    AlertTriangle, X, Eye, Trash2, Upload, Image,
    Users, ChevronDown,
} from 'lucide-vue-next';
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-3xl mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                    <ClipboardList class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">
                        {{ isEditMode ? t('admin.reservations.edit_title') : t('admin.reservations.new_title') }}
                    </h1>
                    <p v-if="isEditMode && reservation.reservation_number" class="text-sm text-gray-500">
                        {{ reservation.reservation_number }}
                    </p>
                    <p v-else class="text-sm text-gray-500">Remplissez les informations de la réservation</p>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="initialLoading" class="flex flex-col items-center justify-center py-20 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">{{ t('common.loading') }}...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="handleSubmit" class="space-y-5">

                <!-- Client Information -->
                <div class="form-section">
                    <h2 class="section-title">
                        <div class="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                            <User class="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        {{ t('admin.reservations.client_info') }}
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="form-label">{{ t('admin.reservations.client_name') }} *</label>
                            <div class="relative">
                                <div class="form-input-wrapper">
                                    <User class="form-input-icon" />
                                    <input 
                                        v-model="reservation.client_name"
                                        type="text"
                                        required
                                        @input="handleClientNameInput"
                                        @focus="handleClientNameInput"
                                        @blur="closeSuggestionsWithDelay"
                                        class="form-input"
                                        autocomplete="off"
                                        placeholder="Nom complet"
                                    >
                                </div>
                                <!-- Autocomplete Dropdown -->
                                <div v-if="showClientSuggestions" class="absolute z-10 w-full bg-white mt-1 rounded-xl ring-1 ring-gray-200 shadow-xl max-h-60 overflow-auto">
                                    <ul>
                                        <li 
                                            v-for="client in clientSuggestions" 
                                            :key="client.id"
                                            @mousedown="selectClient(client)" 
                                            class="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                        >
                                            <div class="text-sm font-semibold text-gray-900">{{ client.full_name }}</div>
                                            <div class="text-xs text-gray-400 flex justify-between mt-0.5">
                                                <span>{{ client.cin }}</span>
                                                <span>{{ client.phone }}</span>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="form-label">{{ t('admin.reservations.client_cin') }} *</label>
                            <div class="form-input-wrapper">
                                <CreditCard class="form-input-icon" />
                                <input v-model="reservation.client_cin" type="text" required class="form-input" placeholder="CIN">
                            </div>
                        </div>

                        <div>
                            <label class="form-label">{{ t('admin.reservations.client_phone') }} *</label>
                            <div class="form-input-wrapper">
                                <Phone class="form-input-icon" />
                                <input v-model="reservation.client_phone" type="tel" required class="form-input" placeholder="Téléphone">
                            </div>
                        </div>

                        <div>
                            <label class="form-label">{{ t('admin.reservations.client_email') }}</label>
                            <div class="form-input-wrapper">
                                <Mail class="form-input-icon" />
                                <input v-model="reservation.client_email" type="email" class="form-input" placeholder="Email">
                            </div>
                        </div>

                        <div>
                            <label class="form-label">Numéro de Permis</label>
                            <div class="form-input-wrapper">
                                <IdCard class="form-input-icon" />
                                <input v-model="reservation.client_permit_number" type="text" class="form-input" placeholder="Ex: 12345678">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Second Driver -->
                <div class="form-section">
                    <div class="flex items-center justify-between">
                        <h2 class="section-title">
                            <div class="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                                <Users class="w-3.5 h-3.5 text-violet-600" />
                            </div>
                            Deuxième Conducteur
                        </h2>
                        <button 
                            type="button"
                            @click="showSecondDriver = !showSecondDriver"
                            class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                            :class="showSecondDriver 
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 ring-1 ring-red-200' 
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 ring-1 ring-indigo-200'"
                        >
                            <Minus v-if="showSecondDriver" class="w-3 h-3" />
                            <Plus v-else class="w-3 h-3" />
                            {{ showSecondDriver ? 'Retirer' : 'Ajouter' }}
                        </button>
                    </div>
                    
                    <div v-if="showSecondDriver" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div>
                            <label class="form-label">Nom Complet</label>
                            <div class="form-input-wrapper">
                                <User class="form-input-icon" />
                                <input v-model="reservation.second_driver_name" type="text" class="form-input" placeholder="Nom complet">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">CIN</label>
                            <div class="form-input-wrapper">
                                <CreditCard class="form-input-icon" />
                                <input v-model="reservation.second_driver_cin" type="text" class="form-input" placeholder="CIN">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">Téléphone</label>
                            <div class="form-input-wrapper">
                                <Phone class="form-input-icon" />
                                <input v-model="reservation.second_driver_phone" type="tel" class="form-input" placeholder="Téléphone">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">Email</label>
                            <div class="form-input-wrapper">
                                <Mail class="form-input-icon" />
                                <input v-model="reservation.second_driver_email" type="email" class="form-input" placeholder="Email">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">Numéro de Permis</label>
                            <div class="form-input-wrapper">
                                <IdCard class="form-input-icon" />
                                <input v-model="reservation.second_driver_permit_number" type="text" class="form-input" placeholder="Ex: 12345678">
                            </div>
                        </div>
                    </div>

                    <p v-else class="text-sm text-gray-400 italic mt-2">
                        Aucun deuxième conducteur. Cliquez sur "Ajouter" pour renseigner.
                    </p>
                </div>

                <!-- Reservation Details -->
                <div class="form-section">
                    <h2 class="section-title">
                        <div class="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                            <Car class="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        {{ t('admin.reservations.reservation_details') }}
                    </h2>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="md:col-span-2">
                            <label class="form-label">{{ t('admin.reservations.select_car') }} *</label>
                            <div class="form-input-wrapper">
                                <Car class="form-input-icon" />
                                <select 
                                    v-model="reservation.car_id"
                                    required
                                    :disabled="isEditMode"
                                    class="form-input appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option :value="0">{{ t('admin.reservations.choose_car') }}</option>
                                    <option v-for="car in availableCars" :key="car.id" :value="car.id">
                                        {{ car.brand }} {{ car.model }} - {{ car.plate_number }}
                                    </option>
                                </select>
                                <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label class="form-label">Numéro de Contrat (Max 4)</label>
                            <div class="form-input-wrapper">
                                <Hash class="form-input-icon" />
                                <input 
                                    v-model="reservation.contract_number"
                                    type="text"
                                    maxlength="4"
                                    placeholder="Ex: 1234"
                                    class="form-input uppercase"
                                >
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div>
                            <label class="form-label">{{ t('admin.reservations.start_date') }} *</label>
                            <DateTimeInput v-model="reservation.start_date" :required="true" />
                            <p v-if="reservation.start_date" class="mt-1 text-xs text-indigo-600 font-semibold pl-1">
                                {{ formatDateTime(reservation.start_date) }}
                            </p>
                        </div>
                        <div>
                            <label class="form-label">{{ t('admin.reservations.end_date') }} *</label>
                            <DateTimeInput v-model="reservation.end_date" :required="true" />
                            <p v-if="reservation.end_date" class="mt-1 text-xs text-indigo-600 font-semibold pl-1">
                                {{ formatDateTime(reservation.end_date) }}
                            </p>
                        </div>
                        <div>
                            <label class="form-label">{{ t('admin.reservations.duration') }}</label>
                            <div class="form-input-wrapper bg-gray-50">
                                <Clock class="form-input-icon" />
                                <input v-model="reservation.duration_days" type="number" readonly class="form-input bg-transparent">
                            </div>
                            <p class="text-[11px] text-gray-400 mt-1 pl-1">{{ t('admin.reservations.auto_calculated') }}</p>
                        </div>
                    </div>
                </div>

                <!-- Pricing -->
                <div class="form-section">
                    <h2 class="section-title">
                        <div class="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                            <DollarSign class="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        {{ t('admin.reservations.pricing') }}
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="form-label">{{ t('admin.reservations.price_per_day') }} * (€)</label>
                            <div class="form-input-wrapper">
                                <DollarSign class="form-input-icon" />
                                <input v-model.number="reservation.price_per_day" type="number" step="0.0001" required class="form-input">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">{{ t('admin.reservations.total_price') }} (€)</label>
                            <div class="form-input-wrapper bg-gray-50">
                                <Wallet class="form-input-icon" />
                                <input v-model="reservation.total_price" type="number" step="0.0001" readonly class="form-input bg-transparent text-lg font-bold">
                            </div>
                            <p class="text-[11px] text-gray-400 mt-1 pl-1">{{ t('admin.reservations.auto_calculated') }}</p>
                        </div>
                    </div>

                    <!-- Payment -->
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{{ t('admin.reservations.payment_details') || 'Paiement' }}</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div class="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100">
                                <label class="text-xs font-bold text-indigo-700 mb-1.5 block">Acompte / Avance (€)</label>
                                <input 
                                    v-model.number="reservation.advance_payment"
                                    type="number"
                                    step="0.0001"
                                    class="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                                    placeholder="0.00"
                                >
                            </div>
                            <div 
                                class="p-3.5 rounded-xl ring-1"
                                :class="restToPay > 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 ring-red-200' : 'bg-gradient-to-br from-emerald-50 to-green-50 ring-emerald-200'"
                            >
                                <label class="text-xs font-bold mb-1.5 block" :class="restToPay > 0 ? 'text-red-700' : 'text-emerald-700'">
                                    Reste à Payer (€)
                                </label>
                                <div class="text-2xl font-extrabold tracking-tight" :class="restToPay > 0 ? 'text-red-600' : 'text-emerald-600'">
                                    {{ restToPay.toFixed(2) }} €
                                </div>
                                <p v-if="restToPay === 0" class="text-[11px] text-emerald-600 mt-1 font-bold flex items-center gap-1">
                                    <CircleCheck class="w-3 h-3" /> Payé en totalité
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Status (edit mode only) -->
                <div v-if="isEditMode" class="form-section">
                    <h2 class="section-title">
                        <div class="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
                            <CircleCheck class="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        {{ t('common.status') }}
                    </h2>
                    <div class="max-w-xs">
                        <label class="form-label">{{ t('admin.reservations.status_filter') }}</label>
                        <div class="form-input-wrapper">
                            <CircleCheck class="form-input-icon" />
                            <select v-model="reservation.status" class="form-input appearance-none cursor-pointer">
                                <option value="pending">{{ t('admin.reservations.status_pending') }}</option>
                                <option value="confirmed">{{ t('admin.reservations.status_confirmed') }}</option>
                                <option value="active">{{ t('admin.reservations.status_active') }}</option>
                                <option value="completed">{{ t('admin.reservations.status_completed') }}</option>
                                <option value="cancelled">{{ t('admin.reservations.status_cancelled') }}</option>
                            </select>
                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <div class="mt-2.5 flex items-center gap-2">
                            <span class="text-xs text-gray-400">Actuel:</span>
                            <span 
                                class="status-badge"
                                :class="{
                                    'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50': reservation.status === 'pending',
                                    'bg-blue-50 text-blue-700 ring-1 ring-blue-200/50': reservation.status === 'confirmed',
                                    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50': reservation.status === 'active',
                                    'bg-gray-50 text-gray-600 ring-1 ring-gray-200/50': reservation.status === 'completed',
                                    'bg-red-50 text-red-700 ring-1 ring-red-200/50': reservation.status === 'cancelled'
                                }"
                            >
                                {{ reservation.status }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Documents (edit mode only) -->
                <div v-if="isEditMode" class="form-section">
                    <h2 class="section-title">
                        <div class="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                            <FileText class="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        Documents & Contrats ({{ documents.length }}/3)
                    </h2>
                    
                    <div v-if="documents.length < 3" class="mb-4">
                        <label class="block cursor-pointer">
                            <input 
                                type="file" 
                                accept="image/*,application/pdf"
                                capture="environment"
                                @change="handleFileUpload"
                                class="hidden"
                            >
                            <div class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all">
                                <Upload class="w-4 h-4" />
                                <span class="font-medium">Capturer / Téléverser Contrat</span>
                            </div>
                        </label>
                        <div v-if="docsLoading" class="mt-2 flex items-center gap-2 text-xs text-indigo-600">
                            <Loader2 class="w-3.5 h-3.5 animate-spin" />
                            Téléversement...
                        </div>
                    </div>
                    <div v-else class="mb-4 p-3 bg-amber-50 text-amber-800 rounded-xl text-sm ring-1 ring-amber-200 flex items-center gap-2">
                        <AlertTriangle class="w-4 h-4 shrink-0" />
                        Maximum de 3 documents atteint.
                    </div>

                    <div v-if="documents.length > 0" class="space-y-2">
                        <div v-for="doc in documents" :key="doc.id" class="flex items-center justify-between bg-gray-50 p-3 rounded-xl ring-1 ring-gray-100">
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
                                <a :href="doc.file_url" target="_blank" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors">
                                    <Eye class="w-4 h-4 text-indigo-500" />
                                </a>
                                <button @click="deleteDocument(doc.id, doc.file_url)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                                    <Trash2 class="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-sm text-gray-400 italic">
                        Aucun document téléversé.
                    </div>
                </div>

                <!-- Optional Fields -->
                <div class="form-section">
                    <h2 class="section-title">
                        <div class="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                            <MapPin class="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        {{ t('admin.reservations.optional') }}
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="form-label">{{ t('admin.reservations.pickup_location') }}</label>
                            <div class="form-input-wrapper">
                                <MapPin class="form-input-icon" />
                                <input v-model="reservation.pickup_location" type="text" class="form-input" placeholder="Lieu de prise en charge">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">{{ t('admin.reservations.return_location') }}</label>
                            <div class="form-input-wrapper">
                                <MapPin class="form-input-icon" />
                                <input v-model="reservation.return_location" type="text" class="form-input" placeholder="Lieu de retour">
                            </div>
                        </div>
                    </div>
                    <div class="mt-3">
                        <label class="form-label">{{ t('admin.reservations.notes') }}</label>
                        <div class="form-input-wrapper items-start">
                            <FileText class="form-input-icon mt-2.5" />
                            <textarea v-model="reservation.notes" rows="2" class="form-input" placeholder="Notes..."></textarea>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button 
                        type="button"
                        @click="router.push(tenantPath('/admin/reservations'))"
                        class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 rounded-xl ring-1 ring-gray-200 transition-all"
                    >
                        {{ t('common.cancel') }}
                    </button>
                    <button 
                        type="submit"
                        :disabled="loading"
                        class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                    >
                        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
                        <CircleCheck v-else class="w-4 h-4" />
                        {{ loading ? t('common.saving') : t('common.save') }}
                    </button>
                </div>
            </form>

            <!-- Preview Modal -->
            <Teleport to="body">
                <Transition name="modal">
                    <div v-if="showPreview" class="fixed inset-0 z-50 overflow-y-auto">
                        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="cancelPreview"></div>
                        <div class="flex min-h-full items-center justify-center p-4">
                            <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
                                <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 class="text-base font-bold text-gray-900">Aperçu du document</h3>
                                    <button @click="cancelPreview" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                        <X class="w-5 h-5" />
                                    </button>
                                </div>
                                <div class="p-6">
                                    <div v-if="previewUrl" class="mb-4 rounded-xl overflow-hidden ring-1 ring-gray-200">
                                        <img :src="previewUrl" alt="Preview" class="w-full h-auto" />
                                    </div>
                                    <div v-else class="mb-4 p-8 bg-gray-50 rounded-xl text-center">
                                        <FileText class="w-12 h-12 mx-auto text-indigo-400 mb-2" />
                                        <p class="text-sm font-semibold text-gray-900">{{ previewFile?.name }}</p>
                                        <p class="text-xs text-gray-400 mt-1">{{ ((previewFile?.size || 0) / 1024 / 1024).toFixed(2) }} MB</p>
                                    </div>
                                    <div class="flex justify-end gap-3">
                                        <button @click="cancelPreview" class="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all">
                                            Annuler
                                        </button>
                                        <button 
                                            @click="confirmUpload"
                                            :disabled="docsLoading"
                                            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl shadow-md shadow-indigo-200 disabled:opacity-50 transition-all"
                                        >
                                            <Loader2 v-if="docsLoading" class="w-4 h-4 animate-spin" />
                                            {{ docsLoading ? 'Téléversement...' : 'Confirmer' }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>

            <!-- Reported Client Warning Modal -->
            <Teleport to="body">
                <Transition name="modal">
                    <div v-if="showReportWarning" class="fixed inset-0 z-50 overflow-y-auto">
                        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
                        <div class="flex min-h-full items-center justify-center p-4">
                            <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                                <div class="p-6">
                                    <div class="flex items-center gap-3 mb-4">
                                        <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                            <AlertTriangle class="w-5 h-5 text-red-600" />
                                        </div>
                                        <h3 class="text-lg font-bold text-red-600">{{ t('reports.warning_title') }}</h3>
                                    </div>
                                    
                                    <p class="text-gray-800 font-medium mb-2 text-sm">
                                        {{ t('reports.warning_message', { cin: reportedClientWarning?.client_cin }) }}
                                    </p>
                                    
                                    <div class="bg-red-50 p-3 rounded-xl mb-4 text-sm text-gray-700 ring-1 ring-red-200">
                                        <span class="font-bold">{{ t('reports.description') }}:</span> <br/>
                                        "{{ reportedClientWarning?.description }}"
                                    </div>
                                    
                                    <p class="text-gray-500 mb-5 text-sm">
                                        {{ t('reports.warning_description', { reason: reportedClientWarning?.description }) }}
                                    </p>
                                    
                                    <div class="flex justify-end gap-3">
                                        <button 
                                            @click="showReportWarning = false; loading = false;"
                                            class="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all"
                                        >
                                            {{ t('reports.cancel_reservation') }}
                                        </button>
                                        <button 
                                            @click="showReportWarning = false; proceededWithReportedClient = true; handleSubmit();"
                                            class="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl shadow-md shadow-red-200 transition-all"
                                        >
                                            {{ t('reports.confirm_anyway') }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>
        </div>
    </div>
</template>

<style scoped>
.form-section {
    background: white;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02);
    padding: 1.25rem;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: rgb(17 24 39);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.form-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgb(55 65 81);
    margin-bottom: 0.3rem;
}

.form-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid rgb(229 231 235);
    border-radius: 0.75rem;
    transition: all 0.15s ease;
    overflow: hidden;
}

.form-input-wrapper:focus-within {
    border-color: rgb(129 140 248);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-input-icon {
    width: 1rem;
    height: 1rem;
    color: rgb(156 163 175);
    margin-left: 0.75rem;
    flex-shrink: 0;
}

.form-input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    font-size: 0.875rem;
    color: rgb(17 24 39);
    background: transparent;
    border: none;
    outline: none;
}

.form-input::placeholder {
    color: rgb(156 163 175);
}

.status-badge {
    display: inline-flex;
    padding: 0.2rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 0.375rem;
    text-transform: capitalize;
}

/* Modal animation */
.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-container { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-container { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-container { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-container { opacity: 0; transform: scale(0.97) translateY(5px); }
</style>
