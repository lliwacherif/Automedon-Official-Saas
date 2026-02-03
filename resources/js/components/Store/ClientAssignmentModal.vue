<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { useTenantStore, type Tenant } from '@/stores/tenant';
import { Loader2, Check, X, Search } from 'lucide-vue-next';

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
const processing = ref<string | null>(null); // Tenant ID being processed
const searchQuery = ref('');

// Fetch data when modal opens
watch(() => props.show, async (newVal) => {
    if (newVal && props.app) {
        await loadData();
    }
});

async function loadData() {
    loading.value = true;
    try {
        // Fetch all tenants
        tenants.value = await tenantStore.fetchAllTenants();

        // Fetch current assignments for this app
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
    return tenants.value.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.slug.toLowerCase().includes(query)
    );
});

async function toggleAssignment(tenantId: string) {
    if (!props.app) return;
    
    processing.value = tenantId;
    try {
        if (assignedTenantIds.value.has(tenantId)) {
            // Unassign
            await store.unassignAppFromTenant(props.app.id, tenantId);
            assignedTenantIds.value.delete(tenantId);
        } else {
            // Assign
            await store.assignAppToTenant(props.app.id, tenantId);
            assignedTenantIds.value.add(tenantId);
        }
    } catch (e) {
        console.error('Error toggling assignment:', e);
        // Revert or show error
        alert('Failed to update assignment.');
    } finally {
        processing.value = null;
    }
}
</script>

<template>
    <div v-if="show" class="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <!-- Background overlay -->
            <div 
                class="fixed inset-0 bg-black/60 transition-opacity backdrop-blur-sm" 
                aria-hidden="true" 
                @click="$emit('close')"
            ></div>

            <!-- This element is to trick the browser into centering the modal contents. -->
            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <!-- Modal Panel -->
            <div 
                class="relative inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-xl w-full flex flex-col max-h-[85vh] z-50 border border-gray-100"
            >
                <!-- Header -->
                <div class="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900" id="modal-title">
                            Manage App Access
                        </h3>
                        <p class="text-xs text-gray-500 mt-1">
                            {{ app?.name }}
                        </p>
                    </div>
                    <button 
                        @click="$emit('close')" 
                        class="text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none"
                    >
                        <X class="h-5 w-5" />
                    </button>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar min-h-[300px]">
                    <!-- Loading State -->
                    <div v-if="loading" class="flex flex-col items-center justify-center h-full text-gray-500">
                        <Loader2 class="animate-spin h-8 w-8 text-indigo-600 mb-2" />
                        <p class="text-sm">Loading...</p>
                    </div>

                    <div v-else class="space-y-2">
                        <div v-if="filteredTenants.length === 0" class="text-center py-10 text-gray-500 text-sm">
                            <div class="bg-gray-100 p-3 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                                <Search class="h-6 w-6 text-gray-400" />
                            </div>
                            No clients found.
                        </div>
                        
                        <div 
                            v-for="tenant in filteredTenants" 
                            :key="tenant.id"
                            class="flex items-center justify-between p-3 rounded-lg border transition-colors relative z-10"
                            :class="assignedTenantIds.has(tenant.id) 
                                ? 'bg-indigo-50 border-indigo-200' 
                                : 'bg-white border-gray-200 hover:border-gray-300'"
                        >
                            <div class="flex items-center space-x-3 overflow-hidden">
                                <div class="flex-shrink-0 h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center border border-gray-200 overflow-hidden">
                                    <img v-if="tenant.logo_url" :src="tenant.logo_url" class="h-full w-full object-cover">
                                    <span v-else class="text-xs font-bold text-gray-500 select-none">{{ tenant.name.substring(0, 2).toUpperCase() }}</span>
                                </div>
                                <div class="min-w-0 truncate">
                                    <p class="text-sm font-medium text-gray-900 truncate">{{ tenant.name }}</p>
                                    <p class="text-xs text-gray-500 truncate">{{ tenant.slug }}</p>
                                </div>
                            </div>

                            <button
                                @click="toggleAssignment(tenant.id)"
                                :disabled="!!processing && processing === tenant.id"
                                class="flex-shrink-0 ml-4 inline-flex items-center justify-center px-4 py-2 border text-xs font-medium rounded-md focus:outline-none transition-colors min-w-[100px] relative z-20 cursor-pointer"
                                :class="assignedTenantIds.has(tenant.id) 
                                    ? 'border-transparent text-indigo-700 bg-indigo-100 hover:bg-indigo-200' 
                                    : 'border-transparent text-white bg-gray-900 hover:bg-gray-800'"
                            >
                                <span v-if="processing === tenant.id" class="flex items-center">
                                    <Loader2 class="animate-spin h-3 w-3 mr-1" />
                                    Wait
                                </span>
                                <span v-else-if="assignedTenantIds.has(tenant.id)" class="flex items-center">
                                    <Check class="h-3 w-3 mr-1" />
                                    Assigned
                                </span>
                                <span v-else>
                                    Assign
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200 flex-shrink-0">
                    <button 
                        type="button" 
                        class="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                        @click="$emit('close')"
                    >
                        Close
                    </button>
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
    background-color: #cbd5e1;
    border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
}
</style>
