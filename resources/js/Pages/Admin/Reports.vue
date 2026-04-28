<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useReportedClients } from '@/composables/useReportedClients';
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
    ChevronDown,
    Users,
    Sparkles,
} from 'lucide-vue-next';

const { t } = useI18n();
const { reportedClients, loading, fetchReportedClients, addReport } = useReportedClients();

// Form
const newReport = ref({
    client_name: '',
    client_cin: '',
    client_phone: '',
    description: '',
});
const submitting = ref(false);
const formError = ref('');
const formSuccess = ref('');

// List interaction
const search = ref('');
const listExpanded = ref(false);

onMounted(() => {
    fetchReportedClients();
});

const wordCount = computed(() => {
    const text = newReport.value.description.trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
});

const displayedReports = computed(() => {
    const term = search.value.trim().toLowerCase();
    if (!term) return reportedClients.value;
    return reportedClients.value.filter(client =>
        client.client_name.toLowerCase().includes(term) ||
        client.client_cin.toLowerCase().includes(term)
    );
});

const recentReportsCount = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return reportedClients.value.filter(r => new Date(r.created_at).getTime() >= cutoff).length;
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
            description: newReport.value.description,
        });

        formSuccess.value = 'Signalement ajouté avec succès.';
        newReport.value = { client_name: '', client_cin: '', client_phone: '', description: '' };

        setTimeout(() => { formSuccess.value = ''; }, 3000);
    } catch (e) {
        formError.value = "Erreur lors de l'ajout du signalement.";
    } finally {
        submitting.value = false;
    }
}

