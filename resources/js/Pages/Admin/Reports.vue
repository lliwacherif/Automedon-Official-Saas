<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useReportedClients, type ReportedClient } from '@/composables/useReportedClients';
import { useI18n } from 'vue-i18n';
import { Search, AlertTriangle, UserPlus, List } from 'lucide-vue-next';

const { t } = useI18n();
const { reportedClients, loading, error, fetchReportedClients, addReport } = useReportedClients();

const search = ref('');
const newReport = ref({
    client_name: '',
    client_cin: '',
    client_phone: '',
    description: ''
});

const submitting = ref(false);

onMounted(() => {
    fetchReportedClients();
});

async function handleSubmit() {
    if (!newReport.value.client_name || !newReport.value.client_cin || !newReport.value.client_phone || !newReport.value.description) {
        return;
    }
    
    submitting.value = true;
    try {
        await addReport({
            client_name: newReport.value.client_name,
            client_cin: newReport.value.client_cin,
            client_phone: newReport.value.client_phone,
            description: newReport.value.description
        });
        
        // Reset form
        newReport.value = {
            client_name: '',
            client_cin: '',
            client_phone: '',
            description: ''
        };
        
    } catch (e) {
        // Error handled in composable
    } finally {
        submitting.value = false;
    }
}

function formatDate(dateString: string) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
}

// Filtered list
const filteredReports = ref<ReportedClient[]>([]);

// Simple watch/computed effect for search (using function to avoid complexity in template)
import { computed } from 'vue';
const displayedReports = computed(() => {
    const term = search.value.toLowerCase();
    return reportedClients.value.filter(client => 
        client.client_name.toLowerCase().includes(term) || 
        client.client_cin.toLowerCase().includes(term)
    );
});
</script>

<template>
    <div class="p-6 max-w-7xl mx-auto">
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 flex items-center">
                <AlertTriangle class="w-8 h-8 text-red-600 mr-3" />
                {{ t('reports.title') }}
            </h1>
            <p class="text-gray-600 mt-2">{{ t('reports.subtitle') }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Left Section: Add Report Form -->
            <div class="lg:col-span-1">
                <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                    <h2 class="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                        <UserPlus class="w-5 h-5 mr-2" />
                        {{ t('reports.add_report') }}
                    </h2>

                    <form @submit.prevent="handleSubmit" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                {{ t('reports.client_name') }}
                            </label>
                            <input 
                                v-model="newReport.client_name"
                                type="text"
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            >
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                {{ t('reports.client_cin') }}
                            </label>
                            <input 
                                v-model="newReport.client_cin"
                                type="text"
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            >
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                {{ t('reports.client_phone') }}
                            </label>
                            <input 
                                v-model="newReport.client_phone"
                                type="text"
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            >
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                {{ t('reports.description') }}
                            </label>
                            <textarea 
                                v-model="newReport.description"
                                rows="4"
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            ></textarea>
                        </div>

                        <button 
                            type="submit"
                            :disabled="submitting || loading"
                            class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                        >
                            {{ submitting ? t('common.saving') : t('reports.submit') }}
                        </button>
                    </form>
                </div>
            </div>

            <!-- Right Section: List of Reported Clients -->
            <div class="lg:col-span-2">
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                        <h2 class="text-xl font-semibold text-gray-800 flex items-center">
                            <List class="w-5 h-5 mr-2" />
                            {{ t('reports.list_title') }}
                        </h2>
                        
                        <div class="relative w-full sm:w-64">
                            <input 
                                v-model="search"
                                type="text"
                                :placeholder="t('reports.search_placeholder')"
                                class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                            <Search class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                    </div>

                    <div v-if="loading && displayedReports.length === 0" class="p-8 text-center text-gray-500">
                        {{ t('common.loading') }}...
                    </div>

                    <div v-else-if="displayedReports.length === 0" class="p-8 text-center text-gray-500 bg-gray-50">
                        {{ t('reports.no_reports') }}
                    </div>

                    <ul v-else class="divide-y divide-gray-200">
                        <li v-for="client in displayedReports" :key="client.id" class="p-6 hover:bg-gray-50 transition-colors">
                            <div class="flex flex-col md:flex-row md:justify-between md:items-start">
                                <div class="flex-1">
                                    <div class="flex items-center mb-2">
                                        <h3 class="text-lg font-bold text-gray-900 mr-3">{{ client.client_name }}</h3>
                                        <span class="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                                            CIN: {{ client.client_cin }}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-2 font-mono">
                                        📞 {{ client.client_phone }}
                                    </p>
                                    <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-md">
                                        <p class="text-gray-800">{{ client.description }}</p>
                                    </div>
                                </div>
                                <div class="mt-4 md:mt-0 md:ml-6 text-sm text-gray-500">
                                    {{ formatDate(client.created_at) }}
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>
