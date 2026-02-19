<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useCars, type Car, type CarBrand, type CarStatus } from '@/composables/useCars';
import { useFileUpload } from '@/composables/useFileUpload';
import { useTenantLink } from '@/composables/useTenantLink';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import {
    Car as CarIcon,
    Edit,
    Plus,
    Image,
    X,
    ChevronDown,
    AlertCircle,
    Loader2,
    CircleCheck,
    Tag,
    Hash,
    Settings,
    Upload,
    DollarSign,
} from 'lucide-vue-next';

const { fetchCarById, createCar, updateCar } = useCars();
const { uploadFile, uploading: uploadingFile } = useFileUpload();
const { tenantPath } = useTenantLink();
const route = useRoute();
const router = useRouter();

const isEditing = ref(false);
const loading = ref(false);
const error = ref('');
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string>('');

const brands: CarBrand[] = ['Renault', 'Dacia', 'Skoda', 'Hyundai', 'Seat', 'MG', 'Mahindra', 'Kia', 'Honda', 'Peugeot', 'Cherry', 'Geely', 'Volkswagen', 'Suzuki'];

const form = ref({
    brand: '' as CarBrand,
    model: '',
    plate_prefix: '', // e.g., "245"
    plate_suffix: '', // e.g., "4521"
    status: 'disponible' as CarStatus, // Default status
    image_url: '', // Will store the uploaded image URL
    auto_manage_status: true, // Auto-manage status by default
    purchase_price: null as number | null,
    leasing_advance: null as number | null,
});

const fullPlateNumber = computed(() => {
    if (form.value.plate_prefix && form.value.plate_suffix) {
        return `${form.value.plate_prefix}TN${form.value.plate_suffix}`;
    }
    return '';
});

onMounted(async () => {
    if (route.params.id) {
        isEditing.value = true;
        const car = await fetchCarById(Number(route.params.id));
        if (car) {
            // Parse plate number: ***TN****
            const match = car.plate_number.match(/^(\d+)TN(\d+)$/);
            const platePrefix = match ? match[1] : '';
            const plateSuffix = match ? match[2] : '';
            
            form.value.brand = car.brand;
            form.value.model = car.model;
            form.value.plate_prefix = platePrefix;
            form.value.plate_suffix = plateSuffix;
            form.value.status = car.status;
            form.value.image_url = car.image_url || '';
            form.value.auto_manage_status = car.auto_manage_status !== false; // Default to true
            form.value.purchase_price = car.purchase_price ?? null;
            form.value.leasing_advance = car.leasing_advance ?? null;
            previewUrl.value = car.image_url || '';
        }
    }
});

function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            error.value = 'Veuillez sélectionner une image valide';
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            error.value = 'L\'image ne doit pas dépasser 5 MB';
            return;
        }
        
        selectedFile.value = file;
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewUrl.value = e.target?.result as string;
        };
        reader.readAsDataURL(file);
        
        error.value = '';
    }
}

function removeImage() {
    selectedFile.value = null;
    previewUrl.value = '';
    form.value.image_url = '';
    
    // Reset file input
    const fileInput = document.getElementById('car-image') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
}

function validatePlateNumber(prefix: string, suffix: string): boolean {
    // Tunisian plate format: ***TN**** (flexible digit count)
    return /^\d{1,3}$/.test(prefix) && /^\d{1,4}$/.test(suffix);
}

