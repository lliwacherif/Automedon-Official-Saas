<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loader2, FileDown, ArrowLeft } from 'lucide-vue-next';
import InvoiceTemplate, { type InvoiceData } from '@/components/Invoices/InvoiceTemplate.vue';
import { useReservations } from '@/composables/useReservations';
import { useTenantStore } from '@/stores/tenant';
import { formatDateTime } from '@/utils/date';
import { useTenantLink } from '@/composables/useTenantLink';
//@ts-ignore
import html2pdf from 'html2pdf.js';

const route = useRoute();
const router = useRouter();
const { fetchReservations } = useReservations(); // We might need a single fetch, but usually fetchReservations loads all. Optimally we'd have fetchReservation(id).
// For now, I'll fetch all and find, or assume the store has it if we just came from the table. 
// But a page refresh would lose it. So I should probably try to fetch.
// Limitations of current composable: `useReservations` fetches all.
// I will just use `supabase` directly here for speed/efficiency or reuse `useReservations` if it exposes a single fetcher.
// Looking at previous `useReservations` usage, it exposes `fetchReservations`.
// I'll import supabase to fetch single reservation to be robust.
import { supabase } from '@/lib/supabase';

const loading = ref(true);
const generating = ref(false);
const previewData = ref<InvoiceData | null>(null);
const tenantStore = useTenantStore();
const { tenantPath } = useTenantLink();

async function loadReservation(id: string) {
    loading.value = true;
    try {
        const { data, error } = await supabase
            .from('reservations')
            .select('*, car:cars(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (data) {
            generateInvoiceData(data, tenantStore.currentTenant);
        }
    } catch (e) {
        console.error('Error loading reservation', e);
        alert('Reservation not found');
        router.push({ name: 'admin.reservations.index', params: { tenantSlug: tenantStore.currentTenant?.slug } });
    } finally {
        loading.value = false;
    }
}

function generateInvoiceData(reservation: any, tenant: any) {
    if (!reservation || !tenant) return;

    const invNum = reservation.contract_number ? `INV-${reservation.contract_number}` : `DRAFT-${Date.now().toString().slice(-4)}`;
    
    const nbDays = Math.ceil((new Date(reservation.end_date).getTime() - new Date(reservation.start_date).getTime()) / (1000 * 3600 * 24));
    
    const tvaRate = 0.19;
    const timbre = 1.000;
    const totalTTC = Number(reservation.total_price) || 0;
    
    // Quick reverse calculation 
    const totalExclStamp = Math.max(0, totalTTC - timbre);
    const totalHT = totalExclStamp / (1 + tvaRate);
    const unitPriceHT = totalHT / (nbDays || 1); 
    
    previewData.value = {
        invoiceNumber: invNum,
        invoiceDate: new Date().toLocaleDateString('fr-TN'),
        company: {
            name: tenant.name,
            address: 'Adresse de la société...',
            gsm: ['00 000 000'],
            email: 'contact@exemple.com',
            mf: '0000000/A/A/000',
            logoUrl: tenant.logo_url
        },
        client: {
            name: reservation.client_name,
            address: 'Adresse client...',
            mf: 'Client MF...',
            tel: reservation.client_phone || ''
        },
        items: [
            {
                designation: `Location véhicule ${reservation.car?.brand || ''} ${reservation.car?.model || ''}`,
                duree: `${formatDateTime(reservation.start_date)} au ${formatDateTime(reservation.end_date)}`,
                unitPriceHT: unitPriceHT,
                unite: 'Jours',
                qte: nbDays || 1,
                totalHT: totalHT
            }
        ],
        tax: {
            tvaRate: tvaRate,
            timbreFiscal: timbre
        }
    };
}

async function downloadPdf() {
    if (!previewData.value) return;
    generating.value = true;

    try {
        const element = document.getElementById('invoice-template');
        if (!element) throw new Error('Template element not found');

        const opt: any = {
            margin: 0,
            filename: `Facture_${previewData.value.invoiceNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().from(element).set(opt).save();
    } catch (e: any) {
        console.error('PDF Generation failed', e);
        // Show the actual error to help debugging
        alert(`Failed to generate PDF: ${e.message || e}`);
    } finally {
        generating.value = false;
    }
}

function goBack() {
    router.back();
}

onMounted(() => {
    if (route.params.id) {
        loadReservation(route.params.id as string);
    }
});
</script>

<template>
    <div class="min-h-screen bg-gray-100 flex flex-col">
        <!-- Toolbar / Header -->
        <header class="bg-white shadow sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div class="flex items-center">
                    <button @click="goBack" class="mr-4 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                        <ArrowLeft class="w-5 h-5" />
                    </button>
                    <h1 class="text-xl font-bold text-gray-900">Éditeur de Facture</h1>
                </div>
                
                <div class="flex items-center space-x-4">
                    <button 
                        @click="downloadPdf"
                        :disabled="generating || loading"
                        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                    >
                        <Loader2 v-if="generating" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                        <FileDown v-else class="-ml-1 mr-2 h-4 w-4" />
                        Télécharger PDF
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
            <div v-if="loading" class="flex justify-center items-center h-64">
                <Loader2 class="animate-spin h-8 w-8 text-indigo-600" />
            </div>
            
            <div v-else-if="previewData" class="w-full max-w-[210mm] shadow-2xl bg-white mb-20 animate-in fade-in zoom-in duration-300">
                <InvoiceTemplate :data="previewData" />
            </div>
        </main>
    </div>
</template>

<style>
/* Global scrollbar style for this page if needed, 
   but standard browser scrollbar on body/main is usually better for full pages calls logic */
</style>
