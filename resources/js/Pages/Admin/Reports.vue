<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useReportedClients, type ReportedClient } from '@/composables/useReportedClients';
import { useI18n } from 'vue-i18n';
import { 
    Search, 
    AlertTriangle, 
    UserPlus, 
    User, 
    CreditCard, 
    Phone, 
    FileText, 
    Loader2, 
    CircleCheck, 
    AlertCircle,
    Calendar,
    ShieldAlert,
} from 'lucide-vue-next';

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
const formError = ref('');
const formSuccess = ref('');

onMounted(() => {
    fetchReportedClients();
});

const wordCount = computed(() => {
    const text = newReport.value.description.trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
});

async function handleSubmit() {
    formError.value = '';
    formSuccess.value = '';

    if (!newReport.value.client_name || !newReport.value.client_cin || !newReport.value.client_phone || !newReport.value.description) {
        formError.value = 'Tous les champs sont requis.';
        return;
    }

    if (wordCount.value < 80) {
        formError.value = `Le motif du signalement doit contenir au moins 80 mots. Actuellement: ${wordCount.value} mot${wordCount.value !== 1 ? 's' : ''}.`;
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
        
        formSuccess.value = 'Signalement ajouté avec succès.';
        newReport.value = {
            client_name: '',
            client_cin: '',
            client_phone: '',
            description: ''
        };

        setTimeout(() => { formSuccess.value = ''; }, 3000);
    } catch (e) {
        formError.value = 'Erreur lors de l\'ajout du signalement.';
    } finally {
        submitting.value = false;
    }
}

