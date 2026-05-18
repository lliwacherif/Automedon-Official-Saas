<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useReservations, type Reservation } from '@/composables/useReservations';
import { useReservationDocuments } from '@/composables/useReservationDocuments';
import { useCars } from '@/composables/useCars';
import { useTenantLink } from '@/composables/useTenantLink';
import { useReportedClients, type ReportedClient } from '@/composables/useReportedClients';
import { useContractAI } from '@/composables/useContractAI';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { useFaithfulClients, type FaithfulClient } from '@/composables/useFaithfulClients';

const { t } = useI18n();
const { searchFaithfulClients, isFaithfulClientCinRegistered, createFaithfulClient } = useFaithfulClients();
const { getReservation, createReservation, updateReservation, checkAvailability } = useReservations();

// Autocomplete State
const clientSuggestions = ref<FaithfulClient[]>([]);
const showClientSuggestions = ref(false);
const isSearchingClients = ref(false);
// Which field opened the dropdown — controls which input it sits under.
const clientAutocompleteAnchor = ref<'name' | 'ci' | null>(null);

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
        clientAutocompleteAnchor.value = 'name';
    } catch (e) {
        console.error('Error searching clients:', e);
    } finally {
        isSearchingClients.value = false;
    }
};

const handleClientCinInput = async () => {
    const query = reservation.value.client_cin;
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
        clientAutocompleteAnchor.value = 'ci';
    } catch (e) {
        console.error('Error searching clients by CIN:', e);
    } finally {
        isSearchingClients.value = false;
    }
};

const selectClient = (client: FaithfulClient) => {
    reservation.value.client_name = client.full_name;
    reservation.value.client_cin = client.cin;
    // Only overwrite optional fields if the faithful client actually has them,
    // so the admin doesn't lose a manually-typed value to an empty record.
    if (client.phone) reservation.value.client_phone = client.phone;
    if (client.email) reservation.value.client_email = client.email;
    if (client.permit_number) reservation.value.client_permit_number = client.permit_number;
    if (client.cin_date) reservation.value.client_cin_date = client.cin_date;
    if (client.permit_date) reservation.value.client_permit_date = client.permit_date;
    if (client.address) reservation.value.client_address = client.address;

    showClientSuggestions.value = false;
    clientSuggestions.value = [];
    clientAutocompleteAnchor.value = null;
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

const { isAnalyzing, analysisError, filledFieldsCount, analyzeContract, hasSecondDriver } = useContractAI();

const isEditMode = computed(() => !!route.params.id && route.params.id !== 'new');
const loading = ref(false);
const initialLoading = ref(true);
const previewFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const showPreview = ref(false);

// AI Contract Scanner State
const showAiScan = ref(false);
const aiScanFile = ref<File | null>(null);
const aiScanPreviewUrl = ref<string | null>(null);
const aiScanStep = ref<'upload' | 'analyzing' | 'done' | 'error'>('upload');
const aiDragOver = ref(false);

function openAiScan() {
    showAiScan.value = true;
    aiScanStep.value = 'upload';
    aiScanFile.value = null;
    aiScanPreviewUrl.value = null;
    analysisError.value = null;
}

function closeAiScan() {
    if (aiScanPreviewUrl.value) {
        URL.revokeObjectURL(aiScanPreviewUrl.value);
    }
    showAiScan.value = false;
    aiScanFile.value = null;
    aiScanPreviewUrl.value = null;
    aiScanStep.value = 'upload';
    aiDragOver.value = false;
}

function handleAiFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        setAiFile(input.files[0]);
        input.value = '';
    }
}

function handleAiDrop(event: DragEvent) {
    aiDragOver.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
        setAiFile(file);
    }
}

function setAiFile(file: File) {
    if (aiScanPreviewUrl.value) {
        URL.revokeObjectURL(aiScanPreviewUrl.value);
    }
    aiScanFile.value = file;
    aiScanPreviewUrl.value = URL.createObjectURL(file);
}

async function startAiAnalysis() {
    if (!aiScanFile.value) return;
    aiScanStep.value = 'analyzing';

    try {
        const result = await analyzeContract(aiScanFile.value, cars.value || []);
        applyAiResult(result);
        aiScanStep.value = 'done';
    } catch {
        aiScanStep.value = 'error';
    }
}

