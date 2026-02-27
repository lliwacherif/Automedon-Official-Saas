<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useCars } from '@/composables/useCars';
import { useMaintenanceRecords, MAINTENANCE_TYPE_LABELS, type MaintenanceType } from '@/composables/useMaintenanceRecords';
import { useFileUpload } from '@/composables/useFileUpload';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import type { Database } from '@/types/supabase';
import { 
    Wrench, Calendar, Gauge, DollarSign, MapPin, Edit, Trash2, Plus, Car, X, ChevronDown, Loader2, FileText, Hash, CircleCheck,
    AlertTriangle, Upload, Image, Eye, Camera, User, CreditCard, IdCard, ClipboardList, ShieldAlert,
} from 'lucide-vue-next';

const { cars, loading: carsLoading, fetchCars, fetchCarById, updateCar } = useCars();
const {
    maintenanceRecords, loading: maintenanceLoading, totalMaintenanceCost,
    fetchMaintenanceRecords, createMaintenanceRecord, updateMaintenanceRecord, deleteMaintenanceRecord,
} = useMaintenanceRecords();
const { uploadFile, uploading: uploadingImage } = useFileUpload();
const tenantStore = useTenantStore();

const selectedCarId = ref<number | null>(null);
const selectedCar = ref<any>(null);

const isModalOpen = ref(false);
const isEditMode = ref(false);
const editingRecordId = ref<number | null>(null);

const DAMAGE_TYPES = [
    'Carrosserie / Rayure',
    'Pare-brise / Vitre',
    'Pare-chocs',
    'Rétroviseur',
    'Pneu / Jante',
    'Moteur / Mécanique',
    'Intérieur / Sellerie',
    'Phare / Feu',
    'Accident',
    'Autre',
];

const formData = ref<any>({
    car_id: 0,
    maintenance_type: 'OIL_CHANGE',
    cost: 0,
    odometer: 0,
    maintenance_date: new Date().toISOString().split('T')[0],
    notes: '',
    provider: '',
    next_due_mileage: null,
    damage_type: '',
    damage_date: '',
    responsible_client_name: '',
    responsible_client_cin: '',
    responsible_client_permit: '',
    linked_reservation_id: null,
    damage_images: [] as string[],
});

const damageImageFiles = ref<{ file: File; preview: string }[]>([]);
const carReservations = ref<any[]>([]);
const loadingReservations = ref(false);

const isRepairMode = computed(() => formData.value.maintenance_type === 'REPAIR');

const filteredCars = computed(() => {
    return cars.value.map(car => ({
        id: car.id, label: `${car.plate_number} - ${car.brand} ${car.model}`,
        brand: car.brand, model: car.model, plate_number: car.plate_number, mileage: car.mileage || 0,
    }));
});

const maintenanceTypeOptions = computed(() => {
    return Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({
        value: value as MaintenanceType, label,
    }));
});

async function fetchCarReservations(carId: number) {
    loadingReservations.value = true;
    try {
        const { data } = await supabase
            .from('reservations')
            .select('id, reservation_number, client_name, client_cin, start_date, end_date, status')
            .eq('car_id', carId)
            .eq('tenant_id', tenantStore.currentTenant?.id || '')
            .order('start_date', { ascending: false });
        carReservations.value = data || [];
    } catch (e) {
        console.error('Error fetching car reservations:', e);
    } finally {
        loadingReservations.value = false;
    }
}

watch(() => formData.value.linked_reservation_id, (resId) => {
    if (!resId || !isRepairMode.value) return;
    const res = carReservations.value.find((r: any) => r.id === resId);
    if (res) {
        formData.value.responsible_client_name = res.client_name;
        formData.value.responsible_client_cin = res.client_cin;
    }
});

async function onCarSelect() {
    if (!selectedCarId.value) {
        selectedCar.value = null;
        maintenanceRecords.value = [];
        return;
    }
    const car = await fetchCarById(selectedCarId.value);
    selectedCar.value = car;
    await fetchMaintenanceRecords(selectedCarId.value);
}

