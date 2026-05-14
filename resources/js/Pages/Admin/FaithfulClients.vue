<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
    Loader2, UserPlus, Users, Trash2, User, CreditCard, Phone, Mail,
    IdCard, Calendar, AlertCircle, CircleCheck, Paperclip, Search, X,
    UserRound, Sparkles, Plus, MapPin, Cake,
} from 'lucide-vue-next';
import { useFaithfulClients, type FaithfulClient } from '@/composables/useFaithfulClients';
import FaithfulClientDocumentsModal from '@/components/FaithfulClientDocumentsModal.vue';

const {
    clients,
    loading,
    fetchFaithfulClients,
    createFaithfulClient,
    deleteFaithfulClient,
} = useFaithfulClients();

// ─────────────────────────────────────────────────────────────
// Form state — preserves the exact same functionality as the
// previous Settings page implementation.
// ─────────────────────────────────────────────────────────────
const form = ref({
    first_name: '',
    last_name: '',
    cin: '',
    phone: '',
    email: '',
    permit_number: '',
    cin_date: '',
    permit_date: '',
    address: '',
    date_of_birth: '',
});

// Compose a "Prenom Nom" string that we keep storing in full_name so existing
// autocomplete (reservation form, services modal) and search continue to work
// without any changes elsewhere.
const composedFullName = (): string =>
    [form.value.first_name, form.value.last_name]
        .map(s => s.trim())
        .filter(Boolean)
        .join(' ');
const formLoading = ref(false);
const formError = ref('');
const formSuccess = ref('');
const showAddForm = ref(false);

const searchQuery = ref('');
const filteredClients = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return clients.value;
    return clients.value.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.cin.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
});

const clientsWithDocs = computed(() =>
    clients.value.filter(c => clientDocCount(c) > 0).length
);

onMounted(() => {
    fetchFaithfulClients();
});

const handleCreate = async () => {
    formError.value = '';
    formSuccess.value = '';
    formLoading.value = true;
    try {
        const fullName = composedFullName();
        await createFaithfulClient({
            full_name: fullName,
            first_name: form.value.first_name.trim() || undefined,
            last_name: form.value.last_name.trim() || undefined,
            cin: form.value.cin,
            phone: form.value.phone.trim() || undefined,
            email: form.value.email || undefined,
            permit_number: form.value.permit_number || undefined,
            cin_date: form.value.cin_date || undefined,
            permit_date: form.value.permit_date || undefined,
            address: form.value.address.trim() || undefined,
            date_of_birth: form.value.date_of_birth || undefined,
        });
        formSuccess.value = 'Client fidèle ajouté avec succès';
        form.value = {
            first_name: '',
            last_name: '',
            cin: '',
            phone: '',
            email: '',
            permit_number: '',
            cin_date: '',
            permit_date: '',
            address: '',
            date_of_birth: '',
        };
        setTimeout(() => { formSuccess.value = ''; }, 2500);
    } catch (e: any) {
        formError.value = e.message || "Erreur lors de l'ajout du client";
    } finally {
        formLoading.value = false;
    }
};

const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client fidèle ?')) return;
    try {
        await deleteFaithfulClient(id);
    } catch (e: any) {
        alert('Erreur lors de la suppression: ' + e.message);
    }
};

function clientDocCount(client: FaithfulClient): number {
    return (client.documents || []).filter(Boolean).length;
}

// Documents modal — same logic as Settings.vue, just moved over.
const docsModalOpen = ref(false);
const docsModalClient = ref<FaithfulClient | null>(null);

