<script setup lang="ts">
import { computed } from 'vue';

export interface ContractData {
  contractNumber: string;
  contractDate: string;
  rc: string;
  company: {
    name: string;
    logoUrl: string | null;
    gsm: string;
    email: string;
    mf: string;
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
}

const props = defineProps<{
  data: ContractData;
}>();

const billing = computed(() => {
  const sub = props.data.encaissement.totalPartiel || 0;
  const tva = sub * 0.19;
  const timbre = 1.0;
  const div = props.data.encaissement.divers || 0;
  const totalFacture = sub + tva + timbre;
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
            <div class="ct-frow"><span class="ct-flbl">Délivré le :</span><span class="ct-fline" :class="{ 'ct-empty': !data.locataire.ciDate }">{{ data.locataire.ciDate }}</span><span class="ct-flbl-ar">مسلمة بتاريخ :</span></div>
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
            <div class="ct-frow"><span class="ct-flbl">Délivré le :</span><span class="ct-fline" :class="{ 'ct-empty': !data.conducteur.ciDate }">{{ data.conducteur.ciDate }}</span><span class="ct-flbl-ar">مسلمة بتاريخ :</span></div>
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

  <!-- ═══════ PAGE 2 — Conditions Générales ═══════ -->
  <div class="ct-paper ct-page2">
    <div class="ct-p2-inner">

      <div class="ct-p2-header-strip">الشروط العامة للكراء — Conditions Générales de Location</div>

      <div class="ct-p2-grid">

        <!-- Arabic column (right side visually) -->
        <div class="ct-p2-ar">
          <div class="ct-p2-section-title">الشروط العامة للكراء</div>

          <p class="ct-p2-bold">تسوية السيارة النهائي في الصفحة 1 يخضع إلى الشروط التالية و مقبولة من طرف المستأجر.</p>

          <p class="ct-p2-chapter">الفصل الأول : استلام السيارة</p>
          <p>على المستأجر أن يتمم و يتحقق من المعلومات التالية:</p>
          <div class="ct-p2-sub">
            <div class="ct-p2-num"><span>١-</span><span>للمستأجر أن يفتش السيارة و يتحقق منها</span></div>
            <div class="ct-p2-num"><span>٢-</span><span>للمستأجر أن يتأكد أن السيارة خالية من الأعطال و صالحة للاستعمال و يجب على المستأجر أن يبلغ الشركة بأي عطل قبل مغادرة</span></div>
          </div>

          <p class="ct-p2-chapter">طلب التسوية لأضرار التالية:</p>
          <div class="ct-p2-sub">
            <div class="ct-p2-num"><span>١)</span><span>مبلغ غير محدد للحوادث الدكتيلية للفرار أو للأشخاص الراكزين في السيارة بدون مقابل</span></div>
            <div class="ct-p2-num"><span>٢)</span><span>مبلغ محدد السنة بـ 33 دج خط خطأ البائع</span></div>
            <div class="ct-p2-num"><span>٣)</span><span>من شركة التأمين التي تبقى على المستأجر إجمالاً مدتها %85 من قيمة السيارة التي أنشأت من بدء التسجيل إذا أطلت مدة كراء السيارات فلا تتجاوز 90 يوماً. في صورة وقوع حادث.</span></div>
            <div class="ct-p2-num"><span>٤)</span><span>لا يعوض من طرف شركة التأمين إلا باستحضار للمعاينة السليمة للمنتفع.</span></div>
          </div>

          <p class="ct-p2-bold">خولاً من حريان الثامن يقدم المستأجر بالشروط التالية:</p>
          <div class="ct-p2-sub">
            <p>أ- أعلام لـ ج- كراء السيارات بالحادث في 24 ساعة وإعلام الشرطة في الحال بكل حادث و حريق أو بكل سبب.</p>
            <p>ب- تقييد المكان – ساعة و مكان وقوع الحادث.</p>
            <p>ت- تصوير الثلاثي المقسمة من طرف الشرطة : الحرس و الكتب المقلوديات لأذار الثنا</p>
            <p>ث- توزيع الثلاثي في مسؤولية الحادث و الصنع مع الأشخاص المتضررين في الحادث.</p>
            <div class="ct-p2-num"><span>١٢-</span><span>الأضرار الحاصلة للحاجيات – أمتعة السيارة – التلور – الأكسسوارات داخل السيارة من عالق المستأجر.</span></div>
            <p>ب- الأضرار الحاصلة نتيجة السياقة فوق طرقات غير معبدة تلقي على المستأجر.</p>
          </div>

          <hr class="ct-p2-divider">

          <p class="ct-p2-chapter">الفصل ٢ : البنزين و الزيت</p>
          <p>البنزين على كاهل المتسوق و يجب عليه أن يبقاها باستمرار الزيوت و المياه.</p>

          <p class="ct-p2-chapter">الفصل ٥ : الميكانيك الوحيدي و العاجز للمحافظات و المصليح الطارئ</p>
          <p>بما في السيارة و فتح أبواب على علوه في أعلاه من ثالث من التأمين مدة التسويق و التأخير عن المنح الكراء لتالي عن أعطاء الثالي أو فتح الكراء وثائق حوادث التي أعلى منه في أصلاح سابق ليها.</p>

          <p class="ct-p2-chapter">الفصل ٦ : حالة السيارة</p>
          <p>تسلم السيارة الثامن من ناحية النظافة و بر المعادات و ما يتبعها و ما اقتدى على هذه المؤهلات لـ ج- كراء السيارات في حالة حوادث دفع ٥٠٠ دج كالعنانة في كل يوم ترجع السيارة في حالة.</p>

          <p class="ct-p2-chapter">الفصل ١ : الأدوات المعبرية لها</p>
          <p>أما إذا أراد الأشخاص بالسيارة لهذا لحظة يتبعي عليه أن يطلب موافقة لـ ج- كراء السيارات و لن يبس علم المكراء الجاري و يتعرض إلى تبعات مدنية و جزائية و حالة إطلاس سيارة و جزاء مؤمن.</p>

          <hr class="ct-p2-divider">

          <p class="ct-p2-chapter">الفصل ٧ : تسويق + وديع و جديد يضمن مسبقاً من التسويق و الثمان حسب التعريفة المعمول بها</p>

          <p class="ct-p2-chapter">الفصل ٨ : إرجاع السيارة و لوازمها</p>
          <p>يجب على المالك أن يهمل السيارة إذا ما مانت ما يناديها تربح السيارة و تحمل على المتسوق لتعرف بالمصاريف في مكن ذلك بنفي التسوق قائم للمول إلى عد إرجاع المالية.</p>

          <p class="ct-p2-chapter">الفصل ٩ : وثائق السيارة</p>
          <p>أ- على المتسوق أن يرجع السيارة انتهاء مدة التسويق مصحوبة بجميع وثائقها (البطاقة الرمادية، الوثائق الرسمية...) و إلا يلتلي التسويق سائر المستأجر على ترجع السيارة وثائق التي و لا يضمن لـ ج- كراء السيارات إلى أن تجدد هنا.</p>

          <p class="ct-p2-chapter">الفصل ١٠ : المسؤولية</p>

          <p class="ct-p2-chapter">الفصل ١١ : في حالة ضياع أوراق السيارة يتحمل مصاريف تجديدها</p>
          <p>المتسوق المسؤول الوحيدي و العاجز التالية للمحافظات و التجاهر التي تجبر في أثناء استعمال السيارة المذكورة و التي هي تحت ضمانه لتحث اشتعلت مدة الكراء في مد الكراء.</p>

          <p class="ct-p2-chapter">الفصل ١٢ : جميع المغارمات الثاقلة لـ ج- كراء السيارات للمتسوق تكون من مسؤولة وثائق محكمة مدينة تونس العاصمة</p>

          <p class="ct-p2-chapter">الفصل ١٣ : لـ ج- كراء السيارات أن تأخذ السيارة في حالة العقل و استرداد</p>
          <p>السيارة للاحظة مخالفة المتسوق لهذه الضوابط و لاسيما إذا لم يثبت هذا العقل في مجانيته بما يعنوم مطلعه بالنقم نفس ما تنامى من ملة الكرالة و كذلك لاسيباب السيارة.</p>

          <p class="ct-p2-chapter">الفصل ١٤ : يتحمل المتسوق جميع المصاريف المتعلقة بالسيارة في صورة حادث مرور.</p>
        </div>

        <!-- French column (left side visually) -->
        <div class="ct-p2-fr">
          <div class="ct-p2-section-title">Conditions Générales de Location</div>

          <p><em>La juridiction du véhicule mentionné à la page 1 est soumise aux conditions suivantes. Acceptée par le demandeur.</em></p>

          <hr class="ct-p2-divider">

          <p class="ct-p2-fr-chapter">Chapitre 1: Utilisation du véhicule</p>
          <p>Par peur de l'assurance, l'expéditeur doit respecter les conditions suivantes: La voiture ne vend pas à personne et assume la responsabilité et ne l'utilise pas.</p>
          <p>Pour passer son besoin et pas le droit de transporter les marchandises ou remorquer des chariots et transporter les gens paint plus que la carte grise.</p>

          <p class="ct-p2-fr-chapter">Chapitre 2:</p>
          <p>Assurance pour légalisation: assurée pour des risques suivantes:</p>
          <div class="ct-p2-sub-fr">
            <p>1) Un nombre indéterminé d'accidents causés à des tiers ou à des personnes voyageant dans La voiture est gratuite</p>
            <p>2) Ne trez la voiture que si la ligne de faute du conducteur est achée</p>
            <p>3) contre les dommages causés à la voiture dans la valeur noncée de 94 du Le prix d'achat d'une voiture qui reste un obstacle enveloppé:</p>
            <p>Attention si un délai est écoulé louer une voiture chez LG pour acheter des voitures est sacrée à chaque charge Sous la forme d'un accident.</p>
            <p>(4) L'indemnisation ne doit pas être indemnisée par la compagnie d'assurance, sauf par référence à l'inspection par conciliation Pour compenser, Sans nier l'assurance, l'expéditeur doit respecter les conditions suivantes:</p>
            <p>A. Un véhicule pour informer les voitures de l'accident en 24 heures et les informations de la police En cas d'accident et d'incendie de la voiture et s'il était simple.</p>
            <p>B- lors de la modication de l'incident ci-dessus, le navigateur doit écrire les raisons</p>
            <p>C) Documents reçus par la police. Gardiens et Apostats</p>
            <p>D) vous relâchez quelque chose</p>
            <p>E) Il est interdit de communiquer dans la responsabilité de l'accident ou la réconciliation avec les personnes qui sont suspectes de l'incident.</p>
            <p>Dans l'Endommagement des roues:- Descente de la voiture - Cristal et accessoires À l'intérieur de la voiture sur l'obstacle enveloppée</p>
            <p>et les dommages causés par la conduite sur des pellets</p>
          </div>

          <hr class="ct-p2-divider">

          <p class="ct-p2-fr-chapter">— Les bagages transférés dans la voiture n'entrent pas dans la zone des assurances.</p>
          <p>7) L'assurance n'est valable que pour la période du renouvellement, car la voiture n'a pas été reéquipée.</p>
          <p>La durée du loyer est l'entière responsabilité de l'expéditeur</p>
          <p>8) Assurer une assurance en état d'étranget ou de permis de conduire</p>
          <p>9) Dans le cas où une personne réclame des informations fausses ou fausses (permis de conduire) Ou mal pour aller chercher des voitures pour acheter toute la responsabilité dans: Accidents pour les autres ou pour les voitures.</p>

          <p class="ct-p2-fr-chapter">Chapitre 3: Essence et Huile</p>
          <p>L'essence sur le shampoing et doit constamment inspecter les huiles et l'eau.</p>

          <p class="ct-p2-fr-chapter">Chapitre 4: Entretien et réparation des véhicules</p>
          <p>Le client doit supporter les frais d'endommagement. Le mécanicien résultant de sa complaisance et le conducteur doivent être impressionnés par les pièces.</p>
          <p>J'al changé la voiture et le contrat de location a été annulé en raison de la période de réparation de la voiture</p>
          <p>La justification des voitures LG ne prend aucune responsabilité en cas de: Accidents causés par un dysfonctionnement dans la fabrication du véhicule ou lors d'une réparation antérieure.</p>

          <p class="ct-p2-fr-chapter">Chapitre 5: L'etat du véhicule</p>
          <p>La voiture est en bon état en termes de propreté, de compteurs, etc.…</p>
          <p>S'il attaquait ces obligations, il devait payer pour les voitures</p>
          <p>L'acheteur peut payer 500 km de base tous les jours et la voiture retourne à l'état Accidents causé par un défaut de fabrication ou de réparation d'une voiture précédente</p>

          <p class="ct-p2-fr-chapter">Chapitre 6: Il est interdit aux clients de quitter le territoire tunisien avec des biz voitures</p>
          <p>Doit être strictement limité dans la permission de l'administration publique.</p>

          <p class="ct-p2-fr-chapter">Chapitre 7: Le plaidoyer</p>
          <p>C'est une extension qui joue à l'avance le prix de la garantie et la garantie Selon le tarif.</p>
          <p>La garantie n'est pas valuable pour éteindre la justication, quel que soit le cas, pour éviter de contester Si Marad conserve la voiture plus longtemps, il devait demander l'approbation Pour louer des voitures et envoyer des informations sur le loyer actuel et ne pas être exposé Aucune trace légale dans le détournement de voiture et la trahison ne peut être trahie</p>

          <hr class="ct-p2-divider">

          <p class="ct-p2-fr-chapter">Chapitre 8: Restitution de la voiture et de ses fournitures</p>
          <p>Il est formellement interdit au chauffeur de négliger le véhicule s'il est physiquement empêché de le rendre.</p>
          <p>Tous les frais sont à la charge du demandeur, à l'appèse de la justication. Est dans la mesure des jambes de la voiture</p>

          <p class="ct-p2-fr-chapter">Chapitre 9: Documentation de la voiture</p>
          <p>A- l'expéditeur doit rendre la voiture après l'expiration du délai de la justication accompagnée de toutes les :</p>
          <p>(Carte grise, documents locais...) et Il ne reste aucune justication le reste de l'ivét jusqu'à ce que les documents soient retournés à La pour location de voiture</p>
          <p>B) En cas de perte des papiers du véhicule, l'expéditeur supporte les frais de son renouvellement.</p>

          <p class="ct-p2-fr-chapter">Chapitre 10: Responsabilité</p>
          <p>Le shogun reste le seul responsable des irrégularités et des archives dans lesquelles il est publié. …lors de l'utilisation du véhicule écrit qui est à sa disposition pendant la période spéciale Dans le contrat de location</p>

          <p class="ct-p2-fr-chapter">Chapitre 11:</p>
          <p>En cas d'absence de séjli et dans les procédures judiciaires et judiciaires: Le demandeur est tenu de payer les frais de justice et autres frais Autre.</p>

          <p class="ct-p2-fr-chapter">Chapitre 12:</p>
          <p>Toutes les objections nées sitre LJ pour l'achat d'une voiture et l'expéditeur est couvert par le tribunal de Tunis.</p>

          <p class="ct-p2-fr-chapter">Chapitre 13:</p>
          <p>LG se réserve le droit de résilier le contrat et de récupérer La voiture dès qu'elle constate la violation de l'expéditeur pour l'un des termes du présent contrat et à aucun droit. Dans sa revendication de toute information qui reste avec le même montant du reste de la période d'achat ainsi que Pour les raisons de vol.</p>

          <p class="ct-p2-fr-chapter">Chapitre 14:</p>
          <p>L'expéditeur supporte tous les frais liés au véhicule sous forme de accident de circulation.</p>
        </div>

      </div>
    </div>
  </div>

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

