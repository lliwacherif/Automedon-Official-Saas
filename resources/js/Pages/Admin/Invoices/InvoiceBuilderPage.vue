<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, FileDown, Loader2, Save, Check } from 'lucide-vue-next';
import InvoiceTemplate, { type InvoiceData } from '@/components/Invoices/InvoiceTemplate.vue';
import { formatDateTime } from '@/utils/date';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const route = useRoute();
const router = useRouter();
const tenantStore = useTenantStore();

const loading = ref(true);
const generating = ref(false);
const isExporting = ref(false);
const previewData = ref<InvoiceData | null>(null);
const templateMountRef = ref<HTMLElement | null>(null);

// ── Frais timbre 2DT/jour ──
const fraisTimbreEnabled = ref(false);
const reservationDays = ref(1);
const reservationTotalPrice = ref(0);

// ── TTC / HT toggle ──
const pricingMode = ref<'TTC' | 'HT'>('TTC');

watch(fraisTimbreEnabled, (checked) => {
  if (!previewData.value) return;
  previewData.value.tax.fraisTimbre = checked ? reservationDays.value * 2 : 0;
});

watch(pricingMode, () => {
  recalculateItems();
});

function recalculateItems() {
  if (!previewData.value) return;
  const price = reservationTotalPrice.value;
  const nbDays = reservationDays.value;
  const tvaRate = 0.19;
  const timbre = 1.0;

  let totalHT: number;
  let unitPriceHT: number;

  if (pricingMode.value === 'HT') {
    totalHT = price;
    unitPriceHT = Number((totalHT / nbDays).toFixed(3));
  } else {
    const totalExclStamp = Math.max(0, price - timbre);
    totalHT = Number((totalExclStamp / (1 + tvaRate)).toFixed(3));
    unitPriceHT = Number((totalHT / nbDays).toFixed(3));
  }

  const item = previewData.value.items[0];
  if (item) {
    item.unitPriceHT = unitPriceHT;
    item.totalHT = totalHT;
    item.qte = nbDays;
  }
}

// ── Company settings (persisted in DB) ──
const companySettings = ref({
  address: '',
  mf: '',
  email: '',
  gsm: '',
});
const savingSettings = ref(false);
const settingsSaved = ref(false);

async function loadInvoiceSettings() {
  const tenantId = tenantStore.currentTenant?.id;
  if (!tenantId) return;

  const { data } = await supabase
    .from('tenant_invoice_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (data) {
    companySettings.value = {
      address: data.company_address || '',
      mf: data.company_mf || '',
      email: data.company_email || '',
      gsm: data.company_gsm || '',
    };
  }
}

