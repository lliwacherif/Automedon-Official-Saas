<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue';
import type { Directive } from 'vue';

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

/**
 * exportMode:
 * - when true: locks inputs (readonly), hides caret, and helps producing cleaner PDF snapshots.
 *
 * minTableRows:
 * - renders extra empty rows so the table looks consistent (better for PDF layout).
 */
const props = withDefaults(
  defineProps<{
    data: InvoiceData;
    exportMode?: boolean;
    minTableRows?: number;
  }>(),
  {
    exportMode: false,
    minTableRows: 8,
  }
);

// Optional free text (was not persisted in InvoiceData in your original file)
const amountInWords = ref('');

/** Line total (robust against NaN) */
function lineTotalHT(item: InvoiceData['items'][number]) {
  const unit = Number(item.unitPriceHT) || 0;
  const qte = Number(item.qte) || 0;
  return unit * qte;
}

/**
 * Keep item.totalHT updated WITHOUT doing side-effects inside computed.
 * This also helps PDF snapshotters because the DOM always matches the data.
 */
watchEffect(() => {
  props.data.items.forEach((item) => {
    item.totalHT = lineTotalHT(item);
  });
});

const totalHT = computed(() => {
  return props.data.items.reduce((sum, item) => sum + lineTotalHT(item), 0);
});

const totalTVA = computed(() => {
  const rate = Number(props.data.tax.tvaRate) || 0;
  return totalHT.value * rate;
});

const totalTTC = computed(() => {
  const timbre = Number(props.data.tax.timbreFiscal) || 0;
  return totalHT.value + totalTVA.value + timbre;
});

// Format currency
const currencyFormatter = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
function formatCurrency(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return currencyFormatter.format(safe);
}

/**
 * BIG FIX for "hidden / not fully shown":
 * Textareas were fixed-height (rows=2 / h-20) and content got clipped in the PDF snapshot.
 * This directive auto-resizes textareas to fit their content.
 */
const autosizeHandlers = new WeakMap<HTMLTextAreaElement, () => void>();

function autosize(el: HTMLTextAreaElement) {
  if (!el) return;
  // Allow shrinking, then expand to content
  el.style.height = 'auto';
  // +2px prevents last-line clipping due to rounding in some renderers
  el.style.height = `${el.scrollHeight + 2}px`;
}

const vAutosize: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    const handler = () => autosize(el);
    autosizeHandlers.set(el, handler);

    // First sizing after mount/render
    nextTick(handler);

    // Resize on user edits and programmatic updates
    el.addEventListener('input', handler, { passive: true });
    el.addEventListener('change', handler, { passive: true });
  },
  updated(el) {
    nextTick(() => autosize(el));
  },
  unmounted(el) {
    const handler = autosizeHandlers.get(el);
    if (handler) {
      el.removeEventListener('input', handler);
      el.removeEventListener('change', handler);
      autosizeHandlers.delete(el);
    }
  },
};

const emptyRowCount = computed(() => {
  const min = Number(props.minTableRows) || 0;
  return Math.max(0, min - props.data.items.length);
});
</script>

