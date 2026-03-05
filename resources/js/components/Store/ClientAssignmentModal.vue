<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { useTenantStore, type Tenant } from '@/stores/tenant';
import { Loader2, Check, X, Search, Users, Building2 } from 'lucide-vue-next';

const props = defineProps<{
    show: boolean;
    app: StoreApp | null;
}>();

const emit = defineEmits(['close']);

const tenantStore = useTenantStore();
const store = useStore();

const tenants = ref<Tenant[]>([]);
const assignedTenantIds = ref<Set<string>>(new Set());
const loading = ref(true);
const processing = ref<string | null>(null);
const searchQuery = ref('');

watch(() => props.show, async (newVal) => {
    if (newVal && props.app) {
        await loadData();
    }
});

async function loadData() {
    loading.value = true;
    try {
        tenants.value = await tenantStore.fetchAllTenants();
        if (props.app) {
            const assignments = await store.fetchAppAssignments(props.app.id);
            assignedTenantIds.value = new Set(assignments.map(a => a.tenant_id));
        }
    } catch (e) {
        console.error('Error loading assignment data:', e);
    } finally {
        loading.value = false;
    }
}

const filteredTenants = computed(() => {
    if (!searchQuery.value) return tenants.value;
    const query = searchQuery.value.toLowerCase();
    return tenants.value.filter(t => t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query));
});

const assignedCount = computed(() => assignedTenantIds.value.size);

async function toggleAssignment(tenantId: string) {
    if (!props.app) return;
    processing.value = tenantId;
    try {
        if (assignedTenantIds.value.has(tenantId)) {
            await store.unassignAppFromTenant(props.app.id, tenantId);
            assignedTenantIds.value.delete(tenantId);
        } else {
            await store.assignAppToTenant(props.app.id, tenantId);
            assignedTenantIds.value.add(tenantId);
        }
    } catch (e) {
        console.error('Error toggling assignment:', e);
        alert('Failed to update assignment.');
    } finally {
        processing.value = null;
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @keydown.escape="$emit('close')">
                <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('close')"></div>

                <div class="relative w-full max-w-xl bg-[#1a1b23] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                    <!-- Header -->
                    <div class="shrink-0 px-6 py-5 border-b border-white/[0.06]">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                    <Users class="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 class="text-base font-semibold text-white">Manage Access</h3>
                                    <p class="text-xs text-white/30 mt-0.5">{{ app?.name }} &middot; {{ assignedCount }} assigned</p>
                                </div>
                            </div>
                            <button @click="$emit('close')" class="text-white/30 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition">
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Search -->
                        <div class="relative mt-4">
                            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input 
                                v-model="searchQuery"
                                type="text"
                                placeholder="Search clients..."
                                class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition"
                            />
                        </div>
                    </div>

                    <!-- Scrollable List -->
                    <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                        <!-- Loading -->
                        <div v-if="loading" class="flex flex-col items-center justify-center py-16">
                            <Loader2 class="w-7 h-7 text-white/20 animate-spin mb-3" />
                            <p class="text-sm text-white/30">Loading clients...</p>
                        </div>

                        <!-- Empty -->
                        <div v-else-if="filteredTenants.length === 0" class="flex flex-col items-center justify-center py-16">
                            <div class="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                                <Search class="w-5 h-5 text-white/15" />
                            </div>
                            <p class="text-sm text-white/30">No clients found</p>
                        </div>

                        <!-- Tenant List -->
                        <div 
                            v-else
                            v-for="tenant in filteredTenants" 
                            :key="tenant.id"
                            class="flex items-center justify-between p-3 rounded-xl border transition-all"
                            :class="assignedTenantIds.has(tenant.id) 
                                ? 'bg-indigo-500/[0.08] border-indigo-500/20' 
                                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'"
                        >
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden" :class="assignedTenantIds.has(tenant.id) ? 'bg-indigo-500/10' : 'bg-white/[0.04]'">
                                    <img v-if="tenant.logo_url" :src="tenant.logo_url" class="w-full h-full object-cover" />
                                    <Building2 v-else class="w-4 h-4 text-white/20" />
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-medium text-white truncate">{{ tenant.name }}</p>
                                    <p class="text-xs text-white/25 truncate">/{{ tenant.slug }}</p>
                                </div>
                            </div>

                            <button
                                @click="toggleAssignment(tenant.id)"
                                :disabled="processing === tenant.id"
                                class="flex-shrink-0 ml-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all min-w-[100px]"
                                :class="assignedTenantIds.has(tenant.id) 
                                    ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20' 
                                    : 'text-white bg-white/[0.08] hover:bg-white/[0.12]'"
                            >
                                <Loader2 v-if="processing === tenant.id" class="w-3 h-3 animate-spin" />
                                <Check v-else-if="assignedTenantIds.has(tenant.id)" class="w-3 h-3" />
                                {{ processing === tenant.id ? '...' : (assignedTenantIds.has(tenant.id) ? 'Assigned' : 'Assign') }}
                            </button>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="shrink-0 px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
                        <p class="text-xs text-white/20">{{ filteredTenants.length }} client{{ filteredTenants.length !== 1 ? 's' : '' }}</p>
                        <button @click="$emit('close')" class="text-sm text-white/40 hover:text-white px-4 py-2 rounded-xl hover:bg-white/[0.06] transition">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div:last-child, .modal-leave-to > div:last-child { transform: scale(0.95) translateY(10px); }
</style>
