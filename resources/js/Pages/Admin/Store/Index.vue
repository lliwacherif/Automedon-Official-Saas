<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { useTenantStore } from '@/stores/tenant';
import { useAuthStore } from '@/stores/auth';
import { ShoppingBag, Loader2, Info, Send, X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { apps, loading, fetchApps } = useStore();
const tenantStore = useTenantStore();
const authStore = useAuthStore();

// Modal State
const showOrderModal = ref(false);
const selectedApp = ref<StoreApp | null>(null);
const sending = ref(false);

onMounted(() => {
    fetchApps();
});

function handleOrderClick(app: StoreApp) {
    selectedApp.value = app;
    showOrderModal.value = true;
}

function handleCloseModal() {
    showOrderModal.value = false;
    selectedApp.value = null;
}
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
                        <button 
                            @click="handleOrderClick(app)"
                            class="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            <ShoppingBag class="w-4 h-4 mr-2" />
                            Commander Application
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Order Modal -->
        <div v-if="showOrderModal && selectedApp" class="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                
                <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="handleCloseModal"></div>

                <!-- Center content -->
                <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full relative">
                    <div class="bg-indigo-600 px-4 py-3 sm:px-6 flex justify-between items-center">
                        <h3 class="text-lg leading-6 font-medium text-white" id="modal-title">Commander {{ selectedApp.name }}</h3>
                        <button @click="handleCloseModal" class="text-white hover:text-gray-200">
                            <X class="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <p class="text-gray-600 mb-6 text-sm">
                            Veuillez confirmer votre demande pour commander l'application <strong>{{ selectedApp.name }}</strong>. 
                            Une notification sera envoyée à l'administrateur principal.
                        </p>

                        <!-- FormSubmit Form -->
                        <form 
                            action="https://formsubmit.co/liwacherif200@gmail.com" 
                            method="POST" 
                            class="space-y-4"
                        >
                            <!-- Hidden Configuration Fields -->
                            <input type="hidden" name="_subject" :value="`Nouvelle commande d'application: ${selectedApp.name}`">
                            <input type="hidden" name="_next" value=""> <!-- Will be set by JS if needed effectively or leave empty to default -->
                            <input type="hidden" name="_captcha" value="false">
                            <input type="hidden" name="_template" value="table">

                            <!-- Visual Read-only Fields -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Application</label>
                                <input type="text" :value="selectedApp.name" readonly disabled class="mt-1 block w-full bg-gray-50 border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border text-gray-500">
                                <input type="hidden" name="Application" :value="selectedApp.name">
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700">Client (Tenant)</label>
                                <input type="text" :value="tenantStore.currentTenant?.name || 'Unknown'" readonly disabled class="mt-1 block w-full bg-gray-50 border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border text-gray-500">
                                <input type="hidden" name="Tenant" :value="tenantStore.currentTenant?.name">
                                <input type="hidden" name="Tenant Slug" :value="tenantStore.currentTenant?.slug">
                            </div>

                            <!-- Optional Message -->
                            <div>
                                <label for="message" class="block text-sm font-medium text-gray-700">Message (Optionnel)</label>
                                <textarea 
                                    name="Message" 
                                    id="message" 
                                    rows="3" 
                                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border" 
                                    placeholder="Ajouter une note..."
                                ></textarea>
                            </div>

                            <div class="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    @click="handleCloseModal"
                                    class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    class="px-4 py-2 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center"
                                >
                                    <Send class="w-4 h-4 mr-2" />
                                    Envoyer la demande
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
