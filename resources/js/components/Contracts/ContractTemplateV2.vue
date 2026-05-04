<script setup lang="ts">
import { computed } from 'vue';
import ContractConditionsPage from '@/components/Contracts/ContractConditionsPage.vue';
import type { ContractData } from '@/components/Contracts/ContractTemplate.vue';

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

const v2L = computed(() => props.data.v2?.locataire || {});
const v2C = computed(() => props.data.v2?.conducteur || {});
const v2P = computed(() => props.data.v2?.periode || {});
const v2X = computed(() => props.data.v2?.changement || {});
const v2R = computed(() => props.data.v2?.reglement || {});

const locataireFullName = computed(() => {
  const nom = props.data.locataire.nom || '';
  const prenom = props.data.locataire.prenom || '';
  return [nom, prenom].filter(Boolean).join(' ');
});

// V2 only: separate "renter" (LOCATAIRE) from the first driver.
// Stays empty unless the user fills it in - never auto-pulls from the reservation.
const renterFullName = computed(() => {
  const r = props.data.v2?.renter;
  return [r?.nom || '', r?.prenom || ''].filter(Boolean).join(' ').trim();
});

const conducteurFullName = computed(() => {
  const nom = props.data.conducteur.nom || '';
  const prenom = props.data.conducteur.prenom || '';
  return [nom, prenom].filter(Boolean).join(' ');
});

const departComposite = computed(() => {
  const d = props.data.periode.departDate || '';
  const h = props.data.periode.departHeure || '';
  return [d, h].filter(Boolean).join(' — ');
});

const retourComposite = computed(() => {
  const d = props.data.periode.retourDate || '';
  const h = props.data.periode.retourHeure || '';
  return [d, h].filter(Boolean).join(' — ');
});

const restAPayer = computed(() => {
  const tot = billing.value.totalFacture || 0;
  const av = Number(v2R.value.avance) || 0;
  return Math.max(0, tot - av);
});

const contactLines = computed(() => {
  const lines: { icon: string; text: string }[] = [];
  const gsmRaw = props.data.company.gsm || '';
  const gsmParts = gsmRaw.split('/').map((s) => s.trim()).filter(Boolean);
  for (const phone of gsmParts) lines.push({ icon: '☎', text: phone });
  if (props.data.company.email) lines.push({ icon: '✉', text: props.data.company.email });
  if (props.data.company.address) lines.push({ icon: '⌂', text: props.data.company.address });
  return lines;
});

function fmt3(v: number | undefined | null): string {
  if (v === null || v === undefined || isNaN(Number(v)) || Number(v) === 0) return '';
  return Number(v).toFixed(3);
}
</script>

