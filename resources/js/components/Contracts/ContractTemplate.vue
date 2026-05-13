<script setup lang="ts">
import { computed } from 'vue';
import ContractConditionsPage from '@/components/Contracts/ContractConditionsPage.vue';

export type ContractLocationType = 'Location' | 'Transfert' | 'Excursion' | '';

export interface ContractData {
  contractNumber: string;
  contractDate: string;
  /** Optional rental type ("Location" by default). Displayed as a 3-state pill row. */
  locationType?: ContractLocationType;
  /** Optional name of the agent who prepared the contract (printed near the signatures). */
  preparedBy?: string;
  rc: string;
  company: {
    name: string;
    logoUrl: string | null;
    gsm: string;
    email: string;
    mf: string;
    rib?: string;
    address?: string;
  };
  locataire: {
    nom: string;
    prenom: string;
    dob: string;
    ci: string;
    ciDate: string;
    nationalite: string;
    adresse: string;
    telephone: string;
    permis: string;
    permisDate: string;
  };
  conducteur: {
    nom: string;
    prenom: string;
    dob: string;
    ci: string;
    ciDate: string;
    nationalite: string;
    adresse: string;
    telephone: string;
    permis: string;
    permisDate: string;
  };
  vehicule: {
    marque: string;
    immatriculation: string;
    assPTrans: string;
    supFranch: string;
    fuelLevel: string;
    roueSecours: string;
    papierOriginaux: string;
  };
  periode: {
    departDate: string;
    departHeure: string;
    retourDate: string;
    retourHeure: string;
    kmDepart: string;
    kmRetour: string;
    kmParcouru: string;
  };
  caution: string;
  encaissement: {
    totalPartiel: number;
    carburant: string;
    divers: number;
  };
  paiement: {
    mode: string;
    numero: string;
    nature: string;
    date: string;
    montant: string;
  };
  prolongation: {
    du: string;
    au: string;
    changement: string;
    dateHoraire: string;
  };
  signature: {
    lieu: string;
    date: string;
  };
  pricingMode?: 'HT' | 'TTC';
  v2?: {
    renter?: {
      nom?: string;
      prenom?: string;
    };
    locataire?: {
      mf?: string;
      lieuDelivrance?: string;
      dateEntreeTunisie?: string;
      permisLieu?: string;
      motifSejour?: '' | 'Touriste' | 'Affaire' | 'Autres';
    };
    conducteur?: {
      mf?: string;
      lieuDelivrance?: string;
      dateEntreeTunisie?: string;
      permisLieu?: string;
      motifSejour?: '' | 'Touriste' | 'Affaire' | 'Autres';
    };
    periode?: {
      stationSortie?: string;
      stationRetour?: string;
      franchise?: string;
      prol1?: string;
      prol2?: string;
    };
    changement?: {
      modele?: string;
      immat?: string;
      date?: string;
    };
    reglement?: {
      cheque?: string;
      cCredit?: string;
      espece?: number;
      avance?: number;
    };
  };
}

const props = defineProps<{
  data: ContractData;
}>();

const billing = computed(() => {
  const mode = props.data.pricingMode || 'HT';
  const input = props.data.encaissement.totalPartiel || 0;
  const tvaRate = 0.19;
  const timbre = 1.0;
  const div = props.data.encaissement.divers || 0;

  let sub: number;
  let tva: number;
  let totalFacture: number;

  if (mode === 'TTC') {
    totalFacture = input;
    const exclStamp = Math.max(0, input - timbre);
    sub = exclStamp / (1 + tvaRate);
    tva = exclStamp - sub;
  } else {
    sub = input;
    tva = sub * tvaRate;
    totalFacture = sub + tva + timbre;
  }

  const total = totalFacture + div;
  return { sub, tva, timbre, div, total, totalFacture };
});

function fmt3(v: number): string {
  return v > 0 ? v.toFixed(3) : '';
}
</script>

