<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, FileDown, Loader2, Save, Check, ChevronDown, Sparkles, Search, CalendarPlus, AlertCircle, ExternalLink, X, UserPlus, BookmarkPlus } from 'lucide-vue-next';
import ContractTemplate from '@/components/Contracts/ContractTemplate.vue';
import ContractTemplateV2 from '@/components/Contracts/ContractTemplateV2.vue';
import type { ContractData } from '@/components/Contracts/ContractTemplate.vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { useCars } from '@/composables/useCars';
import { useFaithfulClients, type FaithfulClient } from '@/composables/useFaithfulClients';
import { useReservations } from '@/composables/useReservations';
// @ts-ignore
// html-to-image captures the contract via SVG <foreignObject>, which
// delegates rendering back to the browser's native engine. This is the
// only way to preserve Arabic letter-shaping / RTL ligatures in the PDF
// (canvas-based rasterizers like html2canvas can't shape Arabic).
import * as htmlToImage from 'html-to-image';
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
    locationType: 'Location',
    preparedBy: '',
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

// ──────────────────────────────────────────────────────────────────
// Fleet picker — lets the user select a car from the agency's fleet
// to pre-fill marque / immatriculation in the Véhicule section.
// ──────────────────────────────────────────────────────────────────
const { cars, fetchCars, updateCar } = useCars();
const selectedFleetCarId = ref<number | null>(null);

function onFleetCarSelected(value: string) {
  const carId = value ? Number(value) : null;
  selectedFleetCarId.value = carId;
  if (carId === null) return;
  const car = cars.value.find((c) => c.id === carId);
  if (!car) return;
  contractData.value.vehicule.marque = `${car.brand} ${car.model}`.trim();
  contractData.value.vehicule.immatriculation = car.plate_number || '';
}

// ──────────────────────────────────────────────────────────────────
// Save-as-reservation — turns a blank contract into a fully-fledged
// reservation in one click. Available only in blank mode (where no
// reservation backs the contract yet).
// ──────────────────────────────────────────────────────────────────
const { createReservation } = useReservations();

const showSaveAsReservationModal = ref(false);
const saveAsReservationLoading = ref(false);
const saveAsReservationError = ref<string | null>(null);
const saveAsReservationSuccess = ref<{ id: number; reservation_number: string } | null>(null);