function openAddModal() {
    isEditMode.value = false;
    editingRecordId.value = null;
    formData.value = {
        car_id: selectedCarId.value!, maintenance_type: 'OIL_CHANGE', cost: 0,
        odometer: selectedCar.value?.mileage || 0, maintenance_date: new Date().toISOString().split('T')[0],
        notes: '', provider: '', next_due_mileage: null,
        damage_type: '', damage_date: new Date().toISOString().split('T')[0],
        responsible_client_name: '', responsible_client_cin: '', responsible_client_permit: '',
        linked_reservation_id: null, damage_images: [],
    };
    damageImageFiles.value = [];
    if (selectedCarId.value) fetchCarReservations(selectedCarId.value);
    isModalOpen.value = true;
}

function openEditModal(record: any) {
    isEditMode.value = true;
    editingRecordId.value = record.id;
    formData.value = {
        car_id: record.car_id, maintenance_type: record.maintenance_type, cost: record.cost,
        odometer: record.odometer, maintenance_date: record.maintenance_date, notes: record.notes || '',
        provider: record.provider || '', next_due_mileage: record.next_due_mileage || null,
        damage_type: record.damage_type || '', damage_date: record.damage_date || '',
        responsible_client_name: record.responsible_client_name || '',
        responsible_client_cin: record.responsible_client_cin || '',
        responsible_client_permit: record.responsible_client_permit || '',
        linked_reservation_id: record.linked_reservation_id || null,
        damage_images: record.damage_images || [],
    };
    damageImageFiles.value = [];
    if (record.car_id) fetchCarReservations(record.car_id);
    isModalOpen.value = true;
}

function closeModal() {
    isModalOpen.value = false;
    isEditMode.value = false;
    editingRecordId.value = null;
    damageImageFiles.value.forEach(f => URL.revokeObjectURL(f.preview));
    damageImageFiles.value = [];
}

function handleDamageImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    for (const file of Array.from(input.files)) {
        if (damageImageFiles.value.length + (formData.value.damage_images?.length || 0) >= 6) break;
        damageImageFiles.value.push({ file, preview: URL.createObjectURL(file) });
    }
    input.value = '';
}

function removePendingImage(index: number) {
    URL.revokeObjectURL(damageImageFiles.value[index].preview);
    damageImageFiles.value.splice(index, 1);
}

function removeExistingImage(index: number) {
    formData.value.damage_images.splice(index, 1);
}

