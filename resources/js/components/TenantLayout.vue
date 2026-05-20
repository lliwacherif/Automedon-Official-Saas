<script setup lang="ts">
import { ref, watch, onMounted, computed, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { Pause, AlertTriangle, X, Check } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import ReturnNotificationToaster from '@/components/ReturnNotificationToaster.vue';
import {
    initReturnNotifications,
    stopReturnNotifications,
} from '@/composables/useReturnNotifications';

const route = useRoute();
const authStore = useAuthStore();
const tenantStore = useTenantStore();

const isPaused = ref(false);
const tenantName = ref('');
const checking = ref(true);
const paymentAlert = ref(false);
const paymentAlertType = ref<'banner' | 'modal'>('banner');
const alertDismissed = ref(false);
// Centered popup (Type 2) — dismissed per-tenant-slug for the current
// browser session so re-navigating inside the same session doesn't keep
// re-popping it but a fresh login does.
const popupDismissed = ref(false);

function popupKey(slug: string) {
    return `automedon_payment_popup_dismissed:${slug}`;
}

async function checkTenantStatus() {
    checking.value = true;
    const slug = route.params.tenantSlug as string;
    if (!slug) { checking.value = false; return; }

    try {
        const { data } = await supabase
            .from('tenants')
            .select('status, name, payment_alert, payment_alert_type')
            .eq('slug', slug)
            .single();

        if (data) {
            tenantName.value = data.name;
            isPaused.value = data.status !== 'active';
            paymentAlert.value = !!data.payment_alert;
            paymentAlertType.value = ((data as any).payment_alert_type === 'modal') ? 'modal' : 'banner';
            if (!data.payment_alert) {
                alertDismissed.value = false;
                popupDismissed.value = false;
                try { sessionStorage.removeItem(popupKey(slug)); } catch { /* ignore */ }
            } else {
                try {
                    popupDismissed.value = sessionStorage.getItem(popupKey(slug)) === '1';
                } catch {
                    popupDismissed.value = false;
                }
            }
        }
    } catch (e) {
        console.error('Failed to check tenant status:', e);
    } finally {
        checking.value = false;
    }
}

const showPaymentPopup = computed(
    () => paymentAlert.value
        && paymentAlertType.value === 'modal'
        && !popupDismissed.value
        && authStore.isAdmin,
);

function dismissPaymentPopup() {
    popupDismissed.value = true;
    const slug = route.params.tenantSlug as string;
    if (slug) {
        try { sessionStorage.setItem(popupKey(slug), '1'); } catch { /* ignore */ }
    }
}

onMounted(checkTenantStatus);

watch(() => route.fullPath, checkTenantStatus);

// Return-notification toaster: only for authenticated admins inside a live tenant.
const showReturnToaster = computed(
    () => !checking.value && !isPaused.value && authStore.isAdmin && !!tenantStore.currentTenant?.id
);

watch(
    showReturnToaster,
    (enabled) => {
        if (enabled) initReturnNotifications();
        else stopReturnNotifications();
    },
    { immediate: true }
);

onBeforeUnmount(() => stopReturnNotifications());
</script>

<template>
    <div v-if="checking" class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>

    <div v-else-if="isPaused" class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div class="max-w-md w-full text-center">
            <div class="bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Pause class="w-8 h-8 text-red-600" />
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-3">Account Suspended</h1>
                <p class="text-gray-600 mb-6">
                    <span class="font-semibold">{{ tenantName }}</span> has been temporarily suspended.
                    Please contact the administrator to restore access.
                </p>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    If you believe this is an error or wish to reactivate your account,
                    please reach out to support.
                </div>
                <RouterLink :to="{ name: 'home' }" class="inline-block mt-6 text-sm text-blue-600 hover:text-blue-800 font-medium">
                    &larr; Back to home
                </RouterLink>
            </div>
        </div>
    </div>

    <div v-else class="tenant-layout">
        <!-- Payment Alert Banner -->
        <div v-if="paymentAlert && !alertDismissed" class="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg">
            <div class="max-w-7xl mx-auto flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <AlertTriangle class="w-4 h-4" />
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-bold">Paiement requis / Payment Required</p>
                        <p class="text-xs text-white/80 mt-0.5">
                            Votre paiement doit être régularisé pour éviter la désactivation de votre compte. Veuillez contacter l'administration.
                        </p>
                    </div>
                </div>
                <button @click="alertDismissed = true" class="shrink-0 p-1.5 rounded-lg hover:bg-white/20 transition">
                    <X class="w-4 h-4" />
                </button>
            </div>
        </div>
        <RouterView />

        <!-- Type 2 — centered popup, shown once per session per tenant slug -->
        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div v-if="showPaymentPopup" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="dismissPaymentPopup"></div>
                    <div class="payment-popup-card relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-amber-200">
                        <div class="px-5 pt-5 pb-3 bg-gradient-to-br from-amber-50 via-orange-50/60 to-amber-50">
                            <div class="flex items-start gap-3">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-300/40 shrink-0">
                                    <AlertTriangle class="w-6 h-6 text-white" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-base font-bold text-amber-900">Paiement requis</h3>
                                    <p class="text-[11px] text-amber-700/80 mt-0.5">Payment Required &middot; دفع مطلوب</p>
                                </div>
                                <button
                                    @click="dismissPaymentPopup"
                                    class="p-1.5 rounded-lg text-amber-700/60 hover:text-amber-800 hover:bg-amber-100 transition shrink-0"
                                    aria-label="Fermer"
                                >
                                    <X class="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div class="px-5 py-4 space-y-3 text-sm text-gray-700 leading-relaxed">
                            <p>
                                Bonjour <span class="font-semibold text-gray-900">{{ tenantName }}</span>,
                                votre paiement doit être régularisé pour éviter la
                                <span class="font-semibold text-red-600">désactivation</span> de votre compte.
                            </p>
                            <p class="text-[12.5px] text-gray-500">
                                Merci de contacter l'administration au plus vite pour finaliser votre règlement.
                            </p>
                        </div>

                        <div class="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                @click="dismissPaymentPopup"
                                class="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md shadow-amber-200 transition"
                            >
                                <Check class="w-4 h-4" />
                                J'ai compris
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <ReturnNotificationToaster v-if="showReturnToaster" />
    </div>
</template>
