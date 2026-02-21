<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useServices, type ServiceType } from '@/composables/useServices';
import { useCars } from '@/composables/useCars';
import { formatDateTime } from '@/utils/date';
import DateTimeInput from '@/components/DateTimeInput.vue';
import {
    Bus,
    Plus,
    Loader2,
    X,
    Car,
    User,
    CreditCard,
    Calendar,
    DollarSign,
    FileText,
    Trash2,
    Edit,
    CircleCheck,
    AlertCircle,
    MapPin,
    Compass,
    ChevronDown,
    Clock,
    Wallet,
    IdCard,
    Banknote,
} from 'lucide-vue-next';

const { services, loading, fetchServices, createService, updateService, deleteService, checkServiceAvailability } = useServices();
const { cars, fetchCars } = useCars();

const isModalOpen = ref(false);
const isEditMode = ref(false);
const editingServiceId = ref<number | null>(null);
const formLoading = ref(false);
const formError = ref('');

const form = ref({
    service_type: 'transfert' as ServiceType,
    car_id: 0,
    start_date: '',
    end_date: '',
    chauffeur_name: '',
    chauffeur_cin: '',
    chauffeur_permit: '',
    client_name: '',
    client_cin: '',
    price: 0,
    payment_method: 'cash' as 'cash' | 'card',
    advance_payment: 0,
    notes: '',
});

onMounted(async () => {
    await Promise.all([fetchServices(), fetchCars()]);
});

const availableCars = computed(() => cars.value || []);

function openModal() {
    isEditMode.value = false;
    editingServiceId.value = null;
    form.value = {
        service_type: 'transfert',
        car_id: 0,
        start_date: '',
        end_date: '',
        chauffeur_name: '',
        chauffeur_cin: '',
        chauffeur_permit: '',
        client_name: '',
        client_cin: '',
        price: 0,
        payment_method: 'cash',
        advance_payment: 0,
        notes: '',
    };
    formError.value = '';
    isModalOpen.value = true;
}