/* Body grid */
.ct-body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1.5px solid #000; }
.ct-left-col { border-right: 1.5px solid #000; }

/* Section headers */
.ct-sec-hdr { background: #e8e8ff; border-bottom: 1px solid #000; padding: 3px 7px; display: flex; justify-content: space-between; font-weight: 700; font-size: 9.5px; text-transform: uppercase; }
.ct-sec-hdr.ct-conductor { border-top: 1px solid #000; }
.ct-sec-body { padding: 5px 7px; }

/* Field rows */
.ct-frow { display: flex; align-items: baseline; gap: 4px; margin-bottom: 3px; }
.ct-flbl { font-weight: 700; font-size: 9px; white-space: nowrap; }
.ct-flbl-ar { font-size: 8.5px; color: #444; white-space: nowrap; }
.ct-fline { flex: 1; border-bottom: 1px dashed #bbb; min-height: 13px; font-size: 10px; color: #1040b0; font-family: monospace; padding: 0 2px; }
.ct-fline.ct-ar { direction: rtl; text-align: right; }
.ct-fline.ct-empty { border-bottom: 1px dashed #ccc; }

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
.ct-km-val { border-bottom: 1px dashed #bbb; min-width: 80px; text-align: right; font-size: 10px; color: #1040b0; font-family: monospace; }

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
.ct-enc-val { border-bottom: 1px dashed #bbb; min-width: 90px; text-align: right; font-size: 10px; color: #1040b0; font-family: monospace; }
.ct-enc-bold .ct-enc-val { font-weight: 700; }

/* Payment */
.ct-pay-block { border-top: 1px solid #000; padding: 4px 6px; font-size: 8.5px; }
.ct-pay-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
.ct-pay-line { border-bottom: 1px dashed #bbb; min-width: 80px; font-size: 9px; color: #1040b0; font-family: monospace; }

/* Vehicle section */
.ct-veh-section { border-top: 1.5px solid #000; }
.ct-veh-hdr { background: #e8e8ff; border-bottom: 1px solid #000; padding: 3px 7px; display: flex; justify-content: space-between; font-weight: 700; font-size: 9.5px; text-transform: uppercase; }
.ct-veh-table { width: 100%; border-collapse: collapse; }
.ct-veh-table th, .ct-veh-table td { border: 1px solid #000; padding: 3px 5px; font-size: 8.5px; text-align: center; }
.ct-veh-table th { background: #f0f0f0; font-weight: 700; }
.ct-veh-val { color: #1040b0; font-family: monospace; font-size: 10px; }
.ct-yn { display: flex; gap: 4px; align-items: center; justify-content: center; }

/* Fuel */
.ct-fuel-row { display: flex; align-items: center; gap: 6px; padding: 4px 7px; border-top: 1px solid #000; font-size: 8.5px; }

/* Prolongation */
.ct-prolong-row { display: flex; align-items: center; gap: 6px; padding: 4px 7px; border-top: 1px solid #000; font-size: 8.5px; }
.ct-prolong-line { border-bottom: 1px dashed #bbb; flex: 1; font-size: 9px; color: #1040b0; font-family: monospace; }
.ct-change-row { display: flex; align-items: center; gap: 6px; padding: 3px 7px; border-top: 1px solid #000; font-size: 8.5px; }

/* Footer grid */
.ct-footer-grid { display: grid; grid-template-columns: 1fr auto; border-top: 1.5px solid #000; }
.ct-footer-block { padding: 6px 10px; }
.ct-footer-text { font-size: 7.5px; color: #333; margin-bottom: 4px; line-height: 1.4; }
.ct-footer-fait { font-size: 9px; font-weight: 700; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ct-sig-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; gap: 10px; }
.ct-sig-box { width: 32%; text-align: center; font-size: 8px; color: #555; }
.ct-sig-line { height: 50px; border: 1px dashed #bbb; margin-bottom: 4px; }

/* Damage panel */
.ct-damage-panel { border-left: 1.5px solid #000; padding: 6px; display: flex; flex-direction: column; align-items: center; width: 140px; }
.ct-damage-cars { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }

/* Footer notice */
.ct-footer-notice { background: #d00; color: #fff; text-align: center; padding: 3px 6px; font-size: 8.5px; font-weight: 700; margin-top: 4px; }

/* ═══════════════════════════════════════════════ */
/* ── PAGE 2 — Conditions Générales ──            */
/* ═══════════════════════════════════════════════ */
.ct-page2 { background: #fff; }
.ct-p2-inner { padding: 8mm 6mm; }

.ct-p2-header-strip {
  background: #2a5a8c;
  color: #fff;
  text-align: center;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 4mm;
  direction: rtl;
}

.ct-p2-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
}

.ct-p2-ar {
  direction: rtl;
  text-align: right;
  font-family: 'Amiri', 'Times New Roman', serif;
  font-size: 9.5px;
  line-height: 1.6;
}

.ct-p2-fr {
  direction: ltr;
  text-align: left;
  font-family: 'Noto Serif', Georgia, 'Times New Roman', serif;
  font-size: 7px;
  line-height: 1.35;
}

.ct-p2-section-title {
  background: #2a5a8c;
  color: #fff;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 4px;
  text-align: center;
}

.ct-p2-chapter {
  font-weight: 700;
  font-size: 9.5px;
  margin-top: 5px;
  margin-bottom: 2px;
  text-decoration: underline;
}

.ct-p2-fr-chapter {
  font-weight: 700;
  font-size: 7.5px;
  margin-top: 4px;
  margin-bottom: 1px;
}

.ct-p2-bold { font-weight: 700; }

.ct-p2-ar p, .ct-p2-fr p { margin-bottom: 3px; }

.ct-p2-sub { padding-right: 8px; margin-bottom: 3px; }
.ct-p2-sub-fr { padding-left: 8px; margin-bottom: 3px; }

.ct-p2-num {
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
}
.ct-p2-num > span:first-child {
  font-weight: 700;
  min-width: 16px;
  flex-shrink: 0;
}

.ct-p2-divider {
  border: none;
  border-top: 1px solid #9a8a6a;
  margin: 5px 0;
}

@media print {
  .ct-paper { box-shadow: none; border: none; width: 100%; }
  .ct-page2 { page-break-before: always; }
}
</style>
