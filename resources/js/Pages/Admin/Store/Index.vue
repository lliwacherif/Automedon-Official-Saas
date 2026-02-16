<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { useTenantStore } from '@/stores/tenant';
import { useAuthStore } from '@/stores/auth';
import { 
    ShoppingBag, 
    Loader2, 
    Send, 
    X, 
    Package, 
    Sparkles, 
    CircleCheck,
    FileText,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { apps, loading, fetchApps } = useStore();
const tenantStore = useTenantStore();
const authStore = useAuthStore();

// Modal State
const showOrderModal = ref(false);
const selectedApp = ref<StoreApp | null>(null);

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
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-200">
                    <ShoppingBag class="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">Store</h1>
                    <p class="text-sm text-gray-500">Découvrez et commandez des applications pour votre agence</p>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement des applications...</p>
            </div>

            <!-- Empty -->
            <div v-else-if="apps.length === 0" class="flex flex-col items-center py-20 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                    <Package class="w-7 h-7 text-gray-300" />
                </div>
                <p class="text-gray-400 font-medium">Aucune application disponible pour le moment.</p>
            </div>

            <!-- Apps Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div 
                    v-for="app in apps" 
                    :key="app.id" 
                    class="app-card group"
                >
                    <div class="p-5 flex-1 flex flex-col">
                        <!-- App Header -->
                        <div class="flex items-start gap-3.5 mb-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                                <img v-if="app.icon_url" :src="app.icon_url" :alt="app.name" class="w-full h-full object-cover" />
                                <Sparkles v-else class="w-5 h-5 text-indigo-500" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-base font-bold text-gray-900">{{ app.name }}</h3>
                                <div class="mt-1">
                                    <span 
                                        v-if="app.price > 0" 
                                        class="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50"
                                    >
                                        {{ app.price.toFixed(2) }} DT
                                    </span>
                                    <span 
                                        v-else 
                                        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200/50"
                                    >
                                        <CircleCheck class="w-3 h-3" />
                                        Gratuit
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Description -->
                        <p class="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-3 flex-1">
                            {{ app.description }}
                        </p>

                        <!-- Action -->
                        <button 
                            @click="handleOrderClick(app)"
                            class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                        >
                            <ShoppingBag class="w-4 h-4" />
                            Commander
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Order Modal -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="showOrderModal && selectedApp" class="fixed inset-0 z-50 overflow-y-auto">
                    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="handleCloseModal"></div>

                    <div class="flex min-h-full items-center justify-center p-4">
                        <div class="modal-container relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">

                            <!-- Modal Header -->
                            <div class="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                        <ShoppingBag class="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <h3 class="text-base font-bold text-gray-900">Commander {{ selectedApp.name }}</h3>
                                </div>
                                <button @click="handleCloseModal" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                    <X class="w-5 h-5" />
                                </button>
                            </div>
                            
                            <!-- Modal Body -->
                            <div class="p-6">
                                <p class="text-sm text-gray-500 mb-5 leading-relaxed">
                                    Confirmez votre demande pour <strong class="text-gray-700">{{ selectedApp.name }}</strong>. 
                                    Une notification sera envoyée à l'administrateur principal.
                                </p>

                                <form 
                                    action="https://formsubmit.co/liwacherif200@gmail.com" 
                                    method="POST" 
                                    class="space-y-3"
                                >
                                    <!-- Hidden fields -->
                                    <input type="hidden" name="_subject" :value="`Nouvelle commande: ${selectedApp.name}`">
                                    <input type="hidden" name="_next" value="">
                                    <input type="hidden" name="_captcha" value="false">
                                    <input type="hidden" name="_template" value="table">

                                    <!-- Application -->
                                    <div>
                                        <label class="form-label">Application</label>
                                        <div class="form-input-wrapper bg-gray-50">
                                            <Package class="form-input-icon" />
                                            <input type="text" :value="selectedApp.name" readonly disabled class="form-input bg-transparent text-gray-500">
                                            <input type="hidden" name="Application" :value="selectedApp.name">
                                        </div>
                                    </div>

                                    <!-- Tenant -->
                                    <div>
                                        <label class="form-label">Client (Tenant)</label>
                                        <div class="form-input-wrapper bg-gray-50">
                                            <ShoppingBag class="form-input-icon" />
                                            <input type="text" :value="tenantStore.currentTenant?.name || 'Unknown'" readonly disabled class="form-input bg-transparent text-gray-500">
                                            <input type="hidden" name="Tenant" :value="tenantStore.currentTenant?.name">
                                            <input type="hidden" name="Tenant Slug" :value="tenantStore.currentTenant?.slug">
                                        </div>
                                    </div>

                                    <!-- Message -->
                                    <div>
                                        <label class="form-label">Message <span class="text-gray-400 font-normal">(Optionnel)</span></label>
                                        <div class="form-input-wrapper items-start">
                                            <FileText class="form-input-icon mt-2.5" />
                                            <textarea 
                                                name="Message" 
                                                rows="3" 
                                                class="form-input" 
                                                placeholder="Ajouter une note..."
                                            ></textarea>
                                        </div>
                                    </div>

                                    <!-- Actions -->
                                    <div class="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            @click="handleCloseModal"
                                            class="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl ring-1 ring-gray-200 transition-all"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                                        >
                                            <Send class="w-4 h-4" />
                                            Envoyer la demande
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.app-card {
    background: white;
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 1px solid rgb(243 244 246);
    box-shadow: 
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(0, 0, 0, 0.02);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-card:hover {
    transform: translateY(-3px);
    border-color: rgb(199 210 254);
    box-shadow: 
        0 12px 28px rgba(79, 70, 229, 0.08),
        0 4px 12px rgba(0, 0, 0, 0.04);
}

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

/* Modal animation */
.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-container { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-container { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-container { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-container { opacity: 0; transform: scale(0.97) translateY(5px); }
</style>
