<script setup lang="ts">
import NavBar from '@/components/NavBar.vue';
import { useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();
const showNavBar = computed(() => {
    // Hide NavBar on Root Dashboard/Login pages
    return !String(route.name).startsWith('root.');
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar v-if="showNavBar" />
    <main class="flex-grow">
      <router-view />
    </main>
    <footer class="bg-white border-t border-gray-200 py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        Automedon, CherifCorp Technologies @2025
      </div>
    </footer>
  </div>
</template>