<template>
  <div id="contract-template" class="ct2-wrapper">
    <!-- ═══════ PAGE 1 — V2 ═══════ -->
    <div class="ct-paper ct2-paper">
      <div class="ct2-inner">

        <!-- Header strip -->
        <div class="ct2-header">
          <div class="ct2-header-logo">
            <img v-if="data.company.logoUrl" :src="data.company.logoUrl" alt="Logo" />
            <template v-else>
              <div class="ct2-logo-fallback-name">{{ data.company.name }}</div>
              <div class="ct2-logo-fallback-sub">RENT CAR</div>
            </template>
          </div>

          <div class="ct2-header-title">
            <div class="ct2-title-ar">كراء السيارات</div>
            <div class="ct2-title-fr">LOCATION DE VOITURE</div>
          </div>

          <div class="ct2-header-contact">
            <div v-for="(line, i) in contactLines" :key="i" class="ct2-contact-row">
              <span class="ct2-contact-icon">{{ line.icon }}</span>
              <span class="ct2-contact-text">{{ line.text }}</span>
            </div>
            <div v-if="data.company.mf" class="ct2-contact-row ct2-contact-row-mf">
              <span class="ct2-contact-icon"></span>
              <span class="ct2-contact-text"><b>M.F :</b> {{ data.company.mf }}</span>
            </div>
          </div>
        </div>

        <!-- M.F / RIB strip -->
        <div class="ct2-mfrib">
          <span><b>M.F :</b> {{ data.company.mf || '—' }}</span>
          <span><b>RIB :</b> {{ data.company.rib || '—' }}</span>
        </div>

        <!-- Title: CONTRAT DE LOCATION N° xxx + Arabic -->
        <div class="ct2-doc-title">
          <span class="ct2-doc-title-fr">CONTRAT DE LOCATION</span>
          <span class="ct2-doc-num">N° {{ data.contractNumber || '________' }}</span>
          <span class="ct2-doc-title-ar">عقد كراء</span>
        </div>

        <!-- Vehicle / Locataire grid -->
        <table class="ct2-grid ct2-vehicle-grid">
          <colgroup>
            <col style="width:38%;">
            <col style="width:32%;">
            <col style="width:23%;">
            <col style="width:7%;">
          </colgroup>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-row"><span class="ct2-lbl">Modèle :</span><span class="ct2-val">{{ data.vehicule.marque }}</span></div>
              <div class="ct2-sub-ar">النوع</div>
            </td>
            <td class="ct2-cell" colspan="2">
              <div class="ct2-row"><span class="ct2-lbl">Immatriculation :</span><span class="ct2-val">{{ data.vehicule.immatriculation }}</span></div>
              <div class="ct2-sub-ar">الرقم المنجمي</div>
            </td>
            <td class="ct2-cell ct2-tu">
              <div class="ct2-tu-fr">TU</div>
              <div class="ct2-sub-ar">تونس</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell" colspan="2">
              <div class="ct2-row"><span class="ct2-lbl">Locataire :</span><span class="ct2-val">{{ renterFullName }}</span></div>
              <div class="ct2-sub-ar">المستأجر</div>
            </td>
            <td class="ct2-cell" colspan="2">
              <div class="ct2-row"><span class="ct2-lbl">M.F :</span><span class="ct2-val">{{ v2L.mf }}</span></div>
            </td>
          </tr>
        </table>

        <!-- Premier conducteur header -->
        <div class="ct2-section-hdr">
          <span class="ct2-section-fr">Premier conducteur</span>
          <span class="ct2-section-ar">السائق الأول</span>
        </div>

        <!-- Premier conducteur grid -->
        <table class="ct2-grid">
          <colgroup>
            <col style="width:33.33%;">
            <col style="width:33.33%;">
            <col style="width:33.34%;">
          </colgroup>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Nom et Prénom :</div>
              <div class="ct2-val">{{ locataireFullName }}</div>
              <div class="ct2-sub-ar">الإسم و اللقب</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">CIN/Passport N° :</div>
              <div class="ct2-val">{{ data.locataire.ci }}</div>
              <div class="ct2-sub-ar">ب ت و / جواز سفر عدد</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date de délivrance :</div>
              <div class="ct2-val">{{ data.locataire.ciDate || v2L.lieuDelivrance }}</div>
              <div class="ct2-sub-ar">تاريخ الإصدار</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date et lieu de naissance :</div>
              <div class="ct2-val">{{ data.locataire.dob }}</div>
              <div class="ct2-sub-ar">تاريخ و مكان الولادة</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Nationalité :</div>
              <div class="ct2-val">{{ data.locataire.nationalite }}</div>
              <div class="ct2-sub-ar">الجنسية</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date d'entrée en Tunisie :</div>
              <div class="ct2-val">{{ v2L.dateEntreeTunisie }}</div>
              <div class="ct2-sub-ar">تاريخ الدخول إلى تونس</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Permis N° :</div>
              <div class="ct2-val">{{ data.locataire.permis }}</div>
              <div class="ct2-sub-ar">رخصة سياقة عدد</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date de délivrance :</div>
              <div class="ct2-val">{{ data.locataire.permisDate || v2L.permisLieu }}</div>
              <div class="ct2-sub-ar">تاريخ الإصدار</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Motif de séjour :</div>
              <div class="ct2-motifs">
                <label class="ct2-motif"><span>Touriste</span><span class="ct2-chk-box">{{ v2L.motifSejour === 'Touriste' ? 'X' : '' }}</span></label>
                <label class="ct2-motif"><span>Autres</span><span class="ct2-chk-box">{{ v2L.motifSejour === 'Autres' ? 'X' : '' }}</span></label>
                <label class="ct2-motif"><span>Affaire</span><span class="ct2-chk-box">{{ v2L.motifSejour === 'Affaire' ? 'X' : '' }}</span></label>
                <span></span>
              </div>
              <div class="ct2-sub-ar">سبب الإقامة</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell" colspan="2">
              <div class="ct2-lbl">Adresse :</div>
              <div class="ct2-val ct2-multiline">{{ data.locataire.adresse }}</div>
              <div class="ct2-sub-ar">العنوان</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">GSM :</div>
              <div class="ct2-val">{{ data.locataire.telephone }}</div>
              <div class="ct2-sub-ar">الهاتف</div>
            </td>
          </tr>
        </table>

        <!-- 2eme conducteur header -->
        <div class="ct2-section-hdr">
          <span class="ct2-section-fr">2<sup>ème</sup> conducteur</span>
          <span class="ct2-section-ar">السائق الثاني</span>
        </div>

        <!-- 2eme conducteur grid -->
        <table class="ct2-grid">
          <colgroup>
            <col style="width:33.33%;">
            <col style="width:33.33%;">
            <col style="width:33.34%;">
          </colgroup>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Nom et Prénom :</div>
              <div class="ct2-val">{{ conducteurFullName }}</div>
              <div class="ct2-sub-ar">الإسم و اللقب</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">CIN/Passport N° :</div>
              <div class="ct2-val">{{ data.conducteur.ci }}</div>
              <div class="ct2-sub-ar">ب ت و / جواز سفر عدد</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date de délivrance :</div>
              <div class="ct2-val">{{ data.conducteur.ciDate || v2C.lieuDelivrance }}</div>
              <div class="ct2-sub-ar">تاريخ الإصدار</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date et lieu de naissance :</div>
              <div class="ct2-val">{{ data.conducteur.dob }}</div>
              <div class="ct2-sub-ar">تاريخ و مكان الولادة</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Nationalité :</div>
              <div class="ct2-val">{{ data.conducteur.nationalite }}</div>
              <div class="ct2-sub-ar">الجنسية</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date d'entrée en Tunisie :</div>
              <div class="ct2-val">{{ v2C.dateEntreeTunisie }}</div>
              <div class="ct2-sub-ar">تاريخ الدخول إلى تونس</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Permis N° :</div>
              <div class="ct2-val">{{ data.conducteur.permis }}</div>
              <div class="ct2-sub-ar">رخصة سياقة عدد</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date de délivrance :</div>
              <div class="ct2-val">{{ data.conducteur.permisDate || v2C.permisLieu }}</div>
              <div class="ct2-sub-ar">تاريخ الإصدار</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Motif de séjour :</div>
              <div class="ct2-motifs">
                <label class="ct2-motif"><span>Touriste</span><span class="ct2-chk-box">{{ v2C.motifSejour === 'Touriste' ? 'X' : '' }}</span></label>
                <label class="ct2-motif"><span>Autres</span><span class="ct2-chk-box">{{ v2C.motifSejour === 'Autres' ? 'X' : '' }}</span></label>
                <label class="ct2-motif"><span>Affaire</span><span class="ct2-chk-box">{{ v2C.motifSejour === 'Affaire' ? 'X' : '' }}</span></label>
                <span></span>
              </div>
              <div class="ct2-sub-ar">سبب الإقامة</div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell" colspan="2">
              <div class="ct2-lbl">Adresse :</div>
              <div class="ct2-val ct2-multiline">{{ data.conducteur.adresse }}</div>
              <div class="ct2-sub-ar">العنوان</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">GSM :</div>
              <div class="ct2-val">{{ data.conducteur.telephone }}</div>
              <div class="ct2-sub-ar">الهاتف</div>
            </td>
          </tr>
        </table>

        <!-- Stations / Dates / KM / Franchise grid -->
        <table class="ct2-grid">
          <colgroup>
            <col style="width:25%;">
            <col style="width:30%;">
            <col style="width:20%;">
            <col style="width:25%;">
          </colgroup>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Station de sortie :</div>
              <div class="ct2-val">{{ v2P.stationSortie }}</div>
              <div class="ct2-sub-ar">مكان الخروج</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date et heure de sortie :</div>
              <div class="ct2-val">{{ departComposite }}</div>
              <div class="ct2-sub-ar">تاريخ و ساعة الخروج</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Km de départ :</div>
              <div class="ct2-val">{{ data.periode.kmDepart }}</div>
              <div class="ct2-sub-ar">رقم العداد عند الخروج</div>
            </td>
            <td class="ct2-cell" rowspan="2">
              <div class="ct2-lbl">Franchise :</div>
              <div class="ct2-val">{{ v2P.franchise }}</div>
              <div class="ct2-sub-ar">الضمان</div>
              <div class="ct2-prol">
                <div><b>Prol 1 :</b> <span class="ct2-val">{{ v2P.prol1 }}</span></div>
                <div><b>Prol 2 :</b> <span class="ct2-val">{{ v2P.prol2 }}</span></div>
              </div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Station de retour :</div>
              <div class="ct2-val">{{ v2P.stationRetour }}</div>
              <div class="ct2-sub-ar">مكان الدخول</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date et heure de retour :</div>
              <div class="ct2-val">{{ retourComposite }}</div>
              <div class="ct2-sub-ar">تاريخ و ساعة الدخول</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Km de retour :</div>
              <div class="ct2-val">{{ data.periode.kmRetour }}</div>
              <div class="ct2-sub-ar">رقم العداد عند الدخول</div>
            </td>
          </tr>
        </table>

        <!-- CHANGEMENT DE VOITURE -->
        <div class="ct2-section-hdr ct2-section-thin">
          <span class="ct2-section-fr">CHANGEMENT DE VOITURE</span>
          <span class="ct2-section-ar">تغيير السيارة</span>
        </div>

        <table class="ct2-grid">
          <colgroup>
            <col style="width:32%;">
            <col style="width:32%;">
            <col style="width:8%;">
            <col style="width:28%;">
          </colgroup>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-lbl">Modèle :</div>
              <div class="ct2-val">{{ v2X.modele }}</div>
              <div class="ct2-sub-ar">النوع</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Immatriculation :</div>
              <div class="ct2-val">{{ v2X.immat }}</div>
              <div class="ct2-sub-ar">الرقم المنجمي</div>
            </td>
            <td class="ct2-cell ct2-tu">
              <div class="ct2-tu-fr">TU</div>
              <div class="ct2-sub-ar">تونس</div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-lbl">Date :</div>
              <div class="ct2-val">{{ v2X.date }}</div>
              <div class="ct2-sub-ar">تاريخ</div>
            </td>
          </tr>
        </table>

        <!-- PAYEMENT / RÈGLEMENT dual header -->
        <div class="ct2-pay-hdr-row">
          <div class="ct2-pay-hdr">
            <span>PAYEMENT PAR</span>
            <span class="ct2-section-ar">الدّفع عن طريق</span>
          </div>
          <div class="ct2-pay-hdr">
            <span>RÈGLEMENT</span>
            <span class="ct2-section-ar">طريقة الخلاص</span>
          </div>
        </div>

        <table class="ct2-grid ct2-pay-grid">
          <colgroup>
            <col style="width:33.33%;">
            <col style="width:33.33%;">
            <col style="width:33.34%;">
          </colgroup>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Chèque N° :</span>
                <span class="ct2-val">{{ v2R.cheque }}</span>
              </div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Avance :</span>
                <span class="ct2-val ct2-money">{{ fmt3(v2R.avance) }}</span>
              </div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Total H.T :</span>
                <span class="ct2-val ct2-money">{{ fmt3(billing.sub) }}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">C.Crédit N° :</span>
                <span class="ct2-val">{{ v2R.cCredit }}</span>
              </div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Reste à payer :</span>
                <span class="ct2-val ct2-money">{{ fmt3(restAPayer) }}</span>
              </div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">T.V.A :</span>
                <span class="ct2-val ct2-money">{{ fmt3(billing.tva) }}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Espèce :</span>
                <span class="ct2-val ct2-money">{{ fmt3(v2R.espece) }}</span>
              </div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Total :</span>
                <span class="ct2-val ct2-money">{{ fmt3(billing.totalFacture) }}</span>
              </div>
            </td>
            <td class="ct2-cell">
              <div class="ct2-row">
                <span class="ct2-lbl">Total T.T.C :</span>
                <span class="ct2-val ct2-money">{{ fmt3(billing.totalFacture) }}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Bottom: cars + insurance -->
        <div class="ct2-bottom">
          <div class="ct2-cars-block">
            <div class="ct2-car-pair-wrap">
              <div class="ct2-car-pair">
                <div class="ct2-car-mini">
                  <div class="ct2-car-lbl">AV</div>
                  <svg width="46" height="22" viewBox="0 0 46 22"><rect x="2" y="3" width="42" height="16" rx="3" fill="none" stroke="#000" stroke-width="0.8"/><line x1="23" y1="3" x2="23" y2="19" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2,2"/></svg>
                </div>
                <div class="ct2-car-mini">
                  <div class="ct2-car-lbl">AR</div>
                  <svg width="46" height="22" viewBox="0 0 46 22"><rect x="2" y="3" width="42" height="16" rx="3" fill="none" stroke="#000" stroke-width="0.8"/><line x1="23" y1="3" x2="23" y2="19" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2,2"/></svg>
                </div>
              </div>
              <div class="ct2-car-cap">
                <b>Départ</b>
                <span class="ct2-sub-ar">الخروج</span>
              </div>
            </div>
            <div class="ct2-car-pair-wrap">
              <div class="ct2-car-pair">
                <div class="ct2-car-mini">
                  <div class="ct2-car-lbl">AV</div>
                  <svg width="46" height="22" viewBox="0 0 46 22"><rect x="2" y="3" width="42" height="16" rx="3" fill="none" stroke="#000" stroke-width="0.8"/><line x1="23" y1="3" x2="23" y2="19" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2,2"/></svg>
                </div>
                <div class="ct2-car-mini">
                  <div class="ct2-car-lbl">AR</div>
                  <svg width="46" height="22" viewBox="0 0 46 22"><rect x="2" y="3" width="42" height="16" rx="3" fill="none" stroke="#000" stroke-width="0.8"/><line x1="23" y1="3" x2="23" y2="19" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2,2"/></svg>
                </div>
              </div>
              <div class="ct2-car-cap">
                <b>Retour</b>
                <span class="ct2-sub-ar">الدخول</span>
              </div>
            </div>
          </div>
          <div class="ct2-insurance">
            L'assurance ne couvre pas les brises de glace, la perte de papier d'accessoires et les dommages causés aux pneumatiques et particulièrement les dommages causés aux véhicules dûs à une mauvaise conduite ainsi que les jours d'immobilisation sont à la charge du client.
          </div>
        </div>

        <!-- Acceptance text -->
        <div class="ct2-acceptance">
          J'ai lu et accepté les conditions ci-contre et au verso de contrat.<br>
          Je suis responsable des violations à la loi sur la circulation routière.
        </div>

        <!-- Signatures -->
        <div class="ct2-signatures">
          <div class="ct2-sig-cell">
            <div class="ct2-sig-label">Signature du client :</div>
            <div class="ct2-sig-area"></div>
          </div>
          <div class="ct2-sig-cell">
            <div class="ct2-sig-label">Contrat préparé par :<br><span style="font-weight:400;">Signature et Cachet</span></div>
            <div class="ct2-sig-area"></div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══════ PAGE 2 — Conditions Générales (shared) ═══════ -->
    <ContractConditionsPage />
  </div>
