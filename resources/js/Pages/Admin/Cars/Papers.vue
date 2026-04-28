<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCars, type Car as CarType, type CarPaperType } from '@/composables/useCars';
import { useFileUpload } from '@/composables/useFileUpload';
import { useTenantLink } from '@/composables/useTenantLink';
import {
    ArrowLeft,
    FileText,
    Shield,
    BadgeCheck,
    Wrench,
    Upload,
    Download,
    Eye,
    Trash2,
    Loader2,
    ImageOff,
    Car as CarIcon,
    FileCheck2,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { fetchCarById, updateCar } = useCars();
const { uploadFile, deleteFile } = useFileUpload();
const { tenantPath } = useTenantLink();

const car = ref<CarType | null>(null);
const loading = ref(true);

interface PaperSection {
    type: CarPaperType;
    field: keyof CarType;
    label: string;
    description: string;
    icon: any;
    accent: string;
}

const SECTIONS: PaperSection[] = [
    { type: 'carte_grise',      field: 'carte_grise_url',      label: 'Carte Grise',      description: 'Carte grise du véhicule',         icon: FileText,   accent: 'indigo'  },
    { type: 'assurance',        field: 'assurance_url',        label: 'Assurance',        description: "Police d'assurance en cours",     icon: Shield,     accent: 'emerald' },
    { type: 'vignette',         field: 'vignette_url',         label: 'Vignette',         description: 'Vignette routière (taxe)',        icon: BadgeCheck, accent: 'amber'   },
    { type: 'visite_technique', field: 'visite_technique_url', label: 'Visite Technique', description: 'Procès-verbal de visite technique', icon: Wrench,    accent: 'rose'    },
];

const sectionBusy = ref<Record<CarPaperType, boolean>>({
    carte_grise: false,
    assurance: false,
    vignette: false,
    visite_technique: false,
});

const completedCount = computed(() => {
    if (!car.value) return 0;
    return SECTIONS.filter(s => (car.value as any)[s.field]).length;
});

function getCurrentUrl(section: PaperSection): string | null {
    if (!car.value) return null;
    return (car.value as any)[section.field] ?? null;
}

function isPdf(url: string | null): boolean {
    return !!url && /\.pdf(\?|$)/i.test(url);
}

function goBack() {
    router.push(tenantPath('/admin/cars'));
}

async function handleFileSelect(event: Event, section: PaperSection) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !car.value) return;

    if (file.size > 15 * 1024 * 1024) {
        alert('Le fichier ne doit pas dépasser 15 MB.');
        return;
    }

    sectionBusy.value[section.type] = true;
    try {
        const folder = `${car.value.id}/${section.type}`;
        const url = await uploadFile(file, 'car-papers', folder);
        if (!url) return;

        const previous = getCurrentUrl(section);
        if (previous) {
            try { await deleteFile(previous, 'car-papers'); } catch { /* non-fatal */ }
        }

        const updated = await updateCar(car.value.id, { [section.field]: url } as any);
        if (updated) car.value = { ...car.value, ...updated };
    } catch (e) {
        console.error('Error uploading paper:', e);
    } finally {
        sectionBusy.value[section.type] = false;
    }
}

async function removePaper(section: PaperSection) {
    if (!car.value) return;
    const url = getCurrentUrl(section);
    if (!url) return;
    if (!confirm(`Supprimer ce document (${section.label}) ?`)) return;

    sectionBusy.value[section.type] = true;
    try {
        try { await deleteFile(url, 'car-papers'); } catch { /* non-fatal */ }
        const updated = await updateCar(car.value.id, { [section.field]: null } as any);
        if (updated) car.value = { ...car.value, ...updated };
    } catch (e) {
        console.error('Error removing paper:', e);
    } finally {
        sectionBusy.value[section.type] = false;
    }
}

function viewPaper(section: PaperSection) {
    const url = getCurrentUrl(section);
    if (!url) return;
    window.open(url, '_blank', 'noopener');
}

