<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStore, type StoreApp } from '@/composables/useStore';
import { Plus, Trash2, Loader2, Upload, ShoppingBag } from 'lucide-vue-next';

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
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-gray-900">Manage Store Apps</h1>
            <button
                @click="showModal = true"
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
                <Plus class="h-5 w-5 mr-2" />
                Add New App
            </button>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border-l-4 border-red-400 p-4">
            <div class="flex">
                <div class="flex-shrink-0">
                    <Trash2 class="h-5 w-5 text-red-400" />
                </div>
                <div class="ml-3">
                    <p class="text-sm text-red-700">{{ error }}</p>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading && !showModal" class="flex justify-center py-12">
            <Loader2 class="animate-spin h-8 w-8 text-indigo-600" />
        </div>

        <!-- Apps List -->
        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
            <ul role="list" class="divide-y divide-gray-200">
                <li v-for="app in apps" :key="app.id">
                    <div class="px-4 py-4 sm:px-6 flex items-center justify-between">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                                <img v-if="app.icon_url" :src="app.icon_url" :alt="app.name" class="h-full w-full object-cover" />
                                <ShoppingBag v-else class="h-6 w-6 text-gray-400" />
                            </div>
                            <div class="ml-4">
                                <h3 class="text-lg font-medium text-gray-900">{{ app.name }}</h3>
                                <div class="text-sm text-gray-500 line-clamp-1">{{ app.description }}</div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {{ app.price }} DT
                            </span>
                            <button
                                @click="handleDelete(app.id)"
                                class="text-red-600 hover:text-red-900 p-2"
                            >
                                <Trash2 class="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </li>
                <li v-if="apps.length === 0" class="px-4 py-8 text-center text-gray-500">
                    No apps in the store yet.
                </li>
            </ul>
        </div>

        <!-- Add App Modal -->
        <div
            v-if="showModal"
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50 flex items-center justify-center p-4"
        >
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Add New App</h3>
                </div>
                
                <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
                    <!-- Icon Upload -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700">App Icon</label>
                        <div class="mt-1 flex items-center space-x-4">
                            <div class="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-300">
                                <img v-if="iconPreview" :src="iconPreview" class="h-full w-full object-cover" />
                                <Upload v-else class="h-8 w-8 text-gray-400" />
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                @change="handleFileChange"
                                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                        </div>
                    </div>

                    <!-- Name -->
                    <div>
                        <label for="name" class="block text-sm font-medium text-gray-700">App Name</label>
                        <input
                            type="text"
                            id="name"
                            v-model="newApp.name"
                            required
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>

                    <!-- Description -->
                    <div>
                        <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            id="description"
                            v-model="newApp.description"
                            rows="3"
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        ></textarea>
                    </div>

                    <!-- Price -->
                    <div>
                        <label for="price" class="block text-sm font-medium text-gray-700">Price (DT)</label>
                        <div class="mt-1 relative rounded-md shadow-sm">
                            <input
                                type="number"
                                id="price"
                                v-model.number="newApp.price"
                                min="0"
                                step="0.01"
                                class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md"
                            />
                            <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span class="text-gray-500 sm:text-sm">DT</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            @click="showModal = false"
                            class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="submitting"
                            class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <span v-if="submitting">Saving...</span>
                            <span v-else>Save App</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
