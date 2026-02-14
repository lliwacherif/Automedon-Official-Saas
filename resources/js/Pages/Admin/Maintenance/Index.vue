<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCars } from '@/composables/useCars';
import { useMaintenanceRecords, MAINTENANCE_TYPE_LABELS, type MaintenanceType } from '@/composables/useMaintenanceRecords';
import type { Database } from '@/types/supabase';
import { 
    Wrench, 
    Calendar, 
    Gauge, 
    DollarSign, 
    MapPin, 
    Edit, 
    Trash2, 
    Plus,
    Car,
    X,
    ChevronDown,
    Loader2,
    FileText,
    Hash,
    CircleCheck,
} from 'lucide-vue-next';

const { cars, loading: carsLoading, fetchCars, fetchCarById, updateCar } = useCars();
const {
    maintenanceRecords,
    loading: maintenanceLoading,
    totalMaintenanceCost,
    fetchMaintenanceRecords,
    createMaintenanceRecord,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
} = useMaintenanceRecords();

// Selected car state
const selectedCarId = ref<number | null>(null);
const selectedCar = ref<any>(null);

// Modal state
const isModalOpen = ref(false);
const isEditMode = ref(false);
const editingRecordId = ref<number | null>(null);

// Form state
const formData = ref<Database['public']['Tables']['maintenance_records']['Insert']>({
    car_id: 0,
    maintenance_type: 'OIL_CHANGE',
    cost: 0,
    odometer: 0,
    maintenance_date: new Date().toISOString().split('T')[0],
    notes: '',
    provider: '',
    next_due_mileage: null,
});

// Computed
const filteredCars = computed(() => {
    return cars.value.map(car => ({
        id: car.id,
        label: `${car.plate_number} - ${car.brand} ${car.model}`,
        brand: car.brand,
        model: car.model,
        plate_number: car.plate_number,
        mileage: car.mileage || 0,
    }));
});

const maintenanceTypeOptions = computed(() => {
    return Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({
        value: value as MaintenanceType,
        label,
    }));
});

// Methods
async function onCarSelect() {
    if (!selectedCarId.value) {
        selectedCar.value = null;
        maintenanceRecords.value = [];
        return;
    }

    // Fetch car details
    const car = await fetchCarById(selectedCarId.value);
    selectedCar.value = car;

    // Fetch maintenance records
    await fetchMaintenanceRecords(selectedCarId.value);
}

function openAddModal() {
    isEditMode.value = false;
    editingRecordId.value = null;
    formData.value = {
        car_id: selectedCarId.value!,
        maintenance_type: 'OIL_CHANGE',
        cost: 0,
        odometer: selectedCar.value?.mileage || 0,
        maintenance_date: new Date().toISOString().split('T')[0],
        notes: '',
        provider: '',
        next_due_mileage: null,
    };
    isModalOpen.value = true;
}

function openEditModal(record: any) {
    isEditMode.value = true;
    editingRecordId.value = record.id;
    formData.value = {
        car_id: record.car_id,
        maintenance_type: record.maintenance_type,
        cost: record.cost,
        odometer: record.odometer,
        maintenance_date: record.maintenance_date,
        notes: record.notes || '',
        provider: record.provider || '',
        next_due_mileage: record.next_due_mileage || null,
    };
    isModalOpen.value = true;
}

function closeModal() {
    isModalOpen.value = false;
    isEditMode.value = false;
    editingRecordId.value = null;
}

async function submitForm() {
    try {
        if (isEditMode.value && editingRecordId.value) {
            await updateMaintenanceRecord(editingRecordId.value, formData.value);
        } else {
            await createMaintenanceRecord(formData.value);
        }

        // If it's a repair, update car status to maintenance
        if (formData.value.maintenance_type === 'REPAIR' && selectedCarId.value) {
            await updateCar(selectedCarId.value, { status: 'maintenance' });
        }

        // Refresh car details to update mileage
        if (selectedCarId.value) {
            const car = await fetchCarById(selectedCarId.value);
            selectedCar.value = car;
        }

        closeModal();
    } catch (error) {
        console.error('Error submitting maintenance record:', error);
    }
}

async function handleDelete(recordId: number) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet enregistrement?')) {
        return;
    }

    try {
        await deleteMaintenanceRecord(recordId, selectedCarId.value!);

        // Refresh car details
        if (selectedCarId.value) {
            const car = await fetchCarById(selectedCarId.value);
            selectedCar.value = car;
        }
    } catch (error) {
        console.error('Error deleting maintenance record:', error);
    }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND',
    }).format(value);
}