function formatDate(dateString: string) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const displayedReports = computed(() => {
    const term = search.value.toLowerCase();
    return reportedClients.value.filter(client => 
        client.client_name.toLowerCase().includes(term) || 
        client.client_cin.toLowerCase().includes(term)
    );
});
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-200">
                    <ShieldAlert class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ t('reports.title') }}</h1>
                    <p class="text-sm text-gray-500">{{ t('reports.subtitle') }}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

                <!-- Add Report Form -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                        <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                <UserPlus class="w-4 h-4 text-red-600" />
                            </div>
                            <h2 class="text-base font-bold text-gray-900">{{ t('reports.add_report') }}</h2>
                        </div>

                        <div class="p-5">
                            <form @submit.prevent="handleSubmit" class="space-y-3">
                                <!-- Error -->
                                <div v-if="formError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                    <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                                    <span>{{ formError }}</span>
                                </div>
                                <!-- Success -->
                                <div v-if="formSuccess" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                    <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{{ formSuccess }}</span>
                                </div>

                                <div>
                                    <label class="form-label">{{ t('reports.client_name') }} *</label>
                                    <div class="form-input-wrapper">
                                        <User class="form-input-icon" />
                                        <input v-model="newReport.client_name" type="text" required class="form-input" placeholder="Nom complet">
                                    </div>
                                </div>

                                <div>
                                    <label class="form-label">{{ t('reports.client_cin') }} *</label>
                                    <div class="form-input-wrapper">
                                        <CreditCard class="form-input-icon" />
                                        <input v-model="newReport.client_cin" type="text" required class="form-input" placeholder="CIN">
                                    </div>
                                </div>

                                <div>
                                    <label class="form-label">{{ t('reports.client_phone') }} *</label>
                                    <div class="form-input-wrapper">
                                        <Phone class="form-input-icon" />
                                        <input v-model="newReport.client_phone" type="text" required class="form-input" placeholder="Téléphone">
                                    </div>
                                </div>

                                <div>
                                    <label class="form-label">{{ t('reports.description') }} *</label>
                                    <div class="form-input-wrapper items-start">
                                        <FileText class="form-input-icon mt-2.5" />
                                        <textarea 
                                            v-model="newReport.description"
                                            rows="6"
                                            required
                                            class="form-input"
                                            placeholder="Décrivez en détail le motif du signalement (minimum 80 mots)..."
                                        ></textarea>
                                    </div>
                                    <div class="mt-1.5 flex items-center justify-between px-1">
                                        <p class="text-[11px]" :class="wordCount >= 80 ? 'text-emerald-600 font-bold' : 'text-gray-400'">
                                            {{ wordCount }} / 80 mots min.
                                        </p>
                                        <div v-if="wordCount > 0 && wordCount < 80" class="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                class="h-full rounded-full transition-all duration-300"
                                                :class="wordCount < 40 ? 'bg-red-400' : 'bg-amber-400'"
                                                :style="{ width: `${Math.min((wordCount / 80) * 100, 100)}%` }"
                                            ></div>
                                        </div>
                                        <div v-else-if="wordCount >= 80" class="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                                            <CircleCheck class="w-3 h-3" />
                                            OK
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    type="submit"
                                    :disabled="submitting || loading || wordCount < 80"
                                    class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                                >
                                    <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
                                    <AlertTriangle v-else class="w-4 h-4" />
                                    {{ submitting ? t('common.saving') : t('reports.submit') }}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Reports List -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                        <div class="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <ShieldAlert class="w-4 h-4 text-gray-600" />
                                </div>
                                <div>
                                    <h2 class="text-base font-bold text-gray-900">{{ t('reports.list_title') }}</h2>
                                    <p class="text-xs text-gray-400">{{ displayedReports.length }} signalement{{ displayedReports.length !== 1 ? 's' : '' }}</p>
                                </div>
                            </div>
                            
                            <div class="relative w-full sm:w-64">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    v-model="search"
                                    type="text"
                                    :placeholder="t('reports.search_placeholder')"
                                    class="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                >
                            </div>
                        </div>

                        <!-- Loading -->
                        <div v-if="loading && displayedReports.length === 0" class="flex flex-col items-center justify-center py-16">
                            <Loader2 class="w-7 h-7 text-indigo-600 animate-spin mb-3" />
                            <p class="text-gray-400 text-sm">{{ t('common.loading') }}...</p>
                        </div>

                        <!-- Empty -->
                        <div v-else-if="displayedReports.length === 0" class="flex flex-col items-center py-16">
                            <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                <ShieldAlert class="w-6 h-6 text-gray-300" />
                            </div>
                            <p class="text-gray-400 font-medium">{{ t('reports.no_reports') }}</p>
                        </div>

                        <!-- List -->
                        <div v-else class="divide-y divide-gray-50">
                            <div 
                                v-for="client in displayedReports" 
                                :key="client.id" 
                                class="p-5 hover:bg-indigo-50/20 transition-colors"
                            >
                                <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                                    <div class="flex-1 min-w-0">
                                        <!-- Client Info -->
                                        <div class="flex flex-wrap items-center gap-2 mb-2.5">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                                    <User class="w-4 h-4 text-red-500" />
                                                </div>
                                                <h3 class="text-sm font-bold text-gray-900">{{ client.client_name }}</h3>
                                            </div>
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-red-700 bg-red-50 rounded-lg ring-1 ring-red-200/50">
                                                <CreditCard class="w-3 h-3" />
                                                {{ client.client_cin }}
                                            </span>
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-gray-500 bg-gray-50 rounded-lg ring-1 ring-gray-200/50">
                                                <Phone class="w-3 h-3" />
                                                {{ client.client_phone }}
                                            </span>
                                        </div>

                                        <!-- Description -->
                                        <div class="bg-red-50/50 p-3.5 rounded-xl ring-1 ring-red-100">
                                            <p class="text-sm text-gray-700 leading-relaxed">{{ client.description }}</p>
                                        </div>
                                    </div>

                                    <!-- Date -->
                                    <div class="flex items-center gap-1.5 text-xs text-gray-400 shrink-0 md:mt-1">
                                        <Calendar class="w-3.5 h-3.5" />
                                        {{ formatDate(client.created_at) }}
                                    </div>
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
    border-color: rgb(248 113 113);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
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