<template>
  <div id="contract-template" class="ct-wrapper">
  <!-- ═══════ PAGE 1 — Contract Form ═══════ -->
  <div class="ct-paper">
    <div class="ct-inner">

      <!-- Header -->
      <div class="ct-hdr">
        <div class="ct-hdr-logo">
          <img v-if="data.company.logoUrl" :src="data.company.logoUrl" class="ct-logo-img" alt="Logo" />
          <template v-else>
            <div class="ct-logo-main">{{ data.company.name }}</div>
            <div class="ct-logo-sub">Rent a car</div>
          </template>
        </div>
        <div class="ct-hdr-center">
          GSM : {{ data.company.gsm || '—' }}<br>
          E-mail : {{ data.company.email || '—' }}<br>
          MF : {{ data.company.mf || '—' }}
        </div>
        <div class="ct-hdr-right">
          <div class="ct-logo-main-ar">{{ data.company.name }}</div>
          <div class="ct-logo-sub-ar">لكراء السيارات</div>
        </div>
      </div>

      <!-- Meta bar -->
      <div class="ct-meta-bar">
        <span>RC:{{ data.rc || '—' }}</span>
        <span class="ct-meta-mid">Date:{{ data.contractDate || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' }}</span>
        <span>M/F: {{ data.company.mf || '—' }}</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
        <span class="ct-contract-badge">عقد كراء &nbsp;&nbsp; N° {{ data.contractNumber || '______' }}</span>
      </div>

      <!-- Type de location / نوع الإيجار -->
      <div class="ct-loc-type-row">
        <span class="ct-loc-type-lbl">Type de location :</span>
        <span
          class="ct-loc-pill"
          :class="{ 'ct-loc-pill-on': (data.locationType || 'Location') === 'Location' }"
        >
          <span class="ct-loc-box">{{ (data.locationType || 'Location') === 'Location' ? '✓' : '' }}</span>
          Location
        </span>
        <span
          class="ct-loc-pill"
          :class="{ 'ct-loc-pill-on': data.locationType === 'Transfert' }"
        >
          <span class="ct-loc-box">{{ data.locationType === 'Transfert' ? '✓' : '' }}</span>
          Transfert
        </span>
        <span
          class="ct-loc-pill"
          :class="{ 'ct-loc-pill-on': data.locationType === 'Excursion' }"
        >
          <span class="ct-loc-box">{{ data.locationType === 'Excursion' ? '✓' : '' }}</span>
          Excursion
        </span>
        <span class="ct-loc-type-lbl-ar">: نوع الإيجار</span>
      </div>

      <!-- Main body grid -->
      <div class="ct-body-grid">
        <!-- Left column -->
        <div class="ct-left-col">
          <div class="ct-sec-hdr"><span>LOCATAIRE</span><span>السائق الأول</span></div>
          <div class="ct-sec-body">
            <div class="ct-frow"><span class="ct-flbl">Nom :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.nom }">{{ data.locataire.nom }}</span><span class="ct-flbl-ar">: الاسم</span><span class="ct-fline ct-ar" :class="{ 'ct-empty': !data.locataire.nom }">{{ data.locataire.nom }}</span></div>
            <div class="ct-frow"><span class="ct-flbl">Prénom :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.prenom }">{{ data.locataire.prenom }}</span><span class="ct-flbl-ar">: اللقب</span><span class="ct-fline ct-ar" :class="{ 'ct-empty': !data.locataire.prenom }">{{ data.locataire.prenom }}</span></div>
            <div class="ct-frow"><span class="ct-flbl" style="font-size:8px;">Date et Lieu de Naissance :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.dob }">{{ data.locataire.dob }}</span><span class="ct-flbl-ar" style="font-size:7.5px;">تاريخ الولادة ومكانها :</span></div>
            <div class="ct-frow" style="justify-content:flex-end;"><span class="ct-fline ct-ar" style="min-width:120px;">{{ data.locataire.dob }}</span></div>
            <div class="ct-frow"><span class="ct-flbl">N° CI ou Passeport :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.ci }">{{ data.locataire.ci }}</span><span class="ct-flbl-ar">عدد وثيقة الهوية :</span></div>
            <div class="ct-frow"><span class="ct-flbl">Date de délivrance :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.ciDate }">{{ data.locataire.ciDate }}</span><span class="ct-flbl-ar">: تاريخ الإصدار</span></div>
            <div class="ct-frow"><span class="ct-flbl">Nationalité :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.nationalite }">{{ data.locataire.nationalite }}</span><span class="ct-flbl-ar">: الجنسية</span><span class="ct-fline ct-ar" :class="{ 'ct-empty': !data.locataire.nationalite }">{{ data.locataire.nationalite }}</span></div>
            <div class="ct-frow"><span class="ct-flbl">Adresse :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.adresse }">{{ data.locataire.adresse }}</span><span class="ct-flbl-ar">: العنوان</span></div>
            <div class="ct-frow"><span class="ct-flbl">Téléphone :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.telephone }">{{ data.locataire.telephone }}</span><span class="ct-flbl-ar">: الهاتف</span></div>
            <div class="ct-frow"><span class="ct-flbl">N° Permis :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.permis }">{{ data.locataire.permis }}</span><span class="ct-flbl-ar">رقم رخصة السياقة :</span></div>
            <div class="ct-frow"><span class="ct-flbl">Délivré le :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.permisDate }">{{ data.locataire.permisDate }}</span><span class="ct-flbl-ar">مسلمة بتاريخ :</span></div>
          </div>

          <div class="ct-sec-hdr ct-conductor"><span>CONDUCTEUR</span><span>السائق الثاني</span></div>
          <div class="ct-sec-body">
            <div class="ct-frow"><span class="ct-flbl">Nom :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.nom }">{{ data.conducteur.nom }}</span><span class="ct-flbl-ar">: الاسم</span><span class="ct-fline ct-ar" :class="{ 'ct-empty': !data.conducteur.nom }">{{ data.conducteur.nom }}</span></div>
            <div class="ct-frow"><span class="ct-flbl">Prénom :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.prenom }">{{ data.conducteur.prenom }}</span><span class="ct-flbl-ar">: اللقب</span></div>
            <div class="ct-frow"><span class="ct-flbl" style="font-size:8px;">Date et Lieu de Naissance :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.dob }">{{ data.conducteur.dob }}</span><span class="ct-flbl-ar" style="font-size:7.5px;">تاريخ الولادة ومكانها :</span></div>
            <div class="ct-frow" style="justify-content:flex-end;"><span class="ct-fline ct-ar" style="min-width:120px;">{{ data.conducteur.dob }}</span></div>
            <div class="ct-frow"><span class="ct-flbl">N° CI ou Passeport :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.ci }">{{ data.conducteur.ci }}</span><span class="ct-flbl-ar">عدد وثيقة الهوية :</span></div>
            <div class="ct-frow"><span class="ct-flbl">Date de délivrance :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.ciDate }">{{ data.conducteur.ciDate }}</span><span class="ct-flbl-ar">: تاريخ الإصدار</span></div>
            <div class="ct-frow"><span class="ct-flbl">Nationalité :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.nationalite }">{{ data.conducteur.nationalite }}</span><span class="ct-flbl-ar">: الجنسية</span></div>
            <div class="ct-frow"><span class="ct-flbl">Adresse :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.adresse }">{{ data.conducteur.adresse }}</span><span class="ct-flbl-ar">: العنوان</span></div>
            <div class="ct-frow"><span class="ct-flbl">Téléphone :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.telephone }">{{ data.conducteur.telephone }}</span><span class="ct-flbl-ar">: الهاتف</span></div>
            <div class="ct-frow"><span class="ct-flbl">N° Permis :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.permis }">{{ data.conducteur.permis }}</span><span class="ct-flbl-ar">رقم رخصة السياقة :</span></div>
            <div class="ct-frow"><span class="ct-flbl">Délivré le :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.permisDate }">{{ data.conducteur.permisDate }}</span><span class="ct-flbl-ar">مسلمة بتاريخ :</span></div>
          </div>
        </div>

        <!-- Right column -->
        <div class="ct-right-col">
          <!-- Dates -->
          <div class="ct-dates-block">
            <div class="ct-date-cell">
              <div class="ct-date-cell-title"><span>RETOUR PRÉVU</span><span style="font-size:7.5px;">العودة المتوقعة</span></div>
              <div class="ct-date-inner">
                <span class="ct-date-lbl">HEURE<br>الساعة</span><span class="ct-fline">{{ data.periode.retourHeure }}</span>
                <span class="ct-date-lbl">DATE<br>التاريخ</span><span class="ct-fline">{{ data.periode.retourDate }}</span>
              </div>
            </div>
            <div class="ct-date-cell" style="border-right:none;">
              <div class="ct-date-cell-title"><span>DÉPART</span><span style="font-size:7.5px;">الإنطلاق</span></div>
              <div class="ct-date-inner">
                <span class="ct-date-lbl">HEURE<br>الساعة</span><span class="ct-fline">{{ data.periode.departHeure }}</span>
                <span class="ct-date-lbl">DATE<br>التاريخ</span><span class="ct-fline">{{ data.periode.departDate }}</span>
              </div>
            </div>
          </div>

          <!-- KM -->
          <div class="ct-km-block">
            <div class="ct-km-row"><span class="ct-km-lbl">Kilométrage de départ</span><span class="ct-km-val">{{ data.periode.kmDepart }}</span></div>
            <div class="ct-km-row"><span class="ct-km-lbl">Kilométrage de retour</span><span class="ct-km-val">{{ data.periode.kmRetour }}</span></div>
            <div class="ct-km-row"><span class="ct-km-lbl">Kilométrage parcouru</span><span class="ct-km-val">{{ data.periode.kmParcouru }}</span></div>
          </div>

          <!-- Caution -->
          <div class="ct-caution-block">
            <div class="ct-caution-title"><span>NATURE DE LA CAUTION:</span><span style="font-size:8px;">نوعية الضمان :</span></div>
            <div class="ct-caution-checks">
              <span class="ct-chk"><span class="ct-chk-box">{{ data.caution === 'carte' ? 'X' : '' }}</span> <span>Carte de crédit</span></span>
              <span class="ct-chk"><span class="ct-chk-box">{{ data.caution === 'especes' ? 'X' : '' }}</span> <span>Espèces</span></span>
              <span class="ct-chk"><span class="ct-chk-box">{{ data.caution === 'cheque' ? 'X' : '' }}</span> <span>Chèque</span></span>
            </div>
          </div>

          <!-- Encaissement -->
          <div class="ct-enc-block">
            <div class="ct-enc-title"><span>Encaissement</span><span>المقابيض</span></div>
            <div class="ct-enc-row"><span class="ct-enc-lbl">TOTAL PARTIEL</span><span class="ct-enc-val">{{ fmt3(billing.sub) }}</span></div>
            <div class="ct-enc-row"><span class="ct-enc-lbl">T.V.A. (Taux 19%)</span><span class="ct-enc-val">{{ fmt3(billing.tva) }}</span></div>
            <div class="ct-enc-row"><span class="ct-enc-lbl">TIMBRE</span><span class="ct-enc-val" style="color:#111;">1.000</span></div>
            <div class="ct-enc-row ct-enc-bold"><span class="ct-enc-lbl">TOTAL FACTURE</span><span class="ct-enc-val">{{ fmt3(billing.totalFacture) }}</span></div>
            <div class="ct-enc-row"><span class="ct-enc-lbl">CARBURANT</span><span class="ct-enc-val">{{ data.encaissement.carburant }}</span></div>
            <div class="ct-enc-row"><span class="ct-enc-lbl">FRANCHISE OU DIVERS</span><span class="ct-enc-val">{{ fmt3(billing.div) }}</span></div>
            <div class="ct-enc-row ct-enc-bold"><span class="ct-enc-lbl">TOTAL DÛ</span><span class="ct-enc-val">{{ fmt3(billing.total) }}</span></div>
          </div>

          <!-- Payment -->
          <div class="ct-pay-block">
            <div class="ct-pay-row">
              <span class="ct-chk"><span class="ct-chk-box">{{ data.paiement.mode === 'cheque' ? 'X' : '' }}</span> Payé par chèque</span>
              <span class="ct-chk"><span class="ct-chk-box">{{ data.paiement.mode === 'carte' ? 'X' : '' }}</span> Carte de Crédit</span>
              <span class="ct-chk"><span class="ct-chk-box">{{ data.paiement.mode === 'especes' ? 'X' : '' }}</span> Espèces</span>
            </div>
            <div class="ct-pay-row"><b>Numéro :</b> <span class="ct-pay-line">{{ data.paiement.numero }}</span></div>
            <div class="ct-pay-row"><b>Nature :</b> <span class="ct-pay-line">{{ data.paiement.nature }}</span> &nbsp;<b>en date du</b> <span class="ct-pay-line">{{ data.paiement.date }}</span></div>
            <div class="ct-pay-row"><b>Montant en T.T.C. :</b> <span class="ct-pay-line">{{ data.paiement.montant }}</span></div>
          </div>
        </div>
      </div>

      <!-- Vehicle section -->
      <div class="ct-veh-section">
        <div class="ct-veh-hdr"><span>VEHICULE</span><span>السيارة</span></div>
        <table class="ct-veh-table">
          <tr>
            <th>MARQUE<br>النوع</th>
            <th>N° IMMATRICULATION<br>العدد المنجمي</th>
            <th colspan="2">ASS.P.TRANS</th>
            <th colspan="2">SUP.FRANCH.</th>
          </tr>
          <tr>
            <td></td><td></td>
            <th>OUI</th><th>NON</th>
            <th>OUI</th><th>NON</th>
          </tr>
          <tr>
            <td class="ct-veh-val">{{ data.vehicule.marque }}</td>
            <td class="ct-veh-val">{{ data.vehicule.immatriculation }}</td>
            <td class="ct-yn"><span class="ct-chk-box">{{ data.vehicule.assPTrans === 'OUI' ? 'X' : '' }}</span></td>
            <td class="ct-yn"><span class="ct-chk-box">{{ data.vehicule.assPTrans === 'NON' ? 'X' : '' }}</span></td>
            <td class="ct-yn"><span class="ct-chk-box">{{ data.vehicule.supFranch === 'OUI' ? 'X' : '' }}</span></td>
            <td class="ct-yn"><span class="ct-chk-box">{{ data.vehicule.supFranch === 'NON' ? 'X' : '' }}</span></td>
          </tr>
        </table>
        <div class="ct-fuel-row">
          <b>Niveau essence départ</b>
          <span class="ct-chk"><span class="ct-chk-box">{{ data.vehicule.fuelLevel === '1/4' ? 'X' : '' }}</span> 1/4</span>
          <span class="ct-chk"><span class="ct-chk-box">{{ data.vehicule.fuelLevel === '1/2' ? 'X' : '' }}</span> 1/2</span>
          <span class="ct-chk"><span class="ct-chk-box">{{ data.vehicule.fuelLevel === '3/4' ? 'X' : '' }}</span> 3/4</span>
          <span class="ct-chk"><span class="ct-chk-box">{{ data.vehicule.fuelLevel === 'Full' ? 'X' : '' }}</span> Full</span>
          &nbsp;&nbsp;
          <b>Avec roue de secours</b> <span class="ct-chk-box">{{ data.vehicule.roueSecours === 'Oui' ? 'X' : '' }}</span>
          &nbsp;
          <b>Avec papier originaux</b> <span class="ct-chk-box">{{ data.vehicule.papierOriginaux === 'Oui' ? 'X' : '' }}</span>
        </div>
        <div class="ct-prolong-row">
          <b>Prolongation :</b>
          &nbsp;<b>Du</b> <span class="ct-prolong-line">{{ data.prolongation.du }}</span>
          &nbsp;<b>Au :</b> <span class="ct-prolong-line">{{ data.prolongation.au }}</span>
          <span style="margin-left:16px;font-size:8px;color:#555;">التمديد :</span>
        </div>
        <div class="ct-change-row">
          <b>Changement :</b> <span class="ct-prolong-line">{{ data.prolongation.changement }}</span>
          &nbsp;<span style="font-size:8px;color:#555;">تغيير السيارة :</span>
        </div>
        <div class="ct-change-row">
          <b>Date et horaire:</b> <span class="ct-prolong-line">{{ data.prolongation.dateHoraire }}</span>
          &nbsp;<span style="font-size:8px;color:#555;">التاريخ والساعة :</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="ct-footer-grid">
        <div class="ct-footer-block">
          <div class="ct-footer-text">
            أقر بأنني قد قبلت الشروط العامة للتأجير المحددة أدناه في الجزء الخلفي من هذا العقد وأعدكم بتسليم السيارة في التاريخ والمكان المتفق عليه.<br>
            Je reconnais avoir accepté les Conditions Générales de Location spécifiées ci-contre au verso de ce contrat et je m'engage à restituer le véhicule à la date et au lieu prévus.
          </div>
          <div class="ct-footer-fait">
            <b>Fait à :</b> <span class="ct-fline" style="min-width:80px;">{{ data.signature.lieu }}</span>
            &nbsp;<b>le</b> <span class="ct-fline" style="min-width:80px;">{{ data.signature.date }}</span>
            &nbsp;<span style="font-size:8px;color:#555;">التاريخ :</span>
          </div>
          <div class="ct-prepared-by-row">
            <b>Contrat préparé par :</b>
            <span class="ct-fline" style="min-width:140px;">{{ data.preparedBy || '' }}</span>
            <span style="font-size:8px;color:#555;">: العقد محرر من قبل</span>
          </div>
          <div class="ct-sig-row">
            <div class="ct-sig-box">
              <div class="ct-sig-line"></div>
              Signature précédée du "lu et approuvé" du locataire.<br>
              <b>إمضاء و ختم الحريف</b>
            </div>
            <div class="ct-sig-box" style="text-align:center;">
              <div style="font-size:14px;font-weight:900;color:#c00;margin-bottom:2px;">{{ data.company.name }}</div>
              <div style="font-size:9px;font-weight:700;">Rent a car</div>
              <div style="font-size:8px;margin-top:4px;">BONNE ROUTE ET SOYEZ PRUDENT</div>
              <div style="font-size:8px;color:#555;">طريق السلامة</div>
            </div>
            <div class="ct-sig-box">
              <div class="ct-sig-line"></div>
              Cachet et Signature {{ data.company.name }}<br>
              <b>إمضاء و ختم</b>
            </div>
          </div>
        </div>

        <div class="ct-damage-panel">
          <div class="ct-damage-cars">
            <div style="text-align:center;">
              <div style="font-size:8px;font-weight:700;margin-bottom:2px;">AR</div>
              <svg width="48" height="70" viewBox="0 0 48 70">
                <rect x="8" y="5" width="32" height="55" rx="6" fill="none" stroke="#333" stroke-width="1.5"/>
                <rect x="4" y="12" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="38" y="12" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="4" y="45" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="38" y="45" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="12" y="8" width="24" height="14" rx="2" fill="none" stroke="#888" stroke-width="1"/>
                <line x1="24" y1="5" x2="24" y2="60" stroke="#bbb" stroke-width=".5" stroke-dasharray="2,2"/>
              </svg>
            </div>
            <div style="text-align:center;">
              <div style="font-size:8px;font-weight:700;margin-bottom:2px;">AV</div>
              <svg width="48" height="70" viewBox="0 0 48 70">
                <rect x="8" y="10" width="32" height="55" rx="6" fill="none" stroke="#333" stroke-width="1.5"/>
                <rect x="4" y="15" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="38" y="15" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="4" y="48" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="38" y="48" width="6" height="12" rx="2" fill="none" stroke="#555" stroke-width="1"/>
                <rect x="12" y="46" width="24" height="14" rx="2" fill="none" stroke="#888" stroke-width="1"/>
                <line x1="24" y1="10" x2="24" y2="65" stroke="#bbb" stroke-width=".5" stroke-dasharray="2,2"/>
              </svg>
            </div>
          </div>
          <div style="font-size:7.5px;font-weight:700;text-align:center;margin-bottom:3px;">DOMMAGES IDENTIFIÉS<br>ET ACCEPTÉS</div>
          <div style="font-size:7.5px;">
            <div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;"><span class="ct-chk-box"></span> Éraflure</div>
            <div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;"><span class="ct-chk-box"></span> Bosse</div>
            <div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;"><span class="ct-chk-box"></span> Manque</div>
          </div>
          <div style="margin-top:6px;font-size:7px;text-align:center;border-top:1px dashed #ccc;padding-top:4px;">
            Nombre &nbsp;|&nbsp; Paraphe client
          </div>
        </div>
      </div>

      <div class="ct-footer-notice">
        A conserver : ce document doit être présenté à tout contrôle des agents de la sûreté nationale
      </div>

    </div>
  </div>

  <!-- ═══════ PAGE 2 — Conditions Générales (shared) ═══════ -->
  <ContractConditionsPage />
  </div>