async function handleSubmit() {
    loading.value = true;
    error.value = '';

    // Validate plate number parts
    if (!validatePlateNumber(form.value.plate_prefix, form.value.plate_suffix)) {
        error.value = 'Format de plaque invalide. Utilisez uniquement des chiffres (ex: 245 TN 4521)';
        loading.value = false;
        return;
    }

    try {
        let imageUrl = form.value.image_url;
        
        // Upload new image if selected
        if (selectedFile.value) {
            const uploadedUrl = await uploadFile(selectedFile.value, 'car-images', 'cars');
            if (uploadedUrl) {
                imageUrl = uploadedUrl;
            } else {
                console.error('Upload returned null');
                throw new Error('Échec du téléchargement de l\'image (URL manquante)');
            }
        }

        const carData = {
            brand: form.value.brand,
            model: form.value.model,
            plate_number: fullPlateNumber.value,
            status: form.value.status,
            image_url: imageUrl || undefined,
            auto_manage_status: form.value.auto_manage_status,
            purchase_price: form.value.purchase_price || null,
            leasing_advance: form.value.leasing_advance || null,
        };

        if (isEditing.value) {
            await updateCar(Number(route.params.id), carData);
        } else {
            await createCar(carData);
        }
        router.push(tenantPath('/admin/cars'));
    } catch (e: any) {
        console.error('Error saving car:', e);
        error.value = e.message || 'Une erreur est survenue lors de l\'enregistrement';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-3xl mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                    <component :is="isEditing ? Edit : Plus" class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">
                        {{ isEditing ? $t('admin.fleet.edit_car') : $t('admin.fleet.create_car') }}
                    </h1>
                    <p class="text-sm text-gray-500">
                        {{ isEditing ? 'Modifier les informations du véhicule' : 'Ajouter un nouveau véhicule à la flotte' }}
                    </p>
                </div>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleSubmit" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">

                <!-- Error -->
                <div v-if="error" class="mx-5 mt-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle class="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                    <span>{{ error }}</span>
                </div>

                <div class="p-5 space-y-5">

                    <!-- Brand & Model -->
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div class="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                                <CarIcon class="w-3.5 h-3.5 text-violet-600" />
                            </div>
                            Véhicule
                        </h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="form-label">{{ $t('admin.fleet.brand') }} *</label>
                                <div class="form-input-wrapper">
                                    <Tag class="form-input-icon" />
                                    <select 
                                        v-model="form.brand" 
                                        required 
                                        class="form-input appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>{{ $t('admin.fleet.select_brand') }}</option>
                                        <option v-for="brand in brands" :key="brand" :value="brand">
                                            {{ brand }}
                                        </option>
                                    </select>
                                    <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.fleet.model') }} *</label>
                                <div class="form-input-wrapper">
                                    <CarIcon class="form-input-icon" />
                                    <input 
                                        v-model="form.model" 
                                        type="text" 
                                        required 
                                        class="form-input"
                                        placeholder="Ex: Clio 5"
                                    >
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Plate Number -->
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div class="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                                <Hash class="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            {{ $t('admin.fleet.plate_number') }}
                        </h3>
                        <div class="flex items-center gap-3">
                            <div class="form-input-wrapper w-28">
                                <input 
                                    v-model="form.plate_prefix" 
                                    type="text" 
                                    required 
                                    placeholder="245"
                                    maxlength="3"
                                    pattern="\d{1,3}"
                                    class="form-input text-center font-mono font-bold"
                                >
                            </div>
                            <span class="text-lg font-extrabold text-gray-400 tracking-wider">TN</span>
                            <div class="form-input-wrapper w-32">
                                <input 
                                    v-model="form.plate_suffix" 
                                    type="text" 
                                    required 
                                    placeholder="4521"
                                    maxlength="4"
                                    pattern="\d{1,4}"
                                    class="form-input text-center font-mono font-bold"
                                >
                            </div>
                            <div v-if="fullPlateNumber" class="hidden sm:flex items-center gap-1.5 ml-2">
                                <span class="inline-flex px-3 py-1.5 text-sm font-bold text-gray-700 bg-gray-50 rounded-lg ring-1 ring-gray-200 font-mono tracking-wider">
                                    {{ fullPlateNumber }}
                                </span>
                            </div>
                        </div>
                        <p class="mt-1.5 text-xs text-gray-400">{{ $t('admin.fleet.plate_format') }}</p>
                    </div>

                    <!-- Purchase Price & Leasing Advance -->
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div class="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                                <DollarSign class="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            Prix &amp; Leasing
                            <span class="text-xs font-normal text-gray-400 normal-case">({{ $t('common.optional') }})</span>
                        </h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="form-label">{{ $t('admin.fleet.purchase_price') }}</label>
                                <div class="form-input-wrapper">
                                    <span class="text-xs font-bold text-gray-400 ml-3 shrink-0">DT</span>
                                    <input 
                                        v-model.number="form.purchase_price" 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        class="form-input"
                                        placeholder="Ex: 45000.00"
                                    >
                                </div>
                                <p class="mt-1 text-xs text-gray-400">{{ $t('admin.fleet.purchase_price_hint') }}</p>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.fleet.leasing_advance') }}</label>
                                <div class="form-input-wrapper">
                                    <span class="text-xs font-bold text-gray-400 ml-3 shrink-0">DT</span>
                                    <input 
                                        v-model.number="form.leasing_advance" 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        class="form-input"
                                        placeholder="Ex: 15000.00"
                                    >
                                </div>
                                <p class="mt-1 text-xs text-gray-400">{{ $t('admin.fleet.leasing_advance_hint') }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Status -->
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div class="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
                                <Settings class="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            {{ $t('admin.fleet.status') }}
                        </h3>

                        <!-- Auto-manage toggle -->
                        <label for="auto-manage-toggle" class="flex items-start gap-3 mb-3 p-3 rounded-xl bg-gray-50 ring-1 ring-gray-100 cursor-pointer hover:bg-gray-100/50 transition-colors">
                            <input 
                                id="auto-manage-toggle"
                                v-model="form.auto_manage_status" 
                                type="checkbox"
                                class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-0.5"
                            >
                            <div>
                                <span class="text-sm font-semibold text-gray-700">Gestion automatique du statut</span>
                                <span class="text-xs text-gray-400 block mt-0.5">
                                    Le statut sera automatiquement mis à jour selon les réservations
                                </span>
                            </div>
                        </label>
                        
                        <!-- Status selector -->
                        <div class="form-input-wrapper">
                            <CircleCheck class="form-input-icon" />
                            <select 
                                v-model="form.status" 
                                :disabled="form.auto_manage_status || form.status !== 'maintenance'"
                                class="form-input appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="disponible">{{ $t('admin.fleet.disponible') }}</option>
                                <option value="loue">{{ $t('admin.fleet.loue') }}</option>
                                <option value="maintenance">{{ $t('admin.fleet.maintenance') }}</option>
                            </select>
                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        
                        <p v-if="form.auto_manage_status" class="mt-1.5 text-xs text-indigo-600 font-medium pl-1">
                            Le statut sera automatiquement défini selon les réservations actives
                        </p>
                        <div v-else class="mt-1.5 space-y-1 pl-1">
                            <p class="text-xs text-amber-600 font-medium">Le statut est contrôlé manuellement.</p>
                            <p v-if="form.status !== 'maintenance'" class="text-xs text-gray-400">
                                Le statut ne peut être modifié manuellement que si le véhicule est en maintenance.
                            </p>
                        </div>
                    </div>

                    <!-- Image -->
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div class="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                                <Image class="w-3.5 h-3.5 text-gray-600" />
                            </div>
                            Image du véhicule
                            <span class="text-xs font-normal text-gray-400 normal-case">(optionnel)</span>
                        </h3>
                        
                        <!-- Preview -->
                        <div v-if="previewUrl" class="mb-4 relative inline-block">
                            <img 
                                :src="previewUrl" 
                                alt="Aperçu" 
                                class="h-44 w-auto rounded-xl shadow-md object-cover ring-1 ring-gray-200"
                            >
                            <button
                                type="button"
                                @click="removeImage"
                                class="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-lg hover:bg-black/70 backdrop-blur-sm transition-colors"
                            >
                                <X class="w-4 h-4" />
                            </button>
                        </div>
                        
                        <!-- Upload -->
                        <label class="block cursor-pointer">
                            <input 
                                id="car-image"
                                type="file" 
                                accept="image/*"
                                @change="handleFileSelect"
                                class="hidden"
                            >
                            <div class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all">
                                <Upload class="w-4 h-4" />
                                <span class="font-medium">Choisir une image</span>
                            </div>
                        </label>
                        <p class="mt-1.5 text-xs text-gray-400 pl-1">PNG, JPG, JPEG jusqu'à 5MB</p>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="px-5 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <RouterLink 
                        :to="tenantPath('/admin/cars')" 
                        class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 rounded-xl ring-1 ring-gray-200 transition-all"
                    >
                        {{ $t('admin.fleet.cancel') }}
                    </RouterLink>
                    <button 
                        type="submit" 
                        :disabled="loading || uploadingFile" 
                        class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                    >
                        <Loader2 v-if="loading || uploadingFile" class="w-4 h-4 animate-spin" />
                        <CircleCheck v-else class="w-4 h-4" />
                        {{ loading || uploadingFile ? 'Chargement...' : $t('admin.fleet.save') }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<style scoped>
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
</style>
