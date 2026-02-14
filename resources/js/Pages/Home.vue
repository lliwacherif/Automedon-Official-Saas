<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useCars, type Car } from '@/composables/useCars';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import ReservationModal from '@/components/ReservationModal.vue';
import CarAvailabilityModal from '@/components/CarAvailabilityModal.vue';
import { Eye, Calendar, Key, Fuel, Gauge, Users, CircleCheck, CircleX, Wrench, Search, Filter, ChevronDown, Car as CarIcon, Loader2 } from 'lucide-vue-next';

const { cars, loading, fetchCars } = useCars();
const authStore = useAuthStore();
const router = useRouter();

const filters = ref({
    search: '',
    status: 'all'
});

// Modal States
const showReservationModal = ref(false);
const showAvailabilityModal = ref(false);
const selectedCar = ref<Car | null>(null);

onMounted(() => {
    fetchCars();
});

// Filtrage côté client
const filteredCars = computed(() => {
    let result = cars.value;

    // Filtre par statut
    if (filters.value.status !== 'all') {
        result = result.filter(car => car.status === filters.value.status);
    }

    // Filtre par recherche (brand ou model)
    if (filters.value.search) {
        const searchLower = filters.value.search.toLowerCase();
        result = result.filter(car => 
            car.brand.toLowerCase().includes(searchLower) ||
            car.model.toLowerCase().includes(searchLower) ||
            car.plate_number.toLowerCase().includes(searchLower)
        );
    }

    return result;
});

// Helper to get brand logo path
const getBrandLogo = (brand: string) => {
    return `/images/${brand}.png`;
};

import { formatDate } from '@/utils/date';

// Handle booking components
const openAvailabilityModal = (car: Car) => {
    selectedCar.value = car;
    showAvailabilityModal.value = true;
};

const closeAvailabilityModal = () => {
    showAvailabilityModal.value = false;
    selectedCar.value = null;
};

const openBookingModal = (car: Car) => {
    // Auth check removed to allow guest reservations
    selectedCar.value = car;
    showReservationModal.value = true;
};

const closeBookingModal = () => {
    showReservationModal.value = false;
    selectedCar.value = null;
};