function applyAiResult(result: Partial<Reservation>) {
    for (const [key, value] of Object.entries(result)) {
        if (value != null && value !== '' && key in reservation.value) {
            (reservation.value as any)[key] = value;
        }
    }

    if (hasSecondDriver(result)) {
        showSecondDriver.value = true;
    }
}

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
    client_cin_date: '',
    client_permit_date: '',
    client_address: '',
    second_driver_name: '',
    second_driver_cin: '',
    second_driver_phone: '',
    second_driver_email: '',
    second_driver_permit_number: '',
    second_driver_cin_date: '',
    second_driver_permit_date: '',
    second_driver_address: '',
    start_date: '',
    end_date: '',
    duration_days: 0,
    price_per_day: 0,
    total_price: 0,
    advance_payment: 0,
    caution: 0,
    caution_currency: 'DT',
    car_id: 0,
    status: 'confirmed',
    pickup_location: '',
    return_location: '',
    notes: '',
    contract_number: '',
    agency_id: null as number | null,
});

const showSecondDriver = ref(false);

// ──────────────────────────────────────────────────────────────────
// "Save as Client Fidèle?" proposal — triggered from handleSubmit on
// click of "Enregistrer", NOT on typing. Sweeps in every filled
// client_* field so the new faithful client is fully populated.
// Never fires in edit mode or agency mode.
// ──────────────────────────────────────────────────────────────────
const showSuggestRegisterModal = ref(false);
const suggestRegisterPayload = ref<{
    full_name: string;
    cin: string;
    phone?: string;
    email?: string;
    permit_number?: string;
    cin_date?: string;
    permit_date?: string;
    address?: string;
} | null>(null);
const suggestRegisterLoading = ref(false);
const suggestRegisterError = ref<string | null>(null);
const suggestRegisterSuccess = ref<string | null>(null);
const suggestRegisterDismissedCins = ref<Set<string>>(new Set());
const suggestRegisterKnownCins = ref<Set<string>>(new Set());
// Resolves the maybeProposeRegisterClient() promise once the user
// makes a decision (save, skip, dismiss). Lets handleSubmit await it.
let suggestRegisterResolver: (() => void) | null = null;

async function maybeProposeRegisterClient(): Promise<void> {
    if (isEditMode.value) return;
    if (clientMode.value === 'agency') return;
    if (showSuggestRegisterModal.value) return;

    const fullName = (reservation.value.client_name || '').trim();
    const cin = (reservation.value.client_cin || '').trim();
    if (!fullName || !cin || cin.length < 4) return;
    if (suggestRegisterDismissedCins.value.has(cin)) return;
    if (suggestRegisterKnownCins.value.has(cin)) return;

    const registered = await isFaithfulClientCinRegistered(cin);
    if (registered === null) return;
    if (registered === true) {
        suggestRegisterKnownCins.value.add(cin);
        return;
    }

    // Show the modal and wait for the user's choice before resolving.
    return new Promise<void>((resolve) => {
        suggestRegisterPayload.value = {
            full_name: fullName,
            cin,
            phone: (reservation.value.client_phone || '').trim() || undefined,
            email: (reservation.value.client_email || '').trim() || undefined,
            permit_number: (reservation.value.client_permit_number || '').trim() || undefined,
            cin_date: (reservation.value.client_cin_date || '').trim() || undefined,
            permit_date: (reservation.value.client_permit_date || '').trim() || undefined,
            address: (reservation.value.client_address || '').trim() || undefined,
        };
        suggestRegisterError.value = null;
        suggestRegisterSuccess.value = null;
        suggestRegisterResolver = resolve;
        showSuggestRegisterModal.value = true;
    });
}

function dismissSuggestRegister() {
    if (suggestRegisterPayload.value) {
        suggestRegisterDismissedCins.value.add(suggestRegisterPayload.value.cin);
    }
    showSuggestRegisterModal.value = false;
    suggestRegisterError.value = null;
    // Let handleSubmit continue with the actual reservation save.
    const r = suggestRegisterResolver;
    suggestRegisterResolver = null;
    if (r) r();
}

async function confirmSuggestRegister() {
    if (!suggestRegisterPayload.value || suggestRegisterLoading.value) return;
    suggestRegisterLoading.value = true;
    suggestRegisterError.value = null;

    const p = suggestRegisterPayload.value;
    // Naive split of full_name → first/last for the search index, matching how
    // the existing Clients Fidèles form does it on creation.
    const parts = p.full_name.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || undefined;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

    try {
        await createFaithfulClient({
            full_name: p.full_name,
            first_name: firstName,
            last_name: lastName,
            cin: p.cin,
            phone: p.phone,
            email: p.email,
            permit_number: p.permit_number,
            cin_date: p.cin_date,
            permit_date: p.permit_date,
            address: p.address,
        });
        suggestRegisterKnownCins.value.add(p.cin);
        suggestRegisterSuccess.value = p.full_name;
        setTimeout(() => {
            showSuggestRegisterModal.value = false;
            suggestRegisterSuccess.value = null;
            // Continue the outer handleSubmit flow after the brief success state.
            const r = suggestRegisterResolver;
            suggestRegisterResolver = null;
            if (r) r();
        }, 1400);
    } catch (e: any) {
        suggestRegisterError.value = e?.message || "Erreur lors de l'enregistrement du client fidèle.";
    } finally {
        suggestRegisterLoading.value = false;
    }
}

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
    await Promise.all([fetchCars(), fetchB2BClients()]);
    
    if (isEditMode.value) {
        const data = await getReservation(Number(route.params.id));
        if (data) {
            reservation.value = {
                ...data,
                start_date: formatDateForInput(data.start_date),
                end_date: formatDateForInput(data.end_date),
            };
            if (data.second_driver_name || data.second_driver_cin || data.second_driver_phone) {
                showSecondDriver.value = true;
            }
            if ((data as any).agency_id) {
                clientMode.value = 'agency';
                selectedAgencyId.value = (data as any).agency_id;
            }
            await fetchDocuments(Number(route.params.id));
        }
    } else {
        const preselectedCarId = route.query.car_id;
        if (preselectedCarId) {
            reservation.value.car_id = Number(preselectedCarId);
        }
    }
    
    initialLoading.value = false;
});