<template>
  <div
    id="invoice-template"
    class="invoice-a4 bg-white text-black font-sans text-sm relative"
    :class="{ 'is-export': exportMode }"
  >
    <!-- 1. Header -->
    <div class="flex justify-between items-start mb-8 gap-6">
      <div class="w-1/2 flex flex-col space-y-1 min-w-0">
        <img
          v-if="data.company.logoUrl"
          :src="data.company.logoUrl"
          class="h-20 object-contain mb-2 w-full object-left"
          alt="Company Logo"
        />

        <!-- Company name: textarea (wraps + autosize) instead of input (no wrap) -->
        <textarea
          v-model="data.company.name"
          v-autosize
          rows="1"
          :readonly="exportMode"
          class="font-bold text-xl uppercase w-full bg-transparent border-none p-0 focus:ring-0 resize-none overflow-hidden placeholder-gray-300 leading-snug invoice-field"
          placeholder="SOCIÉTÉ..."
        />

        <textarea
          v-model="data.company.address"
          v-autosize
          rows="2"
          :readonly="exportMode"
          class="text-xs text-gray-600 w-full bg-transparent border-none p-0 focus:ring-0 resize-none overflow-hidden placeholder-gray-300 leading-snug invoice-field"
          placeholder="Adresse..."
        ></textarea>

        <div class="flex items-start text-xs text-gray-600 gap-2">
          <span class="shrink-0">MF:</span>
          <input
            v-model="data.company.mf"
            :readonly="exportMode"
            class="bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300 invoice-field"
            placeholder="0000000/X/X/X/000"
          />
        </div>

        <div class="flex flex-col text-xs text-gray-600 mt-1 space-y-1">
          <div class="flex items-start gap-2">
            <span class="shrink-0">Email:</span>
            <input
              v-model="data.company.email"
              :readonly="exportMode"
              class="bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300 invoice-field"
              placeholder="email@exemple.com"
            />
          </div>

          <div class="flex items-start gap-2">
            <span class="shrink-0">GSM:</span>
            <input
              :readonly="exportMode"
              :value="data.company.gsm.join(' / ')"
              @input="
                data.company.gsm = ($event.target as HTMLInputElement).value
                  .split('/')
                  .map((s) => s.trim())
                  .filter(Boolean)
              "
              class="bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-300 invoice-field"
              placeholder="22 000 000 / 55 000 000"
            />
          </div>
        </div>
      </div>

      <div class="w-1/2 text-right min-w-0">
        <h2 class="text-4xl font-bold text-gray-800 tracking-widest mb-2">FACTURE</h2>
        <div class="inline-block text-left border-l-4 border-gray-800 pl-3 py-2 bg-gray-50 pr-3 rounded-sm">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-semibold shrink-0">N°:</span>
            <input
              v-model="data.invoiceNumber"
              :readonly="exportMode"
              class="text-sm font-semibold bg-transparent border-none p-0 focus:ring-0 w-40 text-right invoice-field"
            />
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm shrink-0">Date:</span>
            <input
              v-model="data.invoiceDate"
              :readonly="exportMode"
              class="text-sm bg-transparent border-none p-0 focus:ring-0 w-40 text-right invoice-field"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Client Box -->
    <div class="flex justify-end mb-8">
      <div class="w-1/2 border border-gray-800 rounded-lg p-4 bg-gray-50 flex flex-col space-y-2 min-w-0">
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">Client</p>

        <!-- Client name: textarea so it never gets cut -->
        <textarea
          v-model="data.client.name"
          v-autosize
          rows="1"
          :readonly="exportMode"
          class="font-bold text-lg bg-transparent border-none p-0 focus:ring-0 w-full border-b border-gray-300 border-dashed resize-none overflow-hidden leading-snug invoice-field"
          placeholder="Nom Client"
        ></textarea>

        <textarea
          v-model="data.client.address"
          v-autosize
          rows="2"
          :readonly="exportMode"
          class="text-sm bg-transparent border-none p-0 focus:ring-0 w-full resize-none overflow-hidden border-b border-gray-300 border-dashed leading-snug invoice-field"
          placeholder="Adresse Client..."
        ></textarea>

        <div class="flex justify-between text-sm mt-2 pt-2 border-t border-gray-300 gap-4">
          <div class="flex flex-col w-1/2 min-w-0">
            <span class="text-xs text-gray-500">MF</span>
            <input
              v-model="data.client.mf"
              :readonly="exportMode"
              class="bg-transparent border-none p-0 focus:ring-0 w-full invoice-field"
              placeholder="MF..."
            />
          </div>
          <div class="flex flex-col w-1/2 text-right min-w-0">
            <span class="text-xs text-gray-500">Tel</span>
            <input
              v-model="data.client.tel"
              :readonly="exportMode"
              class="bg-transparent border-none p-0 focus:ring-0 w-full text-right invoice-field"
              placeholder="Tel..."
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Items Table -->
    <div class="mb-8">
      <table class="w-full border-collapse border border-gray-300 table-fixed">
        <thead>
          <tr class="bg-gray-100 text-[10px] font-bold uppercase text-center tracking-wider">
            <th class="border border-gray-300 p-1 w-[5%]">N°</th>
            <th class="border border-gray-300 p-1 w-[35%] text-left pl-2">Désignation</th>
            <th class="border border-gray-300 p-1 w-[18%]">Durée</th>
            <th class="border border-gray-300 p-1 w-[12%]">P.U.H.T</th>
            <th class="border border-gray-300 p-1 w-[8%]">Uté</th>
            <th class="border border-gray-300 p-1 w-[8%]">Qté</th>
            <th class="border border-gray-300 p-1 w-[14%]">Montant H.T</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(item, index) in data.items" :key="index" class="text-xs group hover:bg-gray-50">
            <td class="border border-gray-300 p-1 text-center text-gray-500 align-top pt-2">
              {{ index + 1 }}
            </td>

            <td class="border border-gray-300 p-1 align-top">
              <textarea
                v-model="item.designation"
                v-autosize
                rows="2"
                :readonly="exportMode"
                class="w-full bg-transparent border-none p-1 focus:ring-0 resize-none overflow-hidden text-left leading-snug invoice-field"
                style="min-height: 40px"
                placeholder="Désignation..."
              ></textarea>
            </td>

            <td class="border border-gray-300 p-1 align-top">
              <textarea
                v-model="item.duree"
                v-autosize
                rows="2"
                :readonly="exportMode"
                class="w-full bg-transparent border-none p-1 focus:ring-0 text-center resize-none overflow-hidden leading-snug invoice-field"
                style="min-height: 40px"
                placeholder="Durée..."
              ></textarea>
            </td>

            <td class="border border-gray-300 p-1 align-top">
              <div v-if="exportMode" class="w-full text-right p-1 font-mono">
                {{ formatCurrency(item.unitPriceHT) }}
              </div>
              <input
                v-else
                v-model.number="item.unitPriceHT"
                type="number"
                step="0.001"
                class="w-full bg-transparent border-none p-1 focus:ring-0 text-right font-mono invoice-field"
              />
            </td>

            <td class="border border-gray-300 p-1 align-top">
              <input
                v-model="item.unite"
                :readonly="exportMode"
                class="w-full bg-transparent border-none p-1 focus:ring-0 text-center invoice-field"
              />
            </td>

            <td class="border border-gray-300 p-1 align-top">
              <input
                v-model.number="item.qte"
                :readonly="exportMode"
                type="number"
                step="1"
                class="w-full bg-transparent border-none p-1 focus:ring-0 text-center font-mono invoice-field"
              />
            </td>

            <td class="border border-gray-300 p-1 text-right font-medium bg-gray-50 align-top pt-2 font-mono">
              {{ formatCurrency(lineTotalHT(item)) }}
            </td>
          </tr>

          <!-- Empty rows (multiple) to keep consistent PDF layout -->
          <tr v-for="n in emptyRowCount" :key="'empty-' + n" class="text-xs">
            <td class="border border-gray-300 p-2 h-8"></td>
            <td class="border border-gray-300 p-2 h-8"></td>
            <td class="border border-gray-300 p-2 h-8"></td>
            <td class="border border-gray-300 p-2 h-8"></td>
            <td class="border border-gray-300 p-2 h-8"></td>
            <td class="border border-gray-300 p-2 h-8"></td>
            <td class="border border-gray-300 p-2 h-8"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 4. Totals & Signature -->
    <div class="flex justify-between items-start mb-12 page-break-inside-avoid gap-6">
      <div class="w-1/2 pr-2 min-w-0">
        <div class="h-full border border-gray-300 p-4 rounded-lg flex flex-col justify-between min-h-[170px]">
          <p class="text-sm font-bold underline mb-2">Arrêté la présente facture à la somme de :</p>

          <!-- Autosize so it never clips in the PDF -->
          <textarea
            v-model="amountInWords"
            v-autosize
            rows="3"
            :readonly="exportMode"
            class="italic text-sm text-gray-700 w-full bg-transparent border-none p-0 focus:ring-0 resize-none overflow-hidden placeholder-gray-400 leading-snug invoice-field"
            placeholder="(Saisir le montant en toutes lettres ici...)"
          ></textarea>

          <div class="mt-8 text-center border-t border-dashed border-gray-400 pt-4">
            <p class="font-bold">Cachet et Signature</p>
          </div>
        </div>
      </div>

      <div class="w-1/3 min-w-0">
        <table class="w-full border-collapse border border-gray-800">
          <tbody>
            <tr>
              <td class="border border-gray-800 p-2 bg-gray-50 font-bold text-right text-sm">Total H.T</td>
              <td class="border border-gray-800 p-2 text-right font-mono">
                {{ formatCurrency(totalHT) }}
              </td>
            </tr>
            <tr>
              <td class="border border-gray-800 p-2 bg-gray-50 font-bold text-right text-sm">
                TVA
                <input
                  v-model.number="data.tax.tvaRate"
                  :readonly="exportMode"
                  type="number"
                  step="0.01"
                  class="w-12 bg-transparent border-b border-gray-400 text-center p-0 focus:ring-0 text-xs font-mono invoice-field"
                />
              </td>
              <td class="border border-gray-800 p-2 text-right font-mono">
                {{ formatCurrency(totalTVA) }}
              </td>
            </tr>
            <tr>
              <td class="border border-gray-800 p-2 bg-gray-50 font-bold text-right text-sm">Timbre</td>
              <td class="border border-gray-800 p-2 text-right font-mono">
                <input
                  v-model.number="data.tax.timbreFiscal"
                  :readonly="exportMode"
                  type="number"
                  step="0.100"
                  class="w-20 bg-transparent border-none text-right p-0 focus:ring-0 font-mono invoice-field"
                />
              </td>
            </tr>
            <tr class="bg-gray-800 text-white">
              <td class="border border-gray-800 p-2 font-bold text-right text-base">Total T.T.C</td>
              <td class="border border-gray-800 p-2 text-right font-bold text-lg font-mono">
                {{ formatCurrency(totalTTC) }}
              </td>
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
/* --- Core page sizing --- */
.invoice-a4 {
  width: 210mm;
  /* Reduced min-height to prevent forced page breaks when margins are added by PDF generator */
  min-height: 270mm; 
  padding: 10mm;
  margin: 0 auto;
  background: white;
  display: flex;
  flex-direction: column;
}

