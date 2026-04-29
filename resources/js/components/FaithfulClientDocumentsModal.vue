<script setup lang="ts">
import { ref } from 'vue';
import { useFileUpload } from '@/composables/useFileUpload';
import {
    useFaithfulClients,
    FAITHFUL_CLIENT_MAX_DOCUMENTS,
    type FaithfulClient,
} from '@/composables/useFaithfulClients';
import {
    X,
    Upload,
    Eye,
    Download,
    Trash2,
    Loader2,
    ImageOff,
    FileText,
    User,
    Paperclip,
} from 'lucide-vue-next';

interface Props {
    show: boolean;
    client: FaithfulClient | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'updated', client: FaithfulClient): void;
}>();

const { uploadFile, deleteFile } = useFileUpload();
const { setClientDocuments } = useFaithfulClients();

// Per-slot busy state — keyed by slot index 0/1
const slotBusy = ref<boolean[]>([false, false]);

function getSlotUrl(slotIdx: number): string | null {
    const docs = props.client?.documents || [];
    return docs[slotIdx] ?? null;
}

function isPdf(url: string | null): boolean {
    return !!url && /\.pdf(\?|$)/i.test(url);
}

function close() {
    emit('close');
}

async function handleFileSelect(event: Event, slotIdx: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !props.client) return;

    if (file.size > 15 * 1024 * 1024) {
        alert('Le fichier ne doit pas dépasser 15 MB.');
        return;
    }

    slotBusy.value[slotIdx] = true;
    try {
        const folder = `${props.client.id}`;
        const url = await uploadFile(file, 'client-papers', folder);
        if (!url) return;

        const previous = getSlotUrl(slotIdx);
        if (previous) {
            try { await deleteFile(previous, 'client-papers'); } catch { /* non-fatal */ }
        }

        const docs = [...(props.client.documents || [])];
        // Pad with empty placeholders so we can splice at the slot index
        while (docs.length <= slotIdx) docs.push('');
        docs[slotIdx] = url;
        // Remove any trailing empty placeholders
        const cleaned = docs.filter(Boolean);

        const updated = await setClientDocuments(props.client.id, cleaned);
        if (updated) emit('updated', updated);
    } catch (e) {
        console.error('Error uploading client document:', e);
    } finally {
        slotBusy.value[slotIdx] = false;
    }
}

async function removeSlot(slotIdx: number) {
    if (!props.client) return;
    const url = getSlotUrl(slotIdx);
    if (!url) return;
    if (!confirm('Supprimer ce document ?')) return;

    slotBusy.value[slotIdx] = true;
    try {
        try { await deleteFile(url, 'client-papers'); } catch { /* non-fatal */ }

        const docs = [...(props.client.documents || [])];
        docs.splice(slotIdx, 1);

        const updated = await setClientDocuments(props.client.id, docs);
        if (updated) emit('updated', updated);
    } catch (e) {
        console.error('Error removing client document:', e);
    } finally {
        slotBusy.value[slotIdx] = false;
    }
}

function viewSlot(slotIdx: number) {
    const url = getSlotUrl(slotIdx);
    if (!url) return;
    window.open(url, '_blank', 'noopener');
}

