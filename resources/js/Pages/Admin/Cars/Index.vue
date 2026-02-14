<script setup lang="ts">
import { onMounted } from 'vue';
import { useCars, type CarStatus } from '@/composables/useCars';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink } from 'vue-router';
import { 
    Car, 
    Edit, 
    Trash2, 
    Plus,
    Loader2,
    ChevronDown,
    CircleCheck,
    CircleX,
    Wrench,
} from 'lucide-vue-next';

const { carsByBrand, loading, fetchCars, deleteCar, updateCar } = useCars();
const { tenantPath } = useTenantLink();

onMounted(() => {
    fetchCars();
});

async function handleDelete(id: number) {
    if (confirm('Are you sure you want to delete this car?')) {
        await deleteCar(id);
    }
}

async function handleStatusChange(id: number, newStatus: CarStatus) {
    await updateCar(id, { status: newStatus });
}

function getStatusClass(status: string) {
    switch (status) {
        case 'disponible': return 'status-disponible';
        case 'loue': return 'status-loue';
        case 'maintenance': return 'status-maintenance';
        default: return 'status-disponible';
    }
}

// Helper to get brand logo path
const getBrandLogo = (brand: string) => {
    return `/images/${brand}.png`;
};
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                        <Car class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ $t('admin.fleet.title') }}</h1>
                        <p class="text-sm text-gray-500">Gérez votre flotte de véhicules</p>
                    </div>
                </div>
                <RouterLink 
                    :to="tenantPath('/admin/cars/create')" 
                    class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                >
                    <Plus class="w-4 h-4" />
                    {{ $t('admin.fleet.add_car') }}
                </RouterLink>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement de la flotte...</p>
            </div>

            <!-- Brand Groups -->
            <div v-else class="space-y-5">
                <div 
                    v-for="(brand, brandName) in carsByBrand" 
                    :key="brandName" 
                    class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden"
                >
                    <!-- Brand Header -->
                    <div class="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                            <img 
                                :src="getBrandLogo(brandName as string)" 
                                :alt="brandName as string" 
                                class="w-6 h-6 object-contain"
                                @error="($event.target as HTMLImageElement).style.display='none'"
                            >
                        </div>
                        <h2 class="text-base font-bold text-gray-900">{{ brandName }}</h2>
                        <span class="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                            {{ brand.length }}
                        </span>
                    </div>
                    
                    <!-- Empty -->
                    <div v-if="brand.length === 0" class="flex flex-col items-center py-12">
                        <Car class="w-6 h-6 text-gray-300 mb-2" />
                        <p class="text-gray-400 text-sm">{{ $t('admin.fleet.no_cars') }}</p>
                    </div>

                    <div v-else>
                        <!-- Desktop Table -->
                        <div class="hidden md:block overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b border-gray-100">
                                        <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                            {{ $t('admin.fleet.model') }}
                                        </th>
                                        <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                            {{ $t('admin.fleet.plate_number') }}
                                        </th>
                                        <th class="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                            {{ $t('admin.fleet.status') }}
                                        </th>
                                        <th class="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr 
                                        v-for="car in brand" 
                                        :key="car.id" 
                                        class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                                    >
                                        <td class="px-5 py-3.5">
                                            <span class="text-sm font-semibold text-gray-900">{{ car.model }}</span>
                                        </td>
                                        <td class="px-5 py-3.5">
                                            <span class="inline-flex px-2.5 py-1 text-xs font-bold text-gray-600 bg-gray-50 rounded-lg ring-1 ring-gray-200 font-mono">
                                                {{ car.plate_number }}
                                            </span>
                                        </td>
                                        <td class="px-5 py-3.5">
                                            <div class="relative inline-flex">
                                                <select 
                                                    :value="car.status"
                                                    @change="handleStatusChange(car.id, ($event.target as HTMLSelectElement).value as CarStatus)"
                                                    :disabled="car.status !== 'maintenance'"
                                                    title="Le statut ne peut être modifié manuellement que s'il est en maintenance."
                                                    :class="[getStatusClass(car.status), { 'opacity-60 cursor-not-allowed': car.status !== 'maintenance' }]"
                                                    class="status-select appearance-none pr-7 pl-2.5 py-1 text-xs font-bold rounded-lg border-0 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    <option value="disponible">{{ $t('admin.fleet.disponible') }}</option>
                                                    <option value="loue">{{ $t('admin.fleet.loue') }}</option>
                                                    <option value="maintenance">{{ $t('admin.fleet.maintenance') }}</option>
                                                </select>
                                                <ChevronDown 
                                                    v-if="car.status === 'maintenance'" 
                                                    class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" 
                                                    :class="{
                                                        'text-emerald-600': car.status === 'disponible',
                                                        'text-blue-600': car.status === 'loue',
                                                        'text-amber-600': car.status === 'maintenance',
                                                    }"
                                                />
                                            </div>
                                        </td>
                                        <td class="px-5 py-3.5 text-right">
                                            <div class="flex items-center justify-end gap-1">
                                                <RouterLink 
                                                    :to="tenantPath(`/admin/cars/${car.id}/edit`)" 
                                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Edit class="w-4 h-4 text-indigo-500" />
                                                </RouterLink>
                                                <button 
                                                    @click="handleDelete(car.id)" 
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
                        <div class="md:hidden divide-y divide-gray-50">
                            <div 
                                v-for="car in brand" 
                                :key="car.id" 
                                class="p-4"
                            >
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 class="text-sm font-bold text-gray-900">{{ car.model }}</h3>
                                        <span class="inline-flex mt-1 px-2 py-0.5 text-[11px] font-bold text-gray-500 bg-gray-50 rounded-md ring-1 ring-gray-200 font-mono">
                                            {{ car.plate_number }}
                                        </span>
                                    </div>
                                    <div class="relative">
                                        <select 
                                            :value="car.status"
                                            @change="handleStatusChange(car.id, ($event.target as HTMLSelectElement).value as CarStatus)"
                                            :disabled="car.status !== 'maintenance'"
                                            :class="[getStatusClass(car.status), { 'opacity-60 cursor-not-allowed': car.status !== 'maintenance' }]"
                                            class="status-select appearance-none pr-6 pl-2 py-1 text-xs font-bold rounded-lg border-0 focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="disponible">{{ $t('admin.fleet.disponible') }}</option>
                                            <option value="loue">{{ $t('admin.fleet.loue') }}</option>
                                            <option value="maintenance">{{ $t('admin.fleet.maintenance') }}</option>
                                        </select>
                                        <ChevronDown 
                                            v-if="car.status === 'maintenance'" 
                                            class="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-600 pointer-events-none" 
                                        />
                                    </div>
                                </div>
                                
                                <div class="flex justify-end gap-1 pt-3 border-t border-gray-100">
                                    <RouterLink 
                                        :to="tenantPath(`/admin/cars/${car.id}/edit`)" 
                                        class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                    >
                                        <Edit class="w-4 h-4 text-indigo-500" />
                                    </RouterLink>
                                    <button 
                                        @click="handleDelete(car.id)" 
                                        class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 class="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.status-disponible {
    background: rgb(209 250 229);
    color: rgb(22 101 52);
    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.15);
}

.status-loue {
    background: rgb(219 234 254);
    color: rgb(30 64 175);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.15);
}

.status-maintenance {
    background: rgb(254 249 195);
    color: rgb(133 77 14);
    box-shadow: inset 0 0 0 1px rgba(202, 138, 4, 0.15);
}
</style>
