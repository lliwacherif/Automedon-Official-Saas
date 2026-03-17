<script setup lang="ts">
import { nextTick, onMounted, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, FileDown, Loader2, Save, Check, Plus, X, ClipboardList, Car, Calendar, ChevronDown, Building2, User, Search, Users } from 'lucide-vue-next';
import { useB2BClients } from '@/composables/useB2BClients';
import InvoiceTemplate, { type InvoiceData } from '@/components/Invoices/InvoiceTemplate.vue';
import { formatDateTime } from '@/utils/date';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { useTenantLink } from '@/composables/useTenantLink';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const router = useRouter();
const tenantStore = useTenantStore();
const { tenantPath } = useTenantLink();

const loading = ref(true);
const generating = ref(false);
const isExporting = ref(false);
const previewData = ref<InvoiceData | null>(null);
const templateMountRef = ref<HTMLElement | null>(null);

const pricingMode = ref<'HT' | 'TTC'>('HT');

// ── Services state ──
const allServices = ref<any[]>([]);
const selectedServiceIds = ref<Set<number>>(new Set());
const searchQuery = ref('');
const showServicePicker = ref(false);

const selectedServices = computed(() =>
  allServices.value.filter(s => selectedServiceIds.value.has(s.id))
);

const availableServices = computed(() => {
  let list = allServices.value.filter(s => !selectedServiceIds.value.has(s.id));
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(s =>
      (s.client_name || '').toLowerCase().includes(q) ||
      (s.chauffeur_name || '').toLowerCase().includes(q) ||
      (s.contract_number || '').toLowerCase().includes(q) ||
      (s.car?.brand || '').toLowerCase().includes(q)
    );
  }
  return list;
});

// ── B2B Clients ──
const { clients: b2bClients, fetchClients: fetchB2BClients } = useB2BClients();

function selectB2BClientForInvoice(clientId: string) {
  const c = b2bClients.value.find(b => String(b.id) === clientId);
  if (c) {
    clientInfo.value.name = c.company_name;
    clientInfo.value.address = c.address || '';
    clientInfo.value.mf = c.mf || '';
    clientInfo.value.tel = c.phone || '';
    rebuildPreview();
  }
}

// ── Client info (B2B editable) ──
const clientInfo = ref({
  name: '',
  address: '',
  mf: '',
  tel: '',
});

// ── Company settings ──
const companySettings = ref({ address: '', mf: '', email: '', gsm: '' });
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
      await supabase.from('tenant_invoice_settings').update(payload).eq('tenant_id', tenantId);
    } else {
      await (supabase.from('tenant_invoice_settings') as any).insert([payload]);
    }
    settingsSaved.value = true;
    setTimeout(() => (settingsSaved.value = false), 2000);
    rebuildPreview();
  } catch (e) {
    console.error('Error saving invoice settings', e);
    alert('Erreur lors de la sauvegarde');
  } finally {
    savingSettings.value = false;
  }
}

// ── Fetch services ──
async function fetchAllServices() {
  loading.value = true;
  try {
    await loadInvoiceSettings();
    const tenantId = tenantStore.currentTenant?.id;
    if (!tenantId) return;
    const { data } = await supabase
      .from('services')
      .select('*, car:cars(brand, model, license_plate)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    allServices.value = data || [];
  } catch (e) {
    console.error('Error loading services:', e);
  } finally {
    loading.value = false;
  }
}

// ── Build invoice items from selected services ──
function buildItemFromService(svc: any, mode: 'HT' | 'TTC') {
  const start = new Date(svc.start_date);
  const end = new Date(svc.end_date);
  const hours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600)));
  const days = Math.max(1, Math.ceil(hours / 24));
  const price = Number(svc.price) || 0;
  const tvaRate = 0.19;
  const timbre = 1.0;

  let totalHT: number;
  let unitPriceHT: number;
  const qte = days;

  if (mode === 'HT') {
    totalHT = price;
    unitPriceHT = Number((price / qte).toFixed(3));
  } else {
    const excl = Math.max(0, price - timbre);
    totalHT = Number((excl / (1 + tvaRate)).toFixed(3));
    unitPriceHT = Number((totalHT / qte).toFixed(3));
  }

  const typeLabel = svc.service_type === 'transfert' ? 'Transfert' : 'Excursion';
  const plate = svc.car?.license_plate || '';
  const carModel = svc.car ? `${svc.car.brand || ''} ${svc.car.model || ''}`.trim() : '';
  const clientName = svc.client_name || svc.chauffeur_name || '';
  const clientPart = clientName ? ` de ${clientName}` : '';
  const vehiclePart = plate ? ` avec le véhicule ${plate}${carModel ? ' ' + carModel : ''}` : (carModel ? ` avec ${carModel}` : '');
  const datePart = ` du: ${formatDate(svc.start_date)}`;

  return {
    designation: `${typeLabel}${clientPart}${vehiclePart}${datePart}`,
    duree: `${formatDateTime(svc.start_date)} au ${formatDateTime(svc.end_date)}`,
    unitPriceHT,
    unite: 'Jours',
    qte,
    totalHT,
  };
}

