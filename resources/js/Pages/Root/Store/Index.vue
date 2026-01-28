<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { Plus, Trash2, Loader2, Upload, ShoppingBag, ArrowLeft } from 'lucide-vue-next';

const { apps, loading, error, fetchApps, addApp, deleteApp } = useStore();

const showModal = ref(false);
const submitting = ref(false);
const newApp = ref({
    name: '',
    description: '',
    price: 0,
});
const selectedIcon = ref<File | null>(null);
const iconPreview = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
    fetchApps();
});

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
        // Reset form
        newApp.value = { name: '', description: '', price: 0 };
        selectedIcon.value = null;
        iconPreview.value = null;
    } catch (e) {
        console.error(e);
    } finally {
        submitting.value = false;
    }
}

async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this app?')) return;
    await deleteApp(id);
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 py-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Header -->
            <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="flex items-center">
                    <RouterLink 
                        to="/root/dashboard" 
                        class="p-2 mr-4 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft class="w-5 h-5" />
                    </RouterLink>
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">App Store Management</h1>
                        <p class="mt-1 text-sm text-gray-500">Manage applications available for your tenants.</p>
                    </div>
                </div>
                <button
                    @click="showModal = true"
                    class="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-all transform hover:-translate-y-0.5"
                >
                    <Plus class="h-5 w-5 mr-2" />
                    Add New App
                </button>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <Trash2 class="h-5 w-5 text-red-500" />
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-red-800">Error</p>
                        <p class="text-sm text-red-700 mt-1">{{ error }}</p>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading && !showModal" class="flex justify-center py-20">
                <Loader2 class="animate-spin h-10 w-10 text-indigo-600" />
            </div>

            <!-- Apps Grid -->
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- App Card -->
                <div v-for="app in apps" :key="app.id" class="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                    <div class="p-6 flex-1">
                        <div class="flex items-start justify-between">
                            <div class="h-14 w-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img v-if="app.icon_url" :src="app.icon_url" :alt="app.name" class="h-full w-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                                <ShoppingBag v-else class="h-7 w-7 text-indigo-500" />
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {{ app.price > 0 ? `${app.price.toFixed(2)} DT` : 'Free' }}
                                </span>
                                <button
                                    @click="handleDelete(app.id)"
                                    class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="Delete App"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div class="mt-4">
                            <h3 class="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{{ app.name }}</h3>
                            <p class="mt-2 text-sm text-gray-600 line-clamp-3 leading-relaxed">{{ app.description }}</p>
                        </div>
                    </div>
                    <div class="bg-gray-50 px-6 py-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
                        <span>Status: <span class="font-medium text-green-600">Active</span></span>
                        <span>ID: {{ app.id }}</span>
                    </div>
                </div>
                
                <!-- Empty State -->
                <div v-if="apps.length === 0" class="col-span-full py-16 text-center bg-white rounded-xl border border-dashed border-gray-300">
                    <ShoppingBag class="mx-auto h-12 w-12 text-gray-300" />
                    <h3 class="mt-2 text-sm font-medium text-gray-900">No apps available</h3>
                    <p class="mt-1 text-sm text-gray-500">Get started by adding a new application to the store.</p>
                </div>
            </div>

            <!-- Add App Modal -->
            <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="showModal = false"></div>

                    <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                    <div class="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                        <div class="bg-indigo-600 px-4 py-3 sm:px-6">
                            <h3 class="text-lg leading-6 font-medium text-white" id="modal-title">Add New Application</h3>
                        </div>
                        
                        <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
                            <!-- Icon Upload -->
                            <div class="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative" @click="$refs.fileInput.click()">
                                <input
                                    ref="fileInput"
                                    type="file"
                                    accept="image/*"
                                    @change="handleFileChange"
                                    class="hidden"
                                />
                                <div v-if="iconPreview" class="h-24 w-24 relative">
                                    <img :src="iconPreview" class="h-full w-full object-contain rounded-lg" />
                                    <div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                        <p class="text-white text-xs font-medium">Change</p>
                                    </div>
                                </div>
                                <div v-else class="text-center">
                                    <Upload class="mx-auto h-10 w-10 text-gray-400" />
                                    <p class="mt-2 text-sm text-gray-500">Click to upload app icon</p>
                                </div>
                            </div>

                            <!-- Inputs -->
                            <div class="space-y-4">
                                <div>
                                    <label for="name" class="block text-sm font-medium text-gray-700">App Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        v-model="newApp.name"
                                        required
                                        placeholder="e.g. Premium Analytics"
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                    />
                                </div>

                                <div>
                                    <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        id="description"
                                        v-model="newApp.description"
                                        rows="3"
                                        placeholder="Describe features and benefits..."
                                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                    ></textarea>
                                </div>

                                <div>
                                    <label for="price" class="block text-sm font-medium text-gray-700">Price (DT)</label>
                                    <div class="mt-1 relative rounded-md shadow-sm">
                                        <input
                                            type="number"
                                            id="price"
                                            v-model.number="newApp.price"
                                            min="0"
                                            step="0.01"
                                            class="block w-full pl-3 pr-12 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border"
                                        />
                                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span class="text-gray-500 sm:text-sm font-medium">DT</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
                                <button
                                    type="button"
                                    @click="showModal = false"
                                    class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    :disabled="submitting"
                                    class="px-4 py-2 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    <Loader2 v-if="submitting" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    {{ submitting ? 'Saving...' : 'Save Application' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
