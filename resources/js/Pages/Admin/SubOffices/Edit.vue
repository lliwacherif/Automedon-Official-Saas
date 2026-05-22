<script setup lang="ts">
import { useRoute } from 'vue-router';
import SubOfficeForm from '@/components/SubOfficeForm.vue';

const route = useRoute();
const subOfficeId = route.params.id as string;
</script>

<template>
    <SubOfficeForm mode="edit" :sub-office-id="subOfficeId" />
</template>
