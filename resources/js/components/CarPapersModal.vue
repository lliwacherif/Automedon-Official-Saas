<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFileUpload } from '@/composables/useFileUpload';
import { useCars, type Car, type CarPaperType } from '@/composables/useCars';
import { useTenantLink } from '@/composables/useTenantLink';
import { useRouter } from 'vue-router';
import {
    X,
    FileText,
    Shield,
    BadgeCheck,
    Wrench,
    Upload,
    Eye,
    Download,
    Trash2,
    Loader2,
    ImageOff,
    FileCheck2,
    ExternalLink,
} from 'lucide-vue-next';

interface Props {
    show: boolean;
    car: Car | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'updated', car: Car): void;
}>();

const { uploadFile, deleteFile, uploading } = useFileUpload();
const { updateCar } = useCars();
const { tenantPath } = useTenantLink();
const router = useRouter();

interface PaperSection {
    type: CarPaperType;
    field: keyof Car;
    label: string;
    description: string;
    icon: any;
    accent: string;
}

const SECTIONS: PaperSection[] = [
    {
        type: 'carte_grise',
        field: 'carte_grise_url',
        label: 'Carte Grise',
        description: "Carte grise du véhicule",
        icon: FileText,
        accent: 'indigo',
    },
    {
        type: 'assurance',
        field: 'assurance_url',
        label: 'Assurance',
        description: "Police d'assurance en cours",
        icon: Shield,
        accent: 'emerald',
    },
    {
        type: 'vignette',
        field: 'vignette_url',
        label: 'Vignette',
        description: 'Vignette routière (taxe)',
        icon: BadgeCheck,
        accent: 'amber',
    },
    {
        type: 'visite_technique',
        field: 'visite_technique_url',
        label: 'Visite Technique',
        description: 'Procès-verbal de visite technique',
        icon: Wrench,
        accent: 'rose',
    },
];

// Per-section pending upload + busy state
const sectionBusy = ref<Record<CarPaperType, boolean>>({
    carte_grise: false,
    assurance: false,
    vignette: false,
    visite_technique: false,
});

function getCurrentUrl(section: PaperSection): string | null {
    if (!props.car) return null;
    return (props.car as any)[section.field] ?? null;
}

function isPdf(url: string | null): boolean {
    return !!url && /\.pdf(\?|$)/i.test(url);
}

const carDisplayName = computed(() => {
    if (!props.car) return '';
    return `${props.car.brand} ${props.car.model}`;
});

function close() {
    emit('close');
}

async function handleFileSelect(event: Event, section: PaperSection) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !props.car) return;

    if (file.size > 15 * 1024 * 1024) {
        alert('Le fichier ne doit pas dépasser 15 MB.');
        return;
    }

    sectionBusy.value[section.type] = true;
    try {
        const folder = `${props.car.id}/${section.type}`;
        const url = await uploadFile(file, 'car-papers', folder);
        if (!url) return;

        // Optionally remove the previous file to avoid orphans
        const previous = getCurrentUrl(section);
        if (previous) {
            try { await deleteFile(previous, 'car-papers'); } catch { /* non-fatal */ }
        }

        const updated = await updateCar(props.car.id, { [section.field]: url } as any);
        if (updated) emit('updated', updated);
    } catch (e) {
        console.error('Error uploading paper:', e);
    } finally {
        sectionBusy.value[section.type] = false;
    }
}