</template>

<style scoped>
/* ── Wrapper ── */
.ct2-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Paper (V2 page 1 only, scoped via .ct2-paper to avoid bleed onto shared page 2) ── */
.ct2-paper {
  background: #fff;
  width: 794px;
  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  font-size: 9px;
  color: #000;
  border: 1px solid #999;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.ct2-paper * { box-sizing: border-box; }
.ct2-inner { padding: 8px 10px 10px; }

/* ── Header strip ── */
.ct2-header {
  display: grid;
  grid-template-columns: 150px 1fr 200px;
  gap: 6px;
  align-items: center;
  padding-bottom: 4px;
  border-bottom: 1px solid #000;
}
.ct2-header-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ct2-header-logo img {
  max-height: 50px;
  max-width: 140px;
  object-fit: contain;
}
.ct2-logo-fallback-name {
  color: #e85a1a;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 1.5px;
  line-height: 1;
}
.ct2-logo-fallback-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #000;
}

.ct2-header-title {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ct2-title-ar {
  font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Amiri', 'Noto Naskh Arabic', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #e85a1a;
  line-height: 1.25;
  direction: rtl;
  unicode-bidi: isolate;
}
.ct2-title-fr {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #000;
}

.ct2-header-contact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 8.5px;
  line-height: 1.25;
  border-left: 1px solid #000;
  padding-left: 8px;
}
.ct2-contact-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.ct2-contact-icon {
  font-size: 10px;
  width: 12px;
  text-align: center;
  flex-shrink: 0;
  color: #444;
}
.ct2-contact-text {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-all;
}
.ct2-contact-row-mf {
  margin-top: 1px;
  padding-top: 2px;
  border-top: 1px dotted #ccc;
}
.ct2-contact-row-mf .ct2-contact-text b {
  margin-right: 2px;
}