const onReservationSuccess = () => {
    // Refresh cars to update status
    fetchCars();
};
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <main class="w-full py-6 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div class="max-w-[1600px] mx-auto space-y-5">

                <!-- Header -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <CarIcon class="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ $t('fleet.title') }}</h1>
                            <p class="text-sm text-gray-500">{{ filteredCars.length }} véhicule{{ filteredCars.length !== 1 ? 's' : '' }} disponible{{ filteredCars.length !== 1 ? 's' : '' }}</p>
                        </div>
                    </div>
                </div>

                <!-- Search & Filter -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-4">
                    <div class="flex flex-col sm:flex-row gap-3">
                        <div class="flex-1">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">{{ $t('fleet.search_placeholder') }}</label>
                            <div class="relative">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    v-model="filters.search" 
                                    type="text" 
                                    :placeholder="$t('fleet.search_placeholder')" 
                                    class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                >
                            </div>
                        </div>
                        <div class="sm:w-64">
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Statut</label>
                            <div class="relative">
                                <Filter class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select 
                                    v-model="filters.status" 
                                    class="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 appearance-none cursor-pointer transition-all"
                                >
                                    <option value="all">{{ $t('fleet.all_statuses') }}</option>
                                    <option value="disponible">{{ $t('admin.fleet.disponible') }}</option>
                                    <option value="loue">{{ $t('admin.fleet.loue') }}</option>
                                    <option value="maintenance">{{ $t('admin.fleet.maintenance') }}</option>
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
                    <p class="text-gray-500 font-medium">{{ $t('fleet.loading') }}</p>
                </div>

                <!-- Empty -->
                <div v-else-if="filteredCars.length === 0" class="flex flex-col items-center py-20 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                    <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                        <CarIcon class="w-7 h-7 text-gray-300" />
                    </div>
                    <p class="text-gray-400 font-medium">Aucune voiture trouvée.</p>
                </div>

                <!-- Cars Grid -->
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    <div 
                        v-for="car in filteredCars" 
                        :key="car.id" 
                        class="car-card group"
                    >
                        <!-- Image Container -->
                        <div class="relative w-full aspect-[4/3] overflow-hidden bg-gray-900">
                            <img 
                                :src="car.image_url || 'https://via.placeholder.com/400x300?text=No+Image'" 
                                :alt="`${car.brand} ${car.model}`" 
                                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                            >
                            <!-- Gradient overlay -->
                            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>

                            <!-- Status Badge -->
                            <div class="absolute top-3 left-3">
                                <span 
                                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full backdrop-blur-md shadow-sm"
                                    :class="{
                                        'bg-emerald-500/90 text-white': car.status === 'disponible',
                                        'bg-amber-500/90 text-white': car.status === 'loue',
                                        'bg-red-500/90 text-white': car.status === 'maintenance',
                                    }"
                                >
                                    <CircleCheck v-if="car.status === 'disponible'" class="w-3 h-3" />
                                    <CircleX v-else-if="car.status === 'loue'" class="w-3 h-3" />
                                    <Wrench v-else class="w-3 h-3" />
                                    {{ car.status === 'disponible' ? 'Disponible' : car.status === 'loue' ? 'Loué' : 'Maintenance' }}
                                </span>
                            </div>

                            <!-- Brand Logo -->
                            <div class="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-xl p-1.5 shadow-lg ring-1 ring-white/20">
                                <img 
                                    :src="getBrandLogo(car.brand)" 
                                    :alt="car.brand" 
                                    class="h-7 w-7 object-contain"
                                >
                            </div>

                            <!-- Car name on image -->
                            <div class="absolute bottom-3 left-3">
                                <h3 class="text-white font-bold text-lg leading-tight drop-shadow-lg">
                                    {{ car.brand }} {{ car.model }}
                                </h3>
                                <p v-if="authStore.user || authStore.isAdmin" class="text-white/70 text-xs font-medium mt-0.5">
                                    {{ car.plate_number }}
                                </p>
                            </div>
                        </div>
                        
                        <!-- Card Body -->
                        <div class="p-4 flex flex-col gap-3">
                            <!-- Quick Specs -->
                            <div v-if="car.mileage" class="flex items-center gap-1.5 text-xs text-gray-500">
                                <Gauge class="w-3.5 h-3.5" />
                                <span>{{ car.mileage?.toLocaleString() }} km</span>
                            </div>

                            <!-- Action Buttons -->
                            <div class="grid grid-cols-2 gap-2">
                                <button 
                                    @click="openAvailabilityModal(car)"
                                    class="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-xl text-gray-700 bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-200 hover:ring-gray-300 transition-all duration-200"
                                >
                                    <Calendar class="w-4 h-4 text-indigo-500" />
                                    Dispo
                                </button>
                                <button 
                                    @click="openBookingModal(car)"
                                    class="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all duration-200"
                                >
                                    <Key class="w-4 h-4" />
                                    Réserver
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- Reservation Modal -->
        <ReservationModal 
            :show="showReservationModal" 
            :car="selectedCar"
            @close="closeBookingModal"
            @success="onReservationSuccess"
        />

        <!-- Car Availability Modal -->
        <CarAvailabilityModal
            :show="showAvailabilityModal"
            :car="selectedCar"
            @close="closeAvailabilityModal"
        />
    </div>
</template>

<style scoped>
.car-card {
    background: white;
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 1px solid rgb(229 231 235);
    box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.06),
        0 4px 12px rgba(0, 0, 0, 0.04);
    transition: 
        transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1),
        border-color 0.35s ease;
}

.car-card:hover {
    transform: translateY(-6px);
    border-color: rgb(199 210 254);
    box-shadow: 
        0 12px 28px rgba(79, 70, 229, 0.10),
        0 4px 12px rgba(0, 0, 0, 0.06),
        0 0 0 1px rgba(79, 70, 229, 0.05);
}
</style>
