<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { Trash2 } from 'lucide-vue-next';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
// Simple file upload logic without full composable dependency if simpler, but let's try to reuse or just fetch directly.
// Importing useFileUpload if it exists.
import { useFileUpload } from '@/composables/useFileUpload';

const { uploadFile, uploading: uploadingLogo } = useFileUpload();

interface Tenant {
    id: string;
    name: string;
    slug: string;
    logo_url: string;
    status: string;
    created_at: string;
}

const tenants = ref<Tenant[]>([]);
const loading = ref(true);

// New Tenant Form
const showCreateModal = ref(false);
const newTenant = ref({
    name: '',
    slug: '',
    logo_url: '',
    admin_password: 'admin' // Default
});
const selectedLogoFile = ref<File | null>(null);
const logoPreview = ref<string | null>(null);

const createLoading = ref(false);

const fetchTenants = async () => {
    loading.value = true;
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) tenants.value = data as Tenant[];
    loading.value = false;
};

const handleLogoSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        selectedLogoFile.value = file;
        logoPreview.value = URL.createObjectURL(file);
    }
};

const createTenant = async () => {
    createLoading.value = true;
    try {
        let logoUrl = newTenant.value.logo_url;

        if (selectedLogoFile.value) {
            // Upload to 'car-images' (reusing existing bucket for now to avoid permission errors) or 'tenant-logos' if available
            // Let's use 'car-images' as a fallback safe bucket that we know exists and is public
            const url = await uploadFile(selectedLogoFile.value, 'car-images', 'logos');
            if (url) logoUrl = url;
        }

        await tenantStore.createTenant(
            newTenant.value.name,
            newTenant.value.slug,
            logoUrl,
            'admin', // Default username
            newTenant.value.admin_password
        );
        showCreateModal.value = false;
        // Reset form
        newTenant.value = { name: '', slug: '', logo_url: '', admin_password: 'admin' };
        selectedLogoFile.value = null;
        logoPreview.value = null;
        
        await fetchTenants();
    } catch (e: any) {
        alert('Error creating tenant: ' + e.message);
    } finally {
        createLoading.value = false;
    }
};

const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this client? This action is irreversible and will delete all associated data (Cars, Reservations, Users).')) {
        try {
            await tenantStore.deleteTenant(id);
            // Update local list
            tenants.value = tenants.value.filter(t => t.id !== id);
        } catch (e: any) {
            alert('Error deleting tenant: ' + e.message);
        }
    }
};

const logout = () => {
    authStore.signOut();
};

onMounted(() => {
    fetchTenants();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-gray-900 text-white shadow">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                        Automedon Root
                    </span>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-gray-400">root@automedon</span>
                    <RouterLink :to="{ name: 'root.store' }" class="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition">
                        Store
                    </RouterLink>
                    <RouterLink :to="{ name: 'root.settings' }" class="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition">
                        Settings
                    </RouterLink>
                    <button @click="logout" class="text-sm bg-red-900 hover:bg-red-800 px-3 py-1 rounded transition">
                        Logout
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Managed Clients (Tenants)</h2>
                <button 
                    @click="showCreateModal = true"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2"
                >
                    + New Client
                </button>
            </div>

            <!-- Tenant Grid -->
            <div v-if="loading" class="text-center py-12">Loading clients...</div>
            
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div v-for="tenant in tenants" :key="tenant.id" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                    <div class="h-32 bg-gray-100 flex items-center justify-center p-4">
                        <img v-if="tenant.logo_url" :src="tenant.logo_url" class="max-h-full max-w-full object-contain" />
                        <span v-else class="text-gray-400 text-6xl">🏢</span>
                    </div>
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-1">{{ tenant.name }}</h3>
                        <p class="text-sm text-gray-500 mb-4">Slug: <span class="font-mono bg-gray-100 px-1 rounded">{{ tenant.slug }}</span></p>
                        
                        <div class="flex justify-between items-center mt-4">
                            <span :class="{'bg-green-100 text-green-800': tenant.status === 'active', 'bg-red-100 text-red-800': tenant.status !== 'active'}" class="px-2 py-1 rounded text-xs font-semibold uppercase">
                                {{ tenant.status }}
                            </span>
                            <div class="flex gap-2">
                                <a :href="`/${tenant.slug}/admin`" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                                    Access &rarr;
                                </a>
                                <button @click="handleDelete(tenant.id)" class="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1" title="Delete Client">
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        
        <!-- Create Modal -->
        <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 class="text-lg font-bold mb-4">Create New Client</h3>
                <form @submit.prevent="createTenant" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Client Name</label>
                        <input v-model="newTenant.name" type="text" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" placeholder="e.g. GS Cars Rent Car">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Slug (URL)</label>
                        <input v-model="newTenant.slug" type="text" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" placeholder="e.g. gs-cars">
                        <p class="text-xs text-gray-500 mt-1">Access URL: domain.com/{{ newTenant.slug || 'slug' }}/admin</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700">Logo</label>
                        <div class="mt-1 flex items-center gap-4">
                            <div v-if="logoPreview" class="h-12 w-12 rounded overflow-hidden border">
                                <img :src="logoPreview" class="h-full w-full object-contain" />
                            </div>
                            <input 
                                @change="handleLogoSelect" 
                                type="file" 
                                accept="image/*"
                                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            >
                        </div>
                         <!-- Fallback text input if needed, or remove -->
                        <!-- <input v-model="newTenant.logo_url" type="text" class="mt-2 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-xs" placeholder="Or paste URL..."> -->
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700">Admin Password (Username: admin)</label>
                        <input v-model="newTenant.admin_password" type="text" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2">
                    </div>

                    <div class="flex justify-end gap-3 mt-6">
                        <button type="button" @click="showCreateModal = false" class="text-gray-600 hover:text-gray-800 px-4 py-2">Cancel</button>
                        <button type="submit" :disabled="createLoading" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            {{ createLoading ? 'Creating...' : 'Create Client' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
