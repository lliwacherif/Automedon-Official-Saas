<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useB2BClients, type B2BClient } from '@/composables/useB2BClients';
import { useB2BChauffeurs, type B2BChauffeur } from '@/composables/useB2BChauffeurs';
import { useTenantLink } from '@/composables/useTenantLink';
import { RouterLink } from 'vue-router';
import { Building2, Plus, Edit, Trash2, X, Loader2, Phone, Mail, MapPin, Hash, User, ArrowLeft, Users, IdCard, CreditCard, UserPlus } from 'lucide-vue-next';

const { clients, loading, fetchClients, createClient, updateClient, deleteClient } = useB2BClients();
const { chauffeurs, fetchChauffeurs, createChauffeur, deleteChauffeur } = useB2BChauffeurs();
const { tenantPath } = useTenantLink();

// Group chauffeurs by their agency so each card shows a count and the
// manager modal lists just that agency's drivers.
const chauffeursByClient = computed<Record<number, B2BChauffeur[]>>(() => {
    const map: Record<number, B2BChauffeur[]> = {};
    for (const ch of chauffeurs.value) {
        (map[ch.b2b_client_id] ||= []).push(ch);
    }
    return map;
});

function chauffeursFor(clientId: number): B2BChauffeur[] {
    return chauffeursByClient.value[clientId] || [];
}

// ── Chauffeurs manager modal ──
const showChauffeursModal = ref(false);
const chauffeurClient = ref<B2BClient | null>(null);
const addingChauffeur = ref(false);
const deletingChauffeurId = ref<number | null>(null);
const chauffeurForm = ref({ nom: '', prenom: '', permit_number: '', cin: '' });

function openChauffeurs(c: B2BClient) {
    chauffeurClient.value = c;
    chauffeurForm.value = { nom: '', prenom: '', permit_number: '', cin: '' };
    showChauffeursModal.value = true;
}

async function handleAddChauffeur() {
    if (!chauffeurClient.value || !chauffeurForm.value.nom.trim()) return;
    addingChauffeur.value = true;
    try {
        await createChauffeur(chauffeurClient.value.id, { ...chauffeurForm.value });
        chauffeurForm.value = { nom: '', prenom: '', permit_number: '', cin: '' };
    } catch (e: any) {
        alert('Erreur: ' + e.message);
    } finally {
        addingChauffeur.value = false;
    }
}

async function handleDeleteChauffeur(id: number) {
    if (!confirm('Supprimer ce chauffeur ?')) return;
    deletingChauffeurId.value = id;
    try {
        await deleteChauffeur(id);
    } catch (e: any) {
        alert('Erreur: ' + e.message);
    } finally {
        deletingChauffeurId.value = null;
    }
}

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const saving = ref(false);

const form = ref({
    company_name: '',
    contact_name: '',
    address: '',
    mf: '',
    phone: '',
    email: '',
    notes: '',
});

function openAdd() {
    isEdit.value = false;
    editId.value = null;
    form.value = { company_name: '', contact_name: '', address: '', mf: '', phone: '', email: '', notes: '' };
    showModal.value = true;
}

function openEdit(c: B2BClient) {
    isEdit.value = true;
    editId.value = c.id;
    form.value = {
        company_name: c.company_name,
        contact_name: c.contact_name || '',
        address: c.address || '',
        mf: c.mf || '',
        phone: c.phone || '',
        email: c.email || '',
        notes: c.notes || '',
    };
    showModal.value = true;
}

async function handleSubmit() {
    if (!form.value.company_name.trim()) return;
    saving.value = true;
    try {
        if (isEdit.value && editId.value) {
            await updateClient(editId.value, form.value);
        } else {
            await createClient(form.value);
        }
        showModal.value = false;
    } catch (e: any) {
        alert('Erreur: ' + e.message);
    } finally {
        saving.value = false;
    }
}

async function handleDelete(id: number) {
    if (!confirm('Supprimer ce client B2B ?')) return;
    await deleteClient(id);
}