async function saveInvoiceSettings() {
  const tenantId = tenantStore.currentTenant?.id;
  if (!tenantId) return;

  savingSettings.value = true;
  settingsSaved.value = false;

  try {
    const payload = {
      tenant_id: tenantId,
      company_address: companySettings.value.address,
      company_mf: companySettings.value.mf,
      company_email: companySettings.value.email,
      company_gsm: companySettings.value.gsm,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('tenant_invoice_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('tenant_invoice_settings')
        .update(payload)
        .eq('tenant_id', tenantId);
    } else {
      await (supabase.from('tenant_invoice_settings') as any).insert([payload]);
    }

    settingsSaved.value = true;
    setTimeout(() => (settingsSaved.value = false), 2000);

    applySettingsToPreview();
  } catch (e) {
    console.error('Error saving invoice settings', e);
    alert('Erreur lors de la sauvegarde des paramètres');
  } finally {
    savingSettings.value = false;
  }
}

function applySettingsToPreview() {
  if (!previewData.value) return;
  const s = companySettings.value;
  previewData.value.company.address = s.address || 'Adresse de la société...';
  previewData.value.company.mf = s.mf || '0000000/A/A/000';
  previewData.value.company.email = s.email || 'contact@exemple.com';
  previewData.value.company.gsm = s.gsm
    ? s.gsm.split('/').map((v: string) => v.trim()).filter(Boolean)
    : ['00 000 000'];
}

// ── Data URL helper (for logo in PDF) ──
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

// ── Load reservation + generate invoice data ──
async function loadReservation(id: string) {
  loading.value = true;
  try {
    await loadInvoiceSettings();

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

  const start = new Date(reservation.start_date);
  const end = new Date(reservation.end_date);
  const nbDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
  reservationDays.value = nbDays;

  const tvaRate = 0.19;
  const timbre = 1.0;
  const price = Number(reservation.total_price) || 0;
  reservationTotalPrice.value = price;

  let totalHT: number;
  let unitPriceHT: number;

  if (pricingMode.value === 'HT') {
    totalHT = price;
    unitPriceHT = Number((price / nbDays).toFixed(3));
  } else {
    const totalExclStamp = Math.max(0, price - timbre);
    totalHT = Number((totalExclStamp / (1 + tvaRate)).toFixed(3));
    unitPriceHT = Number((totalHT / nbDays).toFixed(3));
  }

  let logoUrl = tenant.logo_url as string | undefined;
  if (logoUrl) {
    try {
      logoUrl = await toDataUrl(logoUrl);
    } catch {
      // Keep original URL if conversion fails.
    }
  }

  const s = companySettings.value;

  previewData.value = {
    invoiceNumber: invNum,
    invoiceDate: new Date().toLocaleDateString('fr-TN'),
    company: {
      name: tenant.name,
      address: s.address || 'Adresse de la société...',
      gsm: s.gsm
        ? s.gsm.split('/').map((v: string) => v.trim()).filter(Boolean)
        : ['00 000 000'],
      email: s.email || 'contact@exemple.com',
      mf: s.mf || '0000000/A/A/000',
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
      timbreFiscal: timbre,
      fraisTimbre: fraisTimbreEnabled.value ? nbDays * 2 : 0
    }
  };
}

// ── PDF export ──
function createA4ExportClone(sourceEl: HTMLElement) {
  const host = document.createElement('div');
  host.setAttribute('data-pdf-host', 'true');
  host.style.position = 'fixed';
  host.style.left = '-12000px';
  host.style.top = '0';
  host.style.width = '210mm';
  host.style.background = '#fff';
  host.style.zIndex = '-1';

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.id = 'invoice-template';
  clone.classList.add('export-a4');
  clone.style.width = '210mm';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.transform = 'none';
  clone.style.minHeight = 'auto';
  clone.style.height = 'auto';

  host.appendChild(clone);
  document.body.appendChild(host);

  return {
    clone,
    cleanup: () => {
      try {
        document.body.removeChild(host);
      } catch {
        // No-op.
      }
    }
  };
}

async function downloadPdf() {
  if (!previewData.value) return;

  generating.value = true;
  isExporting.value = true;
  const cleanups: Array<() => void> = [];

  try {
    await nextTick();

    // @ts-ignore
    if (document.fonts?.ready) {
      // @ts-ignore
      await document.fonts.ready;
    }

    const templateEl = templateMountRef.value?.querySelector('#invoice-template') as HTMLElement | null;
    if (!templateEl) throw new Error('Template element not found');

    const { clone, cleanup } = createA4ExportClone(templateEl);
    cleanups.push(cleanup);

    await new Promise((resolve) => setTimeout(resolve, 120));

    const filename = `Facture_${previewData.value.invoiceNumber}.pdf`;
    const canvasWidth = Math.ceil(clone.scrollWidth);
    const canvasHeight = Math.ceil(clone.scrollHeight);
    const orientation = canvasWidth > canvasHeight ? 'landscape' : 'portrait';

    const options: any = {
      margin: 0,
      filename,
      image: { type: 'png', quality: 1 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: canvasWidth,
        height: canvasHeight,
        windowWidth: canvasWidth,
        windowHeight: canvasHeight
      },
      jsPDF: {
        unit: 'px',
        format: [canvasWidth, canvasHeight],
        orientation,
        compress: true
      }
    };

    await html2pdf().set(options).from(clone).save();
  } catch (error: any) {
    console.error('PDF generation failed', error);
    alert(`Failed to generate PDF: ${error?.message || error}`);
  } finally {
    cleanups.forEach((fn) => fn());
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
  <div class="invoice-editor-page min-h-screen">
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <button
            @click="goBack"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Retour"
          >
            <ArrowLeft class="h-5 w-5" />
          </button>
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Facture Pro</p>
            <h1 class="text-lg font-semibold text-slate-900">Template Editor</h1>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer select-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
            <input
              v-model="fraisTimbreEnabled"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Frais timbre 2DT/Jour</span>
          </label>

          <div class="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium select-none">
            <button
              @click="pricingMode = 'TTC'"
              class="px-3 py-2 transition"
              :class="pricingMode === 'TTC'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
            >
              TTC
            </button>
            <button
              @click="pricingMode = 'HT'"
              class="px-3 py-2 transition border-l border-slate-200"
              :class="pricingMode === 'HT'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
            >
              HT
            </button>
          </div>

          <button
            @click="downloadPdf"
            :disabled="generating || loading || !previewData"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
            <FileDown v-else class="h-4 w-4" />
            Télécharger PDF
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
      <aside class="h-fit space-y-5">
        <!-- Export Quality Info -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Export quality</p>
          <h2 class="mt-2 text-base font-semibold text-slate-900">PDF rendu identique au preview</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            Le rendu est maintenant exporté depuis une surface A4 dédiée pour garder la même structure visuelle,
            les mêmes espacements et une netteté plus propre.
          </p>

          <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><span class="font-semibold">Format:</span> A4 portrait</p>
            <p class="mt-1"><span class="font-semibold">Capture:</span> haute résolution</p>
            <p class="mt-1"><span class="font-semibold">Source:</span> template réel (pas un wrapper)</p>
          </div>
        </div>

        <!-- Company Info Settings -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Informations société</p>
          <h2 class="mt-2 text-base font-semibold text-slate-900">Vos coordonnées facture</h2>
          <p class="mt-2 text-xs leading-5 text-slate-500">
            Ces informations seront pré-remplies sur toutes vos factures.
          </p>

          <div class="mt-4 space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
              <input
                v-model="companySettings.address"
                type="text"
                placeholder="Av. Exemple, Ville 1000"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Matricule Fiscal (MF)</label>
              <input
                v-model="companySettings.mf"
                type="text"
                placeholder="0000000/X/X/X/000"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                v-model="companySettings.email"
                type="email"
                placeholder="contact@exemple.com"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">GSM</label>
              <input
                v-model="companySettings.gsm"
                type="text"
                placeholder="22 000 000 / 55 000 000"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p class="mt-1 text-[10px] text-slate-400">Séparez les numéros par /</p>
            </div>
          </div>

          <button
            @click="saveInvoiceSettings"
            :disabled="savingSettings"
            class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            :class="settingsSaved
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 text-white hover:bg-slate-800'"
          >
            <Check v-if="settingsSaved" class="h-4 w-4" />
            <Loader2 v-else-if="savingSettings" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ settingsSaved ? 'Enregistré !' : 'Enregistrer' }}
          </button>
        </div>

        <!-- Client Info (per invoice, editable) -->
        <div v-if="previewData" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Informations client</p>
          <h2 class="mt-2 text-base font-semibold text-slate-900">Coordonnées du client</h2>
          <p class="mt-2 text-xs leading-5 text-slate-500">
            Modifiez l'adresse et le MF du client pour cette facture.
          </p>

          <div class="mt-4 space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Adresse client</label>
              <input
                v-model="previewData.client.address"
                type="text"
                placeholder="Adresse du client..."
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Matricule Fiscal (MF)</label>
              <input
                v-model="previewData.client.mf"
                type="text"
                placeholder="0000000/X/X/X/000"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </aside>

      <section class="min-h-[70vh] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div v-if="loading" class="flex h-[60vh] items-center justify-center">
          <Loader2 class="h-8 w-8 animate-spin text-indigo-600" />
        </div>

        <div v-else-if="previewData" ref="templateMountRef" class="preview-board">
          <div :class="['preview-frame', isExporting ? 'is-exporting' : '']">
            <InvoiceTemplate :data="previewData" :export-mode="isExporting" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
.invoice-editor-page {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.preview-board {
  min-height: 100%;
  overflow: auto;
  border-radius: 16px;
  background: #eef2ff;
  padding: 24px;
}

.preview-frame {
  margin: 0 auto;
  width: fit-content;
  border-radius: 14px;
  box-shadow:
    0 20px 30px -15px rgba(15, 23, 42, 0.2),
    0 8px 12px -8px rgba(15, 23, 42, 0.15);
}

.preview-frame.is-exporting {
  box-shadow: none;
}

.export-a4 {
  width: 210mm !important;
  min-height: auto !important;
  height: auto !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
  overflow: visible !important;
}

.export-a4,
.export-a4 * {
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

@page {
  size: A4;
  margin: 0;
}
</style>