async function submitForm() {
    try {
        let imageUrls = [...(formData.value.damage_images || [])];
        if (isRepairMode.value && damageImageFiles.value.length > 0) {
            for (const item of damageImageFiles.value) {
                const url = await uploadFile(item.file, 'car-images', 'damage');
                if (url) imageUrls.push(url);
            }
        }

        const payload: any = {
            car_id: formData.value.car_id,
            maintenance_type: formData.value.maintenance_type,
            cost: formData.value.cost,
            odometer: formData.value.odometer,
            maintenance_date: formData.value.maintenance_date,
            notes: formData.value.notes || null,
            provider: formData.value.provider || null,
            next_due_mileage: formData.value.next_due_mileage || null,
        };

        if (isRepairMode.value) {
            payload.damage_type = formData.value.damage_type || null;
            payload.damage_date = formData.value.damage_date || null;
            payload.responsible_client_name = formData.value.responsible_client_name || null;
            payload.responsible_client_cin = formData.value.responsible_client_cin || null;
            payload.responsible_client_permit = formData.value.responsible_client_permit || null;
            payload.linked_reservation_id = formData.value.linked_reservation_id || null;
            payload.damage_images = imageUrls.length > 0 ? imageUrls : null;
        }

        if (isEditMode.value && editingRecordId.value) {
            await updateMaintenanceRecord(editingRecordId.value, payload);
        } else {
            await createMaintenanceRecord(payload);
        }

        if (formData.value.maintenance_type === 'REPAIR' && selectedCarId.value) {
            await updateCar(selectedCarId.value, { status: 'maintenance' });
        }

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
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet enregistrement?')) return;
    try {
        await deleteMaintenanceRecord(recordId, selectedCarId.value!);
        if (selectedCarId.value) {
            const car = await fetchCarById(selectedCarId.value);
            selectedCar.value = car;
        }
    } catch (error) {
        console.error('Error deleting maintenance record:', error);
    }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(value);
}

import { formatDate, formatDateTime } from '@/utils/date';

onMounted(() => { fetchCars(); });
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
                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Sélectionner une voiture</label>
                <div class="relative">
                    <Car class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select v-model="selectedCarId" @change="onCarSelect" class="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 appearance-none cursor-pointer transition-all">
                        <option :value="null">-- Choisir une voiture --</option>
                        <option v-for="car in filteredCars" :key="car.id" :value="car.id">{{ car.label }}</option>
                    </select>
                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            <!-- Main Content -->
            <div v-if="selectedCar" class="space-y-5">
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="stat-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-500">Véhicule</p>
                                <h3 class="text-lg font-extrabold text-gray-900 mt-1 tracking-tight">{{ selectedCar.brand }} {{ selectedCar.model }}</h3>
                            </div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-100 group-hover:scale-110 transition-transform"><Car class="w-5 h-5 text-white" /></div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                            <div class="flex items-center justify-between text-sm"><span class="text-gray-400 text-xs">Plaque</span><span class="font-bold text-gray-700">{{ selectedCar.plate_number }}</span></div>
                            <div class="flex items-center justify-between text-sm"><span class="text-gray-400 text-xs">Kilométrage</span><span class="font-bold text-gray-700">{{ (selectedCar.mileage || 0).toLocaleString() }} km</span></div>
                        </div>
                    </div>
                    <div class="stat-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0"><p class="text-sm font-medium text-gray-500">Opérations</p><h3 class="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight">{{ maintenanceRecords.length }}</h3></div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform"><Hash class="w-5 h-5 text-white" /></div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400 text-xs">Enregistrements de maintenance</div>
                    </div>
                    <div class="stat-card group">
                        <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0"><p class="text-sm font-medium text-gray-500">Coût Total</p><h3 class="text-2xl font-extrabold text-indigo-600 mt-1 tracking-tight">{{ formatCurrency(totalMaintenanceCost) }}</h3></div>
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform"><DollarSign class="w-5 h-5 text-white" /></div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400 text-xs">Total des dépenses d'entretien</div>
                    </div>
                </div>

                <!-- Add Button -->
                <button @click="openAddModal" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all">
                    <Plus class="w-4 h-4" /> Ajouter Entretien
                </button>

                <!-- Desktop Table -->
                <div class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <Wrench class="w-4 h-4 text-gray-400" />
                        <h2 class="text-base font-bold text-gray-900">Historique d'Entretien</h2>
                    </div>
                    <div v-if="maintenanceLoading" class="flex flex-col items-center justify-center py-16">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3"><Loader2 class="w-6 h-6 text-indigo-600 animate-spin" /></div>
                        <p class="text-gray-400 font-medium text-sm">Chargement...</p>
                    </div>
                    <div v-else-if="maintenanceRecords.length === 0" class="flex flex-col items-center py-16">
                        <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3"><Wrench class="w-6 h-6 text-gray-300" /></div>
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
                                    <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Garage / Info</th>
                                    <th class="px-5 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="record in maintenanceRecords" :key="record.id" class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                                    <td class="px-5 py-3.5">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Calendar class="w-4 h-4 text-gray-500" /></div>
                                            <span class="text-sm font-semibold text-gray-900">{{ formatDate(record.maintenance_date) }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <span class="type-badge" :class="{ 'type-badge-repair': record.maintenance_type === 'REPAIR' }">
                                            {{ MAINTENANCE_TYPE_LABELS[record.maintenance_type] }}
                                        </span>
                                        <div v-if="record.maintenance_type === 'REPAIR' && record.damage_type" class="text-[11px] text-red-500 font-medium mt-0.5">{{ record.damage_type }}</div>
                                    </td>
                                    <td class="px-5 py-3.5">
                                        <div class="text-sm font-semibold text-gray-900">{{ record.odometer.toLocaleString() }} km</div>
                                        <div v-if="record.next_due_mileage" class="text-[11px] text-indigo-600 font-bold mt-0.5">Prochain: {{ record.next_due_mileage.toLocaleString() }} km</div>
                                    </td>
                                    <td class="px-5 py-3.5"><span class="text-sm font-bold text-gray-900">{{ formatCurrency(record.cost) }}</span></td>
                                    <td class="px-5 py-3.5">
                                        <span class="text-sm text-gray-500">{{ record.provider || '-' }}</span>
                                        <div v-if="record.maintenance_type === 'REPAIR' && record.responsible_client_name" class="text-[11px] text-gray-400 mt-0.5">
                                            Client: {{ record.responsible_client_name }}
                                        </div>
                                        <div v-if="record.damage_images && record.damage_images.length > 0" class="flex items-center gap-1 mt-1">
                                            <Camera class="w-3 h-3 text-gray-400" />
                                            <span class="text-[11px] text-gray-400">{{ record.damage_images.length }} photo(s)</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-3.5 text-right">
                                        <div class="flex items-center justify-end gap-1">
                                            <button @click="openEditModal(record)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors" title="Modifier"><Edit class="w-4 h-4 text-indigo-500" /></button>
                                            <button @click="handleDelete(record.id)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="Supprimer"><Trash2 class="w-4 h-4 text-red-400" /></button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Mobile Cards -->
                <div class="md:hidden space-y-3">
                    <div v-if="maintenanceLoading" class="flex flex-col items-center justify-center py-16"><Loader2 class="w-7 h-7 text-indigo-600 animate-spin mb-3" /><p class="text-gray-400 text-sm">Chargement...</p></div>
                    <div v-else-if="maintenanceRecords.length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100"><Wrench class="w-8 h-8 text-gray-300 mb-3" /><p class="text-gray-400 font-medium">Aucun enregistrement.</p></div>
                    <div v-else v-for="record in maintenanceRecords" :key="record.id" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                        <div class="p-4 space-y-3">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Calendar class="w-4 h-4 text-gray-500" /></div>
                                    <span class="text-sm font-bold text-gray-900">{{ formatDate(record.maintenance_date) }}</span>
                                </div>
                                <span class="type-badge" :class="{ 'type-badge-repair': record.maintenance_type === 'REPAIR' }">{{ MAINTENANCE_TYPE_LABELS[record.maintenance_type] }}</span>
                            </div>
                            <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Gauge class="w-4 h-4 text-gray-500" /></div><span class="text-sm text-gray-700">{{ record.odometer.toLocaleString() }} km</span></div>
                            <div v-if="record.provider" class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><MapPin class="w-4 h-4 text-gray-500" /></div><span class="text-sm text-gray-500">{{ record.provider }}</span></div>
                            <div v-if="record.maintenance_type === 'REPAIR' && record.responsible_client_name" class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><User class="w-4 h-4 text-red-500" /></div><span class="text-sm text-gray-700">{{ record.responsible_client_name }} <span class="text-gray-400">({{ record.damage_type }})</span></span></div>
                        </div>
                        <div class="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                            <span class="text-base font-bold text-gray-900">{{ formatCurrency(record.cost) }}</span>
                            <div class="flex items-center gap-1">
                                <button @click="openEditModal(record)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"><Edit class="w-4 h-4 text-indigo-500" /></button>
                                <button @click="handleDelete(record.id)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"><Trash2 class="w-4 h-4 text-red-400" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4"><Car class="w-8 h-8 text-gray-300" /></div>
                <h3 class="text-base font-bold text-gray-900">Aucune voiture sélectionnée</h3>
                <p class="mt-1.5 text-sm text-gray-400 max-w-sm mx-auto">Sélectionnez une voiture dans la liste ci-dessus pour consulter et gérer son historique de maintenance.</p>
            </div>
        </div>

        <!-- ===== ADD/EDIT MODAL ===== -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="isModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
                    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
                    <div class="flex min-h-full items-center justify-center p-4">
                        <div class="modal-container relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300" :class="isRepairMode ? 'max-w-3xl' : 'max-w-2xl'">
                            <!-- Modal Header -->
                            <div class="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between" :class="isRepairMode ? 'bg-gradient-to-r from-red-50 to-orange-50' : ''">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="isRepairMode ? 'bg-red-100' : 'bg-amber-100'">
                                        <ShieldAlert v-if="isRepairMode" class="w-4 h-4 text-red-600" />
                                        <Wrench v-else class="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 class="text-base font-bold text-gray-900">
                                            {{ isRepairMode ? (isEditMode ? 'Modifier Réparation' : 'Déclarer une Réparation') : (isEditMode ? 'Modifier Entretien' : 'Ajouter Entretien') }}
                                        </h3>
                                        <p v-if="isRepairMode" class="text-xs text-red-500 font-medium">Dommage / Accident / Réparation</p>
                                    </div>
                                </div>
                                <button @click="closeModal" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X class="w-5 h-5" /></button>
                            </div>

                            <!-- Modal Body -->
                            <form @submit.prevent="submitForm" class="flex-1 overflow-y-auto p-6">
                                <div class="space-y-4">
                                    <!-- Maintenance Type -->
                                    <div>
                                        <label class="form-label">Type d'Entretien *</label>
                                        <div class="form-input-wrapper">
                                            <Wrench class="form-input-icon" />
                                            <select v-model="formData.maintenance_type" required class="form-input appearance-none cursor-pointer">
                                                <option v-for="option in maintenanceTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                                            </select>
                                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    <!-- ===== REPAIR-SPECIFIC FIELDS ===== -->
                                    <Transition name="expand">
                                        <div v-if="isRepairMode" class="space-y-4 bg-red-50/50 rounded-xl p-4 ring-1 ring-red-100">
                                            <div class="flex items-center gap-2 mb-1">
                                                <AlertTriangle class="w-4 h-4 text-red-500" />
                                                <h4 class="text-sm font-bold text-red-700 uppercase tracking-wider">Détails du Dommage</h4>
                                            </div>

                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <!-- Damage Type -->
                                                <div>
                                                    <label class="form-label">Type de dommage *</label>
                                                    <div class="form-input-wrapper">
                                                        <ShieldAlert class="form-input-icon" />
                                                        <select v-model="formData.damage_type" required class="form-input appearance-none cursor-pointer">
                                                            <option value="">-- Sélectionner --</option>
                                                            <option v-for="dt in DAMAGE_TYPES" :key="dt" :value="dt">{{ dt }}</option>
                                                        </select>
                                                        <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </div>

                                                <!-- Damage Date -->
                                                <div>
                                                    <label class="form-label">Date du dommage *</label>
                                                    <div class="form-input-wrapper">
                                                        <Calendar class="form-input-icon" />
                                                        <input v-model="formData.damage_date" type="date" required class="form-input" />
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Linked Reservation -->
                                            <div>
                                                <label class="form-label">Réservation liée</label>
                                                <div class="form-input-wrapper">
                                                    <ClipboardList class="form-input-icon" />
                                                    <select v-model="formData.linked_reservation_id" class="form-input appearance-none cursor-pointer">
                                                        <option :value="null">-- Aucune --</option>
                                                        <option v-for="res in carReservations" :key="res.id" :value="res.id">
                                                            #{{ res.reservation_number }} - {{ res.client_name }} ({{ formatDate(res.start_date) }})
                                                        </option>
                                                    </select>
                                                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                                <p v-if="loadingReservations" class="text-xs text-gray-400 mt-1 flex items-center gap-1"><Loader2 class="w-3 h-3 animate-spin" /> Chargement des réservations...</p>
                                            </div>

                                            <!-- Responsible Client -->
                                            <div class="flex items-center gap-2 mt-2 mb-1">
                                                <User class="w-4 h-4 text-red-500" />
                                                <h4 class="text-sm font-bold text-red-700 uppercase tracking-wider">Client Responsable</h4>
                                            </div>
                                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <label class="form-label">Nom complet</label>
                                                    <div class="form-input-wrapper">
                                                        <User class="form-input-icon" />
                                                        <input v-model="formData.responsible_client_name" type="text" class="form-input" placeholder="Nom du client" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label class="form-label">CIN</label>
                                                    <div class="form-input-wrapper">
                                                        <CreditCard class="form-input-icon" />
                                                        <input v-model="formData.responsible_client_cin" type="text" class="form-input" placeholder="Numéro CIN" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label class="form-label">N° Permis</label>
                                                    <div class="form-input-wrapper">
                                                        <IdCard class="form-input-icon" />
                                                        <input v-model="formData.responsible_client_permit" type="text" class="form-input" placeholder="Numéro permis" />
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Damage Photos -->
                                            <div>
                                                <div class="flex items-center gap-2 mt-2 mb-2">
                                                    <Camera class="w-4 h-4 text-red-500" />
                                                    <h4 class="text-sm font-bold text-red-700 uppercase tracking-wider">Photos du Dommage</h4>
                                                    <span class="text-xs text-gray-400 font-normal normal-case">(max 6)</span>
                                                </div>

                                                <!-- Existing Images -->
                                                <div v-if="formData.damage_images?.length > 0 || damageImageFiles.length > 0" class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                                                    <div v-for="(url, idx) in formData.damage_images" :key="'existing-'+idx" class="relative group aspect-square rounded-xl overflow-hidden ring-1 ring-gray-200">
                                                        <img :src="url" class="w-full h-full object-cover" />
                                                        <button type="button" @click="removeExistingImage(idx)" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X class="w-3 h-3" /></button>
                                                    </div>
                                                    <div v-for="(item, idx) in damageImageFiles" :key="'pending-'+idx" class="relative group aspect-square rounded-xl overflow-hidden ring-2 ring-indigo-200">
                                                        <img :src="item.preview" class="w-full h-full object-cover" />
                                                        <div class="absolute inset-0 bg-indigo-500/10"></div>
                                                        <button type="button" @click="removePendingImage(idx)" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X class="w-3 h-3" /></button>
                                                    </div>
                                                </div>

                                                <!-- Upload Button -->
                                                <label v-if="(formData.damage_images?.length || 0) + damageImageFiles.length < 6" class="block cursor-pointer">
                                                    <input type="file" accept="image/*" multiple capture="environment" @change="handleDamageImageSelect" class="hidden" />
                                                    <div class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-red-200 rounded-xl text-sm text-red-500 hover:border-red-300 hover:bg-red-50/30 transition-all">
                                                        <Camera class="w-4 h-4" />
                                                        <span class="font-medium">Ajouter des photos</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </Transition>

                                    <!-- ===== COMMON FIELDS ===== -->
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <!-- Odometer -->
                                        <div>
                                            <label class="form-label">{{ formData.maintenance_type === 'OIL_CHANGE' ? 'Kilométrage *' : 'Kilométrage' }}</label>
                                            <div class="form-input-wrapper">
                                                <Gauge class="form-input-icon" />
                                                <input v-model.number="formData.odometer" type="number" min="0" :required="formData.maintenance_type === 'OIL_CHANGE'" class="form-input" placeholder="Ex: 45000" />
                                            </div>
                                        </div>

                                        <!-- Cost -->
                                        <div>
                                            <label class="form-label">Coût (DT) *</label>
                                            <div class="form-input-wrapper">
                                                <DollarSign class="form-input-icon" />
                                                <input v-model.number="formData.cost" type="number" min="0" step="0.01" required class="form-input" placeholder="Ex: 150.00" />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Next Due Mileage -->
                                    <div v-if="formData.maintenance_type === 'OIL_CHANGE'">
                                        <label class="form-label">Prochaine Vidange à (km)</label>
                                        <div class="form-input-wrapper">
                                            <Gauge class="form-input-icon" />
                                            <input v-model.number="formData.next_due_mileage" type="number" min="0" class="form-input" placeholder="Ex: 50000" />
                                        </div>
                                    </div>

                                    <!-- Date -->
                                    <div>
                                        <label class="form-label">{{ isRepairMode ? 'Date d\'entrée au garage *' : 'Date *' }}</label>
                                        <div class="form-input-wrapper">
                                            <Calendar class="form-input-icon" />
                                            <input v-model="formData.maintenance_date" type="date" required class="form-input" />
                                        </div>
                                    </div>

                                    <!-- Provider -->
                                    <div v-if="!['ASSURANCE', 'VIGNETTE', 'LEASING'].includes(formData.maintenance_type)">
                                        <label class="form-label">{{ isRepairMode ? 'Garage' : 'Garage / Fournisseur' }}</label>
                                        <div class="form-input-wrapper">
                                            <MapPin class="form-input-icon" />
                                            <input v-model="formData.provider" type="text" class="form-input" placeholder="Ex: Garage Central" />
                                        </div>
                                    </div>

                                    <!-- Notes -->
                                    <div>
                                        <label class="form-label">{{ isRepairMode ? 'Description de la réparation' : 'Description / Notes' }}</label>
                                        <div class="form-input-wrapper items-start">
                                            <FileText class="form-input-icon mt-2.5" />
                                            <textarea v-model="formData.notes" rows="2" class="form-input" :placeholder="isRepairMode ? 'Décrivez les travaux effectués...' : 'Détails de l\'entretien...'"></textarea>
                                        </div>
                                    </div>
                                </div>

                                <!-- Modal Footer -->
                                <div class="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                                    <button type="button" @click="closeModal" class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all">Annuler</button>
                                    <button type="submit" :disabled="maintenanceLoading || uploadingImage" class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all" :class="isRepairMode ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-200' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-indigo-200'">
                                        <Loader2 v-if="maintenanceLoading || uploadingImage" class="w-4 h-4 animate-spin" />
                                        <CircleCheck v-else class="w-4 h-4" />
                                        {{ (maintenanceLoading || uploadingImage) ? 'Enregistrement...' : (isEditMode ? 'Modifier' : (isRepairMode ? 'Déclarer Réparation' : 'Ajouter')) }}
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
.stat-card { background: white; padding: 1.25rem; border-radius: 1rem; border: 1px solid rgb(243 244 246); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04); border-color: rgb(229 231 235); }

.type-badge { display: inline-flex; align-items: center; padding: 0.25rem 0.625rem; font-size: 0.6875rem; font-weight: 700; border-radius: 0.5rem; letter-spacing: 0.025em; background: rgb(236 252 203); color: rgb(63 98 18); box-shadow: inset 0 0 0 1px rgba(132,204,22,0.2); }
.type-badge-repair { background: rgb(254 226 226); color: rgb(153 27 27); box-shadow: inset 0 0 0 1px rgba(239,68,68,0.2); }

.form-label { display: block; font-size: 0.8125rem; font-weight: 600; color: rgb(55 65 81); margin-bottom: 0.3rem; }
.form-input-wrapper { position: relative; display: flex; align-items: center; background: white; border: 1px solid rgb(229 231 235); border-radius: 0.75rem; transition: all 0.15s ease; overflow: hidden; }
.form-input-wrapper:focus-within { border-color: rgb(129 140 248); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.form-input-icon { width: 1rem; height: 1rem; color: rgb(156 163 175); margin-left: 0.75rem; flex-shrink: 0; }
.form-input { width: 100%; padding: 0.6rem 0.75rem; font-size: 0.875rem; color: rgb(17 24 39); background: transparent; border: none; outline: none; }
.form-input::placeholder { color: rgb(156 163 175); }

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-container { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-container { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-container { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-container { opacity: 0; transform: scale(0.97) translateY(5px); }

.expand-enter-active, .expand-leave-active { transition: all 0.3s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; margin-top: 0; margin-bottom: 0; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 1000px; }
</style>
