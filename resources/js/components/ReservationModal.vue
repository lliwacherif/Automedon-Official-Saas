<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useReservations } from '@/composables/useReservations';
import { useAuthStore } from '@/stores/auth';
import type { Car } from '@/composables/useCars';
import { formatDate } from '@/utils/date';
import { 
    X, 
    User, 
    CreditCard, 
    Phone, 
    Mail, 
    CalendarDays, 
    Clock, 
    MapPin, 
    FileText, 
    Key, 
    CheckCircle2, 
    AlertCircle,
    Loader2,
    Car as CarIcon,
} from 'lucide-vue-next';

const props = defineProps<{
    show: boolean;
    car: Car | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'success'): void;
}>();

const { createReservation, checkAvailability, loading, error } = useReservations();
const authStore = useAuthStore();

const form = ref({
    client_name: '',
    client_cin: '',
    client_phone: '',
    client_email: authStore.user?.email || '',
    start_date: '',
    end_date: '',
    price_per_day: 150, // Default price per day in TND
    pickup_location: '',
    return_location: '',
    notes: '',
});

const formError = ref('');
const success = ref(false);

// Calculate duration and total price
const durationDays = computed(() => {
    if (!form.value.start_date || !form.value.end_date) return 0;
    const start = new Date(form.value.start_date);
    const end = new Date(form.value.end_date);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
});

const totalPrice = computed(() => {
    return durationDays.value * form.value.price_per_day;
});

// Hours and Minutes for time picker
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = ['00', '30'];

// Separate inputs for separate control
const startDateDate = ref('');
const startHour = ref('09');
const startMinute = ref('00');
const endDateDate = ref('');
const endHour = ref('09');
const endMinute = ref('00');

// Sync local inputs to form.start_date
watch([startDateDate, startHour, startMinute], ([date, hour, minute]) => {
    if (date && hour && minute) {
        // Ensure minute is 2 digits for ISO string
        const m = minute.padStart(2, '0');
        form.value.start_date = `${date}T${hour}:${m}`;
    } else {
        form.value.start_date = '';
    }
});

// Sync local inputs to form.end_date
watch([endDateDate, endHour, endMinute], ([date, hour, minute]) => {
    if (date && hour && minute) {
        // Ensure minute is 2 digits for ISO string
        const m = minute.padStart(2, '0');
        form.value.end_date = `${date}T${hour}:${m}`;
    } else {
        form.value.end_date = '';
    }
});

// Reset form when modal opens
watch(() => props.show, (newVal) => {
    if (newVal) {
        form.value = {
            client_name: '',
            client_cin: '',
            client_phone: '',
            client_email: authStore.user?.email || '',
            start_date: '',
            end_date: '',
            price_per_day: 150,
            pickup_location: '',
            return_location: '',
            notes: '',
        };
        // Reset local refs

        startDateDate.value = '';
        startHour.value = '09';
        startMinute.value = '00';
        endDateDate.value = '';
        endHour.value = '09';
        endMinute.value = '00';
        
        formError.value = '';
        success.value = false;
    }
});

const validateForm = () => {
    if (!form.value.client_name.trim()) {
        formError.value = 'Le nom est requis';
        return false;
    }
    if (!form.value.client_cin.trim()) {
        formError.value = 'Le CIN est requis';
        return false;
    }
    if (!form.value.client_phone.trim()) {
        formError.value = 'Le téléphone est requis';
        return false;
    }
    if (!form.value.start_date) {
        formError.value = 'La date de début est requise';
        return false;
    }
    if (!form.value.end_date) {
        formError.value = 'La date de fin est requise';
        return false;
    }
    if (durationDays.value <= 0) {
        formError.value = 'La date de fin doit être après la date de début';
        return false;
    }
    formError.value = '';
    return true;
};

const submitReservation = async () => {
    if (!validateForm() || !props.car) return;

    // Check availability first
    try {
        const isAvailable = await checkAvailability(
            props.car.id, 
            form.value.start_date, 
            form.value.end_date
        );

        if (!isAvailable) {
            formError.value = "Date deja reservé choisir un autre date";
            return;
        }

        await createReservation({
            user_id: authStore.user?.id || null, // Allow null for guests
            car_id: props.car.id,
            client_name: form.value.client_name,
            client_cin: form.value.client_cin,
            client_phone: form.value.client_phone,
            client_email: form.value.client_email || null,
            start_date: form.value.start_date,
            end_date: form.value.end_date,
            duration_days: durationDays.value,
            price_per_day: form.value.price_per_day,
            total_price: totalPrice.value,
            status: 'pending', // Set to pending (En Attente) for admin review
            pickup_location: form.value.pickup_location || null,
            return_location: form.value.return_location || null,
            notes: form.value.notes || null,
        });

        success.value = true;
        setTimeout(() => {
            emit('success');
            emit('close');
        }, 2000);
    } catch (e: any) {
        formError.value = e.message || 'Une erreur est survenue';
    }
};

