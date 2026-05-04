<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, FileDown, Loader2, Save, Check, ChevronDown } from 'lucide-vue-next';
import ContractTemplate from '@/components/Contracts/ContractTemplate.vue';
import ContractTemplateV2 from '@/components/Contracts/ContractTemplateV2.vue';
import type { ContractData } from '@/components/Contracts/ContractTemplate.vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
// @ts-ignore
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const route = useRoute();
const router = useRouter();
const tenantStore = useTenantStore();

const loading = ref(true);
const generating = ref(false);
const isExporting = ref(false);
const saving = ref(false);
const saved = ref(false);
const existingContractId = ref<string | null>(null);
const templateMountRef = ref<HTMLElement | null>(null);

const collapsedSections = ref<Record<string, boolean>>({});

function toggleSection(key: string) {
  collapsedSections.value[key] = !collapsedSections.value[key];
}

function createEmptyContractData(): ContractData {
  return {
    contractNumber: '',
    contractDate: '',
    rc: '',
    company: { name: '', logoUrl: null, gsm: '', email: '', mf: '', rib: '', address: '' },
    locataire: { nom: '', prenom: '', dob: '', ci: '', ciDate: '', nationalite: '', adresse: '', telephone: '', permis: '', permisDate: '' },
    conducteur: { nom: '', prenom: '', dob: '', ci: '', ciDate: '', nationalite: '', adresse: '', telephone: '', permis: '', permisDate: '' },
    vehicule: { marque: '', immatriculation: '', assPTrans: '', supFranch: '', fuelLevel: '', roueSecours: '', papierOriginaux: '' },
    periode: { departDate: '', departHeure: '', retourDate: '', retourHeure: '', kmDepart: '', kmRetour: '', kmParcouru: '' },
    caution: '',
    encaissement: { totalPartiel: 0, carburant: '', divers: 0 },
    paiement: { mode: '', numero: '', nature: '', date: '', montant: '' },
    prolongation: { du: '', au: '', changement: '', dateHoraire: '' },
    signature: { lieu: '', date: '' },
    pricingMode: 'HT',
    v2: {
      renter: { nom: '', prenom: '' },
      locataire: { mf: '', lieuDelivrance: '', dateEntreeTunisie: '', permisLieu: '', motifSejour: '' },
      conducteur: { mf: '', lieuDelivrance: '', dateEntreeTunisie: '', permisLieu: '', motifSejour: '' },
      periode: { stationSortie: '', stationRetour: '', franchise: '', prol1: '', prol2: '' },
      changement: { modele: '', immat: '', date: '' },
      reglement: { cheque: '', cCredit: '', espece: 0, avance: 0 },
    },
  };
}

function ensureV2(data: ContractData) {
  data.v2 = data.v2 || {};
  data.v2.renter = { nom: '', prenom: '', ...(data.v2.renter || {}) };
  data.v2.locataire = { mf: '', lieuDelivrance: '', dateEntreeTunisie: '', permisLieu: '', motifSejour: '', ...(data.v2.locataire || {}) };
  data.v2.conducteur = { mf: '', lieuDelivrance: '', dateEntreeTunisie: '', permisLieu: '', motifSejour: '', ...(data.v2.conducteur || {}) };
  data.v2.periode = { stationSortie: '', stationRetour: '', franchise: '', prol1: '', prol2: '', ...(data.v2.periode || {}) };
  data.v2.changement = { modele: '', immat: '', date: '', ...(data.v2.changement || {}) };
  data.v2.reglement = { cheque: '', cCredit: '', espece: 0, avance: 0, ...(data.v2.reglement || {}) };
}

const contractData = ref<ContractData>(createEmptyContractData());

// Auto-calc KM
watch(
  () => [contractData.value.periode.kmDepart, contractData.value.periode.kmRetour],
  ([dep, ret]) => {
    const d = parseInt((dep || '').replace(/\s/g, '')) || 0;
    const r = parseInt((ret || '').replace(/\s/g, '')) || 0;
    if (d && r && r > d) {
      contractData.value.periode.kmParcouru = String(r - d);
    }
  }
);

// Company settings
const companySettings = ref({ address: '', mf: '', email: '', gsm: '', rib: '' });