/* Ensure consistent sizing (prevents subtle clipping) */
#invoice-template,
#invoice-template * {
  box-sizing: border-box;
}

/* Better PDF/print color fidelity */
#invoice-template {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Make “page-break-inside-avoid” actually work */
.page-break-inside-avoid {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Inputs/Textareas: prevent focus rings/shadows from appearing in PDF */
.invoice-field:focus {
  outline: none !important;
  box-shadow: none !important;
}

/* Hide scrollbars and avoid clipped text: autosize handles height */
#invoice-template textarea {
  overflow: hidden !important;
  resize: none;
  /* Add buffer for descenders (g, j, p, q, y) */
  padding-bottom: 2px !important; 
}

/* Improve numeric alignment in PDFs */
#invoice-template .font-mono {
  font-variant-numeric: tabular-nums;
}

/* Remove number spinners (sometimes they render weirdly in snapshots) */
#invoice-template input[type='number'] {
  -moz-appearance: textfield;
}
#invoice-template input[type='number']::-webkit-outer-spin-button,
#invoice-template input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Export mode: no caret (cursor) captured in snapshot */
.is-export input,
.is-export textarea {
  caret-color: transparent !important;
}

/* Print rules */
@page {
  size: A4;
  margin: 0;
}

@media print {
  :global(html),
  :global(body) {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  .invoice-a4 {
    width: 210mm;
    min-height: 290mm; /* Slightly taller for print media where we control margins */
    padding: 10mm;
    margin: 0;
    box-shadow: none;
  }
}

/* Force Hex colors for html2canvas compatibility (it doesn't support oklch) */
#invoice-template .bg-white {
  background-color: #ffffff !important;
}
#invoice-template .bg-gray-50 {
  background-color: #f9fafb !important;
}
#invoice-template .bg-gray-100 {
  background-color: #f3f4f6 !important;
}
#invoice-template .bg-gray-800 {
  background-color: #1f2937 !important;
}
#invoice-template .bg-transparent {
  background-color: transparent !important;
}

#invoice-template .text-black {
  color: #000000 !important;
}
#invoice-template .text-white {
  color: #ffffff !important;
}
#invoice-template .text-gray-500 {
  color: #6b7280 !important;
}
#invoice-template .text-gray-600 {
  color: #4b5563 !important;
}
#invoice-template .text-gray-700 {
  color: #374151 !important;
}
#invoice-template .text-gray-800 {
  color: #1f2937 !important;
}
#invoice-template .placeholder-gray-300::placeholder {
  color: #d1d5db !important;
}
#invoice-template .placeholder-gray-400::placeholder {
  color: #9ca3af !important;
}

#invoice-template .border-gray-200 {
  border-color: #e5e7eb !important;
}
#invoice-template .border-gray-300 {
  border-color: #d1d5db !important;
}
#invoice-template .border-gray-400 {
  border-color: #9ca3af !important;
}
#invoice-template .border-gray-800 {
  border-color: #1f2937 !important;
}
</style>