function downloadPaper(section: PaperSection) {
    const url = getCurrentUrl(section);
    if (!url || !car.value) return;
    const ext = (url.split('.').pop() || 'jpg').split('?')[0];
    const filename = `${car.value.plate_number}_${section.type}.${ext}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadAll() {
    if (!car.value) return;
    for (const section of SECTIONS) {
        if (getCurrentUrl(section)) {
            // Stagger slightly so the browser doesn't suppress concurrent downloads
            setTimeout(() => downloadPaper(section), 150 * SECTIONS.indexOf(section));
        }
    }
}

onMounted(async () => {
    const carId = Number(route.params.id);
    if (!carId) {
        loading.value = false;
        return;
    }
    try {
        car.value = await fetchCarById(carId);
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="min-h-screen bg-gray-50/50">
        <div class="max-w-[1400px] mx-auto p-5 md:p-8 space-y-6">

            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        @click="goBack"
                        class="w-10 h-10 rounded-xl bg-white ring-1 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors"
                        aria-label="Retour à la flotte"
                    >
                        <ArrowLeft class="w-4 h-4" />
                    </button>
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <FileCheck2 class="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 tracking-tight">Documents administratifs</h1>
                        <p class="text-sm text-gray-500">Galerie des papiers de la voiture</p>
                    </div>
                </div>

                <button
                    v-if="car && completedCount > 0"
                    type="button"
                    @click="downloadAll"
                    class="self-start inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
                >
                    <Download class="w-4 h-4" />
                    Tout télécharger
                </button>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Loader2 class="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
                <p class="text-gray-500 font-medium">Chargement...</p>
            </div>

            <!-- Not found -->
            <div v-else-if="!car" class="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <CarIcon class="w-8 h-8 text-gray-300" />
                </div>
                <h3 class="text-base font-bold text-gray-900">Voiture introuvable</h3>
                <p class="mt-1.5 text-sm text-gray-400">Cette voiture n'existe pas ou a été supprimée.</p>
            </div>

            <template v-else>
                <!-- Car hero -->
                <div class="relative overflow-hidden bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                        <div class="relative aspect-[16/10] md:aspect-auto md:h-full bg-gradient-to-b from-slate-50 to-slate-100/80">
                            <img
                                v-if="car.image_url"
                                :src="car.image_url"
                                :alt="`${car.brand} ${car.model}`"
                                class="w-full h-full object-cover"
                                @error="($event.target as HTMLImageElement).style.display='none'"
                            >
                            <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageOff class="w-10 h-10" />
                            </div>
                        </div>
                        <div class="p-5 md:p-6 flex flex-col justify-between gap-4">
                            <div>
                                <div class="flex flex-wrap items-center gap-2 mb-2">
                                    <span class="inline-flex px-2.5 py-1 text-xs font-extrabold text-gray-700 bg-gray-50 rounded-lg ring-1 ring-gray-200 font-mono tracking-tight">
                                        {{ car.plate_number }}
                                    </span>
                                    <span
                                        class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md"
                                        :class="completedCount === 4
                                            ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/60'
                                            : completedCount > 0
                                                ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-200/60'
                                                : 'text-gray-500 bg-gray-50 ring-1 ring-gray-200/60'"
                                    >
                                        <BadgeCheck class="w-3 h-3" />
                                        {{ completedCount }}/4 documents
                                    </span>
                                </div>
                                <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">{{ car.brand }} {{ car.model }}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Big paper grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div
                        v-for="section in SECTIONS"
                        :key="section.type"
                        class="paper-tile"
                        :class="`paper-tile--${section.accent}`"
                    >
                        <!-- Header -->
                        <div class="paper-tile__header">
                            <div class="paper-tile__icon">
                                <component :is="section.icon" class="w-5 h-5" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <h3 class="text-base font-bold text-gray-900 truncate">{{ section.label }}</h3>
                                <p class="text-xs text-gray-500 truncate">{{ section.description }}</p>
                            </div>
                            <span
                                v-if="getCurrentUrl(section)"
                                class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-md ring-1 ring-emerald-200/60"
                            >
                                <BadgeCheck class="w-3 h-3" />
                                OK
                            </span>
                            <span
                                v-else
                                class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-gray-50 rounded-md ring-1 ring-gray-200/60"
                            >
                                Manquant
                            </span>
                        </div>

                        <!-- Big preview -->
                        <div class="paper-tile__preview">
                            <template v-if="getCurrentUrl(section) && !isPdf(getCurrentUrl(section))">
                                <img
                                    :src="getCurrentUrl(section)!"
                                    :alt="section.label"
                                    class="paper-tile__image"
                                    @click="viewPaper(section)"
                                    @error="($event.target as HTMLImageElement).style.display='none'"
                                />
                            </template>
                            <template v-else-if="getCurrentUrl(section) && isPdf(getCurrentUrl(section))">
                                <button
                                    type="button"
                                    @click="viewPaper(section)"
                                    class="paper-tile__pdf"
                                >
                                    <FileText class="w-12 h-12 text-red-400" />
                                    <span class="text-sm font-bold text-gray-700 mt-3">Document PDF</span>
                                    <span class="text-xs text-gray-400 mt-1">Cliquer pour ouvrir</span>
                                </button>
                            </template>
                            <div v-else class="paper-tile__placeholder">
                                <ImageOff class="w-10 h-10 text-gray-300 mb-2" />
                                <span class="text-sm text-gray-400 font-medium">Aucun document téléversé</span>
                                <label class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg ring-1 ring-indigo-200/60 cursor-pointer transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        class="hidden"
                                        :disabled="sectionBusy[section.type]"
                                        @change="(e) => handleFileSelect(e, section)"
                                    />
                                    <Upload class="w-3.5 h-3.5" />
                                    Téléverser
                                </label>
                            </div>

                            <div v-if="sectionBusy[section.type]" class="paper-tile__busy">
                                <Loader2 class="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                        </div>

                        <!-- Actions -->
                        <div v-if="getCurrentUrl(section)" class="paper-tile__actions">
                            <label class="paper-tile__action paper-tile__action--primary cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    class="hidden"
                                    :disabled="sectionBusy[section.type]"
                                    @change="(e) => handleFileSelect(e, section)"
                                />
                                <Upload class="w-3.5 h-3.5" />
                                Remplacer
                            </label>
                            <button
                                type="button"
                                class="paper-tile__action"
                                :disabled="sectionBusy[section.type]"
                                @click="viewPaper(section)"
                            >
                                <Eye class="w-3.5 h-3.5" />
                                Voir
                            </button>
                            <button
                                type="button"
                                class="paper-tile__action"
                                :disabled="sectionBusy[section.type]"
                                @click="downloadPaper(section)"
                            >
                                <Download class="w-3.5 h-3.5" />
                                Télécharger
                            </button>
                            <button
                                type="button"
                                class="paper-tile__action paper-tile__action--danger"
                                :disabled="sectionBusy[section.type]"
                                @click="removePaper(section)"
                            >
                                <Trash2 class="w-3.5 h-3.5" />
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.paper-tile {
    background: white;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.paper-tile__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid rgb(243 244 246);
}

.paper-tile__icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.paper-tile--indigo  .paper-tile__icon { background: rgb(238 242 255); color: rgb(79 70 229); }
.paper-tile--emerald .paper-tile__icon { background: rgb(209 250 229); color: rgb(5 150 105); }
.paper-tile--amber   .paper-tile__icon { background: rgb(254 243 199); color: rgb(180 83 9); }
.paper-tile--rose    .paper-tile__icon { background: rgb(255 228 230); color: rgb(225 29 72); }

.paper-tile__preview {
    position: relative;
    aspect-ratio: 4 / 3;
    background: linear-gradient(180deg, rgb(249 250 251), rgb(243 244 246));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.paper-tile__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: white;
    cursor: zoom-in;
    transition: transform 0.3s ease;
}

.paper-tile__image:hover {
    transform: scale(1.02);
}

.paper-tile__pdf {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, rgb(254 242 242 / 0.5), rgb(254 226 226 / 0.4));
    cursor: pointer;
    transition: background 0.2s ease;
}

.paper-tile__pdf:hover {
    background: linear-gradient(180deg, rgb(254 226 226 / 0.7), rgb(254 202 202 / 0.5));
}

.paper-tile__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.paper-tile__busy {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
}

.paper-tile__actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.375rem;
    padding: 0.75rem;
    border-top: 1px solid rgb(243 244 246);
}

.paper-tile__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 2.25rem;
    background: rgb(249 250 251);
    border: none;
    border-radius: 0.625rem;
    color: rgb(75 85 99);
    box-shadow: inset 0 0 0 1px rgb(229 231 235);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 700;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.paper-tile__action:hover:not(:disabled) {
    background: rgb(238 242 255);
    color: rgb(67 56 202);
    box-shadow: inset 0 0 0 1px rgb(199 210 254);
}

.paper-tile__action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.paper-tile__action--primary {
    background: linear-gradient(135deg, rgb(99 102 241), rgb(79 70 229));
    color: white;
    box-shadow: 0 1px 2px rgba(79, 70, 229, 0.25);
}

.paper-tile__action--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, rgb(79 70 229), rgb(67 56 202));
    color: white;
    box-shadow: 0 2px 6px rgba(79, 70, 229, 0.35);
}

.paper-tile__action--danger:hover:not(:disabled) {
    background: rgb(254 226 226);
    color: rgb(185 28 28);
    box-shadow: inset 0 0 0 1px rgb(252 165 165);
}

@media (max-width: 480px) {
    .paper-tile__actions {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>
