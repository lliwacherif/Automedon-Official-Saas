<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { useFaithfulClients } from '@/composables/useFaithfulClients';
import { 
    Loader2, Lock, UserPlus, Users, Trash2, KeyRound, Shield, Settings, 
    User, CreditCard, Phone, AlertCircle, CircleCheck,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const { t } = useI18n();

// Faithful Client State
const { 
    clients: faithfulClients, 
    loading: faithfulClientsLoading, 
    fetchFaithfulClients, 
    createFaithfulClient, 
    deleteFaithfulClient 
} = useFaithfulClients();

const faithfulClientForm = ref({
    full_name: '',
    cin: '',
    phone: '',
});
const faithfulClientLoading = ref(false);
const faithfulClientError = ref('');
const faithfulClientSuccess = ref('');

onMounted(() => {
    fetchFaithfulClients();
});

const handleCreateFaithfulClient = async () => {
    faithfulClientError.value = '';
    faithfulClientSuccess.value = '';
    faithfulClientLoading.value = true;

    try {
        await createFaithfulClient({ 
            full_name: faithfulClientForm.value.full_name,
            cin: faithfulClientForm.value.cin,
            phone: faithfulClientForm.value.phone
        });
        
        faithfulClientSuccess.value = 'Client fidèle ajouté avec succès';
        faithfulClientForm.value = { full_name: '', cin: '', phone: '' };
    } catch (e: any) {
        faithfulClientError.value = e.message || 'Erreur lors de l\'ajout du client';
    } finally {
        faithfulClientLoading.value = false;
    }
};

const handleDeleteFaithfulClient = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client fidèle ?')) return;
    
    try {
        await deleteFaithfulClient(id);
    } catch (e: any) {
        alert('Erreur lors de la suppression: ' + e.message);
    }
};

// Change Password State
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');

const handleChangePassword = async () => {
    error.value = '';
    success.value = '';

    if (newPassword.value !== confirmPassword.value) {
        error.value = t('admin.settings.password_mismatch');
        return;
    }

    if (newPassword.value.length < 6) {
        error.value = t('admin.settings.password_min_length');
        return;
    }

    loading.value = true;

    try {
        await authStore.changeAdminPassword(currentPassword.value, newPassword.value);
        success.value = t('admin.settings.password_success');
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    } catch (e: any) {
        error.value = e.message || t('admin.settings.password_error');
    } finally {
        loading.value = false;
    }
};

// Create User State
const newUserUsername = ref('');
const newUserPassword = ref('');
const newUserLoading = ref(false);
const newUserError = ref('');
const newUserSuccess = ref('');

