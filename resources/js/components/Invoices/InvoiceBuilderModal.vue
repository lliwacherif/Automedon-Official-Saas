<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Loader2, FileDown, X, RefreshCw } from 'lucide-vue-next';
import InvoiceTemplate, { type InvoiceData } from './InvoiceTemplate.vue';
import { formatDateTime } from '@/utils/date';
//@ts-ignore
import html2pdf from 'html2pdf.js';

const props = defineProps<{
    show: boolean;
    reservation: any; // Type this properly if possible
    tenant: any;
}>();

const emit = defineEmits(['close']);

const loading = ref(false);
const previewData = ref<InvoiceData | null>(null);

// Initialize Invoice Data from Reservation
function generateInvoiceData() {
    if (!props.reservation || !props.tenant) return;

    // Determine Invoice Number (Mocking logic or using Contract Number)
    // In a real app, this might come from a DB sequence.
    const invNum = props.reservation.contract_number ? `INV-${props.reservation.contract_number}` : `DRAFT-${Date.now().toString().slice(-4)}`;

    // Prepare Items
    const nbDays = Math.ceil((new Date(props.reservation.end_date).getTime() - new Date(props.reservation.start_date).getTime()) / (1000 * 3600 * 24));
    
    // Reverse calc HT from Total (Total in DB is usually TTC?)
    // Assuming reservation.total_price is TTC.
    // If we assume a standard rate of 19% and 1.000 stamp:
    // This is explicitly "Facture Pro" logic so we should probably verify if we store HT/TTC separately.
    // For now, I'll assume total_price in DB is the final amount the client pays (TTC).
    // So: TotalTTC = (TotalHT * 1.19) + 1.000
    // TotalHT = (TotalTTC - 1.000) / 1.19
    
    const tvaRate = 0.19;
    const timbre = 1.000;
    const totalTTC = Number(props.reservation.total_price) || 0;
    
    // Quick reverse calculation for the demo
    const totalExclStamp = Math.max(0, totalTTC - timbre);
    const totalHT = totalExclStamp / (1 + tvaRate);
    const unitPriceHT = totalHT / (nbDays || 1); // Only valid if qte is days
    
    previewData.value = {
        invoiceNumber: invNum,
        invoiceDate: new Date().toLocaleDateString('fr-TN'),
        company: {
            name: props.tenant.name,
            address: 'Av. Mongi Slim km 6, Chahia Sfax 3041', // This should likely come from Tenant settings if available
            gsm: ['22400577', '22400631'], // Placeholder or Settings
            email: 'everydaylocation@gmail.com', // Placeholder
            mf: '1874669/H/A/M/000', // Placeholder
            logoUrl: props.tenant.logo_url
        },
        client: {
            name: props.reservation.client_name,
            address: 'Adresse client...', // Reservation might not have this detailed
            mf: 'Client MF...',
            tel: props.reservation.client_phone || ''
        },
        items: [
            {
                designation: `Location véhicule ${props.reservation.car?.brand || ''} ${props.reservation.car?.model || ''}`,
                duree: `${formatDateTime(props.reservation.start_date)} au ${formatDateTime(props.reservation.end_date)}`,
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

watch(() => props.show, (val) => {
    if (val) {
        generateInvoiceData();
    }
});

async function downloadPdf() {
    if (!previewData.value) return;
    loading.value = true;

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
    } catch (e) {
        console.error('PDF Generation failed', e);
        alert('Failed to generate PDF');
    } finally {
        loading.value = false;
    }
}

</script>

<template>
    <div v-if="show" class="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
             <div class="fixed inset-0 bg-black/70 transition-opacity backdrop-blur-sm" aria-hidden="true" @click="$emit('close')"></div>

            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div class="inline-block align-middle bg-gray-100 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-4xl w-full h-[90vh] flex flex-col">
                <!-- Toolbar -->
                <div class="bg-white px-4 py-3 border-b flex justify-between items-center shadow-sm z-10">
                    <h3 class="font-bold text-gray-800 flex items-center">
                        Invoice Preview
                        <span class="ml-2 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">A4</span>
                    </h3>
                    <div class="flex space-x-3">
                         <button 
                            @click="generateInvoiceData"
                            class="text-gray-500 hover:text-gray-700 p-2"
                            title="Refresh Data"
                        >
                            <RefreshCw class="h-4 w-4" />
                        </button>
                        <button 
                            @click="downloadPdf"
                            :disabled="loading"
                            class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                        >
                            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                            <FileDown v-else class="-ml-1 mr-2 h-4 w-4" />
                            Download PDF
                        </button>
                        <button 
                            @click="$emit('close')"
                            class="text-gray-400 hover:text-gray-500"
                        >
                            <X class="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <!-- Preview Area -->
                <div class="flex-1 overflow-y-auto bg-gray-100/50 custom-scrollbar">
                    <div class="min-h-full py-8 flex flex-col items-center justify-start">
                        <div class="shadow-2xl bg-white transition-transform duration-200">
                            <InvoiceTemplate v-if="previewData" :data="previewData" />
                        </div>
                        
                        <!-- Secondary Download Action (Bottom) -->
                        <div class="mt-8 mb-4">
                            <button 
                                @click="downloadPdf"
                                :disabled="loading"
                                class="inline-flex items-center px-6 py-3 border border-transparent rounded-full shadow-lg text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-5 w-5" />
                                <FileDown v-else class="-ml-1 mr-2 h-5 w-5" />
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #c1c1c1;
    border-radius: 5px;
}
</style>