function formatDate(dateString: string) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toggleList() {
    listExpanded.value = !listExpanded.value;
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-b from-rose-50/40 via-gray-50/50 to-gray-50/50">
        <div class="max-w-[1400px] mx-auto p-5 md:p-8 space-y-6">

            <!-- Hero Header -->
            <div class="relative overflow-hidden bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                <!-- Decorative gradient blob -->
                <div class="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full bg-gradient-to-br from-red-200/40 to-rose-300/30 blur-2xl"></div>
                <div class="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-gradient-to-tr from-rose-200/30 to-orange-200/20 blur-2xl"></div>

                <div class="relative p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-200">
                            <ShieldAlert class="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 class="text-2xl md:text-[1.625rem] font-extrabold text-gray-900 tracking-tight leading-tight">{{ t('reports.title') }}</h1>
                            <p class="text-sm text-gray-500 mt-0.5">{{ t('reports.subtitle') }}</p>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div class="flex items-center gap-3">
                        <div class="stat-card stat-card--danger">
                            <div class="stat-icon">
                                <Users class="w-4 h-4" />
                            </div>
                            <div>
                                <div class="stat-value">{{ reportedClients.length }}</div>
                                <div class="stat-label">Total</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--warning">
                            <div class="stat-icon">
                                <Sparkles class="w-4 h-4" />
                            </div>
                            <div>
                                <div class="stat-value">{{ recentReportsCount }}</div>
                                <div class="stat-label">30 j</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Report Form -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <div class="px-5 md:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center ring-1 ring-red-100">
                        <UserPlus class="w-4 h-4 text-red-600" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <h2 class="text-base font-bold text-gray-900">{{ t('reports.add_report') }}</h2>
                        <p class="text-xs text-gray-400 mt-0.5">Le motif du signalement doit contenir au moins 80 mots.</p>
                    </div>
                </div>

                <div class="p-5 md:p-6">
                    <form @submit.prevent="handleSubmit" class="space-y-4">
                        <!-- Inline alerts -->
                        <div v-if="formError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl text-sm ring-1 ring-red-200/70">
                            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                            <span>{{ formError }}</span>
                        </div>
                        <div v-if="formSuccess" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200/70">
                            <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{{ formSuccess }}</span>
                        </div>

                        <!-- Subtle warning banner -->
                        <div class="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50/70 ring-1 ring-amber-200/70">
                            <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                            <p class="text-[12.5px] text-amber-800 leading-snug">
                                Cette section est sensible. Soyez précis et factuel — les signalements sont visibles par les agences partenaires.
                            </p>
                        </div>

                        <!-- 3-column inputs on desktop, stacked on mobile -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                            <div class="mt-1.5 flex items-center justify-between gap-3 px-1">
                                <p class="text-[11px] tabular-nums" :class="wordCount >= 80 ? 'text-emerald-600 font-bold' : 'text-gray-400'">
                                    {{ wordCount }} / 80 mots min.
                                </p>
                                <div v-if="wordCount > 0 && wordCount < 80" class="flex-1 max-w-[160px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
                            class="w-full md:w-auto md:min-w-[220px] md:ml-auto md:flex inline-flex items-center justify-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                        >
                            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
                            <AlertTriangle v-else class="w-4 h-4" />
                            {{ submitting ? t('common.saving') : t('reports.submit') }}
                        </button>
                    </form>
                </div>
            </div>

            <!-- Reports List (collapsible) -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <!-- Header (clickable to toggle) -->
                <button
                    type="button"
                    @click="toggleList"
                    :class="[
                        'w-full px-5 md:px-6 py-4 flex items-center justify-between gap-3 text-left transition-colors',
                        listExpanded ? 'border-b border-gray-100' : 'hover:bg-gray-50/60'
                    ]"
                    :aria-expanded="listExpanded"
                    aria-controls="reports-list-body"
                >
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center ring-1 ring-gray-200/60 shrink-0">
                            <ShieldAlert class="w-4 h-4 text-gray-600" />
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-base font-bold text-gray-900 truncate">{{ t('reports.list_title') }}</h2>
                            <p class="text-xs text-gray-400 mt-0.5">
                                {{ reportedClients.length }} signalement{{ reportedClients.length !== 1 ? 's' : '' }} enregistré{{ reportedClients.length !== 1 ? 's' : '' }}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <span class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-50 rounded-lg ring-1 ring-red-200/50 tabular-nums">
                            {{ reportedClients.length }}
                        </span>
                        <span class="text-xs font-bold text-gray-500 hidden md:inline">
                            {{ listExpanded ? 'Masquer' : 'Voir la liste' }}
                        </span>
                        <div
                            class="w-8 h-8 rounded-lg bg-gray-50 ring-1 ring-gray-200/60 flex items-center justify-center text-gray-500 transition-transform duration-200"
                            :class="listExpanded ? 'rotate-180' : ''"
                        >
                            <ChevronDown class="w-4 h-4" />
                        </div>
                    </div>
                </button>

                <!-- Collapsible body using grid 1fr/0fr trick -->
                <div
                    id="reports-list-body"
                    class="grid transition-[grid-template-rows] duration-300 ease-out"
                    :class="listExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
                >
                    <div class="overflow-hidden">
                        <!-- Search -->
                        <div class="p-5 md:p-6 pb-3">
                            <div class="relative">
                                <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    v-model="search"
                                    type="text"
                                    :placeholder="t('reports.search_placeholder')"
                                    class="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                >
                            </div>
                            <p v-if="search && displayedReports.length !== reportedClients.length" class="text-[11px] text-gray-400 mt-2 px-1">
                                {{ displayedReports.length }} résultat{{ displayedReports.length !== 1 ? 's' : '' }} sur {{ reportedClients.length }}
                            </p>
                        </div>

                        <!-- Loading -->
                        <div v-if="loading && reportedClients.length === 0" class="flex flex-col items-center justify-center py-14">
                            <Loader2 class="w-6 h-6 text-indigo-600 animate-spin mb-3" />
                            <p class="text-gray-400 text-sm">{{ t('common.loading') }}...</p>
                        </div>

                        <!-- Empty -->
                        <div v-else-if="displayedReports.length === 0" class="flex flex-col items-center py-14">
                            <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                <ShieldAlert class="w-6 h-6 text-gray-300" />
                            </div>
                            <p class="text-gray-400 font-medium">
                                {{ search ? 'Aucun résultat pour cette recherche.' : t('reports.no_reports') }}
                            </p>
                        </div>

                        <!-- List items -->
                        <div v-else class="divide-y divide-gray-50">
                            <div
                                v-for="client in displayedReports"
                                :key="client.id"
                                class="report-row group"
                            >
                                <!-- Red accent rail -->
                                <span class="report-rail" aria-hidden="true"></span>

                                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div class="flex-1 min-w-0">
                                        <!-- Client info row -->
                                        <div class="flex flex-wrap items-center gap-2 mb-2.5">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-red-100 to-rose-50 flex items-center justify-center shrink-0 ring-1 ring-red-200/40">
                                                    <User class="w-4 h-4 text-red-500" />
                                                </div>
                                                <h3 class="text-sm font-bold text-gray-900">{{ client.client_name }}</h3>
                                            </div>
                                            <span class="meta-chip meta-chip--danger">
                                                <CreditCard class="w-3 h-3" />
                                                {{ client.client_cin }}
                                            </span>
                                            <span class="meta-chip">
                                                <Phone class="w-3 h-3" />
                                                {{ client.client_phone }}
                                            </span>
                                        </div>

                                        <!-- Description -->
                                        <div class="bg-red-50/40 p-3.5 rounded-xl ring-1 ring-red-100/70">
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
/* ───────────────────────────────────────────────
 * Stat cards in hero
 * ─────────────────────────────────────────────── */
