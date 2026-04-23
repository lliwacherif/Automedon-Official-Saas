import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';

export interface ReturnToast {
  id: number;
  reservationNumber: string;
  clientName: string;
  carLabel: string;
  endDate: string | null;
}

const toasts = ref<ReturnToast[]>([]);
const initialized = ref(false);
let pollTimer: number | null = null;
let lastCheckedTenantId: string | null = null;

const STORAGE_PREFIX = 'automedon_return_notifs_shown_';
const RECENT_WINDOW_DAYS = 7;
const MAX_VISIBLE_TOASTS = 4;

function storageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function loadShownSet(tenantId: string): Set<number> {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveShownSet(tenantId: string, set: Set<number>) {
  try {
    // Cap size to avoid unbounded growth (keep last 500 IDs).
    const arr = Array.from(set);
    const capped = arr.length > 500 ? arr.slice(arr.length - 500) : arr;
    localStorage.setItem(storageKey(tenantId), JSON.stringify(capped));
  } catch {
    /* ignore quota errors */
  }
}

function hasInitKey(tenantId: string): boolean {
  return localStorage.getItem(`${STORAGE_PREFIX}init_${tenantId}`) === '1';
}

function markInitKey(tenantId: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}init_${tenantId}`, '1');
  } catch {
    /* ignore */
  }
}

function pushToast(toast: ReturnToast) {
  // Avoid duplicates in current stack.
  if (toasts.value.some((t) => t.id === toast.id)) return;
  toasts.value.push(toast);
  // Keep stack trimmed; oldest falls off if exceeded.
  if (toasts.value.length > MAX_VISIBLE_TOASTS) {
    toasts.value.splice(0, toasts.value.length - MAX_VISIBLE_TOASTS);
  }
}

export function dismissReturnToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

async function autoCompleteExpired(tenantId: string): Promise<void> {
  // Mark any confirmed/active reservations whose end_date has passed as completed.
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('reservations')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'active'])
    .lt('end_date', nowIso);

  if (error || !data || data.length === 0) return;

  const ids = data.map((r: any) => r.id);
  await (supabase.from('reservations') as any)
    .update({ status: 'completed' })
    .in('id', ids);
}

async function checkReturns(tenantId: string): Promise<void> {
  try {
    await autoCompleteExpired(tenantId);

    const since = new Date();
    since.setDate(since.getDate() - RECENT_WINDOW_DAYS);

    const { data, error } = await supabase
      .from('reservations')
      .select('id, reservation_number, client_name, end_date, updated_at, car:cars(brand, model, license_plate)')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('updated_at', since.toISOString())
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error || !data) return;

    const shown = loadShownSet(tenantId);

    // First-time run for this tenant: silently adopt existing completed IDs
    // so the user isn't bombarded with historical notifications.
    if (!hasInitKey(tenantId)) {
      for (const row of data as any[]) {
        shown.add(row.id as number);
      }
      saveShownSet(tenantId, shown);
      markInitKey(tenantId);
      return;
    }

    // Show the most recent N first (data is already sorted newest first).
    const freshToShow: ReturnToast[] = [];
    for (const row of data as any[]) {
      if (shown.has(row.id)) continue;
      const car = row.car || {};
      const carLabel = [car.brand, car.model].filter(Boolean).join(' ').trim()
        || car.license_plate
        || '';
      freshToShow.push({
        id: row.id,
        reservationNumber: row.reservation_number || `#${row.id}`,
        clientName: row.client_name || '',
        carLabel,
        endDate: row.end_date || row.updated_at || null,
      });
      shown.add(row.id);
    }

    if (freshToShow.length > 0) {
      saveShownSet(tenantId, shown);
      // Push in chronological order (oldest first) so newest end up at the top of the stack visually.
      freshToShow.reverse().forEach(pushToast);
    }
  } catch (e) {
    console.error('Return notifications check failed:', e);
  }
}

export function initReturnNotifications(): void {
  const tenantStore = useTenantStore();

  const run = () => {
    const tenantId = tenantStore.currentTenant?.id;
    if (!tenantId) return;
    lastCheckedTenantId = tenantId;
    void checkReturns(tenantId);
  };

  if (initialized.value) {
    // Re-run on re-invocation (e.g., tenant switched).
    const tenantId = tenantStore.currentTenant?.id;
    if (tenantId && tenantId !== lastCheckedTenantId) run();
    return;
  }

  initialized.value = true;
  run();

  // Periodic check every 2 minutes.
  pollTimer = window.setInterval(run, 2 * 60 * 1000);

  // Re-check when the tab regains focus (useful after "app was closed").
  window.addEventListener('focus', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
}

export function stopReturnNotifications(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  initialized.value = false;
  lastCheckedTenantId = null;
}

export function useReturnNotifications() {
  return {
    toasts,
    dismissReturnToast,
    initReturnNotifications,
    stopReturnNotifications,
  };
}
