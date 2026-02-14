<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink } from 'vue-router';
import type { Database } from '@/types/supabase';
import { Car, Search, History, ChevronRight, Loader2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

type CarData = Database['public']['Tables']['cars']['Row'];

const { t } = useI18n();
const { tenantPath } = useTenantLink();

const cars = ref<CarData[]>([]);
const loading = ref(true);
const searchTerm = ref('');

onMounted(async () => {
    await fetchCars();
});

async function fetchCars() {
    try {
        const tenantStore = useTenantStore();
        
        let query = supabase
            .from('cars')
            .select('*');

        if (tenantStore.currentTenant?.id) {
            query = query.eq('tenant_id', tenantStore.currentTenant.id);
        }
           
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        cars.value = data || [];
    } catch (error) {
        console.error('Error fetching cars:', error);
    } finally {
        loading.value = false;
    }
}

const filteredCars = () => {
    if (!searchTerm.value) return cars.value;
    const term = searchTerm.value.toLowerCase();
    return cars.value.filter(car => 
        car.make?.toLowerCase().includes(term) ||
        car.model.toLowerCase().includes(term) ||
        car.license_plate.toLowerCase().includes(term)
    );
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'disponible': return 'bg-green-100 text-green-800';
        case 'loue': return 'bg-blue-100 text-blue-800';
        case 'maintenance': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-200">
                    <History class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ t('admin.history.title') }}</h1>
                    <p class="text-sm text-gray-500">{{ t('admin.history.subtitle') }}</p>
                </div>
            </div>

            <!-- Search -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-4">
                <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    {{ t('admin.history.search_placeholder') }}
                </label>
                <div class="relative max-w-md">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        v-model="searchTerm"
                        type="text" 
                        class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        :placeholder="t('admin.history.search_placeholder')"
                    />
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">{{ t('admin.history.loading') }}</p>
            </div>

            <!-- Table (Desktop) -->
            <div v-else class="hidden md:block bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <table class="min-w-full">
                    <thead>
                        <tr class="border-b border-gray-100">
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{{ t('admin.history.vehicle') }}</th>
                            <th class="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{{ t('admin.history.license_plate') }}</th>
                            <th class="px-5 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">{{ t('common.actions') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="filteredCars().length === 0">
                            <td colspan="3" class="px-5 py-16 text-center">
                                <div class="flex flex-col items-center">
                                    <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                        <Car class="w-6 h-6 text-gray-300" />
                                    </div>
                                    <p class="text-gray-400 font-medium">{{ t('admin.history.no_cars') }}</p>
                                </div>
                            </td>
                        </tr>
                        <tr 
                            v-for="car in filteredCars()" 
                            :key="car.id" 
                            class="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                        >
                            <td class="px-5 py-3.5">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                                        <img v-if="car.image_url" :src="car.image_url" alt="" class="w-full h-full object-cover">
                                        <Car v-else class="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <div class="text-sm font-bold text-gray-900">{{ car.make || car.brand }} {{ car.model }}</div>
                                        <div class="text-xs text-gray-400">{{ car.year || '' }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-5 py-3.5">
                                <span class="inline-flex px-2.5 py-1 text-xs font-bold text-gray-600 bg-gray-50 rounded-lg ring-1 ring-gray-200 font-mono">
                                    {{ car.license_plate }}
                                </span>
                            </td>
                            <td class="px-5 py-3.5 text-right">
                                <RouterLink 
                                    :to="tenantPath(`/admin/history/${car.id}`)" 
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                    <History class="w-3.5 h-3.5" />
                                    {{ t('admin.history.view_history') }}
                                    <ChevronRight class="w-3 h-3" />
                                </RouterLink>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Mobile Cards -->
            <div v-if="!loading" class="md:hidden space-y-3">
                <div v-if="filteredCars().length === 0" class="flex flex-col items-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
                    <Car class="w-8 h-8 text-gray-300 mb-3" />
                    <p class="text-gray-400 font-medium">{{ t('admin.history.no_cars') }}</p>
                </div>

                <RouterLink
                    v-for="car in filteredCars()"
                    :key="car.id"
                    :to="tenantPath(`/admin/history/${car.id}`)"
                    class="flex items-center gap-3 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-4 hover:bg-indigo-50/30 transition-colors"
                >
                    <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                        <img v-if="car.image_url" :src="car.image_url" alt="" class="w-full h-full object-cover">
                        <Car v-else class="w-5 h-5 text-gray-400" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-gray-900">{{ car.make || car.brand }} {{ car.model }}</div>
                        <div class="text-xs text-gray-400 font-mono mt-0.5">{{ car.license_plate }}</div>
                    </div>
                    <ChevronRight class="w-5 h-5 text-gray-300 shrink-0" />
                </RouterLink>
            </div>
        </div>
    </div>
</template>