function rebuildPreview() {
  if (selectedServices.value.length === 0) {
    previewData.value = null;
    return;
  }

  const items = selectedServices.value.map(s => buildItemFromService(s, pricingMode.value));
  const s = companySettings.value;
  const tenant = tenantStore.currentTenant;

  previewData.value = {
    invoiceNumber: `SVC-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toLocaleDateString('fr-TN'),
    company: {
      name: tenant?.name || '',
      address: s.address || 'Adresse de la société...',
      gsm: s.gsm ? s.gsm.split('/').map((v: string) => v.trim()).filter(Boolean) : ['00 000 000'],
      email: s.email || 'contact@exemple.com',
      mf: s.mf || '0000000/A/A/000',
      logoUrl: tenant?.logo_url || null,
    },
    client: {
      name: clientInfo.value.name || selectedServices.value[0]?.client_name || 'Client',
      address: clientInfo.value.address || 'Adresse client...',
      mf: clientInfo.value.mf || '',
      tel: clientInfo.value.tel || '',
    },
    items,
    tax: {
      tvaRate: 0.19,
      timbreFiscal: 1.0,
      fraisTimbre: 0,
    },
  };
}

watch(pricingMode, () => rebuildPreview());
watch(clientInfo, () => {
  if (previewData.value) {
    previewData.value.client.name = clientInfo.value.name || 'Client';
    previewData.value.client.address = clientInfo.value.address || 'Adresse client...';
    previewData.value.client.mf = clientInfo.value.mf || '';
    previewData.value.client.tel = clientInfo.value.tel || '';
  }
}, { deep: true });

function addService(svc: any) {
  selectedServiceIds.value.add(svc.id);
  if (!clientInfo.value.name && svc.client_name) {
    clientInfo.value.name = svc.client_name;
  }
  rebuildPreview();
}

function removeService(id: number) {
  selectedServiceIds.value.delete(id);
  rebuildPreview();
}

// ── PDF export ──
async function downloadPdf() {
  if (!previewData.value) return;
  generating.value = true;
  isExporting.value = true;
  try {
    await nextTick();
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;

    const templateEl = templateMountRef.value?.querySelector('#invoice-template') as HTMLElement | null;
    if (!templateEl) throw new Error('Template element not found');

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-12000px';
    host.style.top = '0';
    host.style.width = '210mm';
    host.style.background = '#fff';
    host.style.zIndex = '-1';

    const clone = templateEl.cloneNode(true) as HTMLElement;
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

    await new Promise(r => setTimeout(r, 120));

    const filename = `Facture_Services_${previewData.value.invoiceNumber}.pdf`;
    const cw = Math.ceil(clone.scrollWidth);
    const ch = Math.ceil(clone.scrollHeight);

    await html2pdf().set({
      margin: 0, filename,
      image: { type: 'png', quality: 1 },
      html2canvas: { scale: 3, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0, width: cw, height: ch, windowWidth: cw, windowHeight: ch },
      jsPDF: { unit: 'px', format: [cw, ch], orientation: cw > ch ? 'landscape' : 'portrait', compress: true },
    }).from(clone).save();

    try { document.body.removeChild(host); } catch {}
  } catch (error: any) {
    console.error('PDF generation failed', error);
    alert(`Failed to generate PDF: ${error?.message || error}`);
  } finally {
    isExporting.value = false;
    generating.value = false;
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' });
}

onMounted(() => { fetchAllServices(); fetchB2BClients(); });
</script>

<template>
  <div class="invoice-editor-page min-h-screen">
    <!-- Header -->
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3 shrink-0">
          <button @click="router.push(tenantPath('/admin/services'))" class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100">
            <ArrowLeft class="h-5 w-5" />
          </button>
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Services</p>
            <h1 class="text-lg font-semibold text-slate-900">Facture Services Pro</h1>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap justify-end">
          <!-- Service Picker Button -->
          <div class="relative">
            <button @click="showServicePicker = !showServicePicker" class="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100">
              <ClipboardList class="h-4 w-4" />
              <span class="hidden sm:inline">Services</span>
              <span class="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-indigo-600 text-[10px] font-bold text-white">{{ selectedServiceIds.size }}</span>
              <ChevronDown class="h-3.5 w-3.5" :class="{ 'rotate-180': showServicePicker }" />
            </button>

            <Transition name="dropdown">
              <div v-if="showServicePicker" class="absolute right-0 top-full mt-2 w-[420px] max-h-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl z-50 flex flex-col">
                <!-- Search -->
                <div class="p-3 border-b border-slate-100 shrink-0">
                  <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input v-model="searchQuery" type="text" placeholder="Rechercher par client, chauffeur, contrat..." class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                  </div>
                </div>

                <!-- Selected -->
                <div v-if="selectedServices.length > 0" class="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dans la facture ({{ selectedServices.length }})</p>
                  <div class="space-y-1.5 max-h-[140px] overflow-y-auto">
                    <div v-for="svc in selectedServices" :key="svc.id" class="flex items-center justify-between bg-white rounded-lg px-3 py-2 ring-1 ring-indigo-100">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-slate-800 truncate">{{ svc.service_type === 'transfert' ? 'Transfert' : 'Excursion' }} — {{ svc.car?.brand }} {{ svc.car?.model }}</p>
                        <p class="text-[10px] text-slate-400">{{ svc.client_name || 'N/A' }} &middot; {{ Number(svc.price).toFixed(2) }} DT</p>
                      </div>
                      <button @click="removeService(svc.id)" class="shrink-0 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition"><X class="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>

                <!-- Available -->
                <div class="flex-1 overflow-y-auto p-3 min-h-0">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Services disponibles</p>
                  <div v-if="loading" class="flex items-center justify-center py-8"><Loader2 class="w-5 h-5 text-slate-300 animate-spin" /></div>
                  <div v-else-if="availableServices.length === 0" class="py-8 text-center text-xs text-slate-400">Aucun service disponible</div>
                  <div v-else class="space-y-1.5">
                    <button v-for="svc in availableServices" :key="svc.id" @click="addService(svc)" class="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left ring-1 ring-slate-100 hover:ring-indigo-200 hover:bg-indigo-50/50 transition group">
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-slate-800 truncate">
                          {{ svc.service_type === 'transfert' ? 'Transfert' : 'Excursion' }} — {{ svc.car?.brand }} {{ svc.car?.model }}
                          <span v-if="svc.contract_number" class="text-slate-400">#{{ svc.contract_number }}</span>
                        </p>
                        <p class="text-[10px] text-slate-400 truncate">{{ svc.client_name || 'N/A' }} &middot; {{ formatDate(svc.start_date) }} &middot; {{ svc.chauffeur_name }}</p>
                      </div>
                      <div class="flex items-center gap-2 shrink-0 ml-2">
                        <span class="text-xs font-bold text-slate-600">{{ Number(svc.price).toFixed(2) }} DT</span>
                        <div class="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Plus class="w-3.5 h-3.5 text-indigo-600" /></div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- HT / TTC -->
          <div class="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium select-none">
            <button @click="pricingMode = 'HT'" class="px-3 py-2 transition" :class="pricingMode === 'HT' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'">HT</button>
            <button @click="pricingMode = 'TTC'" class="px-3 py-2 transition border-l border-slate-200" :class="pricingMode === 'TTC' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'">TTC</button>
          </div>

          <!-- Download -->
          <button @click="downloadPdf" :disabled="generating || !previewData" class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
            <FileDown v-else class="h-4 w-4" />
            <span class="hidden sm:inline">Télécharger PDF</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Click-away -->
    <div v-if="showServicePicker" class="fixed inset-0 z-30" @click="showServicePicker = false"></div>

    <main class="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
      <aside class="h-fit space-y-5">
        <!-- Company Settings -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Société</p>
          <h2 class="mt-2 text-base font-semibold text-slate-900">Vos coordonnées</h2>
          <div class="mt-4 space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
              <input v-model="companySettings.address" type="text" placeholder="Av. Exemple, Ville 1000" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Matricule Fiscal</label>
              <input v-model="companySettings.mf" type="text" placeholder="0000000/X/X/X/000" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input v-model="companySettings.email" type="email" placeholder="contact@exemple.com" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">GSM</label>
              <input v-model="companySettings.gsm" type="text" placeholder="22 000 000 / 55 000 000" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <button @click="saveInvoiceSettings" :disabled="savingSettings" class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60" :class="settingsSaved ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'">
            <Check v-if="settingsSaved" class="h-4 w-4" /><Loader2 v-else-if="savingSettings" class="h-4 w-4 animate-spin" /><Save v-else class="h-4 w-4" />
            {{ settingsSaved ? 'Enregistré !' : 'Enregistrer' }}
          </button>
        </div>

        <!-- Client B2B Info -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center gap-2 mb-3">
            <Building2 class="w-4 h-4 text-indigo-500" />
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Client / Agence (B2B)</p>
          </div>
          <h2 class="text-base font-semibold text-slate-900">Coordonnées client</h2>
          <p class="mt-1 text-xs text-slate-400">Sélectionnez une agence ou saisissez manuellement</p>

          <!-- B2B Client Selector -->
          <div v-if="b2bClients.length > 0" class="mt-3 p-3 rounded-xl bg-violet-50 ring-1 ring-violet-200">
            <label class="block text-xs font-semibold text-violet-700 mb-1.5">Sélectionner une agence</label>
            <select @change="selectB2BClientForInvoice(($event.target as HTMLSelectElement).value)" class="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 appearance-none cursor-pointer">
              <option value="">-- Choisir --</option>
              <option v-for="b in b2bClients" :key="b.id" :value="String(b.id)">{{ b.company_name }}</option>
            </select>
          </div>

          <div class="mt-4 space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Nom / Raison sociale</label>
              <input v-model="clientInfo.name" type="text" placeholder="Nom du client ou agence" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Adresse</label>
              <input v-model="clientInfo.address" type="text" placeholder="Adresse du client" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Matricule Fiscal (MF)</label>
              <input v-model="clientInfo.mf" type="text" placeholder="0000000/X/X/X/000" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
              <input v-model="clientInfo.tel" type="text" placeholder="00 000 000" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
      </aside>

      <!-- Preview -->
      <section class="min-h-[70vh] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div v-if="loading" class="flex h-[60vh] items-center justify-center">
          <Loader2 class="h-8 w-8 animate-spin text-indigo-600" />
        </div>

        <div v-else-if="!previewData" class="flex flex-col items-center justify-center h-[60vh] text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <ClipboardList class="w-8 h-8 text-slate-300" />
          </div>
          <h3 class="text-base font-bold text-slate-900 mb-1">Aucun service sélectionné</h3>
          <p class="text-sm text-slate-400 max-w-xs">Cliquez sur le bouton "Services" dans la barre d'outils pour sélectionner les services à inclure dans la facture.</p>
        </div>

        <div v-else ref="templateMountRef" class="preview-board">
          <div :class="['preview-frame', isExporting ? 'is-exporting' : '']">
            <InvoiceTemplate :data="previewData" :export-mode="isExporting" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
.invoice-editor-page { background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); }
.preview-board { min-height: 100%; overflow: auto; border-radius: 16px; background: #eef2ff; padding: 24px; }
.preview-frame { margin: 0 auto; width: fit-content; border-radius: 14px; box-shadow: 0 20px 30px -15px rgba(15,23,42,0.2), 0 8px 12px -8px rgba(15,23,42,0.15); }
.preview-frame.is-exporting { box-shadow: none; }
.export-a4 { width: 210mm !important; min-height: auto !important; height: auto !important; box-sizing: border-box !important; background: #ffffff !important; overflow: visible !important; }
.export-a4, .export-a4 * { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
.dropdown-enter-active { transition: all 0.15s ease-out; }
.dropdown-leave-active { transition: all 0.1s ease-in; }
.dropdown-enter-from { opacity: 0; transform: translateY(-4px) scale(0.97); }
.dropdown-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }
</style>