// Hours of grace allowed past a full day before counting an extra day.
// E.g. picking up at 09:00 and returning at 11:30 the next day = 1 day.
// Returning at 12:30 the next day (>3h overrun) = 2 days.
const RETURN_HOURS_GRACE = 3;

// Auto-calculate duration when dates change (skip during initial load)
watch([() => reservation.value.start_date, () => reservation.value.end_date], () => {
    if (initialLoading.value) return;

    if (reservation.value.start_date && reservation.value.end_date) {
        const start = new Date(reservation.value.start_date);
        const end = new Date(reservation.value.end_date);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        // Any positive duration counts as at least 1 day. After that, only
        // overruns strictly greater than RETURN_HOURS_GRACE roll into +1 day.
        const days = diffHours > 0
            ? Math.max(1, Math.ceil((diffHours - RETURN_HOURS_GRACE) / 24))
            : 0;
        reservation.value.duration_days = days;
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
        // Validation — client_phone is optional now.
        if (!reservation.value.client_name || !reservation.value.client_cin ||
            !reservation.value.car_id ||
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

        // Propose registering this client as a Client Fidèle if their CIN
        // isn't already on file. The user can save them or skip — either
        // way the reservation save flow continues right after.
        await maybeProposeRegisterClient();

        if ((reservation.value.duration_days || 0) <= 0) {
            alert(t('admin.reservations.invalid_dates'));
            loading.value = false;
            return;
        }

        const data = {
            client_name: reservation.value.client_name!,
            client_cin: reservation.value.client_cin!,
            client_phone: (reservation.value.client_phone || '').trim() || null,
            client_email: reservation.value.client_email || null,
            client_permit_number: reservation.value.client_permit_number || null,
            client_cin_date: reservation.value.client_cin_date || null,
            client_permit_date: reservation.value.client_permit_date || null,
            client_address: reservation.value.client_address || null,
            second_driver_name: showSecondDriver.value ? (reservation.value.second_driver_name || null) : null,
            second_driver_cin: showSecondDriver.value ? (reservation.value.second_driver_cin || null) : null,
            second_driver_phone: showSecondDriver.value ? (reservation.value.second_driver_phone || null) : null,
            second_driver_email: showSecondDriver.value ? (reservation.value.second_driver_email || null) : null,
            second_driver_permit_number: showSecondDriver.value ? (reservation.value.second_driver_permit_number || null) : null,
            second_driver_cin_date: showSecondDriver.value ? (reservation.value.second_driver_cin_date || null) : null,
            second_driver_permit_date: showSecondDriver.value ? (reservation.value.second_driver_permit_date || null) : null,
            second_driver_address: showSecondDriver.value ? (reservation.value.second_driver_address || null) : null,
            car_id: reservation.value.car_id!,
            start_date: new Date(reservation.value.start_date!).toISOString(),
            end_date: new Date(reservation.value.end_date!).toISOString(),
            duration_days: reservation.value.duration_days!,
            price_per_day: reservation.value.price_per_day!,
            total_price: reservation.value.total_price!,
            advance_payment: reservation.value.advance_payment || 0,
            caution: reservation.value.caution || 0,
            caution_currency: reservation.value.caution_currency || 'DT',
            status: reservation.value.status || 'confirmed',
            pickup_location: reservation.value.pickup_location || null,
            return_location: reservation.value.return_location || null,
            notes: reservation.value.notes || null,
            contract_number: reservation.value.contract_number || null,
            agency_id: clientMode.value === 'agency' ? selectedAgencyId.value : null,
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
import { useB2BClients, type B2BClient } from '@/composables/useB2BClients';
import { 
    ClipboardList, User, CreditCard, Phone, Mail, IdCard, Car, Calendar, Clock, Hash, 
    DollarSign, Wallet, MapPin, FileText, Plus, Minus, Loader2, CircleCheck, 
    AlertTriangle, X, Eye, Trash2, Upload, Image,
    Users, ChevronDown, Sparkles, ScanLine, CheckCircle2, RotateCcw, Building2,
    BookmarkPlus, UserPlus, AlertCircle, Check,
} from 'lucide-vue-next';

const { clients: b2bClients, fetchClients: fetchB2BClients } = useB2BClients();
const clientMode = ref<'regular' | 'agency'>('regular');
const selectedAgencyId = ref<number | null>(null);

function selectAgency(idStr: string) {
    const agency = b2bClients.value.find(b => String(b.id) === idStr);
    if (agency) {
        selectedAgencyId.value = agency.id;
        reservation.value.client_name = agency.company_name;
        reservation.value.client_cin = agency.mf || '';
        reservation.value.client_phone = agency.phone || '';
        reservation.value.client_email = agency.email || '';
        reservation.value.client_permit_number = '';
        reservation.value.client_address = agency.address || '';
    } else {
        selectedAgencyId.value = null;
    }
}

function clearAgency() {
    clientMode.value = 'regular';
    selectedAgencyId.value = null;
    reservation.value.client_name = '';
    reservation.value.client_cin = '';
    reservation.value.client_phone = '';
    reservation.value.client_email = '';
    reservation.value.client_permit_number = '';
    reservation.value.client_address = '';
}
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-3xl mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center justify-between">
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

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        @click="clientMode === 'agency' ? clearAgency() : (clientMode = 'agency')"
                        class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl ring-1 transition-all"
                        :class="clientMode === 'agency' 
                            ? 'text-indigo-700 bg-indigo-50 ring-indigo-300 hover:bg-indigo-100' 
                            : 'text-violet-700 bg-violet-50 ring-violet-300 hover:bg-violet-100'"
                    >
                        <User v-if="clientMode === 'agency'" class="w-4 h-4" />
                        <Building2 v-else class="w-4 h-4" />
                        <span class="hidden sm:inline">{{ clientMode === 'agency' ? 'Client' : 'Agences' }}</span>
                    </button>
                    <button
                        v-if="!isEditMode"
                        type="button"
                        @click="openAiScan"
                        class="ai-scan-btn group relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98]"
                    >
                        <span class="ai-scan-btn-bg"></span>
                        <Sparkles class="w-4 h-4 relative z-10" />
                        <span class="relative z-10 hidden sm:inline">AI Scan</span>
                        <ScanLine class="w-4 h-4 relative z-10 hidden sm:inline" />
                    </button>
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
                        <div class="w-6 h-6 rounded-md flex items-center justify-center" :class="clientMode === 'agency' ? 'bg-violet-100' : 'bg-indigo-100'">
                            <Building2 v-if="clientMode === 'agency'" class="w-3.5 h-3.5 text-violet-600" />
                            <User v-else class="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        {{ clientMode === 'agency' ? 'Informations Agence' : t('admin.reservations.client_info') }}
                    </h2>

                    <!-- Agency Selector -->
                    <div v-if="clientMode === 'agency'" class="p-3 rounded-xl bg-violet-50 ring-1 ring-violet-200 mb-3">
                        <label class="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1.5 block">Sélectionner une Agence</label>
                        <div class="form-input-wrapper">
                            <Building2 class="form-input-icon" />
                            <select 
                                @change="selectAgency(($event.target as HTMLSelectElement).value)" 
                                class="form-input appearance-none cursor-pointer"
                                :value="selectedAgencyId ? String(selectedAgencyId) : ''"
                            >
                                <option value="">-- Choisir une agence --</option>
                                <option v-for="b in b2bClients" :key="b.id" :value="String(b.id)">{{ b.company_name }}</option>
                            </select>
                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="form-label">{{ clientMode === 'agency' ? 'Nom Agence *' : t('admin.reservations.client_name') + ' *' }}</label>
                            <div class="relative">
                                <div class="form-input-wrapper">
                                    <Building2 v-if="clientMode === 'agency'" class="form-input-icon" />
                                    <User v-else class="form-input-icon" />
                                    <input 
                                        v-model="reservation.client_name"
                                        type="text"
                                        required
                                        @input="clientMode !== 'agency' ? handleClientNameInput() : undefined"
                                        @focus="clientMode !== 'agency' ? handleClientNameInput() : undefined"
                                        @blur="closeSuggestionsWithDelay"
                                        class="form-input"
                                        autocomplete="off"
                                        :placeholder="clientMode === 'agency' ? 'Nom de l\'agence' : 'Nom complet'"
                                    >
                                </div>
                                <!-- Autocomplete Dropdown anchored under the Name field -->
                                <div v-if="showClientSuggestions && clientMode !== 'agency' && clientAutocompleteAnchor === 'name'" class="absolute z-10 w-full bg-white mt-1 rounded-xl ring-1 ring-gray-200 shadow-xl max-h-60 overflow-auto">
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
                            <label class="form-label">{{ clientMode === 'agency' ? 'MF / Référence *' : t('admin.reservations.client_cin') + ' *' }}</label>
                            <div class="relative">
                                <div class="form-input-wrapper">
                                    <CreditCard class="form-input-icon" />
                                    <input
                                        v-model="reservation.client_cin"
                                        type="text"
                                        required
                                        @input="clientMode !== 'agency' ? handleClientCinInput() : undefined"
                                        @focus="clientMode !== 'agency' ? handleClientCinInput() : undefined"
                                        @blur="closeSuggestionsWithDelay"
                                        class="form-input"
                                        autocomplete="off"
                                        :placeholder="clientMode === 'agency' ? 'Matricule Fiscale' : 'CIN'"
                                    >
                                </div>
                                <!-- Autocomplete Dropdown anchored under the CIN field -->
                                <div v-if="showClientSuggestions && clientMode !== 'agency' && clientAutocompleteAnchor === 'ci'" class="absolute z-10 w-full bg-white mt-1 rounded-xl ring-1 ring-gray-200 shadow-xl max-h-60 overflow-auto">
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
                            <label class="form-label">{{ t('admin.reservations.client_phone') }} <span class="text-[10px] font-medium text-gray-400 normal-case ml-1">(optionnel)</span></label>
                            <div class="form-input-wrapper">
                                <Phone class="form-input-icon" />
                                <input v-model="reservation.client_phone" type="tel" class="form-input" placeholder="Téléphone">
                            </div>
                        </div>

                        <div>
                            <label class="form-label">{{ t('admin.reservations.client_email') }}</label>
                            <div class="form-input-wrapper">
                                <Mail class="form-input-icon" />
                                <input v-model="reservation.client_email" type="email" class="form-input" placeholder="Email">
                            </div>
                        </div>

                        <div v-if="clientMode !== 'agency'">
                            <label class="form-label">Numéro de Permis</label>
                            <div class="form-input-wrapper">
                                <IdCard class="form-input-icon" />
                                <input v-model="reservation.client_permit_number" type="text" class="form-input" placeholder="Ex: 12345678">
                            </div>
                        </div>

                        <div v-if="clientMode !== 'agency'">
                            <label class="form-label">Date de délivrance CIN</label>
                            <div class="form-input-wrapper">
                                <Calendar class="form-input-icon" />
                                <input v-model="reservation.client_cin_date" type="text" class="form-input" placeholder="Ex: 01/01/2020">
                            </div>
                        </div>

                        <div v-if="clientMode !== 'agency'">
                            <label class="form-label">Date de délivrance Permis</label>
                            <div class="form-input-wrapper">
                                <Calendar class="form-input-icon" />
                                <input v-model="reservation.client_permit_date" type="text" class="form-input" placeholder="Ex: 15/06/2018">
                            </div>
                        </div>

                        <div class="md:col-span-2">
                            <label class="form-label">
                                {{ clientMode === 'agency' ? 'Adresse Agence' : 'Adresse Client' }}
                                <span class="text-gray-400 font-normal">(optionnel)</span>
                            </label>
                            <div class="form-input-wrapper">
                                <MapPin class="form-input-icon" />
                                <input
                                    v-model="reservation.client_address"
                                    type="text"
                                    class="form-input"
                                    placeholder="Ex: 12 Rue de Carthage, Tunis 1000"
                                >
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

                        <div>
                            <label class="form-label">Date de délivrance CIN</label>
                            <div class="form-input-wrapper">
                                <Calendar class="form-input-icon" />
                                <input v-model="reservation.second_driver_cin_date" type="text" class="form-input" placeholder="Ex: 01/01/2020">
                            </div>
                        </div>

                        <div>
                            <label class="form-label">Date de délivrance Permis</label>
                            <div class="form-input-wrapper">
                                <Calendar class="form-input-icon" />
                                <input v-model="reservation.second_driver_permit_date" type="text" class="form-input" placeholder="Ex: 15/06/2018">
                            </div>
                        </div>

                        <div class="md:col-span-2">
                            <label class="form-label">
                                Adresse
                                <span class="text-gray-400 font-normal">(optionnel)</span>
                            </label>
                            <div class="form-input-wrapper">
                                <MapPin class="form-input-icon" />
                                <input
                                    v-model="reservation.second_driver_address"
                                    type="text"
                                    class="form-input"
                                    placeholder="Ex: 12 Rue de Carthage, Tunis 1000"
                                >
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
                            <label class="form-label">Numéro de Contrat</label>
                            <div class="form-input-wrapper">
                                <Hash class="form-input-icon" />
                                <input 
                                    v-model="reservation.contract_number"
                                    type="text"
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
                            <label class="form-label">{{ t('admin.reservations.price_per_day') }} * (DT)</label>
                            <div class="form-input-wrapper">
                                <DollarSign class="form-input-icon" />
                                <input v-model.number="reservation.price_per_day" type="number" step="0.0001" required class="form-input">
                            </div>
                        </div>
                        <div>
                            <label class="form-label">{{ t('admin.reservations.total_price') }} (DT)</label>
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
                                <label class="text-xs font-bold text-indigo-700 mb-1.5 block">Acompte / Avance (DT)</label>
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
                                    Reste à Payer (DT)
                                </label>
                                <div class="text-2xl font-extrabold tracking-tight" :class="restToPay > 0 ? 'text-red-600' : 'text-emerald-600'">
                                    {{ restToPay.toFixed(2) }} DT
                                </div>
                                <p v-if="restToPay === 0" class="text-[11px] text-emerald-600 mt-1 font-bold flex items-center gap-1">
                                    <CircleCheck class="w-3 h-3" /> Payé en totalité
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Caution / Security Deposit -->
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Caution / Dépôt de Garantie</h3>
                        <div class="p-3.5 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 ring-1 ring-amber-200 max-w-md">
                            <label class="text-xs font-bold text-amber-700 mb-1.5 block">Montant Caution</label>
                            <div class="flex gap-2">
                                <input 
                                    v-model.number="reservation.caution"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    class="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-white"
                                    placeholder="0.00"
                                >
                                <select 
                                    v-model="reservation.caution_currency"
                                    class="w-24 px-2 py-2 text-sm font-semibold border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-white text-amber-800 appearance-none text-center cursor-pointer"
                                >
                                    <option value="DT">DT</option>
                                    <option value="EUR">EUR €</option>
                                    <option value="USD">USD $</option>
                                </select>
                            </div>
                            <p class="text-[11px] text-amber-600 mt-1.5">Montant remboursable à la fin de la location</p>
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

            <!-- "Save as Client Fidèle?" proposal modal -->
            <Teleport to="body">
                <Transition name="modal">
                    <div v-if="showSuggestRegisterModal" class="fixed inset-0 z-[60] overflow-y-auto">
                        <div class="fixed inset-0 bg-black/55 backdrop-blur-sm" @click="dismissSuggestRegister"></div>
                        <div class="flex min-h-full items-center justify-center p-4">
                            <div class="modal-container relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                                <!-- Header -->
                                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div class="flex items-center gap-2.5">
                                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                                            <BookmarkPlus class="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <h3 class="text-base font-bold text-gray-900">
                                                {{ suggestRegisterSuccess ? 'Ajouté à vos Clients Fidèles' : 'Nouveau client détecté' }}
                                            </h3>
                                            <p class="text-xs text-gray-500">
                                                {{ suggestRegisterSuccess
                                                    ? 'Ce client est désormais disponible en autocomplétion.'
                                                    : "Ce CIN n'existe pas encore dans vos Clients Fidèles." }}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        @click="dismissSuggestRegister"
                                        :disabled="suggestRegisterLoading"
                                        class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <X class="w-5 h-5" />
                                    </button>
                                </div>

                                <!-- Body -->
                                <div class="px-5 py-4">
                                    <template v-if="suggestRegisterSuccess">
                                        <div class="flex items-start gap-3 bg-emerald-50/70 ring-1 ring-emerald-200 rounded-xl p-4">
                                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
                                                <Check class="w-5 h-5" />
                                            </div>
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold text-gray-900">
                                                    <span class="inline-block px-2 py-0.5 mr-1 rounded-md bg-emerald-100 ring-1 ring-emerald-200 text-emerald-700 font-bold tracking-wide">
                                                        {{ suggestRegisterSuccess }}
                                                    </span>
                                                    est enregistré
                                                </p>
                                                <p class="text-xs text-gray-500 mt-1">
                                                    Vous le retrouverez en autocomplétion dans la réservation, le contrat et la facture.
                                                </p>
                                            </div>
                                        </div>
                                    </template>

                                    <template v-else>
                                        <p class="text-sm text-gray-600 leading-relaxed">
                                            Souhaitez-vous l'enregistrer dans <strong>Clients Fidèles</strong> ?
                                            Les champs déjà remplis (téléphone, email, adresse, permis, dates) seront également sauvegardés.
                                        </p>

                                        <div class="mt-3 space-y-2">
                                            <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-2 items-start bg-gray-50 ring-1 ring-gray-100 rounded-xl px-3 py-2.5">
                                                <span class="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 pt-0.5">Nom complet</span>
                                                <span class="text-sm font-semibold text-gray-900 truncate" :title="suggestRegisterPayload?.full_name">{{ suggestRegisterPayload?.full_name }}</span>
                                            </div>
                                            <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-2 items-start bg-gray-50 ring-1 ring-gray-100 rounded-xl px-3 py-2.5">
                                                <span class="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 pt-0.5">CIN</span>
                                                <span class="text-sm font-mono tracking-wide text-gray-700">{{ suggestRegisterPayload?.cin }}</span>
                                            </div>
                                            <div v-if="suggestRegisterPayload?.phone" class="grid grid-cols-[110px_minmax(0,1fr)] gap-2 items-start bg-gray-50 ring-1 ring-gray-100 rounded-xl px-3 py-2.5">
                                                <span class="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 pt-0.5">Téléphone</span>
                                                <span class="text-sm text-gray-700">{{ suggestRegisterPayload.phone }}</span>
                                            </div>
                                            <div v-if="suggestRegisterPayload?.address" class="grid grid-cols-[110px_minmax(0,1fr)] gap-2 items-start bg-gray-50 ring-1 ring-gray-100 rounded-xl px-3 py-2.5">
                                                <span class="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 pt-0.5">Adresse</span>
                                                <span class="text-sm text-gray-700 truncate" :title="suggestRegisterPayload.address">{{ suggestRegisterPayload.address }}</span>
                                            </div>
                                        </div>

                                        <div v-if="suggestRegisterError" class="mt-3 flex items-start gap-2 bg-red-50 ring-1 ring-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm">
                                            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>{{ suggestRegisterError }}</span>
                                        </div>
                                    </template>
                                </div>

                                <!-- Footer -->
                                <div class="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
                                    <template v-if="suggestRegisterSuccess">
                                        <button
                                            @click="dismissSuggestRegister"
                                            class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 transition-all"
                                        >
                                            <Check class="w-4 h-4" />
                                            C'est noté
                                        </button>
                                    </template>
                                    <template v-else>
                                        <button
                                            @click="dismissSuggestRegister"
                                            :disabled="suggestRegisterLoading"
                                            class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Plus tard
                                        </button>
                                        <button
                                            @click="confirmSuggestRegister"
                                            :disabled="suggestRegisterLoading"
                                            class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Loader2 v-if="suggestRegisterLoading" class="w-4 h-4 animate-spin" />
                                            <UserPlus v-else class="w-4 h-4" />
                                            Enregistrer le client
                                        </button>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>

            <!-- AI Contract Scanner Modal -->
            <Teleport to="body">
                <Transition name="modal">
                    <div v-if="showAiScan" class="fixed inset-0 z-50 overflow-y-auto">
                        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="aiScanStep !== 'analyzing' && closeAiScan()"></div>
                        <div class="flex min-h-full items-center justify-center p-4">
                            <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
                                <!-- Modal Header -->
                                <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
                                    <div class="flex items-center gap-3">
                                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200">
                                            <Sparkles class="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <h3 class="text-base font-bold text-gray-900">AI Contract Scanner</h3>
                                            <p class="text-xs text-gray-500">Powered by Orion</p>
                                        </div>
                                    </div>
                                    <button 
                                        v-if="aiScanStep !== 'analyzing'"
                                        @click="closeAiScan" 
                                        class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                                    >
                                        <X class="w-5 h-5" />
                                    </button>
                                </div>

                                <div class="p-6">
                                    <!-- Step: Upload -->
                                    <div v-if="aiScanStep === 'upload'">
                                        <div v-if="!aiScanFile">
                                            <label 
                                                class="block cursor-pointer"
                                                @dragover.prevent="aiDragOver = true"
                                                @dragleave.prevent="aiDragOver = false"
                                                @drop.prevent="handleAiDrop"
                                            >
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    capture="environment"
                                                    @change="handleAiFileSelect"
                                                    class="hidden"
                                                >
                                                <div 
                                                    class="flex flex-col items-center justify-center gap-3 px-6 py-10 border-2 border-dashed rounded-2xl transition-all"
                                                    :class="aiDragOver 
                                                        ? 'border-violet-400 bg-violet-50/60 scale-[1.01]' 
                                                        : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/30'"
                                                >
                                                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                                                        <ScanLine class="w-7 h-7 text-violet-600" />
                                                    </div>
                                                    <div class="text-center">
                                                        <p class="text-sm font-bold text-gray-700">Importer une image du contrat</p>
                                                        <p class="text-xs text-gray-400 mt-1">Glisser-déposer ou cliquer pour sélectionner</p>
                                                        <p class="text-xs text-gray-400 mt-0.5">Supporte les contrats en Arabe, Français, Anglais</p>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>

                                        <div v-else>
                                            <div class="rounded-xl overflow-hidden ring-1 ring-gray-200 mb-4 max-h-72 overflow-y-auto">
                                                <img :src="aiScanPreviewUrl!" alt="Contract preview" class="w-full h-auto" />
                                            </div>
                                            <p class="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                                                <Image class="w-3.5 h-3.5" />
                                                {{ aiScanFile.name }} ({{ (aiScanFile.size / 1024 / 1024).toFixed(2) }} MB)
                                            </p>

                                            <div class="flex justify-between">
                                                <button 
                                                    type="button"
                                                    @click="aiScanFile = null; if (aiScanPreviewUrl) { URL.revokeObjectURL(aiScanPreviewUrl); aiScanPreviewUrl = null; }"
                                                    class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all"
                                                >
                                                    Changer
                                                </button>
                                                <button 
                                                    type="button"
                                                    @click="startAiAnalysis"
                                                    class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-xl shadow-lg shadow-violet-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    <Sparkles class="w-4 h-4" />
                                                    Analyser le contrat
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Step: Analyzing -->
                                    <div v-else-if="aiScanStep === 'analyzing'" class="flex flex-col items-center justify-center py-8">
                                        <div class="relative mb-6">
                                            <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                                                <Sparkles class="w-9 h-9 text-violet-600 animate-pulse" />
                                            </div>
                                            <div class="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-white shadow-md flex items-center justify-center">
                                                <Loader2 class="w-5 h-5 text-violet-600 animate-spin" />
                                            </div>
                                        </div>
                                        <h4 class="text-base font-bold text-gray-900 mb-1">Analyse en cours...</h4>
                                        <p class="text-sm text-gray-500 text-center max-w-xs">
                                            Orion analyse votre contrat et extrait les informations
                                        </p>
                                        <div class="mt-5 flex gap-1">
                                            <div class="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style="animation-delay: 0ms"></div>
                                            <div class="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style="animation-delay: 150ms"></div>
                                            <div class="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style="animation-delay: 300ms"></div>
                                        </div>
                                    </div>

                                    <!-- Step: Done -->
                                    <div v-else-if="aiScanStep === 'done'" class="flex flex-col items-center justify-center py-6">
                                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center mb-4">
                                            <CheckCircle2 class="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <h4 class="text-base font-bold text-gray-900 mb-1">Analyse terminée</h4>
                                        <p class="text-sm text-gray-500 mb-4">
                                            <span class="font-bold text-emerald-600">{{ filledFieldsCount }}</span> champs remplis automatiquement
                                        </p>
                                        <div class="bg-emerald-50 rounded-xl p-3 ring-1 ring-emerald-200 text-sm text-emerald-700 mb-5 max-w-sm text-center">
                                            Les données extraites ont été appliquées au formulaire. Vérifiez et complétez les informations manquantes.
                                        </div>
                                        <button 
                                            type="button"
                                            @click="closeAiScan"
                                            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-xl shadow-md shadow-emerald-200 transition-all"
                                        >
                                            <CheckCircle2 class="w-4 h-4" />
                                            Fermer et vérifier
                                        </button>
                                    </div>

                                    <!-- Step: Error -->
                                    <div v-else-if="aiScanStep === 'error'" class="flex flex-col items-center justify-center py-6">
                                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center mb-4">
                                            <AlertTriangle class="w-8 h-8 text-red-600" />
                                        </div>
                                        <h4 class="text-base font-bold text-gray-900 mb-1">Erreur d'analyse</h4>
                                        <p class="text-sm text-gray-500 mb-4 text-center max-w-xs">
                                            {{ analysisError || "Impossible d'analyser le contrat. Vérifiez l'image et réessayez." }}
                                        </p>
                                        <div class="flex gap-3">
                                            <button 
                                                type="button"
                                                @click="closeAiScan"
                                                class="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all"
                                            >
                                                Fermer
                                            </button>
                                            <button 
                                                type="button"
                                                @click="aiScanStep = 'upload'"
                                                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl shadow-md shadow-violet-200 transition-all"
                                            >
                                                <RotateCcw class="w-4 h-4" />
                                                Réessayer
                                            </button>
                                        </div>
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

.ai-scan-btn {
    background: linear-gradient(135deg, #7c3aed, #9333ea, #a855f7);
    overflow: hidden;
}

.ai-scan-btn-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #9333ea, #7c3aed, #6d28d9);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.ai-scan-btn:hover .ai-scan-btn-bg {
    opacity: 1;
}

@keyframes ai-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

.ai-scan-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    animation: ai-shimmer 3s infinite;
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