</template>

<style scoped>
/* ── Wrapper for both pages ── */
.ct-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Contract Paper (shared by both pages) ── */
.ct-paper {
  background: #fff;
  width: 794px;
  font-family: Arial, sans-serif;
  font-size: 10px;
  color: #111;
  border: 1px solid #999;
  box-shadow: 0 4px 20px rgba(0,0,0,.25);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  /* Preserve Arabic shaping / ligatures during PDF export. */
  font-feature-settings: normal;
  font-variant-ligatures: normal;
  text-rendering: optimizeLegibility;
}
.ct-paper * { box-sizing: border-box; }
.ct-inner { padding: 12px 14px; }

/* Header */
.ct-hdr { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; border-bottom: 2.5px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
.ct-hdr-logo { display: flex; flex-direction: column; align-items: center; }
.ct-logo-img { height: 50px; max-width: 120px; object-fit: contain; margin-bottom: 2px; }
.ct-logo-main { color: red; font-size: 20px; font-weight: 900; line-height: 1; }
.ct-logo-sub { font-size: 9px; font-weight: 700; color: #222; }
.ct-hdr-center { text-align: center; font-size: 9px; color: #222; }
.ct-hdr-right { text-align: right; }
.ct-logo-main-ar { color: red; font-size: 18px; font-weight: 900; text-align: right; line-height: 1; }
.ct-logo-sub-ar { font-size: 9px; font-weight: 700; color: #222; text-align: right; }

/* Meta bar */
.ct-meta-bar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; border: 1.5px solid #000; background: #e8e8ff; padding: 4px 8px; margin-bottom: 8px; font-weight: 700; font-size: 10px; }
.ct-meta-mid { text-align: center; }
.ct-contract-badge { background: #e8e8ff; border: 1.5px solid #000; padding: 3px 12px; font-weight: 900; font-size: 13px; color: red; }

/* Type de location pill row */
.ct-loc-type-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1.5px solid #000;
  background: #f4f4ff;
  padding: 5px 10px;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
}
.ct-loc-type-lbl { font-weight: 800; }
.ct-loc-type-lbl-ar { margin-left: auto; font-weight: 800; }
.ct-loc-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid #555;
  border-radius: 3px;
  background: #fff;
  font-weight: 700;
}
.ct-loc-pill-on { background: #fff; border-color: #000; border-width: 1.5px; }
.ct-loc-box {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid #000;
  background: #fff;
  text-align: center;
  font-size: 10px;
  line-height: 10px;
  font-weight: 900;
}

/* Body grid */
.ct-body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1.5px solid #000; }
.ct-left-col { border-right: 1.5px solid #000; }

/* Section headers */
.ct-sec-hdr { background: #e8e8ff; border-bottom: 1px solid #000; padding: 3px 7px; display: flex; justify-content: space-between; font-weight: 700; font-size: 9.5px; text-transform: uppercase; }
.ct-sec-hdr.ct-conductor { border-top: 1px solid #000; }
.ct-sec-body { padding: 5px 7px; }

/* Field rows */
.ct-frow { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; }
.ct-flbl { font-weight: 700; font-size: 9px; white-space: nowrap; }
.ct-flbl-ar { font-size: 8.5px; color: #444; white-space: nowrap; }
.ct-fline { flex: 1; border-bottom: none; min-height: 18px; font-size: 14px; font-weight: 700; color: #1040b0; font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Geeza Pro', 'Consolas', 'Courier New', monospace; padding: 1px 2px 3px; letter-spacing: 0.2px; }
.ct-fline.ct-ar { direction: rtl; text-align: right; }
.ct-fline.ct-empty { border-bottom: none; }

/* Dates block */
.ct-dates-block { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
.ct-date-cell { padding: 4px 6px; border-right: 1px solid #000; }
.ct-date-cell-title { font-weight: 700; font-size: 8.5px; display: flex; justify-content: space-between; }
.ct-date-inner { display: grid; grid-template-columns: auto 1fr; gap: 3px; margin-top: 3px; }
.ct-date-lbl { font-size: 8px; font-weight: 700; }

/* KM block */
.ct-km-block { border-bottom: 1px solid #000; }
.ct-km-row { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 6px; border-bottom: 1px solid #eee; gap: 4px; }
.ct-km-row:last-child { border-bottom: none; }
.ct-km-lbl { font-size: 8.5px; font-weight: 700; }
.ct-km-val { border-bottom: none; min-width: 80px; text-align: right; font-size: 14px; font-weight: 700; color: #1040b0; font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Geeza Pro', 'Consolas', 'Courier New', monospace; letter-spacing: 0.2px; padding-bottom: 2px; }

/* Caution block */
.ct-caution-block { border-bottom: 1px solid #000; padding: 4px 6px; }
.ct-caution-title { font-weight: 700; font-size: 9px; display: flex; justify-content: space-between; margin-bottom: 4px; }
.ct-caution-checks { display: flex; gap: 10px; font-size: 8.5px; }
.ct-chk { display: flex; align-items: center; gap: 3px; }
.ct-chk-box { width: 9px; height: 9px; border: 1px solid #333; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 7px; font-weight: 700; line-height: 1; }

/* Encaissement */
.ct-enc-block {}
.ct-enc-title { background: #e8e8ff; padding: 3px 6px; font-weight: 700; font-size: 9px; border-bottom: 1px solid #000; border-top: 1px solid #000; display: flex; justify-content: space-between; }
.ct-enc-row { display: flex; justify-content: space-between; align-items: baseline; padding: 2.5px 6px; border-bottom: 1px solid #eee; gap: 4px; }
.ct-enc-bold { font-weight: 700; background: #f8f8ff; }
.ct-enc-lbl { font-size: 8.5px; font-weight: 700; flex: 1; }
.ct-enc-val { border-bottom: none; min-width: 90px; text-align: right; font-size: 14px; font-weight: 700; color: #1040b0; font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Geeza Pro', 'Consolas', 'Courier New', monospace; letter-spacing: 0.2px; padding-bottom: 2px; }
.ct-enc-bold .ct-enc-val { font-weight: 700; }

/* Payment */
.ct-pay-block { border-top: 1px solid #000; padding: 4px 6px; font-size: 8.5px; }
.ct-pay-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
.ct-pay-line { border-bottom: none; min-width: 80px; font-size: 13px; font-weight: 700; color: #1040b0; font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Geeza Pro', 'Consolas', 'Courier New', monospace; letter-spacing: 0.2px; padding-bottom: 2px; }

/* Vehicle section */
.ct-veh-section { border-top: 1.5px solid #000; }
.ct-veh-hdr { background: #e8e8ff; border-bottom: 1px solid #000; padding: 3px 7px; display: flex; justify-content: space-between; font-weight: 700; font-size: 9.5px; text-transform: uppercase; }
.ct-veh-table { width: 100%; border-collapse: collapse; }
.ct-veh-table th, .ct-veh-table td { border: 1px solid #000; padding: 3px 5px; font-size: 8.5px; text-align: center; }
.ct-veh-table th { background: #f0f0f0; font-weight: 700; }
.ct-veh-val { color: #1040b0; font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Geeza Pro', 'Consolas', 'Courier New', monospace; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
.ct-veh-table td.ct-yn { text-align: center; vertical-align: middle; padding: 4px 5px; }

/* Fuel */
.ct-fuel-row { display: flex; align-items: center; gap: 6px; padding: 4px 7px; border-top: 1px solid #000; font-size: 8.5px; }

/* Prolongation */
.ct-prolong-row { display: flex; align-items: center; gap: 6px; padding: 4px 7px; border-top: 1px solid #000; font-size: 8.5px; }
.ct-prolong-line { border-bottom: none; flex: 1; font-size: 13px; font-weight: 700; color: #1040b0; font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Geeza Pro', 'Consolas', 'Courier New', monospace; letter-spacing: 0.2px; padding-bottom: 2px; }
.ct-change-row { display: flex; align-items: center; gap: 6px; padding: 3px 7px; border-top: 1px solid #000; font-size: 8.5px; }

/* Footer grid */
.ct-footer-grid { display: grid; grid-template-columns: 1fr auto; border-top: 1.5px solid #000; }
.ct-footer-block { padding: 6px 10px; }
.ct-footer-text { font-size: 7.5px; color: #333; margin-bottom: 4px; line-height: 1.4; }
.ct-footer-fait { font-size: 9px; font-weight: 700; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ct-prepared-by-row { font-size: 9px; font-weight: 700; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.ct-sig-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; gap: 10px; }
.ct-sig-box { width: 32%; text-align: center; font-size: 8px; color: #555; }
.ct-sig-line { height: 50px; border: 1px dashed #bbb; margin-bottom: 4px; }

/* Damage panel */
.ct-damage-panel { border-left: 1.5px solid #000; padding: 6px; display: flex; flex-direction: column; align-items: center; width: 140px; }
.ct-damage-cars { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }

/* Footer notice */
.ct-footer-notice { background: #d00; color: #fff; text-align: center; padding: 3px 6px; font-size: 8.5px; font-weight: 700; margin-top: 4px; }

@media print {
  .ct-paper { box-shadow: none; border: none; width: 100%; }
}
</style>