import { formatDate } from '@/utils/date';

onMounted(() => {
    fetchCars();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
                    <Wrench class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">Gestion Maintenance</h1>
                    <p class="text-sm text-gray-500">Suivi d'entretien de votre flotte</p>
                </div>
            </div>

            <!-- Car Selector -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-4">
                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Sélectionner une voiture
                </label>
                <div class="relative">
                    <Car class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        v-model="selectedCarId"
                        @change="onCarSelect"
                        class="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 appearance-none cursor-pointer transition-all"
                    >
                        <option :value="null">-- Choisir une voiture --</option>
                        <option v-for="car in filteredCars" :key="car.id" :value="car.id">
                            {{ car.label }}
                        </option>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            <!-- Main Content -->
            <div v-if="selectedCar" class="space-y-5">

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <!-- Car Info -->
                    <div class="stat-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Véhicule</p>
                                <h3 class="text-lg font-extrabold text-gray-900 mt-1 tracking-tight">{{ selectedCar.brand }} {{ selectedCar.model }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-100 group-hover:scale-110 transition-transform">
                                <Car class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-400 text-xs">Plaque</span>
                                <span class="font-bold text-gray-700">{{ selectedCar.plate_number }}</span>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-400 text-xs">Kilométrage</span>
                                <span class="font-bold text-gray-700">{{ (selectedCar.mileage || 0).toLocaleString() }} km</span>
                            </div>
                        </div>
                    </div>

                    <!-- Operations Count -->
                    <div class="stat-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Opérations</p>
                                <h3 class="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight">{{ maintenanceRecords.length }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                                <Hash class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400 text-xs">
                            Enregistrements de maintenance
                        </div>
                    </div>

                    <!-- Total Cost -->
                    <div class="stat-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Coût Total</p>
                                <h3 class="text-2xl font-extrabold text-indigo-600 mt-1 tracking-tight">{{ formatCurrency(totalMaintenanceCost) }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                                <DollarSign class="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400 text-xs">
                            Total des dépenses d'entretien
                        </div>
                    </div>
                </div>

                <!-- Add Button -->
                <button
                    @click="openAddModal"
                    class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                >
                    <Plus class="w-4 h-4" />
                    Ajouter Entretien
                </button>

                <!-- Desktop Table -->
                <div class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <Wrench class="w-4 h-4 text-gray-400" />
                        <h2 class="text-base font-bold text-gray-900">Historique d'Entretien</h2>
                    </div>

                    <div v-if="maintenanceLoading" class="flex flex-col items-center justify-center py-16">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                            <Loader2 class="w-6 h-6 text-indigo-600 animate-spin" />
                        </div>
                        <p class="text-gray-400 font-medium text-sm">Chargement...</p>
                    </div>

                    <div v-else-if="maintenanceRecords.length === 0" class="flex flex-col items-center py-16">
                        <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                            <Wrench class="w-6 h-6 text-gray-300" />
                        </div>
                        <p class="text-gray-400 font-medium">Aucun enregistrement de maintenance.</p>
                    </div>

                    <div v-else class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="border-b border-gray-100">
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Kilométrage</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Coût</th>
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Garage</th>
                                    <th class="px-5 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="record in maintenanceRecords" :key="record.id" class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                                    <td class="px-5 py-3.5">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <Calendar class="w-4 h-4 text-gray-500" />
                                            </div>
                                            <span class="text-sm font-semibold text-gray-900">{{ formatDate(record.maintenance_date) }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span class="type-badge">
                                            {{ MAINTENANCE_TYPE_LABELS[record.maintenance_type] }}
                                        </span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <div class="text-sm font-semibold text-gray-900">{{ record.odometer.toLocaleString() }} km</div>
                                        <div v-if="record.next_due_mileage" class="text-[11px] text-indigo-600 font-bold mt-0.5">
                                            Prochain: {{ record.next_due_mileage.toLocaleString() }} km
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span class="text-sm font-bold text-gray-900">{{ formatCurrency(record.cost) }}</span>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span class="text-sm text-gray-500">{{ record.provider || '-' }}</span>
                                    </td>
                                    <td class="px-5 py-3.5 text-right">
                                        <div class="flex items-center justify-end gap-1">
                                            <button
                                                @click="openEditModal(record)"
                                                class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit class="w-4 h-4 text-indigo-500" />
                                            </button>
                                            <button
                                                @click="handleDelete(record.id)"
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
                </div>

                <!-- Mobile Cards -->
                <div class="md:hidden space-y-3">
                    <div v-if="maintenanceLoading" class="flex flex-col items-center justify-center py-16">
                        <Loader2 class="w-7 h-7 text-indigo-600 animate-spin mb-3" />
                        <p class="text-gray-400 text-sm">Chargement...</p>
                    </div>
                    <div v-else-if="maintenanceRecords.length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
                        <Wrench class="w-8 h-8 text-gray-300 mb-3" />
                        <p class="text-gray-400 font-medium">Aucun enregistrement.</p>
                    </div>
                    <div 
                        v-else 
                        v-for="record in maintenanceRecords" 
                        :key="record.id" 
                        class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden"
                    >
                        <div class="p-4 space-y-3">
                            <!-- Header -->
                            <div class="flex justify-between items-start">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                        <Calendar class="w-4 h-4 text-gray-500" />
                                    </div>
                                    <span class="text-sm font-bold text-gray-900">{{ formatDate(record.maintenance_date) }}</span>
                                </div>
                                <span class="type-badge">
                                    {{ MAINTENANCE_TYPE_LABELS[record.maintenance_type] }}
                                </span>
                            </div>

                            <!-- Odometer -->
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <Gauge class="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                    <span class="text-sm text-gray-700">{{ record.odometer.toLocaleString() }} km</span>
                                    <span v-if="record.next_due_mileage" class="text-[11px] text-indigo-600 font-bold ml-2">
                                        (Prochain: {{ record.next_due_mileage.toLocaleString() }} km)
                                    </span>
                                </div>
                            </div>

                            <!-- Provider -->
                            <div v-if="record.provider" class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <MapPin class="w-4 h-4 text-gray-500" />
                                </div>
                                <span class="text-sm text-gray-500">{{ record.provider }}</span>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                            <span class="text-base font-bold text-gray-900">{{ formatCurrency(record.cost) }}</span>
                            <div class="flex items-center gap-1">
                                <button
                                    @click="openEditModal(record)"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                >
                                    <Edit class="w-4 h-4 text-indigo-500" />
                                </button>
                                <button
                                    @click="handleDelete(record.id)"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 class="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State (No car selected) -->
            <div v-else class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <Car class="w-8 h-8 text-gray-300" />
                </div>
                <h3 class="text-base font-bold text-gray-900">Aucune voiture sélectionnée</h3>
                <p class="mt-1.5 text-sm text-gray-400 max-w-sm mx-auto">
                    Sélectionnez une voiture dans la liste ci-dessus pour consulter et gérer son historique de maintenance.
                </p>
            </div>
        </div>

        <!-- Add/Edit Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div
                    v-if="isModalOpen"
                    class="fixed inset-0 z-50 overflow-y-auto"
                >
                    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>

                    <div class="flex min-h-full items-center justify-center p-4">
                        <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <!-- Modal Header -->
                            <div class="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Wrench class="w-4 h-4 text-amber-600" />
                                    </div>
                                    <h3 class="text-base font-bold text-gray-900">
                                        {{ isEditMode ? 'Modifier Entretien' : 'Ajouter Entretien' }}
                                    </h3>
                                </div>
                                <button @click="closeModal" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                    <X class="w-5 h-5" />
                                </button>
                            </div>

                            <!-- Modal Body -->
                            <form @submit.prevent="submitForm" class="flex-1 overflow-y-auto p-6">
                                <div class="space-y-4">
                                    <!-- Maintenance Type -->
                                    <div>
                                        <label class="form-label">Type d'Entretien *</label>
                                        <div class="form-input-wrapper">
                                            <Wrench class="form-input-icon" />
                                            <select
                                                v-model="formData.maintenance_type"
                                                required
                                                class="form-input appearance-none cursor-pointer"
                                            >
                                                <option v-for="option in maintenanceTypeOptions" :key="option.value" :value="option.value">
                                                    {{ option.label }}
                                                </option>
                                            </select>
                                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    <!-- Odometer -->
                                    <div>
                                        <label class="form-label">
                                            {{ formData.maintenance_type === 'OIL_CHANGE' ? 'Kilométrage *' : 'Kilométrage' }}
                                        </label>
                                        <div class="form-input-wrapper">
                                            <Gauge class="form-input-icon" />
                                            <input
                                                v-model.number="formData.odometer"
                                                type="number"
                                                min="0"
                                                :required="formData.maintenance_type === 'OIL_CHANGE'"
                                                class="form-input"
                                                placeholder="Ex: 45000"
                                            />
                                        </div>
                                    </div>

                                    <!-- Next Due Mileage -->
                                    <div v-if="formData.maintenance_type === 'OIL_CHANGE'">
                                        <label class="form-label">Prochaine Vidange à (km)</label>
                                        <div class="form-input-wrapper">
                                            <Gauge class="form-input-icon" />
                                            <input
                                                v-model.number="formData.next_due_mileage"
                                                type="number"
                                                min="0"
                                                class="form-input"
                                                placeholder="Ex: 50000"
                                            />
                                        </div>
                                        <p class="mt-1 text-xs text-gray-400 pl-1">Kilométrage auquel faire la prochaine vidange</p>
                                    </div>

                                    <!-- Cost -->
                                    <div>
                                        <label class="form-label">Coût (TND) *</label>
                                        <div class="form-input-wrapper">
                                            <DollarSign class="form-input-icon" />
                                            <input
                                                v-model.number="formData.cost"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                required
                                                class="form-input"
                                                placeholder="Ex: 150.00"
                                            />
                                        </div>
                                    </div>

                                    <!-- Date -->
                                    <div>
                                        <label class="form-label">
                                            {{ formData.maintenance_type === 'REPAIR' ? 'Date de début *' : 'Date *' }}
                                        </label>
                                        <div class="form-input-wrapper">
                                            <Calendar class="form-input-icon" />
                                            <input
                                                v-model="formData.maintenance_date"
                                                type="date"
                                                required
                                                :max="new Date().toISOString().split('T')[0]"
                                                class="form-input"
                                            />
                                        </div>
                                    </div>

                                    <!-- Provider -->
                                    <div v-if="!['ASSURANCE', 'VIGNETTE', 'LEASING'].includes(formData.maintenance_type)">
                                        <label class="form-label">Garage / Fournisseur</label>
                                        <div class="form-input-wrapper">
                                            <MapPin class="form-input-icon" />
                                            <input
                                                v-model="formData.provider"
                                                type="text"
                                                class="form-input"
                                                placeholder="Ex: Garage Central"
                                            />
                                        </div>
                                    </div>

                                    <!-- Notes -->
                                    <div>
                                        <label class="form-label">Description / Notes</label>
                                        <div class="form-input-wrapper items-start">
                                            <FileText class="form-input-icon mt-2.5" />
                                            <textarea
                                                v-model="formData.notes"
                                                rows="2"
                                                class="form-input"
                                                placeholder="Détails de l'entretien..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <!-- Modal Footer -->
                                <div class="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        @click="closeModal"
                                        class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        :disabled="maintenanceLoading"
                                        class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                                    >
                                        <Loader2 v-if="maintenanceLoading" class="w-4 h-4 animate-spin" />
                                        <CircleCheck v-else class="w-4 h-4" />
                                        {{ maintenanceLoading ? 'Enregistrement...' : (isEditMode ? 'Modifier' : 'Ajouter') }}
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
/* Stat cards */
.stat-card {
    background: white;
    padding: 1.25rem;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(0, 0, 0, 0.02);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.06),
        0 2px 8px rgba(0, 0, 0, 0.04);
    border-color: rgb(229 231 235);
}

/* Maintenance type badge */
.type-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 0.5rem;
    letter-spacing: 0.025em;
    background: rgb(236 252 203);
    color: rgb(63 98 18);
    box-shadow: inset 0 0 0 1px rgba(132, 204, 22, 0.2);
}

/* Form styles */
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

/* Modal animation */
.modal-enter-active {
    transition: opacity 0.25s ease;
}
.modal-enter-active .modal-container {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}
.modal-leave-active {
    transition: opacity 0.2s ease;
}
.modal-leave-active .modal-container {
    transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from {
    opacity: 0;
}
.modal-enter-from .modal-container {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
}
.modal-leave-to {
    opacity: 0;
}
.modal-leave-to .modal-container {
    opacity: 0;
    transform: scale(0.97) translateY(5px);
}
</style>