/** "YYYY-MM-DD" (from <input type="date">) → "DD/MM/YYYY". Empty in / empty out. */
function isoToFrenchDate(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** "DD/MM/YYYY" → "YYYY-MM-DD" for <input type="date">. Returns '' on bad input. */
function frenchDateToIso(fr: string): string {
  if (!fr) return '';
  const parts = fr.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return '';
  if (isNaN(+dd) || isNaN(+mm) || isNaN(+yyyy)) return '';
  return `${yyyy.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** Parse a JJ/MM/AAAA date + an optional HH:MM time into a local Date. */
function parseFrenchDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [ddStr, mmStr, yyyyStr] = parts;
  const dd = parseInt(ddStr, 10);
  const mm = parseInt(mmStr, 10);
  const yyyy = parseInt(yyyyStr, 10);
  if (!dd || !mm || !yyyy) return null;

  let hour = 0;
  let minute = 0;
  if (timeStr) {
    const timeParts = timeStr.split(':').map((p) => p.trim());
    if (timeParts.length >= 2) {
      hour = parseInt(timeParts[0], 10) || 0;
      minute = parseInt(timeParts[1], 10) || 0;
    }
  }
  const d = new Date(yyyy, mm - 1, dd, hour, minute, 0);
  return isNaN(d.getTime()) ? null : d;
}

// Two-way bindings for the native <input type="date"> pickers in the
// "Période de location" section. The contract template still stores
// dates as JJ/MM/AAAA strings, but the user gets a real calendar widget.
const periodeDepartDateInput = computed({
  get: () => frenchDateToIso(contractData.value.periode.departDate),
  set: (v: string) => {
    contractData.value.periode.departDate = isoToFrenchDate(v);
  },
});

const periodeRetourDateInput = computed({
  get: () => frenchDateToIso(contractData.value.periode.retourDate),
  set: (v: string) => {
    contractData.value.periode.retourDate = isoToFrenchDate(v);
  },
});

/** Live preview of the reservation that would be created from the current contract. */
const reservationPreview = computed(() => {
  const d = contractData.value;

  // Resolve car: prefer the explicit fleet selection, then fall back to
  // matching by plate (case-insensitive, ignoring whitespace).
  let car: { id: number; brand: string; model: string; plate: string } | null = null;
  if (selectedFleetCarId.value) {
    const c = cars.value.find((c) => c.id === selectedFleetCarId.value);
    if (c) car = { id: c.id, brand: c.brand, model: c.model, plate: c.plate_number || '' };
  } else if (d.vehicule.immatriculation) {
    const wanted = d.vehicule.immatriculation.replace(/\s+/g, '').toLowerCase();
    const c = cars.value.find(
      (c) => (c.plate_number || '').replace(/\s+/g, '').toLowerCase() === wanted,
    );
    if (c) car = { id: c.id, brand: c.brand, model: c.model, plate: c.plate_number || '' };
  }

  const start = parseFrenchDateTime(d.periode.departDate, d.periode.departHeure);
  const end = parseFrenchDateTime(d.periode.retourDate, d.periode.retourHeure);

  let durationDays = 0;
  if (start && end && end > start) {
    durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }

  const clientName = `${d.locataire.prenom || ''} ${d.locataire.nom || ''}`.trim();
  const secondDriverName = `${d.conducteur.prenom || ''} ${d.conducteur.nom || ''}`.trim();

  const totalPrice = Number(d.encaissement.totalPartiel) || 0;
  const advancePayment = Number(d.v2?.reglement?.avance) || 0;

  return {
    car,
    start,
    end,
    durationDays,
    clientName,
    clientCin: d.locataire.ci || '',
    clientPhone: d.locataire.telephone || '',
    clientPermit: d.locataire.permis || '',
    clientAddress: d.locataire.adresse || '',
    secondDriverName,
    secondDriverCin: d.conducteur.ci || '',
    contractNumber: d.contractNumber || '',
    totalPrice,
    advancePayment,
    pricePerDay: durationDays > 0 ? Math.round((totalPrice / durationDays) * 1000) / 1000 : totalPrice,
  };
});

/** Human-readable issues that must be fixed before a reservation can be created. */
const reservationValidationErrors = computed<string[]>(() => {
  const errs: string[] = [];
  const p = reservationPreview.value;
  const plate = contractData.value.vehicule.immatriculation;
  if (!p.car) {
    errs.push(
      plate
        ? `Aucun véhicule de la flotte ne correspond à la plaque « ${plate} ». Sélectionnez-en un depuis « Sélectionner depuis la flotte ».`
        : "Aucun véhicule sélectionné — utilisez « Sélectionner depuis la flotte » dans la section Véhicule.",
    );
  }
  if (!p.start) errs.push("Date/heure de départ manquante (Période de location).");
  if (!p.end) errs.push("Date/heure de retour manquante (Période de location).");
  if (p.start && p.end && p.end <= p.start) {
    errs.push("La date de retour doit être après la date de départ.");
  }
  if (!p.clientName) errs.push("Nom et prénom du locataire requis.");
  if (!p.clientCin) errs.push("N° CI ou Passeport du locataire requis.");
  return errs;
});

const canSaveAsReservation = computed(() => reservationValidationErrors.value.length === 0);

async function openSaveAsReservationModal() {
  saveAsReservationError.value = null;
  saveAsReservationSuccess.value = null;

  // Before opening the preview modal, propose registering the Locataire
  // as a Client Fidèle if their CIN isn't already known.
  const payload = buildSuggestPayloadFromContract();
  if (
    payload &&
    !suggestRegisterDismissedCins.value.has(payload.cin) &&
    !suggestRegisterKnownCins.value.has(payload.cin)
  ) {
    const registered = await isFaithfulClientCinRegistered(payload.cin);
    if (registered === true) {
      suggestRegisterKnownCins.value.add(payload.cin);
    } else if (registered === false) {
      suggestRegisterPayload.value = payload;
      suggestRegisterError.value = null;
      suggestRegisterSuccess.value = null;
      // After the user decides (save / skip), open the save-as-reservation modal.
      pendingActionAfterRegister = () => {
        showSaveAsReservationModal.value = true;
      };
      showSuggestRegisterModal.value = true;
      return;
    }
    // registered === null → DB unreachable, just continue.
  }

  showSaveAsReservationModal.value = true;
}

function closeSaveAsReservationModal() {
  if (saveAsReservationLoading.value) return;
  showSaveAsReservationModal.value = false;
}

async function confirmSaveAsReservation() {
  if (!canSaveAsReservation.value || saveAsReservationLoading.value) return;

  saveAsReservationLoading.value = true;
  saveAsReservationError.value = null;

  try {
    const p = reservationPreview.value;
    const d = contractData.value;
    const now = new Date();
    const isActiveNow = p.start! <= now && p.end! >= now;
    const isFuture = p.start! > now;
    const status = isActiveNow ? 'active' : isFuture ? 'confirmed' : 'completed';

    const hasSecondDriver = Boolean(p.secondDriverName || p.secondDriverCin);

    const payload: Record<string, unknown> = {
      client_name: p.clientName,
      client_cin: p.clientCin,
      client_phone: p.clientPhone,
      client_permit_number: p.clientPermit || null,
      client_cin_date: d.locataire.ciDate || null,
      client_permit_date: d.locataire.permisDate || null,
      client_address: p.clientAddress || null,
      car_id: p.car!.id,
      start_date: p.start!.toISOString(),
      end_date: p.end!.toISOString(),
      duration_days: p.durationDays || 1,
      price_per_day: p.pricePerDay,
      total_price: p.totalPrice,
      advance_payment: p.advancePayment,
      caution: 0,
      caution_currency: 'DT',
      status,
      contract_number: p.contractNumber || null,
      notes: `Réservation créée depuis le Contrat Vierge${d.preparedBy ? ' par ' + d.preparedBy : ''}.`,
    };

    if (hasSecondDriver) {
      payload.second_driver_name = p.secondDriverName || null;
      payload.second_driver_cin = p.secondDriverCin || null;
      payload.second_driver_phone = d.conducteur.telephone || null;
      payload.second_driver_permit_number = d.conducteur.permis || null;
      payload.second_driver_cin_date = d.conducteur.ciDate || null;
      payload.second_driver_permit_date = d.conducteur.permisDate || null;
      payload.second_driver_address = d.conducteur.adresse || null;
    }

    const created = await createReservation(payload as any);
    if (!created || !created.id) {
      throw new Error("La création de la réservation a échoué (aucune donnée retournée).");
    }

    // If the rental window already covers "now", force the car into 'loué' so
    // the Fleet page reflects reality instantly. The fetchCars overlay will
    // keep it consistent for past/future windows.
    if (isActiveNow && p.car) {
      try {
        await updateCar(p.car.id, { status: 'loue' });
      } catch (e) {
        console.warn('Could not mark car as loué after creating reservation:', e);
      }
    }

    // Best-effort: persist the contract data and link it to the new
    // reservation so it shows up later under /admin/contracts/:id/build.
    const tenantId = tenantStore.currentTenant?.id;
    if (tenantId) {
      try {
        await (supabase.from('rental_contracts') as any).insert([
          {
            tenant_id: tenantId,
            reservation_id: created.id,
            contract_number: d.contractNumber || null,
            contract_data: JSON.parse(JSON.stringify(d)),
            updated_at: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        console.warn('Could not persist contract data for new reservation:', e);
      }
    }

    saveAsReservationSuccess.value = {
      id: created.id,
      reservation_number: created.reservation_number || `#${created.id}`,
    };
  } catch (e: any) {
    saveAsReservationError.value = e?.message || "Erreur lors de la création de la réservation.";
  } finally {
    saveAsReservationLoading.value = false;
  }
}

function goToCreatedReservation() {
  if (!saveAsReservationSuccess.value) return;
  const tenantSlug = tenantStore.currentTenant?.slug;
  if (!tenantSlug) return;
  router.push({
    name: 'admin.reservations.show',
    params: { tenantSlug, id: saveAsReservationSuccess.value.id },
  });
}

// ──────────────────────────────────────────────────────────────────
// Faithful-client autocomplete for the Locataire (V1) /
// Premier conducteur (V2) section. Typing in Nom or Prénom triggers
// a fuzzy search; picking a result auto-fills every Locataire field.
// ──────────────────────────────────────────────────────────────────
const { searchFaithfulClients, isFaithfulClientCinRegistered, createFaithfulClient } = useFaithfulClients();
const locataireSuggestions = ref<FaithfulClient[]>([]);
const showLocataireSuggestions = ref(false);
const isSearchingLocataire = ref(false);
// Which field triggered the current suggestion list — controls which input
// the dropdown is anchored under (Nom/Prénom block vs CIN block).
const locataireAutocompleteAnchor = ref<'name' | 'ci' | null>(null);