const closeModal = () => {
    emit('close');
};

// Get today's date for min attribute
const today = new Date().toISOString().split('T')[0];
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
                <!-- Backdrop -->
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>

                <!-- Modal -->
                <div class="flex min-h-full items-center justify-center p-4">
                    <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        
                        <!-- Header with car preview -->
                        <div class="shrink-0 relative">
                            <!-- Car image banner -->
                            <div v-if="car" class="h-32 bg-gray-900 overflow-hidden relative">
                                <img 
                                    :src="car.image_url || 'https://via.placeholder.com/800x200?text=No+Image'" 
                                    :alt="`${car.brand} ${car.model}`"
                                    class="w-full h-full object-cover opacity-60"
                                >
                                <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                                <div class="absolute bottom-3 left-5 right-5 flex items-end justify-between">
                                    <div>
                                        <h2 class="text-xl font-bold text-white">Réserver une voiture</h2>
                                        <p class="text-white/70 text-sm mt-0.5 flex items-center gap-1.5">
                                            <CarIcon class="w-3.5 h-3.5" />
                                            {{ car.brand }} {{ car.model }}
                                            <span v-if="authStore.user" class="text-white/50">· {{ car.plate_number }}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- Close button -->
                            <button 
                                @click="closeModal" 
                                class="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 text-white/80 hover:bg-black/50 hover:text-white backdrop-blur-sm transition-all"
                            >
                                <X class="w-4 h-4" />
                            </button>
                        </div>

                        <!-- Scrollable Content -->
                        <div class="flex-1 overflow-y-auto">

                            <!-- Success Message -->
                            <div v-if="success" class="p-8">
                                <div class="text-center">
                                    <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-50 ring-4 ring-emerald-100">
                                        <CheckCircle2 class="h-10 w-10 text-emerald-500" />
                                    </div>
                                    <h3 class="mt-5 text-xl font-bold text-gray-900">Réservation envoyée !</h3>
                                    <p class="mt-2 text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                                        Votre demande de réservation a été envoyée avec succès. 
                                        Vous recevrez une confirmation sous peu.
                                    </p>
                                </div>
                            </div>

                            <!-- Form -->
                            <form v-else @submit.prevent="submitReservation" class="p-5 space-y-5">
                                <!-- Error Message -->
                                <div v-if="formError" class="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    <AlertCircle class="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                                    <span>{{ formError }}</span>
                                </div>

                                <!-- Client Information -->
                                <div>
                                    <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                            <User class="w-3.5 h-3.5 text-indigo-600" />
                                        </div>
                                        Informations personnelles
                                    </h3>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label class="form-label">Nom complet *</label>
                                            <div class="form-input-wrapper">
                                                <User class="form-input-icon" />
                                                <input 
                                                    v-model="form.client_name"
                                                    type="text" 
                                                    required
                                                    class="form-input"
                                                    placeholder="Votre nom complet"
                                                >
                                            </div>
                                        </div>
                                        <div>
                                            <label class="form-label">CIN *</label>
                                            <div class="form-input-wrapper">
                                                <CreditCard class="form-input-icon" />
                                                <input 
                                                    v-model="form.client_cin"
                                                    type="text" 
                                                    required
                                                    class="form-input"
                                                    placeholder="Numéro de carte d'identité"
                                                >
                                            </div>
                                        </div>
                                        <div>
                                            <label class="form-label">Téléphone *</label>
                                            <div class="form-input-wrapper">
                                                <Phone class="form-input-icon" />
                                                <input 
                                                    v-model="form.client_phone"
                                                    type="tel" 
                                                    required
                                                    class="form-input"
                                                    placeholder="+216 XX XXX XXX"
                                                >
                                            </div>
                                        </div>
                                        <div>
                                            <label class="form-label">Email</label>
                                            <div class="form-input-wrapper">
                                                <Mail class="form-input-icon" />
                                                <input 
                                                    v-model="form.client_email"
                                                    type="email"
                                                    class="form-input"
                                                    placeholder="votre@email.com"
                                                >
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Reservation Dates -->
                                <div>
                                    <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                                            <CalendarDays class="w-3.5 h-3.5 text-violet-600" />
                                        </div>
                                        Dates de location
                                    </h3>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <!-- Start Date -->
                                        <div class="space-y-2">
                                            <label class="form-label">Date de début *</label>
                                            <div class="form-input-wrapper">
                                                <CalendarDays class="form-input-icon" />
                                                <input 
                                                    v-model="startDateDate"
                                                    type="date" 
                                                    :min="today"
                                                    required
                                                    class="form-input"
                                                >
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <Clock class="w-3.5 h-3.5 text-gray-400" />
                                                <div class="flex items-center gap-1 flex-1">
                                                    <select v-model="startHour" class="time-select">
                                                        <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
                                                    </select>
                                                    <span class="text-gray-400 font-bold text-sm">:</span>
                                                    <select v-model="startMinute" class="time-select">
                                                        <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <p v-if="form.start_date" class="text-xs text-indigo-600 font-semibold pl-0.5">
                                                {{ formatDate(form.start_date) }}
                                            </p>
                                        </div>

                                        <!-- End Date -->
                                        <div class="space-y-2">
                                            <label class="form-label">Date de fin *</label>
                                            <div class="form-input-wrapper">
                                                <CalendarDays class="form-input-icon" />
                                                <input 
                                                    v-model="endDateDate"
                                                    type="date" 
                                                    :min="startDateDate || today"
                                                    required
                                                    class="form-input"
                                                >
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <Clock class="w-3.5 h-3.5 text-gray-400" />
                                                <div class="flex items-center gap-1 flex-1">
                                                    <select v-model="endHour" class="time-select">
                                                        <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
                                                    </select>
                                                    <span class="text-gray-400 font-bold text-sm">:</span>
                                                    <select v-model="endMinute" class="time-select">
                                                        <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <p v-if="form.end_date" class="text-xs text-indigo-600 font-semibold pl-0.5">
                                                {{ formatDate(form.end_date) }}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Pricing Summary -->
                                <div v-if="durationDays > 0" class="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-4 ring-1 ring-indigo-100">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                <CalendarDays class="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p class="text-xs text-indigo-600 font-medium">Durée</p>
                                                <p class="text-lg font-bold text-indigo-900">{{ durationDays }} jour{{ durationDays > 1 ? 's' : '' }}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Optional Fields -->
                                <div>
                                    <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                                            <MapPin class="w-3.5 h-3.5 text-gray-600" />
                                        </div>
                                        Informations supplémentaires
                                    </h3>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label class="form-label">Lieu de prise en charge</label>
                                            <div class="form-input-wrapper">
                                                <MapPin class="form-input-icon" />
                                                <input 
                                                    v-model="form.pickup_location"
                                                    type="text"
                                                    class="form-input"
                                                    placeholder="Aéroport, agence, etc."
                                                >
                                            </div>
                                        </div>
                                        <div>
                                            <label class="form-label">Lieu de retour</label>
                                            <div class="form-input-wrapper">
                                                <MapPin class="form-input-icon" />
                                                <input 
                                                    v-model="form.return_location"
                                                    type="text"
                                                    class="form-input"
                                                    placeholder="Aéroport, agence, etc."
                                                >
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <label class="form-label">Notes</label>
                                        <div class="form-input-wrapper items-start">
                                            <FileText class="form-input-icon mt-2.5" />
                                            <textarea 
                                                v-model="form.notes"
                                                rows="2"
                                                class="form-input"
                                                placeholder="Informations complémentaires..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <!-- Submit -->
                                <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button 
                                        type="button"
                                        @click="closeModal"
                                        class="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        type="submit"
                                        :disabled="loading || durationDays <= 0"
                                        class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                                    >
                                        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
                                        <Key v-else class="w-4 h-4" />
                                        <span>{{ loading ? 'Envoi en cours...' : 'Confirmer la réservation' }}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* Modal entrance animation */
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

/* Form field styles */
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

/* Time selects */
.time-select {
    flex: 1;
    padding: 0.4rem 0.25rem;
    font-size: 0.8125rem;
    text-align: center;
    color: rgb(55 65 81);
    background: rgb(249 250 251);
    border: 1px solid rgb(229 231 235);
    border-radius: 0.5rem;
    outline: none;
    transition: all 0.15s ease;
    cursor: pointer;
}

.time-select:focus {
    border-color: rgb(129 140 248);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}
</style>
