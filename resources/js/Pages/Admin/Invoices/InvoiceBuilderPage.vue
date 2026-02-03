<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loader2, FileDown, ArrowLeft } from 'lucide-vue-next';
import InvoiceTemplate, { type InvoiceData } from '@/components/Invoices/InvoiceTemplate.vue';
import { useTenantStore } from '@/stores/tenant';
import { formatDateTime } from '@/utils/date';
import { useTenantLink } from '@/composables/useTenantLink';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { supabase } from '@/lib/supabase';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const generating = ref(false);
const isExporting = ref(false);

const previewData = ref<InvoiceData | null>(null);
const tenantStore = useTenantStore();
const { tenantPath } = useTenantLink();

/**
 * (Optional but very helpful) If your logo is hosted without proper CORS headers,
 * html2canvas can blank it. This tries to convert it to a data URL.
 */
async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
      await generateInvoiceData(data, tenantStore.currentTenant);
    }
  } catch (e) {
    console.error('Error loading reservation', e);
    alert('Reservation not found');
    router.push({
      name: 'admin.reservations.index',
      params: { tenantSlug: tenantStore.currentTenant?.slug }
    });
  } finally {
    loading.value = false;
  }
}

async function generateInvoiceData(reservation: any, tenant: any) {
  if (!reservation || !tenant) return;

  const invNum = reservation.contract_number
    ? `INV-${reservation.contract_number}`
    : `DRAFT-${Date.now().toString().slice(-4)}`;

  // Always at least 1 day
  const start = new Date(reservation.start_date);
  const end = new Date(reservation.end_date);
  const nbDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
  );

  const tvaRate = 0.19;
  const timbre = 1.0;
  const totalTTC = Number(reservation.total_price) || 0;

  // Reverse calc (approx): TTC = HT*(1+tva) + timbre
  const totalExclStamp = Math.max(0, totalTTC - timbre);
  const totalHT = Number((totalExclStamp / (1 + tvaRate)).toFixed(3));
  const unitPriceHT = Number((totalHT / nbDays).toFixed(3));

  let logoUrl = tenant.logo_url as string | undefined;
  if (logoUrl) {
    try {
      // Helps avoid missing logo in PDF if CORS is strict.
      logoUrl = await toDataUrl(logoUrl);
    } catch {
      // If it fails, keep original URL (best effort).
    }
  }

  previewData.value = {
    invoiceNumber: invNum,
    invoiceDate: new Date().toLocaleDateString('fr-TN'),
    company: {
      name: tenant.name,
      address: 'Adresse de la société...',
      gsm: ['00 000 000'],
      email: 'contact@exemple.com',
      mf: '0000000/A/A/000',
      logoUrl: logoUrl || null
    },
    client: {
      name: reservation.client_name,
      address: 'Adresse client...',
      mf: 'Client MF...',
      tel: reservation.client_phone || ''
    },
    items: [
      {
        designation: `Location véhicule ${reservation.car?.brand || ''} ${reservation.car?.model || ''}`.trim(),
        duree: `${formatDateTime(reservation.start_date)} au ${formatDateTime(reservation.end_date)}`,
        unitPriceHT,
        unite: 'Jours',
        qte: nbDays,
        totalHT
      }
    ],
    tax: {
      tvaRate,
      timbreFiscal: timbre
    }
  };
}

/**
 * Creates an off-screen, fixed A4 "print surface" so html2canvas captures
 * exactly 210mm x 297mm and avoids reflow / responsive breakage.
 */
function createA4ExportClone(sourceEl: HTMLElement) {
  const host = document.createElement('div');
  host.setAttribute('data-pdf-host', 'true');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '210mm';
  host.style.height = '297mm';
  host.style.background = '#fff';
  host.style.zIndex = '-1';
  host.style.overflow = 'hidden';

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.id = 'invoice-template-export';
  clone.classList.add('export-a4'); // CSS below
  clone.style.width = '210mm';
  clone.style.minHeight = '297mm';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';

  host.appendChild(clone);
  document.body.appendChild(host);

  return {
    host,
    clone,
    cleanup: () => {
      try {
        document.body.removeChild(host);
      } catch {
        /* noop */
      }
    }
  };
}

async function downloadPdf() {
  if (!previewData.value) return;

  generating.value = true;
  isExporting.value = true;

  const cleanupFns: Array<() => void> = [];

  try {
    await nextTick();

    // Wait for fonts (prevents clipped / shifted text)
    // @ts-ignore
    if (document.fonts?.ready) {
      // @ts-ignore
      await document.fonts.ready;
    }

    const element = document.getElementById('invoice-template');
    if (!element) throw new Error('Template element not found');

    // Create stable A4 clone for export
    const { host, clone, cleanup } = createA4ExportClone(element);
    cleanupFns.push(cleanup);

    // Give the browser a tick to paint the clone
    await new Promise((r) => setTimeout(r, 80));

    const filename = `Facture_${previewData.value.invoiceNumber}.pdf`;

    // IMPORTANT: margin 0 + avoid-all pagebreak = keep single page.
    // If your invoice is taller than A4, it will be scaled down to fit (still 1 page).
    const opt: any = {
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy']
      },
      html2canvas: {
        scale: 3, // sharper text
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
        // ensure capture uses the clone's real size (avoid responsive layout)
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      }
    };

    // Generate from the cloned export surface
    await html2pdf().set(opt).from(clone).save();
  } catch (e: any) {
    console.error('PDF Generation failed', e);
    alert(`Failed to generate PDF: ${e?.message || e}`);
  } finally {
    cleanupFns.forEach((fn) => fn());
    isExporting.value = false;
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
          <button
            @click="goBack"
            class="mr-4 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          >
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

      <!-- Preview -->
      <div
        v-else-if="previewData"
        id="invoice-template"
        :class="[
          'bg-white',
          // keep preview nice on screen
          isExporting ? 'shadow-none m-0' : 'shadow-2xl mb-20 animate-in fade-in zoom-in duration-300'
        ]"
        class="invoice-shell"
      >
        <InvoiceTemplate :data="previewData" />
      </div>
    </main>
  </div>
</template>

<style>
/* ===== Screen Preview Size ===== */
.invoice-shell {
  width: 210mm;        /* matches A4 width */
  min-height: 297mm;   /* matches A4 height */
  box-sizing: border-box;
  background: #fff;
}

/* ===== Export Clone Rules =====
   Applied only to the off-screen cloned node so the captured PDF is stable.
*/
.export-a4 {
  width: 210mm !important;
  min-height: 297mm !important;
  height: 297mm !important; /* hard clamp to one page */
  box-sizing: border-box !important;
  background: #fff !important;
  overflow: hidden !important; /* prevent content from spilling and creating page 2 */
}

/* If your template uses big outer margins/padding that cause overflow,
   you can give yourself a safe printable padding here.
   (Leave commented if your template already handles it.)
*/
/*
.export-a4 {
  padding: 10mm !important;
}
*/

/* Improve text rendering on canvas capture */
.export-a4,
.export-a4 * {
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

/* Just in case something adds default print margins */
@page {
  size: A4;
  margin: 0;
}
</style>
