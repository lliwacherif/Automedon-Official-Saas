<script setup lang="ts">
import { computed } from 'vue';

// Define the structure of the Invoice Data
export interface InvoiceData {
    invoiceNumber: string;
    invoiceDate: string;
    company: {
        name: string;
        address: string;
        gsm: string[];
        email: string;
        mf: string;
        logoUrl: string | null;
    };
    client: {
        name: string;
        address: string;
        mf: string;
        tel: string;
    };
    items: {
        designation: string;
        duree: string;
        unitPriceHT: number;
        unite: string;
        qte: number;
        totalHT: number;
    }[];
    tax: {
        tvaRate: number; // e.g. 0.19
        timbreFiscal: number;
    };
}

const props = defineProps<{
    data: InvoiceData;
}>();

// Calculations - We must react to changes in the items array
// Since we are mutating the prop.data directly (passed as reactive object),
// computed properties should trigger automatically.

// Note: In Vue, mutating deep props is generally discouraged, but for a "Builder" pattern
// where the parent holds the state and passes it down to be edited, it's efficient.
// Alternatively, we could emit updates, but v-model binding on every field is verbose.

const totalHT = computed(() => {
    return props.data.items.reduce((sum, item) => {
        // Recalculate line total in case unit price or qte changed
        item.totalHT = item.unitPriceHT * item.qte;
        return sum + item.totalHT;
    }, 0);
});

const totalTVA = computed(() => {
    return totalHT.value * props.data.tax.tvaRate;
});

const totalTTC = computed(() => {
    return totalHT.value + totalTVA.value + props.data.tax.timbreFiscal;
});