/* ── M.F / RIB ── */
.ct2-mfrib {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 4px;
  border-bottom: 1px solid #000;
  font-size: 9px;
}

/* ── Doc title ── */
.ct2-doc-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 5px 4px;
  border-bottom: 1px solid #000;
}
.ct2-doc-title-fr {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
}
.ct2-doc-num {
  font-size: 14px;
  font-weight: 800;
  color: #d7351a;
  font-family: "Courier New", monospace;
  letter-spacing: 1px;
}
.ct2-doc-title-ar {
  font-size: 18px;
  font-weight: 700;
  color: #d7351a;
  font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Amiri', 'Noto Naskh Arabic', sans-serif;
  margin-left: auto;
  direction: rtl;
  unicode-bidi: isolate;
  line-height: 1.3;
}

/* ── Generic grid table ── */
.ct2-grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.ct2-grid td.ct2-cell {
  border: 1px solid #000;
  padding: 4px 5px 7px;
  vertical-align: top;
  position: relative;
  font-size: 9px;
}

/* Use display: table for label+value rows — far more reliable than flex when
   the element is cloned for html2canvas PDF export. */
.ct2-row {
  display: table;
  width: 100%;
  table-layout: auto;
  border-spacing: 0;
}
.ct2-row + .ct2-row { margin-top: 2px; }

