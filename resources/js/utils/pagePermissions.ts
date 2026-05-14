import {
    Car,
    BarChart3,
    ClipboardList,
    Bus,
    Wrench,
    History,
    AlertTriangle,
    Orbit,
    Table,
    UserRound,
    ShoppingBag,
} from 'lucide-vue-next';
import type { Component } from 'vue';

export type PageKey =
    | 'fleet'
    | 'kpi'
    | 'reservations'
    | 'services'
    | 'maintenance'
    | 'history'
    | 'reports'
    | 'daily_journal'
    | 'reservations_table'
    | 'faithful_clients'
    | 'store';

export interface PageDefinition {
    key: PageKey;
    /** vue-i18n key for the label (e.g. `admin.settings.pages.fleet`) */
    labelKey: string;
    /** vue-i18n key for the short description */
    descKey: string;
    /** Tailwind color name used for the accent / gradient */
    color: string;
    /** Lucide icon component */
    icon: Component;
    /** Default vue-router route name (used by NavBar/router guard) */
    routeName: string;
    /** Sub-route prefix(es) — any nav link starting with these is gated by the page key */
    routePrefixes: string[];
}

export const PAGE_DEFINITIONS: PageDefinition[] = [
    {
        key: 'fleet',
        labelKey: 'admin.settings.pages.fleet.label',
        descKey: 'admin.settings.pages.fleet.desc',
        color: 'indigo',
        icon: Car,
        routeName: 'admin.cars.index',
        routePrefixes: ['/admin/cars'],
    },
    {
        key: 'kpi',
        labelKey: 'admin.settings.pages.kpi.label',
        descKey: 'admin.settings.pages.kpi.desc',
        color: 'blue',
        icon: BarChart3,
        routeName: 'admin.dashboard',
        routePrefixes: ['/admin/kpi'],
    },
    {
        key: 'reservations',
        labelKey: 'admin.settings.pages.reservations.label',
        descKey: 'admin.settings.pages.reservations.desc',
        color: 'emerald',
        icon: ClipboardList,
        routeName: 'admin.reservations.index',
        routePrefixes: ['/admin/reservations/', '/admin/reservations'],
    },
    {
        key: 'reservations_table',
        labelKey: 'admin.settings.pages.reservations_table.label',
        descKey: 'admin.settings.pages.reservations_table.desc',
        color: 'slate',
        icon: Table,
        routeName: 'admin.reservations.table',
        routePrefixes: ['/admin/reservations-table'],
    },
    {
        key: 'services',
        labelKey: 'admin.settings.pages.services.label',
        descKey: 'admin.settings.pages.services.desc',
        color: 'amber',
        icon: Bus,
        routeName: 'admin.services.index',
        routePrefixes: ['/admin/services'],
    },
    {
        key: 'maintenance',
        labelKey: 'admin.settings.pages.maintenance.label',
        descKey: 'admin.settings.pages.maintenance.desc',
        color: 'orange',
        icon: Wrench,
        routeName: 'admin.maintenance.index',
        routePrefixes: ['/admin/maintenance'],
    },
    {
        key: 'daily_journal',
        labelKey: 'admin.settings.pages.daily_journal.label',
        descKey: 'admin.settings.pages.daily_journal.desc',
        color: 'cyan',
        icon: Orbit,
        routeName: 'admin.daily_journal.index',
        routePrefixes: ['/admin/daily-journal'],
    },
    {
        key: 'faithful_clients',
        labelKey: 'admin.settings.pages.faithful_clients.label',
        descKey: 'admin.settings.pages.faithful_clients.desc',
        color: 'pink',
        icon: UserRound,
        routeName: 'admin.faithful_clients.index',
        routePrefixes: ['/admin/faithful-clients'],
    },
    {
        key: 'reports',
        labelKey: 'admin.settings.pages.reports.label',
        descKey: 'admin.settings.pages.reports.desc',
        color: 'red',
        icon: AlertTriangle,
        routeName: 'admin.reports',
        routePrefixes: ['/admin/reports'],
    },
    {
        key: 'history',
        labelKey: 'admin.settings.pages.history.label',
        descKey: 'admin.settings.pages.history.desc',
        color: 'purple',
        icon: History,
        routeName: 'admin.history.index',
        routePrefixes: ['/admin/history'],
    },
    {
        key: 'store',
        labelKey: 'admin.settings.pages.store.label',
        descKey: 'admin.settings.pages.store.desc',
        color: 'fuchsia',
        icon: ShoppingBag,
        routeName: 'admin.store.index',
        routePrefixes: ['/admin/store'],
    },
];

/**
 * Reasonable default selection used as a starting point in the admin UI.
 * Mirrors the existing assistant defaults (everything except KPI / History).
 */
export const DEFAULT_ALLOWED_PAGES: PageKey[] = [
    'fleet',
    'reservations',
    'reservations_table',
    'services',
    'maintenance',
    'daily_journal',
    'faithful_clients',
    'reports',
    'store',
];

/**
 * Convert a router path (e.g. `/Cherif-Rent-Car/admin/cars/12/edit`) into
 * the page key it logically belongs to. Returns null if it doesn't match
 * any gated page (e.g. /admin/settings is intentionally not in this list
 * because only admins reach it).
 */
export function pageKeyForPath(path: string): PageKey | null {
    for (const def of PAGE_DEFINITIONS) {
        for (const prefix of def.routePrefixes) {
            if (path.includes(prefix)) return def.key;
        }
    }
    return null;
}

/**
 * Returns true when the given user can see the given page key.
 * - role 'admin' or 'root' → always true
 * - allowed_pages NULL → backward compatible (true for most pages, but
 *   KPI/History still require admin role through the router meta flag)
 * - otherwise → membership test on the allow-list
 */
export function userCanAccessPage(
    role: string | undefined | null,
    allowedPages: string[] | null | undefined,
    pageKey: PageKey,
): boolean {
    if (role === 'admin' || role === 'root') return true;

    if (allowedPages == null) {
        // Legacy users: KPI / History stay admin-only (handled by router meta)
        if (pageKey === 'kpi' || pageKey === 'history') return false;
        return true;
    }

    return allowedPages.includes(pageKey);
}