async function handleLocataireNameInput() {
  const query = `${contractData.value.locataire.prenom || ''} ${contractData.value.locataire.nom || ''}`.trim();
  if (!query || query.length < 2) {
    locataireSuggestions.value = [];
    showLocataireSuggestions.value = false;
    return;
  }
  isSearchingLocataire.value = true;
  try {
    const results = await searchFaithfulClients(query);
    locataireSuggestions.value = results;
    showLocataireSuggestions.value = results.length > 0;
    locataireAutocompleteAnchor.value = 'name';
  } catch (e) {
    console.error('Faithful client search failed:', e);
  } finally {
    isSearchingLocataire.value = false;
  }
}

async function handleLocataireCinInput() {
  const query = (contractData.value.locataire.ci || '').trim();
  if (!query || query.length < 2) {
    locataireSuggestions.value = [];
    showLocataireSuggestions.value = false;
    return;
  }
  isSearchingLocataire.value = true;
  try {
    const results = await searchFaithfulClients(query);
    locataireSuggestions.value = results;
    showLocataireSuggestions.value = results.length > 0;
    locataireAutocompleteAnchor.value = 'ci';
  } catch (e) {
    console.error('Faithful client search by CIN failed:', e);
  } finally {
    isSearchingLocataire.value = false;
  }
}

function closeLocataireSuggestionsWithDelay() {
  setTimeout(() => {
    showLocataireSuggestions.value = false;
  }, 200);
}

/**
 * Split a FaithfulClient into the contract's nom / prenom / dob slots, with
 * a fallback to naively splitting full_name for legacy rows that only have
 * full_name set. Reused by both Locataire and Conducteur autocompletes.
 */
function splitFaithfulClient(client: FaithfulClient) {
  let nom = client.last_name || '';
  let prenom = client.first_name || '';
  if (!nom && !prenom && client.full_name) {
    const parts = client.full_name.trim().split(/\s+/);
    prenom = parts[0] || '';
    nom = parts.slice(1).join(' ');
  }

  // Convert ISO date (YYYY-MM-DD) to JJ/MM/AAAA used everywhere on the contract.
  let dob = '';
  if (client.date_of_birth) {
    const d = new Date(client.date_of_birth);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      dob = `${dd}/${mm}/${yyyy}`;
    }
  }

  return { nom, prenom, dob };
}

// ──────────────────────────────────────────────────────────────────
// "Save as Client Fidèle?" proposal — triggered on click of
// "Sauvegarder comme réservation" in blank mode, NOT on typing.
// Captures every Locataire field the admin filled in so the new
// faithful client is as complete as possible.
// ──────────────────────────────────────────────────────────────────
interface SuggestRegisterPayload {
  nom: string;
  prenom: string;
  cin: string;
  cin_date?: string;
  permit_number?: string;
  permit_date?: string;
  address?: string;
  phone?: string;
  email?: string;
  /** ISO YYYY-MM-DD parsed from the locataire's dob field. */
  date_of_birth?: string;
}

const showSuggestRegisterModal = ref(false);
const suggestRegisterPayload = ref<SuggestRegisterPayload | null>(null);
const suggestRegisterLoading = ref(false);
const suggestRegisterError = ref<string | null>(null);
const suggestRegisterSuccess = ref<string | null>(null);
// CINs the admin already dismissed for this session, so the modal
// doesn't pop up again for them.
const suggestRegisterDismissedCins = ref<Set<string>>(new Set());
// CINs for which we already detected an existing client → skip the
// re-query on subsequent clicks of the same flow.
const suggestRegisterKnownCins = ref<Set<string>>(new Set());
// Action to run once the propose-register modal is dismissed/confirmed.
// Used to chain back into "Sauvegarder comme réservation".
let pendingActionAfterRegister: (() => void) | null = null;