.ct2-lbl {
  display: table-cell;
  font-weight: 700;
  font-size: 8.5px;
  color: #000;
  letter-spacing: 0.1px;
  white-space: nowrap;
  vertical-align: baseline;
  width: 1%;
  padding-right: 4px;
}
.ct2-val {
  display: table-cell;
  vertical-align: baseline;
  border-bottom: 1px solid #bbb;
  padding: 1px 2px 2px;
  font-family: "Courier New", monospace;
  color: #1040b0;
  font-size: 12px;
  font-weight: 700;
  word-break: break-word;
  line-height: 1.25;
  min-height: 16px;
  letter-spacing: 0.2px;
}
/* Block context (when a cell uses stacked label/value/arabic layout
   instead of an inline ct2-row). The .ct2-lbl block fallback comes
   from the bare <div class="ct2-lbl"> inside cells. */
.ct2-cell > .ct2-lbl {
  display: block;
  width: auto;
  padding-right: 0;
  margin-bottom: 1px;
}
.ct2-cell > .ct2-val {
  display: block;
  width: 100%;
}
.ct2-multiline {
  display: block;
  min-height: 16px;
  white-space: pre-wrap;
  line-height: 1.3;
}
.ct2-sub-ar {
  font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Noto Naskh Arabic', 'Amiri', sans-serif;
  font-size: 8.5px;
  color: #444;
  text-align: right;
  direction: rtl;
  unicode-bidi: isolate;
  margin-top: 4px;
  margin-bottom: 1px;
  line-height: 1.6;
  padding: 1px 2px 0;
  /* Don't clip Arabic — let descenders be visible.
     Cell padding gives the room they need. */
  overflow: visible;
}