function openEditModal(svc: any) {
    isEditMode.value = true;
    editingServiceId.value = svc.id;
    
    // Format dates for DateTimeInput (YYYY-MM-DDTHH:mm)
    const formatForInput = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${mo}-${da}T${h}:${mi}`;
    };

    form.value = {
        service_type: svc.service_type,
        car_id: svc.car_id,
        start_date: formatForInput(svc.start_date),
        end_date: formatForInput(svc.end_date),
        chauffeur_name: svc.chauffeur_name,
        chauffeur_cin: svc.chauffeur_cin,
        chauffeur_permit: svc.chauffeur_permit || '',
        client_name: svc.client_name || '',
        client_cin: svc.client_cin || '',
        price: svc.price,
        payment_method: svc.payment_method || 'cash',
        advance_payment: svc.advance_payment || 0,
        notes: svc.notes || '',
    };
    formError.value = '';
    isModalOpen.value = true;
}

function closeModal() {
    isModalOpen.value = false;
    isEditMode.value = false;
    editingServiceId.value = null;
    formError.value = '';
}

async function handleSubmit() {
    formError.value = '';
    formLoading.value = true;

    try {
        if (!form.value.car_id || form.value.car_id === 0) {
            formError.value = 'Veuillez sélectionner un véhicule.';
            formLoading.value = false;
            return;
        }
        if (!form.value.start_date || !form.value.end_date) {
            formError.value = 'Veuillez renseigner les dates de début et fin.';
            formLoading.value = false;
            return;
        }
        if (!form.value.chauffeur_name.trim()) {
            formError.value = 'Le nom du chauffeur est requis.';
            formLoading.value = false;
            return;
        }
        if (!form.value.chauffeur_cin.trim()) {
            formError.value = 'Le CIN du chauffeur est requis.';
            formLoading.value = false;
            return;
        }
        if (!form.value.client_name.trim()) {
            formError.value = 'Le nom du client est requis.';
            formLoading.value = false;
            return;
        }
        if (!form.value.client_cin.trim()) {
            formError.value = 'Le CIN du client est requis.';
            formLoading.value = false;
            return;
        }
        if (form.value.price <= 0) {
            formError.value = 'Le prix doit être supérieur à 0.';
            formLoading.value = false;
            return;
        }

        // Validate minimum 1 hour
        const start = new Date(form.value.start_date);
        const end = new Date(form.value.end_date);
        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 1) {
            formError.value = 'La durée minimale est de 1 heure.';
            formLoading.value = false;
            return;
        }

        if (end <= start) {
            formError.value = 'La date de fin doit être après la date de début.';
            formLoading.value = false;
            return;
        }

        // Check availability
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const check = await checkServiceAvailability(
            form.value.car_id, startIso, endIso,
            isEditMode.value ? editingServiceId.value ?? undefined : undefined
        );

        if (!check.available) {
            formError.value = check.reason;
            formLoading.value = false;
            return;
        }

        const payload = {
            service_type: form.value.service_type,
            car_id: form.value.car_id,
            start_date: startIso,
            end_date: endIso,
            chauffeur_name: form.value.chauffeur_name,
            chauffeur_cin: form.value.chauffeur_cin,
            chauffeur_permit: form.value.chauffeur_permit || null,
            client_name: form.value.client_name,
            client_cin: form.value.client_cin,
            price: form.value.price,
            payment_method: form.value.payment_method,
            advance_payment: form.value.advance_payment || 0,
            notes: form.value.notes || null,
        };

        if (isEditMode.value && editingServiceId.value) {
            await updateService(editingServiceId.value, payload);
        } else {
            await createService(payload);
        }

        closeModal();
    } catch (e: any) {
        formError.value = e.message || 'Erreur lors de la création du service.';
    } finally {
        formLoading.value = false;
    }
}

async function handleDelete(id: number) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) return;
    await deleteService(id);
}

function getTypeLabel(type: ServiceType) {
    return type === 'transfert' ? 'Transfert' : 'Excursion';
}

function getTypeClass(type: ServiceType) {
    return type === 'transfert' ? 'type-transfert' : 'type-excursion';
}

const formatCurrency = (v: number) => new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(v);
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-200">
                        <Bus class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Services</h1>
                        <p class="text-sm text-gray-500">{{ services.length }} service{{ services.length !== 1 ? 's' : '' }} enregistré{{ services.length !== 1 ? 's' : '' }}</p>
                    </div>
                </div>
                <button 
                    @click="openModal"
                    class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                >
                    <Plus class="w-4 h-4" />
                    Nouveau Service
                </button>
            </div>

            <!-- Loading -->
            <div v-if="loading && services.length === 0" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement des services...</p>
            </div>

            <!-- Desktop Table -->
            <div v-else class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <table class="min-w-full">
                    <thead>
                        <tr class="border-b border-gray-100">
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Véhicule</th>
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dates</th>
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Chauffeur</th>
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Client</th>
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Prix</th>
                            <th class="px-5 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="services.length === 0">
                            <td colspan="7" class="px-5 py-16 text-center">
                                <div class="flex flex-col items-center">
                                    <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                        <Bus class="w-6 h-6 text-gray-300" />
                                    </div>
                                    <p class="text-gray-400 font-medium">Aucun service enregistré.</p>
                                </div>
                            </td>
                        </tr>
                        <tr v-for="svc in services" :key="svc.id" class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                            <td class="px-5 py-3.5">
                                <span :class="getTypeClass(svc.service_type)" class="type-badge">
                                    <MapPin v-if="svc.service_type === 'transfert'" class="w-3 h-3" />
                                    <Compass v-else class="w-3 h-3" />
                                    {{ getTypeLabel(svc.service_type) }}
                                </span>
                            </td>
                            <td class="px-5 py-3.5">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                        <Car class="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-semibold text-gray-900">{{ svc.car?.brand }} {{ svc.car?.model }}</div>
                                        <div class="text-xs text-gray-400 font-mono">{{ svc.car?.plate_number }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-5 py-3.5">
                                <div class="flex items-center gap-1.5">
                                    <Calendar class="w-3.5 h-3.5 text-gray-400" />
                                    <div>
                                        <div class="text-sm text-gray-700">{{ formatDateTime(svc.start_date) }}</div>
                                        <div class="text-sm text-gray-700">{{ formatDateTime(svc.end_date) }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-5 py-3.5">
                                <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                        <User class="w-3.5 h-3.5 text-gray-500" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-semibold text-gray-900">{{ svc.chauffeur_name }}</div>
                                        <div class="text-xs text-gray-400 font-mono">{{ svc.chauffeur_cin }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-5 py-3.5">
                                <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                                        <User class="w-3.5 h-3.5 text-indigo-500" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-semibold text-gray-900">{{ svc.client_name }}</div>
                                        <div class="text-xs text-gray-400 font-mono">{{ svc.client_cin }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-5 py-3.5">
                                <span class="text-sm font-bold text-gray-900">{{ formatCurrency(svc.price) }}</span>
                            </td>
                            <td class="px-5 py-3.5 text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <button 
                                        @click="openEditModal(svc)"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                        title="Modifier"
                                    >
                                        <Edit class="w-4 h-4 text-indigo-500" />
                                    </button>
                                    <button 
                                        @click="handleDelete(svc.id)"
                                        class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 class="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Mobile Cards -->
            <div v-if="!loading || services.length > 0" class="md:hidden space-y-3">
                <div v-if="services.length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
                    <Bus class="w-8 h-8 text-gray-300 mb-3" />
                    <p class="text-gray-400 font-medium">Aucun service.</p>
                </div>

                <div v-for="svc in services" :key="svc.id" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="p-4 space-y-2.5">
                        <div class="flex justify-between items-start">
                            <span :class="getTypeClass(svc.service_type)" class="type-badge">
                                <MapPin v-if="svc.service_type === 'transfert'" class="w-3 h-3" />
                                <Compass v-else class="w-3 h-3" />
                                {{ getTypeLabel(svc.service_type) }}
                            </span>
                            <span class="text-xs text-gray-400">{{ formatDateTime(svc.created_at) }}</span>
                        </div>

                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <Car class="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-900">{{ svc.car?.brand }} {{ svc.car?.model }}</div>
                                <div class="text-xs text-gray-400 font-mono">{{ svc.car?.plate_number }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <User class="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                                <div class="text-xs text-gray-400">Chauffeur</div>
                                <div class="text-sm font-semibold text-gray-900">{{ svc.chauffeur_name }}</div>
                                <div class="text-xs text-gray-400 font-mono">{{ svc.chauffeur_cin }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                <User class="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                                <div class="text-xs text-gray-400">Client</div>
                                <div class="text-sm font-semibold text-gray-900">{{ svc.client_name }}</div>
                                <div class="text-xs text-gray-400 font-mono">{{ svc.client_cin }}</div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <Calendar class="w-4 h-4 text-gray-500" />
                            </div>
                            <div class="text-sm text-gray-600">
                                {{ formatDateTime(svc.start_date) }} — {{ formatDateTime(svc.end_date) }}
                            </div>
                        </div>
                    </div>

                    <div class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <span class="text-base font-bold text-gray-900">{{ formatCurrency(svc.price) }}</span>
                        <div class="flex items-center gap-1">
                            <button @click="openEditModal(svc)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors">
                                <Edit class="w-4 h-4 text-indigo-500" />
                            </button>
                            <button @click="handleDelete(svc.id)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                                <Trash2 class="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="isModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
                    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
                    <div class="flex min-h-full items-center justify-center p-4">
                        <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <!-- Header -->
                            <div class="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                                        <Bus class="w-4 h-4 text-rose-600" />
                                    </div>
                                    <h3 class="text-base font-bold text-gray-900">{{ isEditMode ? 'Modifier le Service' : 'Nouveau Service' }}</h3>
                                </div>
                                <button @click="closeModal" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                    <X class="w-5 h-5" />
                                </button>
                            </div>

                            <!-- Form -->
                            <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto p-6 space-y-4">
                                <!-- Error -->
                                <div v-if="formError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                    <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                                    <span>{{ formError }}</span>
                                </div>

                                <!-- Type -->
                                <div>
                                    <label class="form-label">Type de Service *</label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <button 
                                            type="button"
                                            @click="form.service_type = 'transfert'"
                                            class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ring-1"
                                            :class="form.service_type === 'transfert' 
                                                ? 'bg-indigo-50 text-indigo-700 ring-indigo-300 shadow-sm' 
                                                : 'bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100'"
                                        >
                                            <MapPin class="w-4 h-4" />
                                            Transfert
                                        </button>
                                        <button 
                                            type="button"
                                            @click="form.service_type = 'excursion'"
                                            class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ring-1"
                                            :class="form.service_type === 'excursion' 
                                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-300 shadow-sm' 
                                                : 'bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100'"
                                        >
                                            <Compass class="w-4 h-4" />
                                            Excursion
                                        </button>
                                    </div>
                                </div>

                                <!-- Car -->
                                <div>
                                    <label class="form-label">Véhicule *</label>
                                    <div class="form-input-wrapper">
                                        <Car class="form-input-icon" />
                                        <select v-model="form.car_id" required class="form-input appearance-none cursor-pointer">
                                            <option :value="0" disabled>-- Choisir un véhicule --</option>
                                            <option v-for="car in availableCars" :key="car.id" :value="car.id">
                                                {{ car.brand }} {{ car.model }} - {{ car.plate_number }}
                                            </option>
                                        </select>
                                        <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                <!-- Dates -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label class="form-label">Date & Heure Début *</label>
                                        <DateTimeInput v-model="form.start_date" :required="true" />
                                        <p v-if="form.start_date" class="mt-1 text-xs text-indigo-600 font-semibold pl-1">
                                            {{ formatDateTime(form.start_date) }}
                                        </p>
                                    </div>
                                    <div>
                                        <label class="form-label">Date & Heure Fin *</label>
                                        <DateTimeInput v-model="form.end_date" :required="true" />
                                        <p v-if="form.end_date" class="mt-1 text-xs text-indigo-600 font-semibold pl-1">
                                            {{ formatDateTime(form.end_date) }}
                                        </p>
                                    </div>
                                </div>
                                <p class="text-[11px] text-gray-400 -mt-2 pl-1">
                                    <Clock class="w-3 h-3 inline-block mr-0.5" /> Durée minimale: 1 heure. Même jour autorisé.
                                </p>

                                <!-- Chauffeur -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label class="form-label">Nom du Chauffeur *</label>
                                        <div class="form-input-wrapper">
                                            <User class="form-input-icon" />
                                            <input v-model="form.chauffeur_name" type="text" required class="form-input" placeholder="Nom complet">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="form-label">CIN Chauffeur *</label>
                                        <div class="form-input-wrapper">
                                            <CreditCard class="form-input-icon" />
                                            <input v-model="form.chauffeur_cin" type="text" required class="form-input" placeholder="CIN">
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">N° Permis Chauffeur</label>
                                    <div class="form-input-wrapper max-w-xs">
                                        <IdCard class="form-input-icon" />
                                        <input v-model="form.chauffeur_permit" type="text" class="form-input" placeholder="Numéro de permis">
                                    </div>
                                </div>

                                <!-- Client -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label class="form-label">Nom du Client *</label>
                                        <div class="form-input-wrapper">
                                            <User class="form-input-icon" />
                                            <input v-model="form.client_name" type="text" required class="form-input" placeholder="Nom complet">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="form-label">CIN Client/Passport *</label>
                                        <div class="form-input-wrapper">
                                            <CreditCard class="form-input-icon" />
                                            <input v-model="form.client_cin" type="text" required class="form-input" placeholder="CIN">
                                        </div>
                                    </div>
                                </div>

                                <!-- Price -->
                                <div>
                                    <label class="form-label">Prix (DT) *</label>
                                    <div class="form-input-wrapper">
                                        <DollarSign class="form-input-icon" />
                                        <input v-model.number="form.price" type="number" step="0.01" min="0" required class="form-input" placeholder="Ex: 250.00">
                                    </div>
                                </div>

                                <!-- Payment -->
                                <div class="space-y-3">
                                    <label class="form-label">Mode de Paiement</label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <button 
                                            type="button"
                                            @click="form.payment_method = 'cash'"
                                            class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ring-1"
                                            :class="form.payment_method === 'cash' 
                                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-300 shadow-sm' 
                                                : 'bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100'"
                                        >
                                            <Banknote class="w-4 h-4" />
                                            Cash
                                        </button>
                                        <button 
                                            type="button"
                                            @click="form.payment_method = 'card'"
                                            class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ring-1"
                                            :class="form.payment_method === 'card' 
                                                ? 'bg-blue-50 text-blue-700 ring-blue-300 shadow-sm' 
                                                : 'bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100'"
                                        >
                                            <CreditCard class="w-4 h-4" />
                                            Carte
                                        </button>
                                    </div>

                                    <div>
                                        <label class="form-label">Avance (DT)</label>
                                        <div class="form-input-wrapper max-w-xs">
                                            <Wallet class="form-input-icon" />
                                            <input v-model.number="form.advance_payment" type="number" step="0.01" min="0" class="form-input" placeholder="Ex: 100.00">
                                        </div>
                                        <p class="mt-1 text-xs text-gray-400 pl-1">Montant avancé par le client (optionnel)</p>
                                    </div>
                                </div>

                                <!-- Notes -->
                                <div>
                                    <label class="form-label">Notes</label>
                                    <div class="form-input-wrapper items-start">
                                        <FileText class="form-input-icon mt-2.5" />
                                        <textarea v-model="form.notes" rows="2" class="form-input" placeholder="Détails supplémentaires..."></textarea>
                                    </div>
                                </div>

                                <!-- Submit -->
                                <div class="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                    <button type="button" @click="closeModal" class="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all">
                                        Annuler
                                    </button>
                                    <button 
                                        type="submit"
                                        :disabled="formLoading"
                                        class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                                    >
                                        <Loader2 v-if="formLoading" class="w-4 h-4 animate-spin" />
                                        <CircleCheck v-else class="w-4 h-4" />
                                        {{ isEditMode ? 'Enregistrer' : 'Créer le Service' }}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.type-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 0.5rem;
    letter-spacing: 0.025em;
}

.type-transfert {
    background: rgb(219 234 254);
    color: rgb(30 64 175);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.15);
}

.type-excursion {
    background: rgb(209 250 229);
    color: rgb(22 101 52);
    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.15);
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

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-container { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-container { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-container { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-container { opacity: 0; transform: scale(0.97) translateY(5px); }
</style>