.stat-card {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.875rem 0.5rem 0.625rem;
    border-radius: 0.875rem;
    background: rgb(255 255 255);
    box-shadow:
        inset 0 0 0 1px rgb(243 244 246),
        0 1px 2px rgba(0, 0, 0, 0.02);
}

.stat-card--danger .stat-icon {
    background: rgb(254 226 226);
    color: rgb(220 38 38);
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.15);
}

.stat-card--warning .stat-icon {
    background: rgb(255 237 213);
    color: rgb(234 88 12);
    box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.15);
}

.stat-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-value {
    font-size: 1rem;
    font-weight: 800;
    color: rgb(17 24 39);
    line-height: 1;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
}

.stat-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(156 163 175);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
}

/* ───────────────────────────────────────────────
 * Form
 * ─────────────────────────────────────────────── */
.form-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: rgb(75 85 99);
    margin-bottom: 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.form-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid rgb(229 231 235);
    border-radius: 0.75rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    overflow: hidden;
}

.form-input-wrapper:hover {
    border-color: rgb(209 213 219);
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
    resize: vertical;
}

.form-input::placeholder {
    color: rgb(156 163 175);
}

/* ───────────────────────────────────────────────
 * List rows
 * ─────────────────────────────────────────────── */
.report-row {
    position: relative;
    padding: 1.125rem 1.25rem 1.125rem 1.5rem;
    transition: background 0.15s ease;
}

.report-row:hover {
    background: rgb(254 242 242 / 0.4);
}

.report-rail {
    position: absolute;
    top: 1.125rem;
    bottom: 1.125rem;
    left: 0.75rem;
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgb(248 113 113), rgb(244 63 94));
    opacity: 0.55;
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.report-row:hover .report-rail {
    opacity: 1;
    transform: scaleY(1.04);
}

@media (min-width: 768px) {
    .report-row {
        padding-left: 1.75rem;
    }
    .report-rail {
        left: 1rem;
    }
}

/* Meta chips for CIN / phone / etc. */
.meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(107 114 128);
    background: rgb(249 250 251);
    border-radius: 0.5rem;
    box-shadow: inset 0 0 0 1px rgb(229 231 235 / 0.85);
    letter-spacing: 0.01em;
}

.meta-chip--danger {
    color: rgb(185 28 28);
    background: rgb(254 226 226 / 0.7);
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.18);
}
</style>
