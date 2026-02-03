<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { useFaithfulClients } from '@/composables/useFaithfulClients';
import { Loader2, Lock, UserPlus, Users, Trash2, KeyRound, Shield } from 'lucide-vue-next';
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
    <div class="p-6 space-y-8">
        <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ $t('admin.settings.title') }}</h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Gérez vos paramètres de sécurité et vos préférences d'application.</p>
        </div>

        <!-- Security & User Management Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Change Password Section -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <KeyRound class="h-5 w-5" />
                    </div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.change_password_title') }}</h2>
                </div>

                <div class="p-6">
                    <form @submit.prevent="handleChangePassword" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('admin.settings.current_password') }}</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Lock class="h-4 w-4" />
                                </span>
                                <input 
                                    v-model="currentPassword"
                                    type="password"
                                    required
                                    class="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                    :placeholder="$t('admin.settings.current_password')"
                                />
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('admin.settings.new_password') }}</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Lock class="h-4 w-4" />
                                </span>
                                <input 
                                    v-model="newPassword"
                                    type="password"
                                    required
                                    class="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                    :placeholder="$t('admin.settings.new_password')"
                                />
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('admin.settings.confirm_password') }}</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Lock class="h-4 w-4" />
                                </span>
                                <input 
                                    v-model="confirmPassword"
                                    type="password"
                                    required
                                    class="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                    :placeholder="$t('admin.settings.confirm_password')"
                                />
                            </div>
                        </div>

                        <div v-if="error" class="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-800">
                            {{ error }}
                        </div>

                        <div v-if="success" class="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-100 dark:border-green-800">
                            {{ success }}
                        </div>

                        <button 
                            type="submit" 
                            :disabled="loading"
                            class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                            {{ $t('admin.settings.change_password_submit') }}
                        </button>
                    </form>
                </div>
            </div>

            <!-- Create User Section (Admin Only) -->
            <div v-if="authStore.role === 'admin'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                        <Shield class="h-5 w-5" />
                    </div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('admin.settings.create_user_title') }}</h2>
                </div>

                <div class="p-6 flex-1 flex flex-col justify-between">
                    <div>
                         <p class="text-sm text-gray-500 mb-6 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700" v-html="$t('admin.settings.create_user_desc')"></p>

                        <form @submit.prevent="handleCreateUser" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('admin.settings.username') }}</label>
                                <div class="relative">
                                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <Users class="h-4 w-4" />
                                    </span>
                                    <input 
                                        v-model="newUserUsername"
                                        type="text"
                                        required
                                        class="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                        placeholder="e.g. staff1"
                                    />
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('admin.settings.initial_password') }}</label>
                                <div class="relative">
                                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <Lock class="h-4 w-4" />
                                    </span>
                                    <input 
                                        v-model="newUserPassword"
                                        type="password"
                                        required
                                        class="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                        :placeholder="$t('admin.settings.initial_password')"
                                    />
                                </div>
                            </div>

                            <div v-if="newUserError" class="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-800">
                                {{ newUserError }}
                            </div>

                            <div v-if="newUserSuccess" class="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-100 dark:border-green-800">
                                {{ newUserSuccess }}
                            </div>

                            <button 
                                type="submit" 
                                :disabled="newUserLoading"
                                class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Loader2 v-if="newUserLoading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                                {{ $t('admin.settings.create_user_submit') }}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- Client Fidele Section -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Users class="h-5 w-5" />
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Informations Client Fidèle</h2>
                        <p class="text-sm text-gray-500">Gérez votre base de clients fidèles pour faciliter la création de réservations.</p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Form -->
                    <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                       <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Ajouter un nouveau client</h3>
                       <form @submit.prevent="handleCreateFaithfulClient" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom Complet *</label>
                                <input 
                                    v-model="faithfulClientForm.full_name"
                                    type="text"
                                    required
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                    placeholder="Ex: Jeanne Doe"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CIN (Carte Nationale) *</label>
                                <input 
                                    v-model="faithfulClientForm.cin"
                                    type="text"
                                    required
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                    placeholder="Ex: A1234567"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone *</label>
                                <input 
                                    v-model="faithfulClientForm.phone"
                                    type="tel"
                                    required
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                                    placeholder="Ex: +216 12 345 678"
                                />
                            </div>

                             <div v-if="faithfulClientError" class="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-800">
                                {{ faithfulClientError }}
                            </div>

                            <div v-if="faithfulClientSuccess" class="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-100 dark:border-green-800">
                                {{ faithfulClientSuccess }}
                            </div>

                            <button 
                                type="submit" 
                                :disabled="faithfulClientLoading"
                                class="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <UserPlus v-if="!faithfulClientLoading" class="w-4 h-4 mr-2" />
                                <Loader2 v-else class="animate-spin -ml-1 mr-2 h-4 w-4" />
                                Ajouter Client Fidèle
                            </button>
                       </form>
                    </div>

                    <!-- List -->
                    <div class="flex flex-col">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Clients Ajoutés Récemment</h3>
                            <span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">{{ faithfulClients.length }} clients</span>
                        </div>
                        
                        <div class="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm flex flex-col h-[400px]">
                            <div v-if="faithfulClientsLoading" class="flex-1 flex justify-center items-center">
                                <Loader2 class="animate-spin h-8 w-8 text-indigo-500" />
                            </div>
                            
                            <div v-else-if="faithfulClients.length === 0" class="flex-1 flex flex-col justify-center items-center text-center p-6 text-gray-400">
                                <Users class="h-12 w-12 mb-3 opacity-20" />
                                <p class="text-sm italic">Aucun client fidèle trouvé.</p>
                                <p class="text-xs mt-1">Commencez par ajouter votre premier client.</p>
                            </div>
                            
                            <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto custom-scrollbar">
                                <li v-for="client in faithfulClients" :key="client.id" class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex justify-between items-center group transition-colors">
                                    <div class="flex items-center gap-3">
                                        <div class="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                            {{ client.full_name.charAt(0) }}
                                        </div>
                                        <div>
                                            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ client.full_name }}</p>
                                            <div class="flex items-center text-xs text-gray-500 gap-2">
                                                <span class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">{{ client.cin }}</span>
                                                <span>•</span>
                                                <span>{{ client.phone }}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        @click="handleDeleteFaithfulClient(client.id)"
                                        class="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="Supprimer"
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.5);
}
</style>
