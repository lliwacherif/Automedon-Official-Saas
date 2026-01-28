<script setup lang="ts">
import { onMounted } from 'vue';
import { useStore } from '@/composables/useStore';
import { ShoppingBag, Loader2, Info } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { apps, loading, fetchApps } = useStore();

onMounted(() => {
    fetchApps();
});
</script>

<template>
    <div class="p-6">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-2xl font-bold text-gray-800 flex items-center">
                <ShoppingBag class="w-8 h-8 mr-3 text-indigo-600" />
                Store (Apps)
            </h1>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
            <Loader2 class="animate-spin h-8 w-8 text-indigo-600" />
        </div>

        <div v-else-if="apps.length === 0" class="text-center py-12 bg-white rounded-lg shadow-sm">
            <ShoppingBag class="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p class="text-gray-500">Aucune application disponible pour le moment.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="app in apps" :key="app.id" class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100">
                <div class="p-6 flex-1 flex flex-col">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center">
                            <div class="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center mr-4 overflow-hidden border border-indigo-100">
                                <img v-if="app.icon_url" :src="app.icon_url" :alt="app.name" class="w-full h-full object-cover" />
                                <ShoppingBag v-else class="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-gray-900">{{ app.name }}</h3>
                                <div class="mt-1">
                                    <span v-if="app.price > 0" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {{ app.price.toFixed(2) }} DT
                                    </span>
                                    <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Gratuit
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <p class="text-gray-600 text-sm mb-4 line-clamp-3">
                        {{ app.description }}
                    </p>

                    <div class="mt-auto pt-4 border-t border-gray-100">
                        <button class="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                            <Info class="w-4 h-4 mr-2" />
                            Voir détails
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
