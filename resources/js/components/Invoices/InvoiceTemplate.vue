<script setup lang="ts">
import { computed, watchEffect } from 'vue';

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
    tvaRate: number;
    timbreFiscal: number;
  };
}

const props = withDefaults(
  defineProps<{
    data: InvoiceData;
    exportMode?: boolean;
  }>(),
  {
    exportMode: false,
  }
);

function lineTotalHT(item: InvoiceData['items'][number]) {
  const unit = Number(item.unitPriceHT) || 0;
  const qte = Number(item.qte) || 0;
  return unit * qte;
}

watchEffect(() => {
  props.data.items.forEach((item) => {
    item.totalHT = lineTotalHT(item);
  });
});

const totalHT = computed(() =>
  props.data.items.reduce((sum, item) => sum + lineTotalHT(item), 0)
);

const totalTVA = computed(() => {
  const rate = Number(props.data.tax.tvaRate) || 0;
  return totalHT.value * rate;
});

const totalTTC = computed(() => {
  const timbre = Number(props.data.tax.timbreFiscal) || 0;
  return totalHT.value + totalTVA.value + timbre;
});

const currencyFormatter = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function fmt(amount: number) {
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function tvaPercent() {
  return ((Number(props.data.tax.tvaRate) || 0) * 100).toFixed(0);
}
</script>

<template>
  <div id="invoice-template" class="invoice-page">
    <!-- Header -->
    <div class="inv-header">
      <div class="inv-company">
        <img
          v-if="data.company.logoUrl"
          :src="data.company.logoUrl"
          class="inv-logo"
          alt="Logo"
        />
        <div class="inv-company-name">{{ data.company.name }}</div>
        <div class="inv-company-detail">{{ data.company.address }}</div>
        <div class="inv-company-detail">MF: {{ data.company.mf }}</div>
        <div class="inv-company-detail">Email: {{ data.company.email }}</div>
        <div class="inv-company-detail">GSM: {{ data.company.gsm.join(' / ') }}</div>
      </div>
      <div class="inv-title-block">
        <div class="inv-title">FACTURE</div>
        <div class="inv-meta">
          <span class="inv-meta-label">N°:</span>
          <span v-if="exportMode" class="inv-meta-value">{{ data.invoiceNumber }}</span>
          <input v-else v-model="data.invoiceNumber" class="inv-input inv-input-right" />
        </div>
        <div class="inv-meta">
          <span class="inv-meta-label">Date:</span>
          <span v-if="exportMode" class="inv-meta-value">{{ data.invoiceDate }}</span>
          <input v-else v-model="data.invoiceDate" class="inv-input inv-input-right" />
        </div>
      </div>
    </div>

    <!-- Separator -->
    <div class="inv-sep"></div>

    <!-- Client -->
    <div class="inv-client-section">
      <div class="inv-client-label">CLIENT</div>
      <div class="inv-client-box">
        <div class="inv-client-name">{{ data.client.name }}</div>
        <div class="inv-client-detail">{{ data.client.address }}</div>
        <div class="inv-client-row">
          <span>MF: {{ data.client.mf }}</span>
          <span>Tel: {{ data.client.tel }}</span>
        </div>
      </div>
    </div>

    <!-- Items -->
    <div class="inv-items-section">
      <div class="inv-items-header">
        <span class="inv-col-num">#</span>
        <span class="inv-col-desc">Désignation</span>
        <span class="inv-col-dur">Durée</span>
        <span class="inv-col-pu">P.U H.T</span>
        <span class="inv-col-unite">Unité</span>
        <span class="inv-col-qte">Qté</span>
        <span class="inv-col-total">Total H.T</span>
      </div>

      <div v-for="(item, idx) in data.items" :key="idx" class="inv-items-row">
        <span class="inv-col-num">{{ idx + 1 }}</span>
        <span class="inv-col-desc">{{ item.designation }}</span>
        <span class="inv-col-dur">{{ item.duree }}</span>
        <span class="inv-col-pu inv-mono">{{ fmt(item.unitPriceHT) }}</span>
        <span class="inv-col-unite">{{ item.unite }}</span>
        <span class="inv-col-qte inv-mono">{{ item.qte }}</span>
        <span class="inv-col-total inv-mono inv-bold">{{ fmt(lineTotalHT(item)) }}</span>
      </div>
    </div>

    <!-- Totals -->
    <div class="inv-totals-section">
      <div class="inv-totals-box">
        <div class="inv-total-line">
          <span class="inv-total-label">Total H.T</span>
          <span class="inv-total-value inv-mono">{{ fmt(totalHT) }}</span>
        </div>
        <div class="inv-total-line">
          <span class="inv-total-label">TVA ({{ tvaPercent() }}%)</span>
          <span class="inv-total-value inv-mono">{{ fmt(totalTVA) }}</span>
        </div>
        <div class="inv-total-line">
          <span class="inv-total-label">Timbre fiscal</span>
          <span class="inv-total-value inv-mono">{{ fmt(data.tax.timbreFiscal) }}</span>
        </div>
        <div class="inv-total-line inv-total-ttc">
          <span class="inv-total-label">Total T.T.C</span>
          <span class="inv-total-value inv-mono">{{ fmt(totalTTC) }}</span>
        </div>
      </div>
    </div>

    <!-- Signature -->
    <div class="inv-signature-section">
      <div class="inv-signature-box">
        <div class="inv-signature-title">Cachet et Signature</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="inv-footer">
      <div>{{ data.company.name }} &mdash; {{ data.company.address }}</div>
      <div>MF: {{ data.company.mf }} | Email: {{ data.company.email }} | GSM: {{ data.company.gsm.join(' / ') }}</div>
    </div>
  </div>
</template>

<style scoped>
/* ===================== A4 Page ===================== */
.invoice-page {
  width: 210mm;
  min-height: 280mm;
  padding: 12mm 14mm;
  margin: 0 auto;
  background-color: #ffffff;
  color: #1a1a1a;
  font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
  font-size: 11px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.invoice-page * {
  box-sizing: border-box;
}

/* ===================== Header ===================== */
.inv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8mm;
}

.inv-company {
  max-width: 55%;
}

.inv-logo {
  height: 60px;
  max-width: 200px;
  object-fit: contain;
  margin-bottom: 6px;
}

.inv-company-name {
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  color: #1f2937;
  margin-bottom: 4px;
}

.inv-company-detail {
  font-size: 10px;
  color: #4b5563;
  line-height: 1.6;
}

.inv-title-block {
  text-align: right;
}

.inv-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 4px;
  color: #1f2937;
  margin-bottom: 8px;
}