function downloadSlot(slotIdx: number) {
    const url = getSlotUrl(slotIdx);
    if (!url || !props.client) return;
    const ext = (url.split('.').pop() || 'jpg').split('?')[0];
    const safeName = props.client.full_name.replace(/[^a-z0-9]+/gi, '_');
    const filename = `${safeName}_doc${slotIdx + 1}.${ext}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="show && client" class="fixed inset-0 z-50 overflow-y-auto">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>

                <div class="flex min-h-full items-center justify-center p-4">
                    <div class="modal-container relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
                        <!-- Header -->
                        <div class="shrink-0 px-5 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/40 to-violet-50/30">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                                    <Paperclip class="w-4 h-4 text-white" />
                                </div>
                                <div class="min-w-0">
                                    <h3 class="text-base font-bold text-gray-900 truncate">Documents du client</h3>
                                    <p class="text-xs text-gray-500 truncate flex items-center gap-1.5">
                                        <User class="w-3 h-3 text-gray-400" />
                                        <span class="font-semibold text-gray-700">{{ client.full_name }}</span>
                                        <span class="text-gray-300">·</span>
                                        <span class="font-mono">{{ client.cin }}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                @click="close"
                                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                                aria-label="Fermer"
                            >
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Body -->
                        <div class="flex-1 overflow-y-auto p-5 md:p-6">
                            <p class="text-[12px] text-gray-500 mb-4 leading-relaxed">
                                Téléversez jusqu'à <span class="font-bold text-gray-700">{{ FAITHFUL_CLIENT_MAX_DOCUMENTS }}</span> documents personnels (CIN, permis de conduire, etc.) pour ce client.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div
                                    v-for="slotIdx in [0, 1]"
                                    :key="slotIdx"
                                    class="doc-slot"
                                >
                                    <div class="doc-slot__header">
                                        <span class="doc-slot__index">Document {{ slotIdx + 1 }}</span>
                                        <span
                                            v-if="getSlotUrl(slotIdx)"
                                            class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-md ring-1 ring-emerald-200/60"
                                        >
                                            OK
                                        </span>
                                        <span
                                            v-else
                                            class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-gray-50 rounded-md ring-1 ring-gray-200/60"
                                        >
                                            Vide
                                        </span>
                                    </div>

                                    <div class="doc-slot__preview">
                                        <template v-if="getSlotUrl(slotIdx) && !isPdf(getSlotUrl(slotIdx))">
                                            <img
                                                :src="getSlotUrl(slotIdx)!"
                                                :alt="`Document ${slotIdx + 1}`"
                                                class="doc-slot__image"
                                                @click="viewSlot(slotIdx)"
                                                @error="($event.target as HTMLImageElement).style.display='none'"
                                            />
                                        </template>
                                        <template v-else-if="getSlotUrl(slotIdx) && isPdf(getSlotUrl(slotIdx))">
                                            <button
                                                type="button"
                                                @click="viewSlot(slotIdx)"
                                                class="doc-slot__pdf"
                                            >
                                                <FileText class="w-9 h-9 text-red-400" />
                                                <span class="text-xs font-bold text-gray-700 mt-2">Document PDF</span>
                                                <span class="text-[10px] text-gray-400">Cliquer pour ouvrir</span>
                                            </button>
                                        </template>
                                        <div v-else class="doc-slot__placeholder">
                                            <ImageOff class="w-7 h-7 text-gray-300 mb-1.5" />
                                            <span class="text-[11px] text-gray-400 font-medium">Aucun document</span>
                                        </div>

                                        <div v-if="slotBusy[slotIdx]" class="doc-slot__busy">
                                            <Loader2 class="w-5 h-5 text-indigo-500 animate-spin" />
                                        </div>
                                    </div>

                                    <div class="doc-slot__actions">
                                        <label class="doc-action doc-action--primary cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                class="hidden"
                                                :disabled="slotBusy[slotIdx]"
                                                @change="(e) => handleFileSelect(e, slotIdx)"
                                            />
                                            <Upload class="w-3.5 h-3.5" />
                                            {{ getSlotUrl(slotIdx) ? 'Remplacer' : 'Téléverser' }}
                                        </label>

                                        <button
                                            v-if="getSlotUrl(slotIdx)"
                                            type="button"
                                            class="doc-action"
                                            :disabled="slotBusy[slotIdx]"
                                            @click="viewSlot(slotIdx)"
                                            title="Voir"
                                        >
                                            <Eye class="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            v-if="getSlotUrl(slotIdx)"
                                            type="button"
                                            class="doc-action"
                                            :disabled="slotBusy[slotIdx]"
                                            @click="downloadSlot(slotIdx)"
                                            title="Télécharger"
                                        >
                                            <Download class="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            v-if="getSlotUrl(slotIdx)"
                                            type="button"
                                            class="doc-action doc-action--danger"
                                            :disabled="slotBusy[slotIdx]"
                                            @click="removeSlot(slotIdx)"
                                            title="Supprimer"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

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
.doc-slot {
    background: white;
    border-radius: 0.875rem;
    border: 1px solid rgb(243 244 246);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.doc-slot__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid rgb(243 244 246 / 0.85);
}

.doc-slot__index {
    font-size: 0.75rem;
    font-weight: 800;
    color: rgb(55 65 81);
    letter-spacing: 0.01em;
}

.doc-slot__preview {
    position: relative;
    aspect-ratio: 4 / 3;
    background: linear-gradient(180deg, rgb(249 250 251), rgb(243 244 246));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.doc-slot__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: zoom-in;
    transition: transform 0.3s ease;
}
.doc-slot__image:hover {
    transform: scale(1.03);
}

.doc-slot__pdf {
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
.doc-slot__pdf:hover {
    background: linear-gradient(180deg, rgb(254 226 226 / 0.7), rgb(254 202 202 / 0.5));
}

.doc-slot__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.doc-slot__busy {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
}

.doc-slot__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border-top: 1px solid rgb(243 244 246 / 0.85);
}

.doc-action {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 1.875rem;
    width: 1.875rem;
    padding: 0;
    background: rgb(249 250 251);
    border: none;
    border-radius: 0.5rem;
    color: rgb(75 85 99);
    box-shadow: inset 0 0 0 1px rgb(229 231 235);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.doc-action:hover:not(:disabled) {
    background: rgb(238 242 255);
    color: rgb(67 56 202);
    box-shadow: inset 0 0 0 1px rgb(199 210 254);
}

.doc-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.doc-action--primary {
    flex: 1;
    width: auto;
    padding: 0 0.75rem;
    background: linear-gradient(135deg, rgb(99 102 241), rgb(79 70 229));
    color: white;
    box-shadow: 0 1px 2px rgba(79, 70, 229, 0.25);
    font-size: 0.75rem;
    font-weight: 700;
}

.doc-action--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, rgb(79 70 229), rgb(67 56 202));
    color: white;
    box-shadow: 0 2px 6px rgba(79, 70, 229, 0.35);
}

.doc-action--danger:hover:not(:disabled) {
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