const handleCreateUser = async () => {
    newUserError.value = '';
    newUserSuccess.value = '';
    
    if (newUserPassword.value.length < 6) {
        newUserError.value = t('admin.settings.password_min_length');
        return;
    }

    newUserLoading.value = true;

    try {
        await tenantStore.createTenantUser(newUserUsername.value, newUserPassword.value, 'user');
        newUserSuccess.value = t('admin.settings.user_created_success', { username: newUserUsername.value });
        newUserUsername.value = '';
        newUserPassword.value = '';
    } catch (e: any) {
        newUserError.value = e.message || t('admin.settings.create_user_error');
    } finally {
        newUserLoading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg shadow-gray-300">
                    <Settings class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">{{ $t('admin.settings.title') }}</h1>
                    <p class="text-sm text-gray-500">Gérez vos paramètres de sécurité et vos préférences.</p>
                </div>
            </div>

            <!-- Security Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

                <!-- Change Password -->
                <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <KeyRound class="w-4 h-4 text-blue-600" />
                        </div>
                        <h2 class="text-base font-bold text-gray-900">{{ $t('admin.settings.change_password_title') }}</h2>
                    </div>

                    <div class="p-5">
                        <form @submit.prevent="handleChangePassword" class="space-y-3">
                            <div>
                                <label class="form-label">{{ $t('admin.settings.current_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="currentPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.current_password')">
                                </div>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.settings.new_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="newPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.new_password')">
                                </div>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.settings.confirm_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="confirmPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.confirm_password')">
                                </div>
                            </div>

                            <div v-if="error" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ error }}</span>
                            </div>
                            <div v-if="success" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ success }}</span>
                            </div>

                            <button 
                                type="submit" 
                                :disabled="loading"
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-xl shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                            >
                                <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
                                <KeyRound v-else class="w-4 h-4" />
                                {{ $t('admin.settings.change_password_submit') }}
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Create User (Admin Only) -->
                <div v-if="authStore.role === 'admin'" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Shield class="w-4 h-4 text-emerald-600" />
                        </div>
                        <h2 class="text-base font-bold text-gray-900">{{ $t('admin.settings.create_user_title') }}</h2>
                    </div>

                    <div class="p-5 flex-1 flex flex-col">
                        <p class="text-sm text-gray-500 mb-4 bg-gray-50 p-3 rounded-xl ring-1 ring-gray-100 leading-relaxed" v-html="$t('admin.settings.create_user_desc')"></p>

                        <form @submit.prevent="handleCreateUser" class="space-y-3 flex-1">
                            <div>
                                <label class="form-label">{{ $t('admin.settings.username') }}</label>
                                <div class="form-input-wrapper">
                                    <Users class="form-input-icon" />
                                    <input v-model="newUserUsername" type="text" required class="form-input" placeholder="e.g. staff1">
                                </div>
                            </div>
                            <div>
                                <label class="form-label">{{ $t('admin.settings.initial_password') }}</label>
                                <div class="form-input-wrapper">
                                    <Lock class="form-input-icon" />
                                    <input v-model="newUserPassword" type="password" required class="form-input" :placeholder="$t('admin.settings.initial_password')">
                                </div>
                            </div>

                            <div v-if="newUserError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ newUserError }}</span>
                            </div>
                            <div v-if="newUserSuccess" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{{ newUserSuccess }}</span>
                            </div>

                            <button 
                                type="submit" 
                                :disabled="newUserLoading"
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                            >
                                <Loader2 v-if="newUserLoading" class="w-4 h-4 animate-spin" />
                                <UserPlus v-else class="w-4 h-4" />
                                {{ $t('admin.settings.create_user_submit') }}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Faithful Clients -->
            <div class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Users class="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900">Clients Fidèles</h2>
                            <p class="text-xs text-gray-400">Facilite la création rapide de réservations</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg ring-1 ring-gray-100">
                        {{ faithfulClients.length }} clients
                    </span>
                </div>

                <div class="p-5">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

                        <!-- Add Form -->
                        <div class="bg-gray-50 rounded-xl p-5 ring-1 ring-gray-100">
                            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <UserPlus class="w-3.5 h-3.5" />
                                Ajouter un client
                            </h3>
                            <form @submit.prevent="handleCreateFaithfulClient" class="space-y-3">
                                <div>
                                    <label class="form-label">Nom Complet *</label>
                                    <div class="form-input-wrapper">
                                        <User class="form-input-icon" />
                                        <input v-model="faithfulClientForm.full_name" type="text" required class="form-input" placeholder="Ex: Jeanne Doe">
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">CIN *</label>
                                    <div class="form-input-wrapper">
                                        <CreditCard class="form-input-icon" />
                                        <input v-model="faithfulClientForm.cin" type="text" required class="form-input" placeholder="Ex: A1234567">
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label">Téléphone *</label>
                                    <div class="form-input-wrapper">
                                        <Phone class="form-input-icon" />
                                        <input v-model="faithfulClientForm.phone" type="tel" required class="form-input" placeholder="Ex: +216 12 345 678">
                                    </div>
                                </div>

                                <div v-if="faithfulClientError" class="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-red-200">
                                    <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{{ faithfulClientError }}</span>
                                </div>
                                <div v-if="faithfulClientSuccess" class="flex items-start gap-2 bg-emerald-50 text-emerald-700 px-3 py-2.5 rounded-xl text-sm ring-1 ring-emerald-200">
                                    <CircleCheck class="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{{ faithfulClientSuccess }}</span>
                                </div>

                                <button 
                                    type="submit" 
                                    :disabled="faithfulClientLoading"
                                    class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                                >
                                    <Loader2 v-if="faithfulClientLoading" class="w-4 h-4 animate-spin" />
                                    <UserPlus v-else class="w-4 h-4" />
                                    Ajouter Client Fidèle
                                </button>
                            </form>
                        </div>

                        <!-- Client List -->
                        <div class="flex flex-col">
                            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Users class="w-3.5 h-3.5" />
                                Clients récents
                            </h3>
                            
                            <div class="flex-1 bg-white rounded-xl ring-1 ring-gray-100 overflow-hidden flex flex-col h-[380px]">
                                <div v-if="faithfulClientsLoading" class="flex-1 flex flex-col justify-center items-center">
                                    <Loader2 class="w-7 h-7 text-indigo-500 animate-spin mb-3" />
                                    <p class="text-sm text-gray-400">Chargement...</p>
                                </div>
                                
                                <div v-else-if="faithfulClients.length === 0" class="flex-1 flex flex-col justify-center items-center text-center p-6">
                                    <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                                        <Users class="w-6 h-6 text-gray-300" />
                                    </div>
                                    <p class="text-sm text-gray-400 font-medium">Aucun client fidèle.</p>
                                    <p class="text-xs text-gray-300 mt-1">Commencez par en ajouter un.</p>
                                </div>
                                
                                <ul v-else class="divide-y divide-gray-50 overflow-y-auto custom-scrollbar">
                                    <li v-for="client in faithfulClients" :key="client.id" class="px-4 py-3 hover:bg-indigo-50/30 flex justify-between items-center group transition-colors">
                                        <div class="flex items-center gap-3">
                                            <div class="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm ring-1 ring-indigo-100">
                                                {{ client.full_name.charAt(0) }}
                                            </div>
                                            <div>
                                                <p class="text-sm font-semibold text-gray-900">{{ client.full_name }}</p>
                                                <div class="flex items-center text-xs text-gray-400 gap-2 mt-0.5">
                                                    <span class="bg-gray-50 px-1.5 py-0.5 rounded-md ring-1 ring-gray-100 text-gray-500 font-mono text-[11px]">{{ client.cin }}</span>
                                                    <span>{{ client.phone }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            @click="handleDeleteFaithfulClient(client.id)"
                                            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                            title="Supprimer"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                        </button>
                                    </li>
                                </ul>
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

.custom-scrollbar::-webkit-scrollbar {
    width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.25);
    border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.45);
}
</style>