/* TU box (vertical) */
.ct2-cell.ct2-tu {
  text-align: center;
  padding: 4px 2px 3px;
}
.ct2-tu-fr {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 1px;
}
.ct2-cell.ct2-tu .ct2-sub-ar {
  text-align: center;
}

/* Section header — full-width border row */
.ct2-section-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  background: #ffffff;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
  font-weight: 700;
  font-size: 10px;
  text-align: center;
}
.ct2-section-thin {
  background: #f5f5f5;
}
.ct2-section-fr {
  flex: 1 1 auto;
  min-width: 0;
  text-align: center;
  letter-spacing: 0.5px;
}
.ct2-section-ar {
  font-family: 'Tahoma', 'Sakkal Majalla', 'Arial Unicode MS', 'Amiri', 'Noto Naskh Arabic', sans-serif;
  font-size: 11px;
  font-weight: 700;
  flex: 1 1 auto;
  min-width: 0;
  text-align: center;
  direction: rtl;
  unicode-bidi: isolate;
  line-height: 1.5;
}

/* Motif checkboxes — 2-col grid: Touriste/Autres on row 1, Affaire on row 2 */
.ct2-motifs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
  margin-top: 2px;
}
.ct2-motif {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font-size: 8.5px;
  font-weight: 600;
}
.ct2-chk-box {
  width: 12px;
  height: 12px;
  border: 1px solid #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 800;
  flex-shrink: 0;
  line-height: 1;
  background: #fff;
}

