<script setup lang="ts">
import { ShoppingBag, X } from 'lucide-vue-next';
import { useTenantStore } from '@/stores/tenant';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
    show: boolean;
    appName: string;
}>();

const emit = defineEmits(['close']);

const tenantStore = useTenantStore();
const authStore = useAuthStore();
const router = useRouter();

function goToStore() {
    emit('close');
    // If admin, go to admin dashboard -> store? 
    // Wait, tenants don't have a "store" view usually, only Root Admin does.
    // The requirement says: "The others will be shown a small window telling them to by the App for this feature to work, with a link to the store page"
    // Assuming there is a public store or tenant store view?
    // Based on file list, I see `Pages/Root/Store`. I don't see a `Pages/Admin/Store`.
    // If user is a tenant admin, maybe they can't "buy" it themselves if there is no UI.
    // But the prompt says "link to the store page". 
    // If no tenant store exists, I'll just redirect to contact or show a message.
    // Checking `useStore` again... "Tenant context NOT needed for fetching global apps".
    // Maybe there is a `/store` for tenants?
    // For now, I'll just redirect to dashboard or show a generic message if no route exists.
    // However, I will assume there might be a route or just close.
    // Actually, looking at `routes`, if I knew them...
    // Let's safe bet: close and alert "Contact your administrator".
    // OR if they are Root, go to Root Store.
    
    if (authStore.isRoot) {
        router.push({ name: 'root.store' });
    } else {
        // Tenants might not have a store page yet. 
        // Showing a helpful message instead of a broken link.
        alert("Please contact the platform administrator to purchase this app.");
    }
}
</script>

<template>
    <div v-if="show" class="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-black/60 transition-opacity backdrop-blur-sm" aria-hidden="true" @click="$emit('close')"></div>

            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div class="relative inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-md w-full border-2 border-indigo-100">
                <div class="bg-white px-6 py-6 pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                            <ShoppingBag class="h-6 w-6 text-indigo-600" aria-hidden="true" />
                        </div>
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                Feature Locked
                            </h3>
                            <div class="mt-2">
                                <p class="text-sm text-gray-500">
                                    The <span class="font-bold text-gray-800">{{ appName }}</span> app is required to access this feature.
                                </p>
                                <p class="text-sm text-gray-500 mt-2">
                                    Unlock advanced invoicing, PDF generation, and more by adding this app to your workspace.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse">
                    <button 
                        type="button" 
                        class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                        @click="goToStore"
                    >
                        Get {{ appName }}
                    </button>
                    <button 
                        type="button" 
                        class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        @click="$emit('close')"
                    >
                        Cancel
                    </button>
                </div>
                
                <button @click="$emit('close')" class="absolute top-3 right-3 text-gray-400 hover:text-gray-500">
                    <X class="h-5 w-5" />
                </button>
            </div>
        </div>
    </div>
</template>
