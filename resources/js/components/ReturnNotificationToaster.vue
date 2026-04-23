<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2, KeyRound, X } from 'lucide-vue-next';
import { useReturnNotifications } from '@/composables/useReturnNotifications';

const { toasts, dismissReturnToast } = useReturnNotifications();
const { t, d } = useI18n();

const AUTO_DISMISS_MS = 9000;
const timers = new Map<number, number>();

function scheduleDismiss(id: number) {
  clearTimer(id);
  const handle = window.setTimeout(() => {
    dismissReturnToast(id);
    clearTimer(id);
  }, AUTO_DISMISS_MS);
  timers.set(id, handle);
}

function clearTimer(id: number) {
  const h = timers.get(id);
  if (h !== undefined) {
    window.clearTimeout(h);
    timers.delete(id);
  }
}

function formatEndDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  try {
    return d(date, 'short');
  } catch {
    return date.toLocaleString();
  }
}

watch(
  toasts,
  (list) => {
    const currentIds = new Set(list.map((t) => t.id));
    for (const id of Array.from(timers.keys())) {
      if (!currentIds.has(id)) clearTimer(id);
    }
    for (const t of list) {
      if (!timers.has(t.id)) scheduleDismiss(t.id);
    }
  },
  { deep: true, immediate: true }
);

onMounted(() => {
  for (const t of toasts.value) scheduleDismiss(t.id);
});

onBeforeUnmount(() => {
  for (const h of timers.values()) window.clearTimeout(h);
  timers.clear();
});
</script>

<template>
  <div class="return-toaster" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="return-toast" tag="div" class="return-toaster-stack">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="return-toast"
        role="status"
        @mouseenter="clearTimer(toast.id)"
        @mouseleave="scheduleDismiss(toast.id)"
      >
        <span class="return-toast-accent" aria-hidden="true" />

        <div class="return-toast-icon">
          <KeyRound class="h-[18px] w-[18px]" />
          <span class="return-toast-icon-dot">
            <CheckCircle2 class="h-3 w-3" />
          </span>
        </div>

        <div class="return-toast-body">
          <div class="return-toast-title">{{ t('notifications.return.title') }}</div>
          <p class="return-toast-message">
            {{
              t('notifications.return.message', {
                client: toast.clientName || t('notifications.return.a_client'),
                car: toast.carLabel || t('notifications.return.a_vehicle'),
              })
            }}
          </p>
          <div class="return-toast-meta">
            <span class="return-toast-chip">{{ toast.reservationNumber }}</span>
            <span v-if="toast.endDate" class="return-toast-dot">•</span>
            <span v-if="toast.endDate" class="return-toast-time">{{ formatEndDate(toast.endDate) }}</span>
          </div>
        </div>

        <button
          type="button"
          class="return-toast-close"
          :aria-label="t('notifications.return.dismiss')"
          @click="dismissReturnToast(toast.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.return-toaster {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9999;
  pointer-events: none;
}

.return-toaster-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}

.return-toast {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: min(360px, calc(100vw - 40px));
  padding: 14px 14px 14px 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  box-shadow:
    0 12px 28px -12px rgba(15, 23, 42, 0.2),
    0 4px 10px -4px rgba(15, 23, 42, 0.12);
  overflow: hidden;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
}

.return-toast-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #10b981, #059669);
  border-radius: 3px 0 0 3px;
}

.return-toast-icon {
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #047857;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.return-toast-icon-dot {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #ffffff;
  color: #059669;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 1.5px #ffffff;
}

.return-toast-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.return-toast-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.return-toast-message {
  font-size: 12.5px;
  line-height: 1.45;
  color: #475569;
  margin: 0;
  word-break: break-word;
}

.return-toast-meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
}

.return-toast-chip {
  padding: 1px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-weight: 600;
  font-size: 10.5px;
  letter-spacing: 0.01em;
}

.return-toast-dot {
  opacity: 0.6;
}

.return-toast-time {
  color: #64748b;
}

.return-toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  margin-top: -2px;
}

.return-toast-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

/* Transitions */
.return-toast-enter-from {
  opacity: 0;
  transform: translateX(28px) scale(0.97);
}
.return-toast-enter-active {
  transition: opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.return-toast-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.97);
}
.return-toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
  position: absolute;
  right: 0;
}
.return-toast-move {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