/* Prolongation sub-block */
.ct2-prol {
  margin-top: 3px;
  padding-top: 3px;
  border-top: 1px dashed #999;
  font-size: 8.5px;
  display: flex;
  flex-direction: column;
  gap: 1.5px;
}

/* PAYEMENT / RÈGLEMENT headers row */
.ct2-pay-hdr-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
}
.ct2-pay-hdr {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 6px;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.5px;
  border-right: 1px solid #000;
}
.ct2-pay-hdr:last-child { border-right: none; }
.ct2-pay-hdr .ct2-section-ar {
  flex: none;
  font-size: 11px;
}

.ct2-pay-grid td.ct2-cell {
  padding: 5px 8px;
  min-height: 22px;
}
.ct2-pay-grid .ct2-val {
  border-bottom: none;
}
.ct2-pay-grid .ct2-row > .ct2-val.ct2-money {
  text-align: right;
}

.ct2-money {
  font-weight: 700;
  letter-spacing: 0.3px;
}

/* Bottom: cars + insurance */
.ct2-bottom {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 6px;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
  padding: 4px 6px;
}
.ct2-cars-block {
  display: flex;
  gap: 8px;
}
.ct2-car-pair-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}
.ct2-car-pair {
  display: flex;
  gap: 4px;
}
.ct2-car-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ct2-car-lbl {
  font-size: 7px;
  font-weight: 700;
  margin-bottom: 1px;
}
.ct2-car-cap {
  text-align: center;
  font-size: 8.5px;
  font-weight: 700;
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ct2-insurance {
  font-size: 8.5px;
  line-height: 1.35;
  color: #111;
  padding-left: 8px;
  border-left: 1px solid #000;
}

/* Acceptance text */
.ct2-acceptance {
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
  padding: 4px 6px;
  font-size: 8.5px;
  font-style: italic;
  line-height: 1.4;
}

/* Signatures */
.ct2-signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  border-bottom: 1px solid #000;
}
.ct2-sig-cell {
  padding: 4px 6px;
  border-right: 1px solid #000;
}
.ct2-sig-cell:last-child { border-right: none; }
.ct2-sig-label {
  font-size: 9px;
  font-weight: 700;
  margin-bottom: 4px;
}
.ct2-sig-area {
  height: 60px;
}

@media print {
  .ct2-paper { box-shadow: none; border: none; width: 100%; }
}
</style>