// Format currency
function formatCurrency(amount: number) {
    return amount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
</script>

<template>
    <div id="invoice-template" class="invoice-a4 bg-white text-black font-sans text-sm relative">
        <!-- 1. Header -->
        <div class="flex justify-between items-start mb-8">
            <div class="w-1/2 flex flex-col space-y-1">
                <img v-if="data.company.logoUrl" :src="data.company.logoUrl" class="h-20 object-contain mb-2 w-full object-left" alt="Company Logo">
                
                <input v-model="data.company.name" class="font-bold text-xl uppercase w-full bg-transparent border-none p-0 focus:ring-0 placeholder-gray-300" placeholder="SOCIÉTÉ..." />
                <textarea v-model="data.company.address" rows="2" class="text-xs text-gray-600 w-full bg-transparent border-none p-0 focus:ring-0 resize-none placeholder-gray-300" placeholder="Adresse..."></textarea>
                
                <div class="flex items-center text-xs text-gray-600">
                    <span class="mr-1">MF:</span>
                    <input v-model="data.company.mf" class="bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300" placeholder="0000000/X/X/X/000" />
                </div>
                
                <div class="flex flex-col text-xs text-gray-600 mt-1">
                    <div class="flex items-center">
                         <span class="mr-1">Email:</span>
                         <input v-model="data.company.email" class="bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300" placeholder="email@exemple.com" />
                    </div>
                    <!-- Simplified GSM editing for better UX -->
                    <div class="flex items-center">
                        <span class="mr-1">GSM:</span>
                        <input :value="data.company.gsm.join(' / ')" @input="data.company.gsm = ($event.target as HTMLInputElement).value.split('/').map(s => s.trim())" class="bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300" placeholder="22 000 000" />
                    </div>
                </div>
            </div>
            
            <div class="w-1/2 text-right">
                <h2 class="text-4xl font-bold text-gray-800 tracking-widest mb-2">FACTURE</h2>
                <div class="inline-block text-left border-l-4 border-gray-800 pl-3 py-1 bg-gray-50 pr-2">
                    <div class="flex items-center">
                        <span class="text-sm font-semibold mr-2">N°:</span>
                        <input v-model="data.invoiceNumber" class="text-sm font-semibold bg-transparent border-none p-0 focus:ring-0 w-32 text-right" />
                    </div>
                    <div class="flex items-center">
                         <span class="text-sm mr-2">Date:</span>
                         <input v-model="data.invoiceDate" class="text-sm bg-transparent border-none p-0 focus:ring-0 w-32 text-right" />
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. Client Box -->
        <div class="flex justify-end mb-8">
            <div class="w-1/2 border border-gray-800 rounded-lg p-4 bg-gray-50 flex flex-col space-y-1">
                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Client</p>
                <input v-model="data.client.name" class="font-bold text-lg bg-transparent border-none p-0 focus:ring-0 w-full border-b border-gray-300 border-dashed" placeholder="Nom Client" />
                <textarea v-model="data.client.address" rows="2" class="text-sm bg-transparent border-none p-0 focus:ring-0 w-full resize-none border-b border-gray-300 border-dashed" placeholder="Adresse Client..."></textarea>
                
                <div class="flex justify-between text-sm mt-2 pt-2 border-t border-gray-300">
                    <div class="flex flex-col w-1/2 mr-2">
                        <span class="text-xs text-gray-500">MF</span>
                        <input v-model="data.client.mf" class="bg-transparent border-none p-0 focus:ring-0 w-full" placeholder="MF..." />
                    </div>
                    <div class="flex flex-col w-1/2 text-right">
                        <span class="text-xs text-gray-500">Tel</span>
                         <input v-model="data.client.tel" class="bg-transparent border-none p-0 focus:ring-0 w-full text-right" placeholder="Tel..." />
                    </div>
                </div>
            </div>
        </div>

        <!-- 3. Items Table -->
        <div class="mb-8">
            <table class="w-full border-collapse border border-gray-300">
                <thead>
                    <tr class="bg-gray-100 text-xs font-bold uppercase text-center">
                        <th class="border border-gray-300 p-2 w-10">N°</th>
                        <th class="border border-gray-300 p-2 text-left">Désignation</th>
                        <th class="border border-gray-300 p-2 w-32">Durée</th>
                        <th class="border border-gray-300 p-2 w-28">P.U.H.T</th>
                        <th class="border border-gray-300 p-2 w-16">Uté</th>
                        <th class="border border-gray-300 p-2 w-16">Qté</th>
                        <th class="border border-gray-300 p-2 w-28">Montant H.T</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(item, index) in data.items" :key="index" class="text-sm group hover:bg-gray-50">
                        <td class="border border-gray-300 p-2 text-center text-gray-500">{{ index + 1 }}</td>
                        
                        <td class="border border-gray-300 p-2">
                            <textarea v-model="item.designation" rows="2" class="w-full bg-transparent border-none p-0 focus:ring-0 resize-none"></textarea>
                        </td>
                        
                        <td class="border border-gray-300 p-2">
                             <input v-model="item.duree" class="w-full bg-transparent border-none p-0 focus:ring-0 text-center" />
                        </td>
                        
                        <td class="border border-gray-300 p-2">
                            <input v-model.number="item.unitPriceHT" type="number" step="0.001" class="w-full bg-transparent border-none p-0 focus:ring-0 text-right font-mono" />
                        </td>
                        
                        <td class="border border-gray-300 p-2">
                             <input v-model="item.unite" class="w-full bg-transparent border-none p-0 focus:ring-0 text-center" />
                        </td>
                        
                        <td class="border border-gray-300 p-2">
                             <input v-model.number="item.qte" type="number" step="1" class="w-full bg-transparent border-none p-0 focus:ring-0 text-center font-mono" />
                        </td>
                        
                        <td class="border border-gray-300 p-2 text-right font-medium bg-gray-50">
                            {{ formatCurrency(item.unitPriceHT * item.qte) }}
                        </td>
                    </tr>
                    <!-- Empty rows to fill space if needed, purely aesthetic -->
                    <tr v-if="data.items.length < 5">
                        <td class="border border-gray-300 p-2 h-8"></td>
                        <td class="border border-gray-300 p-2"></td>
                        <td class="border border-gray-300 p-2"></td>
                        <td class="border border-gray-300 p-2"></td>
                        <td class="border border-gray-300 p-2"></td>
                        <td class="border border-gray-300 p-2"></td>
                        <td class="border border-gray-300 p-2"></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 4. Totals & Signature -->
        <div class="flex justify-between items-start mb-12 page-break-inside-avoid">
            <div class="w-1/2 pr-8">
                <div class="h-full border border-gray-300 p-4 rounded-lg flex flex-col justify-between min-h-[150px]">
                    <p class="text-sm font-bold underline mb-2">Arrêté la présente facture à la somme de :</p>
                    <textarea class="italic text-sm text-gray-700 w-full h-20 bg-transparent border-none p-0 focus:ring-0 resize-none placeholder-gray-400" placeholder="(Saisir le montant en toutes lettres ici...)"></textarea>
                    
                    <div class="mt-8 text-center border-t border-dashed border-gray-400 pt-4">
                        <p class="font-bold">Cachet et Signature</p>
                    </div>
                </div>
            </div>
            
            <div class="w-1/3">
                <table class="w-full border-collapse border border-gray-800">
                    <tbody>
                        <tr>
                            <td class="border border-gray-800 p-2 bg-gray-50 font-bold text-right text-sm">Total H.T</td>
                            <td class="border border-gray-800 p-2 text-right font-mono">{{ formatCurrency(totalHT) }}</td>
                        </tr>
                        <tr>
                            <td class="border border-gray-800 p-2 bg-gray-50 font-bold text-right text-sm">
                                TVA <input v-model.number="data.tax.tvaRate" type="number" step="0.01" class="w-10 bg-transparent border-b border-gray-400 text-center p-0 focus:ring-0 text-xs" />
                            </td>
                            <td class="border border-gray-800 p-2 text-right font-mono">{{ formatCurrency(totalTVA) }}</td>
                        </tr>
                        <tr>
                            <td class="border border-gray-800 p-2 bg-gray-50 font-bold text-right text-sm">
                                Timbre
                            </td>
                            <td class="border border-gray-800 p-2 text-right font-mono">
                                <input v-model.number="data.tax.timbreFiscal" type="number" step="0.100" class="w-16 bg-transparent border-none text-right p-0 focus:ring-0 font-mono" />
                            </td>
                        </tr>
                        <tr class="bg-gray-800 text-white">
                            <td class="border border-gray-800 p-2 font-bold text-right text-base">Total T.T.C</td>
                            <td class="border border-gray-800 p-2 text-right font-bold text-lg font-mono">{{ formatCurrency(totalTTC) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 5. Footer -->
        <div class="mt-auto pt-12 pb-4 text-center border-t border-gray-300 text-xs text-gray-500 w-full page-break-inside-avoid">
            <p>{{ data.company.name }} - {{ data.company.address }}</p>
            <p>MF: {{ data.company.mf }} - Email: {{ data.company.email }} - GSM: {{ data.company.gsm.join(' / ') }}</p>
        </div>
    </div>
</template>

<style scoped>
.invoice-a4 {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm;
    margin: 0 auto;
    background: white;
    display: flex;
    flex-direction: column;
}

@media print {
    .invoice-a4 {
        margin: 0;
        border: initial;
        border-radius: initial;
        width: initial;
        min-height: initial;
        box-shadow: initial;
        background: initial;
        page-break-after: always;
    }
}

/* Force Hex colors for html2canvas compatibility (it doesn't support oklch) */
#invoice-template .bg-white { background-color: #ffffff !important; }
#invoice-template .bg-gray-50 { background-color: #f9fafb !important; }
#invoice-template .bg-gray-100 { background-color: #f3f4f6 !important; }
#invoice-template .bg-gray-800 { background-color: #1f2937 !important; }
#invoice-template .bg-transparent { background-color: transparent !important; }

#invoice-template .text-black { color: #000000 !important; }
#invoice-template .text-white { color: #ffffff !important; }
#invoice-template .text-gray-500 { color: #6b7280 !important; }
#invoice-template .text-gray-600 { color: #4b5563 !important; }
#invoice-template .text-gray-700 { color: #374151 !important; }
#invoice-template .text-gray-800 { color: #1f2937 !important; }
#invoice-template .placeholder-gray-300::placeholder { color: #d1d5db !important; }
#invoice-template .placeholder-gray-400::placeholder { color: #9ca3af !important; }

#invoice-template .border-gray-200 { border-color: #e5e7eb !important; }
#invoice-template .border-gray-300 { border-color: #d1d5db !important; }
#invoice-template .border-gray-400 { border-color: #9ca3af !important; }
#invoice-template .border-gray-800 { border-color: #1f2937 !important; }
</style>