// Active contract template — driven by tenant.contract_template
const contractTemplate = computed<'default' | 'v2'>(() => {
  const t = (tenantStore.currentTenant as any)?.contract_template;
  return t === 'v2' ? 'v2' : 'default';
});

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
      rib: (data as any).company_rib || '',
    };
  }
}

async function saveInvoiceSettings() {
  const tenantId = tenantStore.currentTenant?.id;
  if (!tenantId) return;
  try {
    const payload = {
      tenant_id: tenantId,
      company_address: companySettings.value.address,
      company_mf: companySettings.value.mf,
      company_email: companySettings.value.email,
      company_gsm: companySettings.value.gsm,
      company_rib: companySettings.value.rib,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('tenant_invoice_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) {
      await (supabase.from('tenant_invoice_settings') as any)
        .update(payload)
        .eq('tenant_id', tenantId);
    } else {
      await (supabase.from('tenant_invoice_settings') as any).insert([payload]);
    }

    // Reflect changes immediately into the live contract preview.
    contractData.value.company.rib = companySettings.value.rib;
    contractData.value.company.address = companySettings.value.address;
    contractData.value.company.mf = companySettings.value.mf;
    contractData.value.company.email = companySettings.value.email;
    contractData.value.company.gsm = companySettings.value.gsm;
  } catch (e) {
    console.error('Error saving invoice settings (contract):', e);
  }
}

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

function fmtDateForContract(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTimeForContract(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

async function loadReservation(id: string) {
  loading.value = true;
  try {
    await loadInvoiceSettings();

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*, car:cars(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!reservation) throw new Error('Reservation not found');

    const tenant = tenantStore.currentTenant;
    if (!tenant) throw new Error('Tenant not found');

    let logoUrl: string | null = tenant.logo_url || null;
    if (logoUrl) {
      try { logoUrl = await toDataUrl(logoUrl); } catch { /* keep original */ }
    }

    const s = companySettings.value;

    // Check for saved contract
    const { data: savedContract } = await supabase
      .from('rental_contracts')
      .select('*')
      .eq('reservation_id', reservation.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (savedContract?.contract_data && typeof savedContract.contract_data === 'object') {
      existingContractId.value = savedContract.id;
      const sd = savedContract.contract_data as any;
      contractData.value = {
        ...createEmptyContractData(),
        ...sd,
        company: {
          name: tenant.name,
          logoUrl,
          gsm: s.gsm || sd.company?.gsm || '',
          email: s.email || sd.company?.email || '',
          mf: s.mf || sd.company?.mf || '',
          rib: s.rib || sd.company?.rib || '',
          address: s.address || sd.company?.address || '',
        },
      };
      ensureV2(contractData.value);
    } else {
      contractData.value = {
        contractNumber: reservation.contract_number || reservation.reservation_number || '',
        contractDate: fmtDateForContract(reservation.created_at || new Date().toISOString()),
        rc: s.mf || '',
        company: {
          name: tenant.name,
          logoUrl,
          gsm: s.gsm || '',
          email: s.email || '',
          mf: s.mf || '',
          rib: s.rib || '',
          address: s.address || '',
        },
        locataire: {
          nom: reservation.client_name || '',
          prenom: '',
          dob: '',
          ci: reservation.client_cin || '',
          ciDate: reservation.client_cin_date || '',
          nationalite: '',
          adresse: '',
          telephone: reservation.client_phone || '',
          permis: reservation.client_permit_number || '',
          permisDate: reservation.client_permit_date || '',
        },
        conducteur: {
          nom: reservation.second_driver_name || '',
          prenom: '',
          dob: '',
          ci: reservation.second_driver_cin || '',
          ciDate: reservation.second_driver_cin_date || '',
          nationalite: '',
          adresse: '',
          telephone: reservation.second_driver_phone || '',
          permis: reservation.second_driver_permit_number || '',
          permisDate: reservation.second_driver_permit_date || '',
        },
        vehicule: {
          marque: `${reservation.car?.brand || ''} ${reservation.car?.model || ''}`.trim(),
          immatriculation: reservation.car?.plate_number || reservation.car?.license_plate || '',
          assPTrans: '',
          supFranch: '',
          fuelLevel: '',
          roueSecours: '',
          papierOriginaux: '',
        },
        periode: {
          departDate: fmtDateForContract(reservation.start_date),
          departHeure: fmtTimeForContract(reservation.start_date),
          retourDate: fmtDateForContract(reservation.end_date),
          retourHeure: fmtTimeForContract(reservation.end_date),
          kmDepart: '',
          kmRetour: '',
          kmParcouru: '',
        },
        caution: '',
        encaissement: {
          totalPartiel: Number(reservation.total_price) || 0,
          carburant: '',
          divers: 0,
        },
        paiement: { mode: '', numero: '', nature: '', date: '', montant: '' },
        prolongation: { du: '', au: '', changement: '', dateHoraire: '' },
        signature: { lieu: '', date: fmtDateForContract(new Date().toISOString()) },
        pricingMode: 'HT',
        v2: {
          renter: { nom: '', prenom: '' },
          locataire: { mf: '', lieuDelivrance: '', dateEntreeTunisie: '', permisLieu: '', motifSejour: '' },
          conducteur: { mf: '', lieuDelivrance: '', dateEntreeTunisie: '', permisLieu: '', motifSejour: '' },
          periode: { stationSortie: '', stationRetour: '', franchise: '', prol1: '', prol2: '' },
          changement: { modele: '', immat: '', date: '' },
          reglement: {
            cheque: '',
            cCredit: '',
            espece: 0,
            avance: Number(reservation.advance_payment) || 0,
          },
        },
      };
    }
  } catch (e) {
    console.error('Error loading reservation for contract', e);
    alert('Reservation not found');
    router.push({ name: 'admin.reservations.index', params: { tenantSlug: tenantStore.currentTenant?.slug } });
  } finally {
    loading.value = false;
  }
}

async function saveContract() {
  const tenantId = tenantStore.currentTenant?.id;
  const reservationId = route.params.id;
  if (!tenantId || !reservationId) return;

  saving.value = true;
  saved.value = false;
  try {
    const payload = {
      tenant_id: tenantId,
      reservation_id: Number(reservationId),
      contract_number: contractData.value.contractNumber || null,
      contract_data: JSON.parse(JSON.stringify(contractData.value)),
      updated_at: new Date().toISOString(),
    };

    if (existingContractId.value) {
      await supabase
        .from('rental_contracts')
        .update(payload)
        .eq('id', existingContractId.value);
    } else {
      const { data: inserted } = await (supabase.from('rental_contracts') as any)
        .insert([payload])
        .select()
        .single();
      if (inserted) existingContractId.value = inserted.id;
    }

    saved.value = true;
    setTimeout(() => (saved.value = false), 2500);
  } catch (e) {
    console.error('Error saving contract', e);
    alert('Erreur lors de la sauvegarde du contrat');
  } finally {
    saving.value = false;
  }
}

// PDF export
function createExportClone(sourceEl: HTMLElement) {
  const host = document.createElement('div');
  host.setAttribute('data-pdf-host', 'true');
  host.style.position = 'fixed';
  host.style.left = '-12000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#fff';
  host.style.zIndex = '-1';
  host.style.fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.id = 'contract-template-export';
  clone.style.width = '794px';
  clone.style.minWidth = '794px';
  clone.style.maxWidth = '794px';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.transform = 'none';
  clone.style.border = 'none';
  clone.style.gap = '0px';
  clone.style.background = '#ffffff';

  clone.querySelectorAll('.ct-paper').forEach((paper: any) => {
    paper.style.boxShadow = 'none';
    paper.style.border = 'none';
  });

  // Inline-fix tables that depend on <colgroup> widths so html2canvas honors them
  // (some versions misread colgroup percentages on offscreen clones).
  clone.querySelectorAll('table').forEach((tbl: any) => {
    tbl.style.tableLayout = 'fixed';
    tbl.style.width = '100%';
    tbl.style.borderCollapse = 'collapse';
  });

  host.appendChild(clone);
  document.body.appendChild(host);

  return {
    clone,
    cleanup: () => { try { document.body.removeChild(host); } catch {} },
  };
}

async function downloadPdf() {
  generating.value = true;
  isExporting.value = true;
  const cleanups: Array<() => void> = [];

  try {
    await nextTick();

    // Wait for any in-flight fonts (system Tahoma is the primary Arabic font,
    // so this is mostly a safety net for the Latin face).
    try {
      // @ts-ignore
      if (document.fonts?.ready) await document.fonts.ready;
    } catch { /* ignore */ }

    const wrapperEl = templateMountRef.value?.querySelector('#contract-template') as HTMLElement | null;
    if (!wrapperEl) throw new Error('Template element not found');

    const pages = wrapperEl.querySelectorAll('.ct-paper');
    if (pages.length === 0) throw new Error('No pages found');

    const filename = `Contrat_${contractData.value.contractNumber || 'draft'}.pdf`;
    const scale = 3;
    let pdf: InstanceType<typeof jsPDF> | null = null;

    for (let i = 0; i < pages.length; i++) {
      const { clone, cleanup } = createExportClone(pages[i] as HTMLElement);
      cleanups.push(cleanup);

      await new Promise((r) => setTimeout(r, 150));

      const w = Math.ceil(clone.scrollWidth);
      const h = Math.ceil(clone.scrollHeight);

      const canvas = await html2canvas(clone, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: w,
        height: h,
        windowWidth: w,
        windowHeight: h,
      });

      const imgData = canvas.toDataURL('image/png');
      const pageW = canvas.width / scale;
      const pageH = canvas.height / scale;

      if (i === 0) {
        pdf = new jsPDF({
          unit: 'px',
          format: [pageW, pageH],
          orientation: pageW > pageH ? 'landscape' : 'portrait',
          compress: true,
        });
        pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);
      } else if (pdf) {
        pdf.addPage([pageW, pageH], pageW > pageH ? 'landscape' : 'portrait');
        pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);
      }
    }

    if (pdf) pdf.save(filename);
  } catch (error: any) {
    console.error('PDF generation failed', error);
    alert(`Erreur PDF: ${error?.message || error}`);
  } finally {
    cleanups.forEach((fn) => fn());
    isExporting.value = false;
    generating.value = false;
  }
}

function resetAll() {
  if (!confirm('Réinitialiser tous les champs du contrat ?')) return;
  const company = { ...contractData.value.company };
  contractData.value = createEmptyContractData();
  contractData.value.company = company;
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
  <div class="contract-builder-page min-h-screen">
    <!-- Header -->
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3 shrink-0">
          <button @click="goBack" class="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
            <ArrowLeft class="h-5 w-5" />
          </button>
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Contrat de location</p>
            <h1 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              Contract Builder
              <span
                v-if="contractTemplate === 'v2'"
                class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700"
              >
                Template V2
              </span>
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap justify-end">
          <!-- TTC / HT switcher -->
          <div class="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium select-none">
            <button
              @click="contractData.pricingMode = 'TTC'"
              type="button"
              class="px-3 py-2 transition"
              :class="contractData.pricingMode === 'TTC'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
            >
              TTC
            </button>
            <button
              @click="contractData.pricingMode = 'HT'"
              type="button"
              class="px-3 py-2 transition border-l border-slate-200"
              :class="(contractData.pricingMode || 'HT') === 'HT'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'"
            >
              HT
            </button>
          </div>

          <!-- Save -->
          <button
            @click="saveContract"
            :disabled="saving || loading"
            class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            :class="saved ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'"
          >
            <Check v-if="saved" class="h-4 w-4" />
            <Loader2 v-else-if="saving" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            <span class="hidden sm:inline">{{ saved ? 'Enregistré !' : 'Enregistrer' }}</span>
          </button>

          <!-- Download PDF -->
          <button
            @click="downloadPdf"
            :disabled="generating || loading"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
            <FileDown v-else class="h-4 w-4" />
            <span class="hidden sm:inline">Télécharger PDF</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">

      <!-- Sidebar -->
      <aside class="h-fit space-y-3">

        <!-- Contract Info -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('info')">
            <span>Contract info</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.info }" />
          </button>
          <div v-show="!collapsedSections.info" class="sb-body">
            <div class="sb-field">
              <label>Contract N°</label>
              <input v-model="contractData.contractNumber" placeholder="000563" />
            </div>
            <div class="sb-row-2">
              <div class="sb-field"><label>Date</label><input v-model="contractData.contractDate" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field"><label>RC N°</label><input v-model="contractData.rc" placeholder="B049892016" /></div>
            </div>
            <template v-if="contractTemplate === 'v2'">
              <div class="sb-divider">
                <span>Société (V2)</span>
              </div>
              <div class="sb-field">
                <label>Adresse société</label>
                <input v-model="companySettings.address" placeholder="Complexe Ribat N°10 5000 Monastir" @change="saveInvoiceSettings" />
              </div>
              <div class="sb-field">
                <label>RIB (Banque)</label>
                <input v-model="companySettings.rib" placeholder="04508045006507290539" @change="saveInvoiceSettings" />
              </div>
              <p class="sb-hint">Persisté pour ce tenant — visible dans l'en-tête du contrat V2.</p>
            </template>
          </div>
        </div>

        <!-- Locataire (V2 only) — actual renter, separate from the first driver -->
        <div v-if="contractTemplate === 'v2' && contractData.v2?.renter" class="sb-card">
          <button class="sb-title" @click="toggleSection('renter')">
            <span>Locataire (المستأجر)</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.renter }" />
          </button>
          <div v-show="!collapsedSections.renter" class="sb-body">
            <p class="sb-hint">Personne qui loue la voiture (peut être différente du conducteur).</p>
            <div class="sb-field"><label>Nom</label><input v-model="contractData.v2.renter.nom" /></div>
            <div class="sb-field"><label>Prénom</label><input v-model="contractData.v2.renter.prenom" /></div>
          </div>
        </div>

        <!-- Premier conducteur (V2) / Locataire (V1) -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('locataire')">
            <span>{{ contractTemplate === 'v2' ? 'Premier conducteur (السائق الأول)' : 'Locataire (السائق الأول)' }}</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.locataire }" />
          </button>
          <div v-show="!collapsedSections.locataire" class="sb-body">
            <div class="sb-field"><label>Nom (الاسم)</label><input v-model="contractData.locataire.nom" /></div>
            <div class="sb-field"><label>Prénom (اللقب)</label><input v-model="contractData.locataire.prenom" /></div>
            <div class="sb-field"><label>Date et Lieu de Naissance</label><input v-model="contractData.locataire.dob" placeholder="JJ/MM/AAAA — Lieu" /></div>
            <div class="sb-field"><label>N° CI ou Passeport</label><input v-model="contractData.locataire.ci" /></div>
            <div class="sb-field"><label>Date de délivrance (CIN/Passport)</label><input v-model="contractData.locataire.ciDate" placeholder="JJ/MM/AAAA" /></div>
            <div class="sb-field"><label>Nationalité</label><input v-model="contractData.locataire.nationalite" /></div>
            <div class="sb-field"><label>Adresse</label><input v-model="contractData.locataire.adresse" /></div>
            <div class="sb-field"><label>Téléphone</label><input v-model="contractData.locataire.telephone" /></div>
            <div class="sb-field"><label>N° Permis</label><input v-model="contractData.locataire.permis" /></div>
            <div class="sb-field"><label>Date de délivrance (Permis)</label><input v-model="contractData.locataire.permisDate" placeholder="JJ/MM/AAAA" /></div>
            <template v-if="contractTemplate === 'v2' && contractData.v2?.locataire">
              <div class="sb-divider"><span>V2 — champs additionnels</span></div>
              <div class="sb-field"><label>M.F (Matricule fiscal)</label><input v-model="contractData.v2.locataire.mf" /></div>
              <div class="sb-field"><label>Date d'entrée en Tunisie</label><input v-model="contractData.v2.locataire.dateEntreeTunisie" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field">
                <label>Motif de séjour</label>
                <select v-model="contractData.v2.locataire.motifSejour">
                  <option value="">—</option>
                  <option value="Touriste">Touriste</option>
                  <option value="Affaire">Affaire</option>
                  <option value="Autres">Autres</option>
                </select>
              </div>
            </template>
          </div>
        </div>

        <!-- Conducteur -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('conducteur')">
            <span>Conducteur (السائق الثاني)</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.conducteur }" />
          </button>
          <div v-show="!collapsedSections.conducteur" class="sb-body">
            <div class="sb-field"><label>Nom</label><input v-model="contractData.conducteur.nom" /></div>
            <div class="sb-field"><label>Prénom</label><input v-model="contractData.conducteur.prenom" /></div>
            <div class="sb-field"><label>Date et Lieu de Naissance</label><input v-model="contractData.conducteur.dob" placeholder="JJ/MM/AAAA — Lieu" /></div>
            <div class="sb-field"><label>N° CI ou Passeport</label><input v-model="contractData.conducteur.ci" /></div>
            <div class="sb-field"><label>Date de délivrance (CIN/Passport)</label><input v-model="contractData.conducteur.ciDate" placeholder="JJ/MM/AAAA" /></div>
            <div class="sb-field"><label>Nationalité</label><input v-model="contractData.conducteur.nationalite" /></div>
            <div class="sb-field"><label>Adresse</label><input v-model="contractData.conducteur.adresse" /></div>
            <div class="sb-field"><label>Téléphone</label><input v-model="contractData.conducteur.telephone" /></div>
            <div class="sb-field"><label>N° Permis</label><input v-model="contractData.conducteur.permis" /></div>
            <div class="sb-field"><label>Date de délivrance (Permis)</label><input v-model="contractData.conducteur.permisDate" placeholder="JJ/MM/AAAA" /></div>
            <template v-if="contractTemplate === 'v2' && contractData.v2?.conducteur">
              <div class="sb-divider"><span>V2 — champs additionnels</span></div>
              <div class="sb-field"><label>M.F (Matricule fiscal)</label><input v-model="contractData.v2.conducteur.mf" /></div>
              <div class="sb-field"><label>Date d'entrée en Tunisie</label><input v-model="contractData.v2.conducteur.dateEntreeTunisie" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field">
                <label>Motif de séjour</label>
                <select v-model="contractData.v2.conducteur.motifSejour">
                  <option value="">—</option>
                  <option value="Touriste">Touriste</option>
                  <option value="Affaire">Affaire</option>
                  <option value="Autres">Autres</option>
                </select>
              </div>
            </template>
          </div>
        </div>

        <!-- Vehicule -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('vehicule')">
            <span>Véhicule (السيارة)</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.vehicule }" />
          </button>
          <div v-show="!collapsedSections.vehicule" class="sb-body">
            <div class="sb-field"><label>Marque / Modèle</label><input v-model="contractData.vehicule.marque" placeholder="e.g. Volkswagen Virtus" /></div>
            <div class="sb-field"><label>N° Immatriculation</label><input v-model="contractData.vehicule.immatriculation" placeholder="244 TU 1132" /></div>
            <div class="sb-row-2">
              <div class="sb-field">
                <label>Ass. P. Trans</label>
                <select v-model="contractData.vehicule.assPTrans"><option value="">—</option><option>OUI</option><option>NON</option></select>
              </div>
              <div class="sb-field">
                <label>Sup. Franch.</label>
                <select v-model="contractData.vehicule.supFranch"><option value="">—</option><option>OUI</option><option>NON</option></select>
              </div>
            </div>
            <div class="sb-field">
              <label>Niveau essence départ</label>
              <select v-model="contractData.vehicule.fuelLevel"><option value="">—</option><option value="1/4">1/4</option><option value="1/2">1/2</option><option value="3/4">3/4</option><option value="Full">Full (Plein)</option></select>
            </div>
            <div class="sb-row-2">
              <div class="sb-field">
                <label>Roue de secours</label>
                <select v-model="contractData.vehicule.roueSecours"><option value="">—</option><option>Oui</option><option>Non</option></select>
              </div>
              <div class="sb-field">
                <label>Papier originaux</label>
                <select v-model="contractData.vehicule.papierOriginaux"><option value="">—</option><option>Oui</option><option>Non</option></select>
              </div>
            </div>
          </div>
        </div>

        <!-- Periode -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('periode')">
            <span>Période de location</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.periode }" />
          </button>
          <div v-show="!collapsedSections.periode" class="sb-body">
            <div class="sb-row-2">
              <div class="sb-field"><label>Départ — Date</label><input v-model="contractData.periode.departDate" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field"><label>Départ — Heure</label><input v-model="contractData.periode.departHeure" placeholder="HH:MM" /></div>
            </div>
            <div class="sb-row-2">
              <div class="sb-field"><label>Retour prévu — Date</label><input v-model="contractData.periode.retourDate" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field"><label>Retour prévu — Heure</label><input v-model="contractData.periode.retourHeure" placeholder="HH:MM" /></div>
            </div>
            <div class="sb-field"><label>KM de départ</label><input v-model="contractData.periode.kmDepart" placeholder="89 813" /></div>
            <div class="sb-field"><label>KM de retour</label><input v-model="contractData.periode.kmRetour" /></div>
            <div class="sb-field"><label>KM parcouru (auto-calc)</label><input v-model="contractData.periode.kmParcouru" placeholder="auto" /></div>
            <template v-if="contractTemplate === 'v2' && contractData.v2?.periode">
              <div class="sb-divider"><span>V2 — Stations & Franchise</span></div>
              <div class="sb-field"><label>Station de sortie</label><input v-model="contractData.v2.periode.stationSortie" placeholder="Monastir" /></div>
              <div class="sb-field"><label>Station de retour</label><input v-model="contractData.v2.periode.stationRetour" placeholder="Monastir" /></div>
              <div class="sb-field"><label>Franchise (الضمان)</label><input v-model="contractData.v2.periode.franchise" placeholder="—" /></div>
              <div class="sb-row-2">
                <div class="sb-field"><label>Prol 1</label><input v-model="contractData.v2.periode.prol1" /></div>
                <div class="sb-field"><label>Prol 2</label><input v-model="contractData.v2.periode.prol2" /></div>
              </div>
            </template>
          </div>
        </div>

        <!-- Changement de voiture (V2) -->
        <div v-if="contractTemplate === 'v2' && contractData.v2?.changement" class="sb-card">
          <button class="sb-title" @click="toggleSection('changement')">
            <span>Changement de voiture (V2)</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.changement }" />
          </button>
          <div v-show="!collapsedSections.changement" class="sb-body">
            <div class="sb-field"><label>Modèle</label><input v-model="contractData.v2.changement.modele" placeholder="e.g. Volkswagen Golf" /></div>
            <div class="sb-field"><label>Immatriculation</label><input v-model="contractData.v2.changement.immat" placeholder="244 TU 1132" /></div>
            <div class="sb-field"><label>Date</label><input v-model="contractData.v2.changement.date" placeholder="JJ/MM/AAAA" /></div>
          </div>
        </div>

        <!-- Règlement (V2) -->
        <div v-if="contractTemplate === 'v2' && contractData.v2?.reglement" class="sb-card">
          <button class="sb-title" @click="toggleSection('reglement')">
            <span>Règlement (V2)</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.reglement }" />
          </button>
          <div v-show="!collapsedSections.reglement" class="sb-body">
            <div class="sb-field"><label>Chèque N°</label><input v-model="contractData.v2.reglement.cheque" /></div>
            <div class="sb-field"><label>C.Crédit N°</label><input v-model="contractData.v2.reglement.cCredit" /></div>
            <div class="sb-field"><label>Espèce (DT)</label><input v-model.number="contractData.v2.reglement.espece" type="number" step="0.001" placeholder="0.000" /></div>
            <div class="sb-field"><label>Avance (DT)</label><input v-model.number="contractData.v2.reglement.avance" type="number" step="0.001" placeholder="0.000" /></div>
            <p class="sb-hint">Total H.T, T.V.A et Total T.T.C sont calculés automatiquement à partir de l'Encaissement.</p>
          </div>
        </div>

        <!-- Caution -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('caution')">
            <span>Nature de la caution</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.caution }" />
          </button>
          <div v-show="!collapsedSections.caution" class="sb-body">
            <div class="sb-field">
              <label>Type de caution</label>
              <select v-model="contractData.caution"><option value="">— Aucun —</option><option value="carte">Carte de crédit</option><option value="especes">Espèces</option><option value="cheque">Chèque</option></select>
            </div>
          </div>
        </div>

        <!-- Encaissement -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('encaissement')">
            <span>Encaissement (المقابيض)</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.encaissement }" />
          </button>
          <div v-show="!collapsedSections.encaissement" class="sb-body">
            <div class="sb-field">
              <label>{{ contractData.pricingMode === 'TTC' ? 'Total Facture TTC (DT)' : 'Total Partiel HT (DT)' }}</label>
              <input v-model.number="contractData.encaissement.totalPartiel" type="number" step="0.001" placeholder="0.000" />
            </div>
            <div class="sb-field">
              <label>Carburant</label>
              <select v-model="contractData.encaissement.carburant"><option value="">—</option><option value="R">R (Remise)</option><option value="F">F (Full)</option><option value="E">E (Empty)</option></select>
            </div>
            <div class="sb-field"><label>Franchise ou Divers (DT)</label><input v-model.number="contractData.encaissement.divers" type="number" step="0.001" placeholder="0.000" /></div>
          </div>
        </div>

        <!-- Paiement -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('paiement')">
            <span>Mode de paiement</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.paiement }" />
          </button>
          <div v-show="!collapsedSections.paiement" class="sb-body">
            <div class="sb-field">
              <label>Mode</label>
              <select v-model="contractData.paiement.mode"><option value="">—</option><option value="cheque">Chèque</option><option value="carte">Carte de Crédit</option><option value="especes">Espèces</option></select>
            </div>
            <div class="sb-field"><label>Numéro</label><input v-model="contractData.paiement.numero" /></div>
            <div class="sb-field"><label>Nature</label><input v-model="contractData.paiement.nature" /></div>
            <div class="sb-row-2">
              <div class="sb-field"><label>En date du</label><input v-model="contractData.paiement.date" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field"><label>Montant TTC</label><input v-model="contractData.paiement.montant" placeholder="0.000" /></div>
            </div>
          </div>
        </div>

        <!-- Prolongation -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('prolongation')">
            <span>Prolongation / Changement</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.prolongation }" />
          </button>
          <div v-show="!collapsedSections.prolongation" class="sb-body">
            <div class="sb-row-2">
              <div class="sb-field"><label>Du</label><input v-model="contractData.prolongation.du" placeholder="JJ/MM/AAAA" /></div>
              <div class="sb-field"><label>Au</label><input v-model="contractData.prolongation.au" placeholder="JJ/MM/AAAA" /></div>
            </div>
            <div class="sb-field"><label>Changement de voiture</label><input v-model="contractData.prolongation.changement" /></div>
            <div class="sb-field"><label>Date et horaire</label><input v-model="contractData.prolongation.dateHoraire" placeholder="JJ/MM/AAAA HH:MM" /></div>
          </div>
        </div>

        <!-- Signature -->
        <div class="sb-card">
          <button class="sb-title" @click="toggleSection('signature')">
            <span>Signature</span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': collapsedSections.signature }" />
          </button>
          <div v-show="!collapsedSections.signature" class="sb-body">
            <div class="sb-field"><label>Fait à</label><input v-model="contractData.signature.lieu" placeholder="Bizerte" /></div>
            <div class="sb-field"><label>Le (date)</label><input v-model="contractData.signature.date" placeholder="JJ/MM/AAAA" /></div>
          </div>
        </div>

        <!-- Reset -->
        <button @click="resetAll" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
          Réinitialiser tous les champs
        </button>
      </aside>

      <!-- Preview -->
      <section class="min-h-[70vh] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div v-if="loading" class="flex h-[60vh] items-center justify-center">
          <Loader2 class="h-8 w-8 animate-spin text-indigo-600" />
        </div>
        <div v-else ref="templateMountRef" class="contract-preview-board">
          <div :class="['contract-preview-frame', isExporting ? 'is-exporting' : '']">
            <ContractTemplateV2 v-if="contractTemplate === 'v2'" :data="contractData" />
            <ContractTemplate v-else :data="contractData" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
.contract-builder-page {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.contract-preview-board {
  min-height: 100%;
  overflow: auto;
  border-radius: 16px;
  background: #e2e8f0;
  padding: 24px;
}

.contract-preview-frame {
  margin: 0 auto;
  width: fit-content;
  border-radius: 4px;
  box-shadow:
    0 20px 30px -15px rgba(15, 23, 42, 0.2),
    0 8px 12px -8px rgba(15, 23, 42, 0.15);
}

.contract-preview-frame.is-exporting {
  box-shadow: none;
}

/* Sidebar cards */
.sb-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
}

.sb-title {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #475569;
  background: #f8fafc;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.sb-title:hover { background: #f1f5f9; }

.sb-body {
  padding: 12px 16px 16px;
  display: grid;
  gap: 10px;
}

.sb-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sb-field label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}
.sb-field input,
.sb-field select {
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sb-field input:focus,
.sb-field select:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.15);
  background: #fff;
}
.sb-field input::placeholder { color: #94a3b8; }

.sb-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sb-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 2px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6366f1;
}
.sb-divider::before,
.sb-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);
}

.sb-hint {
  font-size: 10.5px;
  color: #94a3b8;
  margin: 4px 0 0;
  line-height: 1.4;
}
</style>
