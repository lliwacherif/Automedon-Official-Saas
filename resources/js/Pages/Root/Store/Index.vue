<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { Plus, Trash2, Loader2, Upload, ShoppingBag, ArrowLeft, Users, X, Globe, DollarSign, Building2, Store } from 'lucide-vue-next';
import ClientAssignmentModal from '@/components/Store/ClientAssignmentModal.vue';

const { apps, loading, error, fetchApps, addApp, deleteApp } = useStore();

const showModal = ref(false);
const submitting = ref(false);
const newApp = ref({ name: '', description: '', price: 0 });
const selectedIcon = ref<File | null>(null);
const iconPreview = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const showAssignmentModal = ref(false);
const selectedAppForAssignment = ref<StoreApp | null>(null);

function openAssignmentModal(app: StoreApp) {
    selectedAppForAssignment.value = app;
    showAssignmentModal.value = true;
}

function closeAssignmentModal() {
    showAssignmentModal.value = false;
    selectedAppForAssignment.value = null;
}

onMounted(() => { fetchApps(); });

function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        selectedIcon.value = input.files[0];
        iconPreview.value = URL.createObjectURL(input.files[0]);
    }
}

async function handleSubmit() {
    if (!newApp.value.name) return;
    submitting.value = true;
    try {
        await addApp(newApp.value, selectedIcon.value || undefined);
        showModal.value = false;
        newApp.value = { name: '', description: '', price: 0 };
        selectedIcon.value = null;
        iconPreview.value = null;
    } catch (e) { console.error(e); }
    finally { submitting.value = false; }
}

async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this app?')) return;
    await deleteApp(id);
}
</script>

<template>
    <div class="min-h-screen bg-[#0f1117]">
        <!-- Header -->
        <header class="border-b border-white/[0.06] bg-[#0f1117]/80 backdrop-blur-xl sticky top-0 z-40">
            <div class="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <RouterLink to="/root/dashboard" class="flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
                        <ArrowLeft class="w-4 h-4" />
                    </RouterLink>
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                            <Store class="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-white">App Store</span>
                            <p class="text-xs text-white/30">Manage applications for tenants</p>
                        </div>
                    </div>
                </div>
                <button @click="showModal = true" class="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-white/5">
                    <Plus class="w-4 h-4" /> New App
                </button>
            </div>
        </header>

        <main class="max-w-[1400px] mx-auto px-6 py-8">
            <!-- Error -->
            <div v-if="error" class="mb-6 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                <span>{{ error }}</span>
            </div>

            <!-- Loading -->
            <div v-if="loading && !showModal" class="flex flex-col items-center justify-center py-24">
                <Loader2 class="w-8 h-8 text-white/20 animate-spin mb-4" />
                <p class="text-sm text-white/30">Loading apps...</p>
            </div>

            <!-- Apps Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div v-for="app in apps" :key="app.id" class="group bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/[0.05]">
                    <div class="p-5">
                        <div class="flex items-start gap-4">
                            <div class="w-14 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img v-if="app.icon_url" :src="app.icon_url" :alt="app.name" class="w-full h-full object-cover" />
                                <ShoppingBag v-else class="w-6 h-6 text-white/20" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-base font-semibold text-white truncate">{{ app.name }}</h3>
                                <p class="text-sm text-white/30 mt-1 line-clamp-2 leading-relaxed">{{ app.description }}</p>
                            </div>
                        </div>
                    </div>
                    <div class="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider" :class="app.price > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.06] text-white/40'">
                            {{ app.price > 0 ? `${app.price.toFixed(2)} DT` : 'Free' }}
                        </span>
                        <div class="flex items-center gap-1">
                            <button @click="openAssignmentModal(app)" class="p-2 rounded-lg text-indigo-400/60 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all" title="Manage Access">
                                <Users class="w-4 h-4" />
                            </button>
                            <button @click="handleDelete(app.id)" class="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Empty -->
                <div v-if="apps.length === 0" class="col-span-full flex flex-col items-center justify-center py-24 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl">
                    <div class="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                        <ShoppingBag class="w-7 h-7 text-white/20" />
                    </div>
                    <p class="text-white/40 font-medium mb-1">No apps yet</p>
                    <p class="text-white/20 text-sm mb-6">Add your first application to the store</p>
                    <button @click="showModal = true" class="flex items-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg transition">
                        <Plus class="w-4 h-4" /> New App
                    </button>
                </div>
            </div>
        </main>

        <!-- Add App Modal -->
        <Transition name="modal">
            <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showModal = false"></div>
                <div class="relative w-full max-w-lg bg-[#1a1b23] border border-white/[0.08] rounded-2xl shadow-2xl">
                    <div class="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                        <div>
                            <h3 class="text-lg font-semibold text-white">New Application</h3>
                            <p class="text-xs text-white/30 mt-0.5">Add an app to the store</p>
                        </div>
                        <button @click="showModal = false" class="text-white/30 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition"><X class="w-5 h-5" /></button>
                    </div>

                    <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
                        <!-- Icon Upload -->
                        <div class="flex flex-col items-center justify-center p-5 border-2 border-dashed border-white/[0.08] rounded-xl hover:border-white/[0.15] hover:bg-white/[0.02] transition cursor-pointer" @click="fileInput?.click()">
                            <input ref="fileInput" type="file" accept="image/*" @change="handleFileChange" class="hidden" />
                            <div v-if="iconPreview" class="w-20 h-20 rounded-xl overflow-hidden ring-2 ring-white/[0.1]">
                                <img :src="iconPreview" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-center">
                                <Upload class="mx-auto w-8 h-8 text-white/15 mb-2" />
                                <p class="text-xs text-white/30">Click to upload app icon</p>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">App Name</label>
                            <div class="relative">
                                <ShoppingBag class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                <input v-model="newApp.name" type="text" required placeholder="e.g. Premium Analytics" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" />
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Description</label>
                            <textarea v-model="newApp.description" rows="3" placeholder="Describe features and benefits..." class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition"></textarea>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Price (DT)</label>
                            <div class="relative">
                                <DollarSign class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                <input v-model.number="newApp.price" type="number" min="0" step="0.01" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-14 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition" />
                                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/30 font-semibold">DT</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
                            <button type="button" @click="showModal = false" class="text-sm text-white/40 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/[0.06] transition">Cancel</button>
                            <button type="submit" :disabled="submitting" class="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed">
                                <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
                                {{ submitting ? 'Saving...' : 'Save Application' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Transition>

        <!-- Client Assignment Modal -->
        <ClientAssignmentModal :show="showAssignmentModal" :app="selectedAppForAssignment" @close="closeAssignmentModal" />
    </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
</style>