function openDocsModal(client: FaithfulClient) {
    docsModalClient.value = client;
    docsModalOpen.value = true;
}
function closeDocsModal() {
    docsModalOpen.value = false;
    docsModalClient.value = null;
}
function onDocsUpdated(updated: FaithfulClient) {
    if (docsModalClient.value && docsModalClient.value.id === updated.id) {
        docsModalClient.value = { ...docsModalClient.value, ...updated };
    }
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div class="max-w-[1500px] mx-auto p-5 md:p-8 space-y-6">

            <!-- Hero / Header -->
            <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-6 md:p-8 shadow-xl shadow-indigo-200">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_50%)]"></div>
                <div class="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
                <div class="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-violet-300/20 blur-3xl"></div>

                <div class="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30 flex items-center justify-center shadow-lg">
                            <UserRound class="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <Sparkles class="w-3.5 h-3.5 text-amber-200" />
                                <span class="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-100">Carnet d'adresses</span>
                            </div>
                            <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Clients Fidèles</h1>
                            <p class="text-sm text-indigo-100/90 mt-1 max-w-md">
                                Facilite la création rapide de réservations. Les clients ajoutés ici apparaissent en autocomplétion sur le formulaire de réservation.
                            </p>
                        </div>
                    </div>

                    <!-- Stats pills -->
                    <div class="flex items-center gap-2">
                        <div class="px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-indigo-100/80">Total</p>
                            <p class="text-2xl font-bold text-white leading-tight tabular-nums">{{ clients.length }}</p>
                        </div>
                        <div class="px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-indigo-100/80">Avec docs</p>
                            <p class="text-2xl font-bold text-white leading-tight tabular-nums">{{ clientsWithDocs }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toolbar: Search + Add -->
            <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div class="relative flex-1">
                    <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Rechercher par nom, CIN, téléphone ou email…"
                        class="w-full pl-11 pr-10 py-3 text-sm bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                    <button
                        v-if="searchQuery"
                        type="button"
                        @click="searchQuery = ''"
                        class="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X class="w-3.5 h-3.5" />
                    </button>
                </div>

                <button
                    type="button"
                    @click="showAddForm = !showAddForm"
                    class="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-2xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all shrink-0"
                >
                    <Plus class="w-4 h-4 transition-transform" :class="{ 'rotate-45': showAddForm }" />
                    {{ showAddForm ? 'Fermer le formulaire' : 'Ajouter un client' }}
                </button>
            </div>

            <!-- Main grid: form (when open) + list -->
            <div class="grid grid-cols-1 gap-5" :class="showAddForm ? 'lg:grid-cols-[400px_minmax(0,1fr)]' : ''">

                <!-- Add Form (collapsible) -->
                <Transition name="slide-fade">
                    <div v-if="showAddForm" class="h-fit bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                        <div class="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/40 to-violet-50/40">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-white ring-1 ring-indigo-100 flex items-center justify-center shadow-sm">
                                    <UserPlus class="w-4 h-4 text-indigo-600" />
                                </div>
                                <h2 class="text-sm font-bold text-gray-900">Nouveau client fidèle</h2>
                            </div>
                        </div>

                        <form @submit.prevent="handleCreate" class="p-5 space-y-3">
                            <!-- Identité : Nom + Prénom -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="form-label">Nom *</label>
                                    <div class="form-input-wrapper">
                                        <User class="form-input-icon" />
                                        <input v-model="form.last_name" type="text" required class="form-input" placeholder="Ex: Doe" />
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">Prénom *</label>
                                    <div class="form-input-wrapper">
                                        <User class="form-input-icon" />
                                        <input v-model="form.first_name" type="text" required class="form-input" placeholder="Ex: Jeanne" />
                                    </div>
                                </div>
                            </div>

                            <!-- CIN + Délivrance CIN -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="form-label">CIN *</label>
                                    <div class="form-input-wrapper">
                                        <CreditCard class="form-input-icon" />
                                        <input v-model="form.cin" type="text" required class="form-input" placeholder="A1234567" />
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">Délivrance CIN</label>
                                    <div class="form-input-wrapper">
                                        <Calendar class="form-input-icon" />
                                        <input v-model="form.cin_date" type="text" class="form-input" placeholder="01/01/2020" />
                                    </div>
                                </div>
                            </div>

                            <!-- Permis + Délivrance permis -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="form-label">Numéro de permis</label>
                                    <div class="form-input-wrapper">
                                        <IdCard class="form-input-icon" />
                                        <input v-model="form.permit_number" type="text" class="form-input" placeholder="12345678" />
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">Délivrance permis</label>
                                    <div class="form-input-wrapper">
                                        <Calendar class="form-input-icon" />
                                        <input v-model="form.permit_date" type="text" class="form-input" placeholder="15/06/2018" />
                                    </div>
                                </div>
                            </div>

                            <!-- Adresse + Date de naissance (optionnel) -->
                            <div class="grid grid-cols-1 gap-3">
                                <div>
                                    <label class="form-label">Adresse client</label>
                                    <div class="form-input-wrapper">
                                        <MapPin class="form-input-icon" />
                                        <input v-model="form.address" type="text" class="form-input" placeholder="Rue, ville, code postal..." />
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">Date de naissance</label>
                                    <div class="form-input-wrapper">
                                        <Cake class="form-input-icon" />
                                        <input v-model="form.date_of_birth" type="date" class="form-input" />
                                    </div>
                                </div>
                            </div>

                            <!-- Contact (optionnel) au bas du formulaire -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="form-label">Email</label>
                                    <div class="form-input-wrapper">
                                        <Mail class="form-input-icon" />
                                        <input v-model="form.email" type="email" class="form-input" placeholder="client@email.com" />
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">Téléphone</label>
                                    <div class="form-input-wrapper">
                                        <Phone class="form-input-icon" />
                                        <input v-model="form.phone" type="tel" class="form-input" placeholder="+216 12 345 678" />
                                    </div>
                                </div>
                            </div>

                            <div v-if="formError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ formError }}</span>
                            </div>
                            <div v-if="formSuccess" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ formSuccess }}</span>
                            </div>

                            <button
                                type="submit"
                                :disabled="formLoading"
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                            >
                                <Loader2 v-if="formLoading" class="w-4 h-4 animate-spin" />
                                <UserPlus v-else class="w-4 h-4" />
                                Ajouter le client
                            </button>
                        </form>
                    </div>
                </Transition>

                <!-- Client list -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <Users class="w-4 h-4 text-indigo-600" />
                            </div>
                            <h2 class="text-sm font-bold text-gray-900">
                                {{ searchQuery ? 'Résultats' : 'Tous les clients' }}
                            </h2>
                        </div>
                        <span class="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg ring-1 ring-gray-100 tabular-nums">
                            {{ filteredClients.length }}{{ searchQuery ? ` / ${clients.length}` : '' }}
                        </span>
                    </div>

                    <!-- Loading -->
                    <div v-if="loading && clients.length === 0" class="flex flex-col items-center justify-center py-20">
                        <Loader2 class="w-7 h-7 text-indigo-500 animate-spin mb-3" />
                        <p class="text-sm text-gray-400">Chargement…</p>
                    </div>

                    <!-- Empty state -->
                    <div v-else-if="clients.length === 0" class="flex flex-col items-center text-center py-20 px-6">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 flex items-center justify-center mb-4">
                            <Users class="w-7 h-7 text-indigo-400" />
                        </div>
                        <p class="text-base font-semibold text-gray-700">Aucun client fidèle</p>
                        <p class="text-sm text-gray-400 mt-1 max-w-sm">
                            Ajoutez vos clients réguliers pour les retrouver en autocomplétion lors de la création d'une réservation.
                        </p>
                        <button
                            type="button"
                            @click="showAddForm = true"
                            class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
                        >
                            <Plus class="w-3.5 h-3.5" />
                            Ajouter le premier
                        </button>
                    </div>

                    <!-- Filtered-empty state -->
                    <div v-else-if="filteredClients.length === 0" class="flex flex-col items-center text-center py-16 px-6">
                        <div class="w-14 h-14 rounded-xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mb-3">
                            <Search class="w-6 h-6 text-gray-300" />
                        </div>
                        <p class="text-sm font-semibold text-gray-600">Aucun résultat</p>
                        <p class="text-xs text-gray-400 mt-1">Essayez avec un autre nom ou CIN.</p>
                    </div>

                    <!-- Grid of cards -->
                    <ul v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                        <li
                            v-for="client in filteredClients"
                            :key="client.id"
                            class="group relative rounded-2xl bg-white ring-1 ring-gray-100 hover:ring-indigo-200 hover:shadow-md transition-all p-4 flex flex-col gap-3"
                        >
                            <div class="flex items-start gap-3">
                                <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-base ring-1 ring-white shadow-sm flex items-center justify-center shrink-0">
                                    {{ client.full_name.charAt(0).toUpperCase() }}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-sm font-bold text-gray-900 truncate">{{ client.full_name }}</p>
                                    <span class="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-gray-50 ring-1 ring-gray-100 text-[11px] font-mono text-gray-500">
                                        {{ client.cin }}
                                    </span>
                                </div>
                                <button
                                    @click="handleDelete(client.id)"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                    title="Supprimer"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>

                            <div class="space-y-1 text-xs">
                                <div v-if="client.phone" class="flex items-center gap-1.5 text-gray-600">
                                    <Phone class="w-3 h-3 text-gray-400 shrink-0" />
                                    <span class="truncate">{{ client.phone }}</span>
                                </div>
                                <div v-if="client.email" class="flex items-center gap-1.5 text-gray-500">
                                    <Mail class="w-3 h-3 text-gray-400 shrink-0" />
                                    <span class="truncate">{{ client.email }}</span>
                                </div>
                                <div v-if="client.permit_number" class="flex items-center gap-1.5 text-gray-500">
                                    <IdCard class="w-3 h-3 text-gray-400 shrink-0" />
                                    <span class="truncate font-mono">{{ client.permit_number }}</span>
                                </div>
                                <div v-if="client.address" class="flex items-center gap-1.5 text-gray-500">
                                    <MapPin class="w-3 h-3 text-gray-400 shrink-0" />
                                    <span class="truncate">{{ client.address }}</span>
                                </div>
                                <div v-if="client.date_of_birth" class="flex items-center gap-1.5 text-gray-500">
                                    <Cake class="w-3 h-3 text-gray-400 shrink-0" />
                                    <span class="truncate">{{ client.date_of_birth }}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                @click="openDocsModal(client)"
                                class="mt-auto inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-all"
                                :class="clientDocCount(client) > 0
                                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100'
                                    : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'"
                                :title="`Documents (${clientDocCount(client)}/2)`"
                            >
                                <Paperclip class="w-3.5 h-3.5" />
                                Documents
                                <span class="tabular-nums">{{ clientDocCount(client) }}/2</span>
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Faithful client documents modal -->
        <FaithfulClientDocumentsModal
            :show="docsModalOpen"
            :client="docsModalClient"
            @close="closeDocsModal"
            @updated="onDocsUpdated"
        />
    </div>
</template>

<style scoped>
.form-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: rgb(55 65 81);
    margin-bottom: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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

/* Collapsible add-form transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}
</style>