/** Try to extract an ISO date (YYYY-MM-DD) from the locataire's free-text dob. */
function extractIsoDob(dob: string): string | undefined {
  if (!dob) return undefined;
  const m = dob.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function buildSuggestPayloadFromContract(): SuggestRegisterPayload | null {
  const d = contractData.value.locataire;
  const nom = (d.nom || '').trim();
  const prenom = (d.prenom || '').trim();
  const cin = (d.ci || '').trim();
  if (!nom || !prenom || !cin || cin.length < 4) return null;

  return {
    nom,
    prenom,
    cin,
    cin_date: (d.ciDate || '').trim() || undefined,
    permit_number: (d.permis || '').trim() || undefined,
    permit_date: (d.permisDate || '').trim() || undefined,
    address: (d.adresse || '').trim() || undefined,
    phone: (d.telephone || '').trim() || undefined,
    date_of_birth: extractIsoDob(d.dob || ''),
  };
}

function dismissSuggestRegister() {
  if (suggestRegisterPayload.value) {
    suggestRegisterDismissedCins.value.add(suggestRegisterPayload.value.cin);
  }
  showSuggestRegisterModal.value = false;
  suggestRegisterError.value = null;
  // Continue to whatever flow the admin started (save-as-reservation, etc.)
  const next = pendingActionAfterRegister;
  pendingActionAfterRegister = null;
  if (next) next();
}

async function confirmSuggestRegister() {
  if (!suggestRegisterPayload.value || suggestRegisterLoading.value) return;
  suggestRegisterLoading.value = true;
  suggestRegisterError.value = null;

  const p = suggestRegisterPayload.value;
  const fullName = `${p.prenom} ${p.nom}`.trim();

  try {
    await createFaithfulClient({
      full_name: fullName,
      first_name: p.prenom,
      last_name: p.nom,
      cin: p.cin,
      cin_date: p.cin_date,
      permit_number: p.permit_number,
      permit_date: p.permit_date,
      address: p.address,
      phone: p.phone,
      email: p.email,
      date_of_birth: p.date_of_birth,
    });
    suggestRegisterKnownCins.value.add(p.cin);
    suggestRegisterSuccess.value = fullName;
    // Auto-close + continue the pending action after a brief success state.
    setTimeout(() => {
      showSuggestRegisterModal.value = false;
      suggestRegisterSuccess.value = null;
      const next = pendingActionAfterRegister;
      pendingActionAfterRegister = null;
      if (next) next();
    }, 1400);
  } catch (e: any) {
    suggestRegisterError.value = e?.message || "Erreur lors de l'enregistrement du client fidèle.";
  } finally {
    suggestRegisterLoading.value = false;
  }
}

function selectLocataireClient(client: FaithfulClient) {
  const { nom, prenom, dob } = splitFaithfulClient(client);

  contractData.value.locataire.nom = nom;
  contractData.value.locataire.prenom = prenom;
  contractData.value.locataire.dob = dob;
  contractData.value.locataire.ci = client.cin || '';
  contractData.value.locataire.ciDate = client.cin_date || '';
  contractData.value.locataire.adresse = client.address || '';
  contractData.value.locataire.telephone = client.phone || '';
  contractData.value.locataire.permis = client.permit_number || '';
  contractData.value.locataire.permisDate = client.permit_date || '';

  // V2 has a dedicated Locataire (renter) section — admin asked for Nom/Prénom only there.
  if (contractData.value.v2?.renter) {
    contractData.value.v2.renter.nom = nom;
    contractData.value.v2.renter.prenom = prenom;
  }

  showLocataireSuggestions.value = false;
  locataireSuggestions.value = [];
  locataireAutocompleteAnchor.value = null;
}

// ──────────────────────────────────────────────────────────────────
// Conducteur (السائق الثاني) — same Clients Fidèles autocomplete as
// Locataire/Premier conducteur, but bound to the second-driver fields.
// ──────────────────────────────────────────────────────────────────
const conducteurSuggestions = ref<FaithfulClient[]>([]);
const showConducteurSuggestions = ref(false);
const isSearchingConducteur = ref(false);
const conducteurAutocompleteAnchor = ref<'name' | 'ci' | null>(null);

async function handleConducteurNameInput() {
  const query = `${contractData.value.conducteur.prenom || ''} ${contractData.value.conducteur.nom || ''}`.trim();
  if (!query || query.length < 2) {
    conducteurSuggestions.value = [];
    showConducteurSuggestions.value = false;
    return;
  }
  isSearchingConducteur.value = true;
  try {
    const results = await searchFaithfulClients(query);
    conducteurSuggestions.value = results;
    showConducteurSuggestions.value = results.length > 0;
    conducteurAutocompleteAnchor.value = 'name';
  } catch (e) {
    console.error('Faithful client search failed (conducteur):', e);
  } finally {
    isSearchingConducteur.value = false;
  }
}

async function handleConducteurCinInput() {
  const query = (contractData.value.conducteur.ci || '').trim();
  if (!query || query.length < 2) {
    conducteurSuggestions.value = [];
    showConducteurSuggestions.value = false;
    return;
  }
  isSearchingConducteur.value = true;
  try {
    const results = await searchFaithfulClients(query);
    conducteurSuggestions.value = results;
    showConducteurSuggestions.value = results.length > 0;
    conducteurAutocompleteAnchor.value = 'ci';
  } catch (e) {
    console.error('Faithful client search by CIN failed (conducteur):', e);
  } finally {
    isSearchingConducteur.value = false;
  }
}

function closeConducteurSuggestionsWithDelay() {
  setTimeout(() => {
    showConducteurSuggestions.value = false;
  }, 200);
}

function selectConducteurClient(client: FaithfulClient) {
  const { nom, prenom, dob } = splitFaithfulClient(client);

  contractData.value.conducteur.nom = nom;
  contractData.value.conducteur.prenom = prenom;
  contractData.value.conducteur.dob = dob;
  contractData.value.conducteur.ci = client.cin || '';
  contractData.value.conducteur.ciDate = client.cin_date || '';
  contractData.value.conducteur.adresse = client.address || '';
  contractData.value.conducteur.telephone = client.phone || '';
  contractData.value.conducteur.permis = client.permit_number || '';
  contractData.value.conducteur.permisDate = client.permit_date || '';

  showConducteurSuggestions.value = false;
  conducteurSuggestions.value = [];
  conducteurAutocompleteAnchor.value = null;
}

// Active contract template — driven by tenant.contract_template
const contractTemplate = computed<'default' | 'v2'>(() => {
  const t = (tenantStore.currentTenant as any)?.contract_template;
  return t === 'v2' ? 'v2' : 'default';
});

// Blank mode: opened from /admin/contracts/blank, no reservation attached.
// The form starts empty (only company info pre-filled) so the user can fill
// it in by hand and download a one-off contract PDF.
const isBlankMode = computed(() => !route.params.id);

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

// Blank-mode loader: pre-populates only the company block (logo, address,
// MF, GSM, email, RIB) so the user sees a branded but otherwise empty form
// that they can fill in and export.
async function loadBlankContract() {
  loading.value = true;
  try {
    await loadInvoiceSettings();
    const tenant = tenantStore.currentTenant;
    if (!tenant) return;

    let logoUrl: string | null = tenant.logo_url || null;
    if (logoUrl) {
      try { logoUrl = await toDataUrl(logoUrl); } catch { /* keep original */ }
    }

    const s = companySettings.value;
    contractData.value.company = {
      name: tenant.name || '',
      logoUrl,
      gsm: s.gsm || '',
      email: s.email || '',
      mf: s.mf || '',
      rib: s.rib || '',
      address: s.address || '',
    };
    contractData.value.rc = s.mf || '';
    contractData.value.contractDate = fmtDateForContract(new Date().toISOString());
    contractData.value.signature.date = fmtDateForContract(new Date().toISOString());
  } catch (e) {
    console.error('Error initializing blank contract', e);
  } finally {
    loading.value = false;
  }
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

    // Sync the fleet picker so the dropdown reflects the reservation's car.
    selectedFleetCarId.value = reservation.car_id ?? reservation.car?.id ?? null;

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
        locationType: 'Location',
        preparedBy: '',
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
          adresse: reservation.client_address || '',
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
          adresse: reservation.second_driver_address || '',
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

    try {
      // @ts-ignore
      if (document.fonts?.ready) await document.fonts.ready;
    } catch { /* ignore */ }

    const wrapperEl = templateMountRef.value?.querySelector('#contract-template') as HTMLElement | null;
    if (!wrapperEl) throw new Error('Template element not found');

    const pages = wrapperEl.querySelectorAll('.ct-paper');
    if (pages.length === 0) throw new Error('No pages found');

    const filename = `Contrat_${contractData.value.contractNumber || 'draft'}.pdf`;
    // Higher pixelRatio = sharper PDF text. 3x is a good balance of size vs
    // sharpness for A4 contracts.
    const pixelRatio = 3;
    let pdf: InstanceType<typeof jsPDF> | null = null;

    for (let i = 0; i < pages.length; i++) {
      const { clone, cleanup } = createExportClone(pages[i] as HTMLElement);
      cleanups.push(cleanup);

      // Give the browser a tick to lay out and paint the cloned subtree
      // (especially important for the Arabic shaping pass).
      await new Promise((r) => setTimeout(r, 200));

      const w = Math.ceil(clone.scrollWidth);
      const h = Math.ceil(clone.scrollHeight);

      // html-to-image renders the DOM through SVG <foreignObject>, so the
      // browser itself performs text layout — including Arabic letter
      // shaping (ligatures, kerning, RTL flow). The output is a PNG data URL.
      const dataUrl = await htmlToImage.toPng(clone, {
        pixelRatio,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: w,
        height: h,
        style: {
          margin: '0',
          background: '#ffffff',
        },
      });

      if (i === 0) {
        pdf = new jsPDF({
          unit: 'px',
          format: [w, h],
          orientation: w > h ? 'landscape' : 'portrait',
          compress: true,
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
      } else if (pdf) {
        pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
        pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
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

onMounted(async () => {
  // Always preload the fleet so the Véhicule picker is populated whether the
  // page opens in blank mode or from an existing reservation.
  fetchCars().catch((e) => console.error('fetchCars failed for contract builder:', e));

  if (route.params.id) {
    await loadReservation(route.params.id as string);
  } else {
    await loadBlankContract();
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
            <p class="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              {{ isBlankMode ? 'Contrat vierge' : 'Contrat de location' }}
            </p>
            <h1 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              Contract Builder
              <span
                v-if="contractTemplate === 'v2'"
                class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700"
              >
                Template V2
              </span>
              <span
                v-if="isBlankMode"
                class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700"
              >
                Vierge
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

          <!-- Save (hidden in blank mode — no reservation to attach to) -->
          <button
            v-if="!isBlankMode"
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

          <!-- Save as Reservation (blank mode only) -->
          <button
            v-if="isBlankMode"
            @click="openSaveAsReservationModal"
            :disabled="loading"
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            title="Créer une réservation à partir de ce contrat"
          >
            <CalendarPlus class="h-4 w-4" />
            <span class="hidden sm:inline">Sauvegarder comme réservation</span>
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
            <div class="sb-row-2">
              <div class="sb-field">
                <label>Type de location</label>
                <select v-model="contractData.locationType">
                  <option value="Location">Location</option>
                  <option value="Transfert">Transfert</option>
                  <option value="Excursion">Excursion</option>
                </select>
              </div>
              <div class="sb-field">
                <label>Contrat préparé par</label>
                <input v-model="contractData.preparedBy" placeholder="Nom de l'agent" />
              </div>
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
            <p class="sb-hint sb-hint-accent">
              <Search class="w-3 h-3" />
              Tapez un nom, prénom <strong>ou CIN</strong> pour rechercher dans vos Clients Fidèles et auto-remplir tous les champs.
            </p>
            <div class="sb-autocomplete-wrap">
              <div class="sb-field">
                <label>Nom (الاسم)</label>
                <input
                  v-model="contractData.locataire.nom"
                  @input="handleLocataireNameInput"
                  @focus="handleLocataireNameInput"
                  @blur="closeLocataireSuggestionsWithDelay"
                  autocomplete="off"
                />
              </div>
              <div class="sb-field">
                <label>Prénom (اللقب)</label>
                <input
                  v-model="contractData.locataire.prenom"
                  @input="handleLocataireNameInput"
                  @focus="handleLocataireNameInput"
                  @blur="closeLocataireSuggestionsWithDelay"
                  autocomplete="off"
                />
              </div>

              <div v-if="showLocataireSuggestions && locataireAutocompleteAnchor === 'name'" class="sb-suggestions">
                <button
                  v-for="client in locataireSuggestions"
                  :key="client.id"
                  type="button"
                  class="sb-suggestion-item"
                  @mousedown.prevent="selectLocataireClient(client)"
                >
                  <div class="sb-sug-avatar">{{ client.full_name.charAt(0).toUpperCase() }}</div>
                  <div class="sb-sug-info">
                    <div class="sb-sug-name">{{ client.full_name }}</div>
                    <div class="sb-sug-meta">
                      <span class="sb-sug-cin">{{ client.cin }}</span>
                      <span v-if="client.phone">· {{ client.phone }}</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div class="sb-field"><label>Date et Lieu de Naissance</label><input v-model="contractData.locataire.dob" placeholder="JJ/MM/AAAA — Lieu" /></div>
            <div class="sb-autocomplete-wrap">
              <div class="sb-field">
                <label>N° CI ou Passeport</label>
                <input
                  v-model="contractData.locataire.ci"
                  @input="handleLocataireCinInput"
                  @focus="handleLocataireCinInput"
                  @blur="closeLocataireSuggestionsWithDelay"
                  autocomplete="off"
                />
              </div>

              <div v-if="showLocataireSuggestions && locataireAutocompleteAnchor === 'ci'" class="sb-suggestions">
                <button
                  v-for="client in locataireSuggestions"
                  :key="client.id"
                  type="button"
                  class="sb-suggestion-item"
                  @mousedown.prevent="selectLocataireClient(client)"
                >
                  <div class="sb-sug-avatar">{{ client.full_name.charAt(0).toUpperCase() }}</div>
                  <div class="sb-sug-info">
                    <div class="sb-sug-name">{{ client.full_name }}</div>
                    <div class="sb-sug-meta">
                      <span class="sb-sug-cin">{{ client.cin }}</span>
                      <span v-if="client.phone">· {{ client.phone }}</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
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
            <p class="sb-hint sb-hint-accent">
              <Search class="w-3 h-3" />
              Tapez un nom, prénom <strong>ou CIN</strong> pour rechercher dans vos Clients Fidèles et auto-remplir tous les champs.
            </p>
            <div class="sb-autocomplete-wrap">
              <div class="sb-field">
                <label>Nom</label>
                <input
                  v-model="contractData.conducteur.nom"
                  @input="handleConducteurNameInput"
                  @focus="handleConducteurNameInput"
                  @blur="closeConducteurSuggestionsWithDelay"
                  autocomplete="off"
                />
              </div>
              <div class="sb-field">
                <label>Prénom</label>
                <input
                  v-model="contractData.conducteur.prenom"
                  @input="handleConducteurNameInput"
                  @focus="handleConducteurNameInput"
                  @blur="closeConducteurSuggestionsWithDelay"
                  autocomplete="off"
                />
              </div>

              <div v-if="showConducteurSuggestions && conducteurAutocompleteAnchor === 'name'" class="sb-suggestions">
                <button
                  v-for="client in conducteurSuggestions"
                  :key="client.id"
                  type="button"
                  class="sb-suggestion-item"
                  @mousedown.prevent="selectConducteurClient(client)"
                >
                  <div class="sb-sug-avatar">{{ client.full_name.charAt(0).toUpperCase() }}</div>
                  <div class="sb-sug-info">
                    <div class="sb-sug-name">{{ client.full_name }}</div>
                    <div class="sb-sug-meta">
                      <span class="sb-sug-cin">{{ client.cin }}</span>
                      <span v-if="client.phone">· {{ client.phone }}</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div class="sb-field"><label>Date et Lieu de Naissance</label><input v-model="contractData.conducteur.dob" placeholder="JJ/MM/AAAA — Lieu" /></div>
            <div class="sb-autocomplete-wrap">
              <div class="sb-field">
                <label>N° CI ou Passeport</label>
                <input
                  v-model="contractData.conducteur.ci"
                  @input="handleConducteurCinInput"
                  @focus="handleConducteurCinInput"
                  @blur="closeConducteurSuggestionsWithDelay"
                  autocomplete="off"
                />
              </div>

              <div v-if="showConducteurSuggestions && conducteurAutocompleteAnchor === 'ci'" class="sb-suggestions">
                <button
                  v-for="client in conducteurSuggestions"
                  :key="client.id"
                  type="button"
                  class="sb-suggestion-item"
                  @mousedown.prevent="selectConducteurClient(client)"
                >
                  <div class="sb-sug-avatar">{{ client.full_name.charAt(0).toUpperCase() }}</div>
                  <div class="sb-sug-info">
                    <div class="sb-sug-name">{{ client.full_name }}</div>
                    <div class="sb-sug-meta">
                      <span class="sb-sug-cin">{{ client.cin }}</span>
                      <span v-if="client.phone">· {{ client.phone }}</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
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
            <div class="sb-field">
              <label class="sb-label-flex">
                <Sparkles class="w-3 h-3 text-indigo-500" />
                Sélectionner depuis la flotte
              </label>
              <select
                :value="selectedFleetCarId ?? ''"
                @change="onFleetCarSelected(($event.target as HTMLSelectElement).value)"
              >
                <option value="">— Saisie manuelle —</option>
                <option v-for="car in cars" :key="car.id" :value="car.id">
                  {{ car.brand }} {{ car.model }} — {{ car.plate_number }}<template v-if="car.status === 'loue'"> · Loué</template><template v-else-if="car.status === 'maintenance'"> · Maintenance</template>
                </option>
              </select>
              <p class="sb-hint">Pré-remplit Marque/Modèle et N° Immatriculation. Vous pouvez ensuite ajuster manuellement.</p>
            </div>
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
              <div class="sb-field"><label>Départ — Date</label><input v-model="periodeDepartDateInput" type="date" /></div>
              <div class="sb-field"><label>Départ — Heure</label><input v-model="contractData.periode.departHeure" type="time" /></div>
            </div>
            <div class="sb-row-2">
              <div class="sb-field"><label>Retour prévu — Date</label><input v-model="periodeRetourDateInput" type="date" /></div>
              <div class="sb-field"><label>Retour prévu — Heure</label><input v-model="contractData.periode.retourHeure" type="time" /></div>
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
              <select v-model="contractData.paiement.mode"><option value="">—</option><option value="cheque">Chèque</option><option value="carte">Carte de Crédit</option><option value="especes">Espèces</option><option value="virement">Virement</option></select>
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

    <!-- "Save as Client Fidèle?" proposal modal -->
    <Teleport to="body">
      <Transition name="cb-modal">
        <div v-if="showSuggestRegisterModal" class="cb-modal-root">
          <div class="cb-modal-backdrop" @click="dismissSuggestRegister"></div>
          <div class="cb-modal-card cb-modal-card--narrow">
            <header class="cb-modal-header">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                  <BookmarkPlus class="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">
                    {{ suggestRegisterSuccess ? 'Ajouté à vos Clients Fidèles' : 'Nouveau client détecté' }}
                  </h3>
                  <p class="text-xs text-slate-500">
                    {{ suggestRegisterSuccess
                      ? 'Ce client est désormais disponible en autocomplétion.'
                      : "Ce CIN n'existe pas encore dans vos Clients Fidèles." }}
                  </p>
                </div>
              </div>
              <button @click="dismissSuggestRegister" class="cb-modal-close" :disabled="suggestRegisterLoading">
                <X class="h-4 w-4" />
              </button>
            </header>

            <div class="cb-modal-body">
              <template v-if="suggestRegisterSuccess">
                <div class="cb-success">
                  <div class="cb-success-icon">
                    <Check class="h-6 w-6" />
                  </div>
                  <div class="cb-success-text">
                    <p class="text-sm font-semibold text-slate-900">
                      <span class="cb-res-number">{{ suggestRegisterSuccess }}</span>
                      est enregistré
                    </p>
                    <p class="text-xs text-slate-500 mt-1">
                      Vous le retrouverez en autocomplétion dans le contrat, la réservation et la facture.
                    </p>
                  </div>
                </div>
              </template>

              <template v-else>
                <p class="text-sm text-slate-600 leading-relaxed">
                  Souhaitez-vous l'enregistrer dans <strong>Clients Fidèles</strong> ?
                  Tous les champs déjà saisis pour le locataire seront sauvegardés.
                </p>

                <div class="cb-preview-grid mt-3">
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">Nom</div>
                    <div class="cb-preview-value font-semibold text-slate-900">{{ suggestRegisterPayload?.nom }}</div>
                  </div>
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">Prénom</div>
                    <div class="cb-preview-value font-semibold text-slate-900">{{ suggestRegisterPayload?.prenom }}</div>
                  </div>
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">CIN</div>
                    <div class="cb-preview-value font-mono text-sm tracking-wide text-slate-700">{{ suggestRegisterPayload?.cin }}</div>
                  </div>
                  <div v-if="suggestRegisterPayload?.cin_date" class="cb-preview-row">
                    <div class="cb-preview-label">Délivrance CIN</div>
                    <div class="cb-preview-value text-sm text-slate-700">{{ suggestRegisterPayload.cin_date }}</div>
                  </div>
                  <div v-if="suggestRegisterPayload?.permit_number" class="cb-preview-row">
                    <div class="cb-preview-label">N° Permis</div>
                    <div class="cb-preview-value font-mono text-sm text-slate-700">{{ suggestRegisterPayload.permit_number }}</div>
                  </div>
                  <div v-if="suggestRegisterPayload?.permit_date" class="cb-preview-row">
                    <div class="cb-preview-label">Délivrance Permis</div>
                    <div class="cb-preview-value text-sm text-slate-700">{{ suggestRegisterPayload.permit_date }}</div>
                  </div>
                  <div v-if="suggestRegisterPayload?.date_of_birth" class="cb-preview-row">
                    <div class="cb-preview-label">Date de naissance</div>
                    <div class="cb-preview-value text-sm text-slate-700">{{ suggestRegisterPayload.date_of_birth }}</div>
                  </div>
                  <div v-if="suggestRegisterPayload?.address" class="cb-preview-row">
                    <div class="cb-preview-label">Adresse</div>
                    <div class="cb-preview-value text-sm text-slate-700 truncate" :title="suggestRegisterPayload.address">{{ suggestRegisterPayload.address }}</div>
                  </div>
                  <div v-if="suggestRegisterPayload?.phone" class="cb-preview-row">
                    <div class="cb-preview-label">Téléphone</div>
                    <div class="cb-preview-value text-sm text-slate-700">{{ suggestRegisterPayload.phone }}</div>
                  </div>
                </div>

                <div v-if="suggestRegisterError" class="cb-error-banner">
                  <AlertCircle class="w-4 h-4 text-red-500 shrink-0" />
                  <span>{{ suggestRegisterError }}</span>
                </div>
              </template>
            </div>

            <footer class="cb-modal-footer">
              <template v-if="suggestRegisterSuccess">
                <button @click="dismissSuggestRegister" class="cb-btn cb-btn-primary">
                  <Check class="h-4 w-4" />
                  C'est noté
                </button>
              </template>
              <template v-else>
                <button @click="dismissSuggestRegister" :disabled="suggestRegisterLoading" class="cb-btn cb-btn-ghost">
                  Plus tard
                </button>
                <button
                  @click="confirmSuggestRegister"
                  :disabled="suggestRegisterLoading"
                  class="cb-btn cb-btn-primary"
                >
                  <Loader2 v-if="suggestRegisterLoading" class="h-4 w-4 animate-spin" />
                  <UserPlus v-else class="h-4 w-4" />
                  Enregistrer le client
                </button>
              </template>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Save-as-reservation confirmation modal -->
    <Teleport to="body">
      <Transition name="cb-modal">
        <div v-if="showSaveAsReservationModal" class="cb-modal-root">
          <div class="cb-modal-backdrop" @click="closeSaveAsReservationModal"></div>
          <div class="cb-modal-card">
            <header class="cb-modal-header">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200">
                  <CalendarPlus class="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900">
                    {{ saveAsReservationSuccess ? 'Réservation créée' : 'Sauvegarder comme réservation' }}
                  </h3>
                  <p class="text-xs text-slate-500">
                    {{ saveAsReservationSuccess
                      ? 'La réservation a été créée à partir de ce contrat.'
                      : 'Confirmez pour transformer ce contrat en réservation.' }}
                  </p>
                </div>
              </div>
              <button @click="closeSaveAsReservationModal" class="cb-modal-close" :disabled="saveAsReservationLoading">
                <X class="h-4 w-4" />
              </button>
            </header>

            <div class="cb-modal-body">
              <!-- Success state -->
              <template v-if="saveAsReservationSuccess">
                <div class="cb-success">
                  <div class="cb-success-icon">
                    <Check class="h-6 w-6" />
                  </div>
                  <div class="cb-success-text">
                    <p class="text-sm font-semibold text-slate-900">
                      Réservation
                      <span class="cb-res-number">{{ saveAsReservationSuccess.reservation_number }}</span>
                    </p>
                    <p class="text-xs text-slate-500 mt-1">
                      Les données du contrat ont été reportées dans la nouvelle réservation. Le contrat est lié et accessible depuis la fiche de réservation.
                    </p>
                  </div>
                </div>
              </template>

              <!-- Validation errors -->
              <template v-else-if="reservationValidationErrors.length > 0">
                <p class="text-xs text-slate-500 mb-3">
                  Pour créer la réservation, complétez d'abord les informations suivantes :
                </p>
                <ul class="cb-error-list">
                  <li v-for="(err, idx) in reservationValidationErrors" :key="idx">
                    <AlertCircle class="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{{ err }}</span>
                  </li>
                </ul>
              </template>

              <!-- Preview state -->
              <template v-else>
                <div class="cb-preview-grid">
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">Locataire</div>
                    <div class="cb-preview-value">
                      <div class="font-semibold text-slate-900">{{ reservationPreview.clientName }}</div>
                      <div class="text-[11px] text-slate-500 font-mono">{{ reservationPreview.clientCin }}<span v-if="reservationPreview.clientPhone"> · {{ reservationPreview.clientPhone }}</span></div>
                    </div>
                  </div>
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">Véhicule</div>
                    <div class="cb-preview-value">
                      <div class="font-semibold text-slate-900">{{ reservationPreview.car?.brand }} {{ reservationPreview.car?.model }}</div>
                      <div class="text-[11px] text-slate-500 font-mono">{{ reservationPreview.car?.plate }}</div>
                    </div>
                  </div>
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">Période</div>
                    <div class="cb-preview-value">
                      <div class="text-sm text-slate-700">{{ contractData.periode.departDate }} {{ contractData.periode.departHeure }}</div>
                      <div class="text-sm text-slate-700">→ {{ contractData.periode.retourDate }} {{ contractData.periode.retourHeure }}</div>
                      <div class="text-[11px] text-slate-500 mt-0.5">{{ reservationPreview.durationDays }} jour{{ reservationPreview.durationDays > 1 ? 's' : '' }}</div>
                    </div>
                  </div>
                  <div class="cb-preview-row">
                    <div class="cb-preview-label">Total</div>
                    <div class="cb-preview-value">
                      <div class="font-semibold text-slate-900">{{ reservationPreview.totalPrice.toFixed(3) }} DT</div>
                      <div v-if="reservationPreview.advancePayment > 0" class="text-[11px] text-slate-500">
                        Avance : {{ reservationPreview.advancePayment.toFixed(3) }} DT
                      </div>
                    </div>
                  </div>
                  <div v-if="reservationPreview.contractNumber" class="cb-preview-row">
                    <div class="cb-preview-label">Contrat N°</div>
                    <div class="cb-preview-value font-mono text-sm text-slate-700">{{ reservationPreview.contractNumber }}</div>
                  </div>
                  <div v-if="reservationPreview.secondDriverName" class="cb-preview-row">
                    <div class="cb-preview-label">2ᵉ conducteur</div>
                    <div class="cb-preview-value">
                      <div class="text-sm font-medium text-slate-700">{{ reservationPreview.secondDriverName }}</div>
                      <div v-if="reservationPreview.secondDriverCin" class="text-[11px] text-slate-500 font-mono">{{ reservationPreview.secondDriverCin }}</div>
                    </div>
                  </div>
                </div>

                <div class="cb-notice">
                  <Sparkles class="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>
                    La voiture sera marquée <strong>louée</strong> si la période couvre maintenant.
                    Le contrat sera également lié à la réservation et restera accessible depuis sa fiche.
                  </span>
                </div>

                <div v-if="saveAsReservationError" class="cb-error-banner">
                  <AlertCircle class="w-4 h-4 text-red-500 shrink-0" />
                  <span>{{ saveAsReservationError }}</span>
                </div>
              </template>
            </div>

            <footer class="cb-modal-footer">
              <template v-if="saveAsReservationSuccess">
                <button @click="closeSaveAsReservationModal" class="cb-btn cb-btn-ghost">Fermer</button>
                <button @click="goToCreatedReservation" class="cb-btn cb-btn-primary">
                  <ExternalLink class="h-4 w-4" />
                  Voir la réservation
                </button>
              </template>
              <template v-else>
                <button @click="closeSaveAsReservationModal" :disabled="saveAsReservationLoading" class="cb-btn cb-btn-ghost">
                  Annuler
                </button>
                <button
                  @click="confirmSaveAsReservation"
                  :disabled="!canSaveAsReservation || saveAsReservationLoading"
                  class="cb-btn cb-btn-confirm"
                >
                  <Loader2 v-if="saveAsReservationLoading" class="h-4 w-4 animate-spin" />
                  <Check v-else class="h-4 w-4" />
                  Confirmer & créer
                </button>
              </template>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
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

.sb-hint-accent {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.04));
  border: 1px dashed rgba(99, 102, 241, 0.25);
  color: #4f46e5;
  font-weight: 600;
  margin: 0;
}

.sb-label-flex {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ─── Faithful client autocomplete ──────────────────────────── */
.sb-autocomplete-wrap {
  position: relative;
  display: grid;
  gap: 10px;
}

.sb-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 6px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow:
    0 10px 28px -10px rgba(15, 23, 42, 0.18),
    0 4px 10px -6px rgba(15, 23, 42, 0.10);
  max-height: 280px;
  overflow-y: auto;
  z-index: 30;
}

.sb-suggestion-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  border-bottom: 1px solid #f1f5f9;
}
.sb-suggestion-item:last-child { border-bottom: none; }
.sb-suggestion-item:hover { background: #eef2ff; }

.sb-sug-avatar {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px -2px rgba(99, 102, 241, 0.45);
}

.sb-sug-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.sb-sug-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-sug-meta {
  font-size: 11px;
  color: #64748b;
  display: flex;
  gap: 6px;
  align-items: center;
}

.sb-sug-cin {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  padding: 1px 6px;
  background: #f1f5f9;
  border-radius: 6px;
  color: #475569;
  font-weight: 600;
}

/* ─── Save-as-reservation modal ──────────────────────────────── */
.cb-modal-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.cb-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
}

.cb-modal-card {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 1.25rem;
  box-shadow:
    0 30px 60px -20px rgba(15, 23, 42, 0.35),
    0 10px 30px -10px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.cb-modal-card--narrow {
  max-width: 460px;
}

.cb-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
}

.cb-modal-close {
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.cb-modal-close:hover { background: #f1f5f9; color: #475569; }
.cb-modal-close:disabled { opacity: 0.4; cursor: not-allowed; }

.cb-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.cb-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
}

.cb-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border-radius: 0.65rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
}
.cb-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.cb-btn-ghost {
  background: #f1f5f9;
  color: #475569;
}
.cb-btn-ghost:hover:not(:disabled) { background: #e2e8f0; }

.cb-btn-confirm {
  background: linear-gradient(180deg, #059669, #047857);
  color: white;
  box-shadow: 0 4px 10px -4px rgba(5, 150, 105, 0.4);
}
.cb-btn-confirm:hover:not(:disabled) {
  box-shadow: 0 6px 14px -4px rgba(5, 150, 105, 0.55);
  transform: translateY(-1px);
}

.cb-btn-primary {
  background: linear-gradient(180deg, #4f46e5, #4338ca);
  color: white;
  box-shadow: 0 4px 10px -4px rgba(79, 70, 229, 0.4);
}
.cb-btn-primary:hover:not(:disabled) {
  box-shadow: 0 6px 14px -4px rgba(79, 70, 229, 0.55);
  transform: translateY(-1px);
}

.cb-preview-grid {
  display: grid;
  gap: 0.6rem;
  margin-bottom: 0.85rem;
}

.cb-preview-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  align-items: start;
}

.cb-preview-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  padding-top: 2px;
}

.cb-preview-value {
  font-size: 13px;
  color: #1e293b;
  min-width: 0;
}

.cb-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.04));
  border: 1px dashed rgba(99, 102, 241, 0.25);
  border-radius: 0.75rem;
  color: #4338ca;
  font-size: 11.5px;
  line-height: 1.5;
}

.cb-error-list {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.75rem;
  list-style: none;
  margin: 0;
}
.cb-error-list li {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 12px;
  color: #991b1b;
  line-height: 1.4;
}

.cb-error-banner {
  margin-top: 0.85rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.75rem;
  color: #991b1b;
  font-size: 12px;
}

.cb-success {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02));
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.85rem;
}

.cb-success-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background: linear-gradient(180deg, #10b981, #059669);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px -4px rgba(16, 185, 129, 0.5);
}

.cb-success-text { min-width: 0; }

.cb-res-number {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  padding: 1px 8px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 0.4rem;
  color: #047857;
  margin-left: 0.4rem;
  font-weight: 700;
}

/* Modal enter/leave transition */
.cb-modal-enter-active,
.cb-modal-leave-active {
  transition: opacity 0.2s ease;
}
.cb-modal-enter-active .cb-modal-card,
.cb-modal-leave-active .cb-modal-card {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
}
.cb-modal-enter-from,
.cb-modal-leave-to {
  opacity: 0;
}
.cb-modal-enter-from .cb-modal-card {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
.cb-modal-leave-to .cb-modal-card {
  opacity: 0;
  transform: scale(0.97) translateY(6px);
}
</style>