async function removePaper(section: PaperSection) {
    if (!props.car) return;
    const url = getCurrentUrl(section);
    if (!url) return;
    if (!confirm(`Supprimer ce document (${section.label}) ?`)) return;

    sectionBusy.value[section.type] = true;
    try {
        try { await deleteFile(url, 'car-papers'); } catch { /* non-fatal */ }
        const updated = await updateCar(props.car.id, { [section.field]: null } as any);
        if (updated) emit('updated', updated);
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
    if (!url || !props.car) return;
    const ext = (url.split('.').pop() || 'jpg').split('?')[0];
    const filename = `${props.car.plate_number}_${section.type}.${ext}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function openGalleryPage() {
    if (!props.car) return;
    router.push(tenantPath(`/admin/cars/${props.car.id}/papers`));
    close();
}
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="show && car" class="fixed inset-0 z-50 overflow-y-auto">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>

                <div class="flex min-h-full items-center justify-center p-4">
                    <div class="modal-container relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
                        <!-- Header -->
                        <div class="shrink-0 px-5 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/40 to-violet-50/30">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                                    <FileCheck2 class="w-4 h-4 text-white" />
                                </div>
                                <div class="min-w-0">
                                    <h3 class="text-base font-bold text-gray-900 truncate">Documents administratifs</h3>
                                    <p class="text-xs text-gray-500 truncate">
                                        <span class="font-mono font-bold text-gray-700">{{ car.plate_number }}</span>
                                        <span class="mx-1.5 text-gray-300">·</span>
                                        {{ carDisplayName }}
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    @click="openGalleryPage"
                                    class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-white hover:bg-indigo-50 rounded-lg ring-1 ring-indigo-200/60 transition-colors"
                                >
                                    <ExternalLink class="w-3.5 h-3.5" />
                                    Galerie
                                </button>
                                <button
                                    type="button"
                                    @click="close"
                                    class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                    aria-label="Fermer"
                                >
                                    <X class="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <!-- Body -->
                        <div class="flex-1 overflow-y-auto p-5 md:p-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div
                                    v-for="section in SECTIONS"
                                    :key="section.type"
                                    class="paper-card"
                                    :class="`paper-card--${section.accent}`"
                                >
                                    <!-- Section header -->
                                    <div class="paper-card__header">
                                        <div class="paper-card__icon">
                                            <component :is="section.icon" class="w-4 h-4" />
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <h4 class="text-sm font-bold text-gray-900 truncate">{{ section.label }}</h4>
                                            <p class="text-[11px] text-gray-500 truncate">{{ section.description }}</p>
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

                                    <!-- Preview area -->
                                    <div class="paper-card__preview">
                                        <template v-if="getCurrentUrl(section) && !isPdf(getCurrentUrl(section))">
                                            <img
                                                :src="getCurrentUrl(section)!"
                                                :alt="section.label"
                                                class="paper-card__image"
                                                @click="viewPaper(section)"
                                                @error="($event.target as HTMLImageElement).style.display='none'"
                                            />
                                        </template>
                                        <template v-else-if="getCurrentUrl(section) && isPdf(getCurrentUrl(section))">
                                            <button
                                                type="button"
                                                @click="viewPaper(section)"
                                                class="paper-card__pdf"
                                            >
                                                <FileText class="w-9 h-9 text-red-400" />
                                                <span class="text-xs font-bold text-gray-700 mt-2">Document PDF</span>
                                                <span class="text-[10px] text-gray-400">Cliquer pour ouvrir</span>
                                            </button>
                                        </template>
                                        <div v-else class="paper-card__placeholder">
                                            <ImageOff class="w-7 h-7 text-gray-300 mb-1.5" />
                                            <span class="text-[11px] text-gray-400 font-medium">Aucun document</span>
                                        </div>

                                        <!-- Spinner overlay while busy -->
                                        <div v-if="sectionBusy[section.type]" class="paper-card__busy">
                                            <Loader2 class="w-5 h-5 text-indigo-500 animate-spin" />
                                        </div>
                                    </div>

                                    <!-- Action buttons -->
                                    <div class="paper-card__actions">
                                        <label class="paper-action paper-action--primary cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                class="hidden"
                                                :disabled="sectionBusy[section.type]"
                                                @change="(e) => handleFileSelect(e, section)"
                                            />
                                            <Upload class="w-3.5 h-3.5" />
                                            {{ getCurrentUrl(section) ? 'Remplacer' : 'Téléverser' }}
                                        </label>

                                        <button
                                            v-if="getCurrentUrl(section)"
                                            type="button"
                                            class="paper-action"
                                            :disabled="sectionBusy[section.type]"
                                            @click="viewPaper(section)"
                                            :title="`Voir ${section.label}`"
                                        >
                                            <Eye class="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            v-if="getCurrentUrl(section)"
                                            type="button"
                                            class="paper-action"
                                            :disabled="sectionBusy[section.type]"
                                            @click="downloadPaper(section)"
                                            :title="`Télécharger ${section.label}`"
                                        >
                                            <Download class="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            v-if="getCurrentUrl(section)"
                                            type="button"
                                            class="paper-action paper-action--danger"
                                            :disabled="sectionBusy[section.type]"
                                            @click="removePaper(section)"
                                            :title="`Supprimer ${section.label}`"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Footer note -->
                            <p class="text-[11px] text-gray-400 mt-5 text-center">
                                Formats acceptés: image (JPG, PNG, WEBP, HEIC) ou PDF · 15 MB max par document.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.paper-card {
    background: white;
    border-radius: 1rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.paper-card__header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    border-bottom: 1px solid rgb(243 244 246 / 0.8);
}

.paper-card__icon {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.paper-card--indigo  .paper-card__icon { background: rgb(238 242 255); color: rgb(79 70 229); }
.paper-card--emerald .paper-card__icon { background: rgb(209 250 229); color: rgb(5 150 105); }
.paper-card--amber   .paper-card__icon { background: rgb(254 243 199); color: rgb(180 83 9); }
.paper-card--rose    .paper-card__icon { background: rgb(255 228 230); color: rgb(225 29 72); }

.paper-card__preview {
    position: relative;
    aspect-ratio: 4 / 3;
    background: linear-gradient(180deg, rgb(249 250 251), rgb(243 244 246));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.paper-card__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: zoom-in;
    transition: transform 0.3s ease;
}

.paper-card__image:hover {
    transform: scale(1.03);
}

.paper-card__pdf {
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

.paper-card__pdf:hover {
    background: linear-gradient(180deg, rgb(254 226 226 / 0.7), rgb(254 202 202 / 0.5));
}

.paper-card__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.paper-card__busy {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
}

.paper-card__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 0.75rem;
    border-top: 1px solid rgb(243 244 246 / 0.8);
}

.paper-action {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 2rem;
    width: 2rem;
    padding: 0;
    background: rgb(249 250 251);
    border: none;
    border-radius: 0.5rem;
    color: rgb(75 85 99);
    box-shadow: inset 0 0 0 1px rgb(229 231 235);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.paper-action:hover:not(:disabled) {
    background: rgb(238 242 255);
    color: rgb(67 56 202);
    box-shadow: inset 0 0 0 1px rgb(199 210 254);
}

.paper-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.paper-action--primary {
    flex: 1;
    height: 2rem;
    width: auto;
    padding: 0 0.875rem;
    background: linear-gradient(135deg, rgb(99 102 241), rgb(79 70 229));
    color: white;
    box-shadow: 0 1px 2px rgba(79, 70, 229, 0.25);
    font-size: 0.75rem;
    font-weight: 700;
}

.paper-action--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, rgb(79 70 229), rgb(67 56 202));
    color: white;
    box-shadow: 0 2px 6px rgba(79, 70, 229, 0.35);
}

.paper-action--danger:hover:not(:disabled) {
    background: rgb(254 226 226);
    color: rgb(185 28 28);
    box-shadow: inset 0 0 0 1px rgb(252 165 165);
}

/* Modal transitions */
.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-container { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-leave-active .modal-container { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-container { opacity: 0; transform: scale(0.96) translateY(10px); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-container { opacity: 0; transform: scale(0.97) translateY(5px); }
</style>