.inv-meta {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  font-size: 12px;
}

.inv-meta-label {
  font-weight: 600;
  color: #374151;
}

.inv-meta-value {
  color: #1f2937;
}

/* ===================== Separator ===================== */
.inv-sep {
  height: 2px;
  background-color: #1f2937;
  margin-bottom: 8mm;
}

/* ===================== Client ===================== */
.inv-client-section {
  margin-bottom: 8mm;
  margin-left: auto;
  width: 55%;
}

.inv-client-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #6b7280;
  margin-bottom: 4px;
}

.inv-client-box {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 10px 14px;
  background-color: #f9fafb;
}

.inv-client-name {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.inv-client-detail {
  font-size: 11px;
  color: #4b5563;
  margin-bottom: 2px;
}

.inv-client-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #6b7280;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e5e7eb;
}

/* ===================== Items ===================== */
.inv-items-section {
  margin-bottom: 8mm;
}

.inv-items-header {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-top: 2px solid #1f2937;
  border-bottom: 2px solid #1f2937;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #374151;
  background-color: #f3f4f6;
}

.inv-items-row {
  display: flex;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 11px;
  color: #1f2937;
}

/* Column widths */
.inv-col-num   { width: 5%;  text-align: center; padding: 0 4px; }
.inv-col-desc  { width: 32%; text-align: left;   padding: 0 6px; }
.inv-col-dur   { width: 21%; text-align: center; padding: 0 4px; font-size: 10px; }
.inv-col-pu    { width: 13%; text-align: right;  padding: 0 6px; }
.inv-col-unite { width: 8%;  text-align: center; padding: 0 4px; }
.inv-col-qte   { width: 7%;  text-align: center; padding: 0 4px; }
.inv-col-total { width: 14%; text-align: right;  padding: 0 6px; }

/* ===================== Totals ===================== */
.inv-totals-section {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10mm;
}

.inv-totals-box {
  width: 45%;
}

.inv-total-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.inv-total-label {
  font-weight: 600;
  color: #374151;
}

.inv-total-value {
  color: #1f2937;
}

.inv-total-ttc {
  background-color: #1f2937;
  color: #ffffff;
  border-bottom: none;
  border-radius: 0 0 4px 4px;
  font-size: 14px;
  padding: 8px 12px;
}

.inv-total-ttc .inv-total-label,
.inv-total-ttc .inv-total-value {
  color: #ffffff;
  font-weight: 700;
}

/* ===================== Signature ===================== */
.inv-signature-section {
  margin-bottom: 10mm;
}

.inv-signature-box {
  width: 45%;
  min-height: 80px;
  border: 1px dashed #9ca3af;
  border-radius: 4px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
}

.inv-signature-title {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

/* ===================== Footer ===================== */
.inv-footer {
  margin-top: auto;
  padding-top: 6mm;
  border-top: 1px solid #d1d5db;
  text-align: center;
  font-size: 9px;
  color: #9ca3af;
  line-height: 1.6;
}

/* ===================== Shared ===================== */
.inv-mono {
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', Courier, monospace;
}

.inv-bold {
  font-weight: 700;
}

/* ===================== Inputs (edit mode only) ===================== */
.inv-input {
  border: none;
  background: transparent;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  padding: 0;
  margin: 0;
  outline: none;
  width: 140px;
}

.inv-input:focus {
  outline: none;
  box-shadow: none;
  border-bottom: 1px solid #6366f1;
}

.inv-input-right {
  text-align: right;
}

/* ===================== Print ===================== */
@page {
  size: A4;
  margin: 0;
}

@media print {
  .invoice-page {
    width: 210mm;
    min-height: 290mm;
    padding: 10mm;
    margin: 0;
    box-shadow: none;
  }
}
</style>