onMounted(() => {
    fetchClients();
    fetchChauffeurs();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1200px] mx-auto p-5 md:p-6 space-y-5">
            <!-- Header -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <RouterLink :to="tenantPath('/admin/services')" class="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                        <ArrowLeft class="w-4 h-4 text-gray-600" />
                    </RouterLink>
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                        <Building2 class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Clients B2B / Agences</h1>
                        <p class="text-sm text-gray-500">{{ clients.length }} client{{ clients.length !== 1 ? 's' : '' }} enregistré{{ clients.length !== 1 ? 's' : '' }}</p>
                    </div>
                </div>
                <button @click="openAdd" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-xl shadow-md shadow-purple-200 transition-all">
                    <Plus class="w-4 h-4" /> Nouveau Client B2B
                </button>
            </div>

            <!-- Loading -->
            <div v-if="loading && clients.length === 0" class="flex flex-col items-center py-20">
                <Loader2 class="w-8 h-8 text-violet-600 animate-spin mb-3" />
                <p class="text-gray-400">Chargement...</p>
            </div>

            <!-- Empty -->
            <div v-else-if="clients.length === 0" class="flex flex-col items-center py-20 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                <Building2 class="w-12 h-12 text-gray-300 mb-3" />
                <p class="text-gray-400 font-medium mb-1">Aucun client B2B</p>
                <p class="text-sm text-gray-300 mb-4">Ajoutez vos agences et partenaires</p>
                <button @click="openAdd" class="text-sm font-medium text-violet-600 hover:text-violet-700">+ Ajouter</button>
            </div>

            <!-- Cards Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div v-for="c in clients" :key="c.id" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                    <div class="p-5">
                        <div class="flex items-start gap-3 mb-3">
                            <div class="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                                <Building2 class="w-5 h-5 text-violet-600" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <h3 class="text-base font-bold text-gray-900 truncate">{{ c.company_name }}</h3>
                                <p v-if="c.contact_name" class="text-xs text-gray-400 mt-0.5">Contact: {{ c.contact_name }}</p>
                            </div>
                        </div>
                        <div class="space-y-1.5 text-sm text-gray-500">
                            <div v-if="c.address" class="flex items-center gap-2"><MapPin class="w-3.5 h-3.5 text-gray-400 shrink-0" /><span class="truncate">{{ c.address }}</span></div>
                            <div v-if="c.mf" class="flex items-center gap-2"><Hash class="w-3.5 h-3.5 text-gray-400 shrink-0" /><span class="font-mono text-xs">{{ c.mf }}</span></div>
                            <div v-if="c.phone" class="flex items-center gap-2"><Phone class="w-3.5 h-3.5 text-gray-400 shrink-0" /><span>{{ c.phone }}</span></div>
                            <div v-if="c.email" class="flex items-center gap-2"><Mail class="w-3.5 h-3.5 text-gray-400 shrink-0" /><span>{{ c.email }}</span></div>
                        </div>
                    </div>
                    <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-1">
                        <button @click="openChauffeurs(c)" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg ring-1 ring-violet-200/70 transition">
                            <Users class="w-3.5 h-3.5" />
                            Chauffeurs
                            <span class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-violet-500 rounded-full">{{ chauffeursFor(c.id).length }}</span>
                        </button>
                        <div class="flex items-center gap-1">
                            <button @click="openEdit(c)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition"><Edit class="w-4 h-4 text-indigo-500" /></button>
                            <button @click="handleDelete(c.id)" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition"><Trash2 class="w-4 h-4 text-red-400" /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showModal = false"></div>
                    <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl">
                        <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Building2 class="w-4 h-4 text-violet-600" /></div>
                                <h3 class="text-base font-bold text-gray-900">{{ isEdit ? 'Modifier Client B2B' : 'Nouveau Client B2B' }}</h3>
                            </div>
                            <button @click="showModal = false" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"><X class="w-5 h-5" /></button>
                        </div>
                        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nom de l'agence / Société *</label>
                                <input v-model="form.company_name" type="text" required class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="Ex: Travel Pro Agency" />
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Personne de contact</label>
                                    <input v-model="form.contact_name" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="Nom" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Téléphone</label>
                                    <input v-model="form.phone" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="00 000 000" />
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Adresse</label>
                                <input v-model="form.address" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="Adresse complète" />
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Matricule Fiscal (MF)</label>
                                    <input v-model="form.mf" type="text" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="0000000/X/X/000" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                                    <input v-model="form.email" type="email" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="contact@agence.com" />
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
                                <textarea v-model="form.notes" rows="2" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" placeholder="Notes..."></textarea>
                            </div>
                            <div class="flex justify-end gap-3 pt-3 border-t border-gray-100">
                                <button type="button" @click="showModal = false" class="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition">Annuler</button>
                                <button type="submit" :disabled="saving" class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md disabled:opacity-50 transition">
                                    <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                                    {{ saving ? 'Enregistrement...' : (isEdit ? 'Modifier' : 'Créer') }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Chauffeurs Manager Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showChauffeursModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showChauffeursModal = false"></div>
                    <div class="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
                        <!-- Header -->
                        <div class="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-violet-600 to-purple-600">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Users class="w-5 h-5 text-white" /></div>
                                <div class="min-w-0">
                                    <h3 class="text-base font-bold text-white truncate">Chauffeurs</h3>
                                    <p class="text-xs text-white/80 truncate">{{ chauffeurClient?.company_name }}</p>
                                </div>
                            </div>
                            <button @click="showChauffeursModal = false" class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition"><X class="w-5 h-5" /></button>
                        </div>

                        <!-- List -->
                        <div class="flex-1 overflow-y-auto p-5 space-y-2.5">
                            <div v-if="chauffeurClient && chauffeursFor(chauffeurClient.id).length === 0" class="flex flex-col items-center py-10 text-center">
                                <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3"><User class="w-6 h-6 text-gray-300" /></div>
                                <p class="text-gray-400 font-medium">Aucun chauffeur</p>
                                <p class="text-sm text-gray-300">Ajoutez le premier chauffeur ci-dessous.</p>
                            </div>
                            <div
                                v-for="ch in (chauffeurClient ? chauffeursFor(chauffeurClient.id) : [])"
                                :key="ch.id"
                                class="flex items-center gap-3 p-3 rounded-xl ring-1 ring-gray-100 bg-gray-50/60 hover:bg-gray-50 transition"
                            >
                                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-sm font-bold">
                                    {{ (ch.prenom || ch.nom || '?').charAt(0).toUpperCase() }}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="text-sm font-semibold text-gray-900 truncate">{{ ch.prenom }} {{ ch.nom }}</div>
                                    <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-500">
                                        <span v-if="ch.permit_number" class="inline-flex items-center gap-1"><IdCard class="w-3 h-3 text-gray-400" /> Permis: <span class="font-mono">{{ ch.permit_number }}</span></span>
                                        <span v-if="ch.cin" class="inline-flex items-center gap-1"><CreditCard class="w-3 h-3 text-gray-400" /> CIN/Passport: <span class="font-mono">{{ ch.cin }}</span></span>
                                    </div>
                                </div>
                                <button
                                    @click="handleDeleteChauffeur(ch.id)"
                                    :disabled="deletingChauffeurId === ch.id"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition shrink-0 disabled:opacity-50"
                                >
                                    <Loader2 v-if="deletingChauffeurId === ch.id" class="w-4 h-4 text-red-400 animate-spin" />
                                    <Trash2 v-else class="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>

                        <!-- Add form -->
                        <form @submit.prevent="handleAddChauffeur" class="border-t border-gray-100 p-5 bg-white space-y-3">
                            <div class="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <UserPlus class="w-3.5 h-3.5 text-violet-500" /> Ajouter un chauffeur
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <input v-model="chauffeurForm.prenom" type="text" placeholder="Prénom" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                                <input v-model="chauffeurForm.nom" type="text" required placeholder="Nom *" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                                <input v-model="chauffeurForm.permit_number" type="text" placeholder="N° Permis" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                                <input v-model="chauffeurForm.cin" type="text" placeholder="CIN / Passport" class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
                            </div>
                            <div class="flex justify-end">
                                <button
                                    type="submit"
                                    :disabled="addingChauffeur || !chauffeurForm.nom.trim()"
                                    class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md disabled:opacity-50 transition"
                                >
                                    <Loader2 v-if="addingChauffeur" class="w-4 h-4 animate-spin" />
                                    <Plus v-else class="w-4 h-4" />
                                    {{ addingChauffeur ? 'Ajout...' : 'Ajouter' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
