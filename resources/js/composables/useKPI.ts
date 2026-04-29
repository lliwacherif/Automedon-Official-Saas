import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import {
    startOfMonth,
    endOfMonth,
    format,
    parseISO,
    startOfWeek,
    endOfWeek,
    startOfYear,
    endOfYear,
    startOfQuarter,
    endOfQuarter,
    differenceInCalendarDays,
    differenceInMilliseconds,
    addMilliseconds,
    subMilliseconds,
    eachDayOfInterval,
    max as maxDate,
    min as minDate,
} from 'date-fns';

// Maintenance type labels — must mirror the labels exported by useMaintenanceRecords
const MAINTENANCE_LABELS: Record<string, string> = {
    OIL_CHANGE: 'Vidange',
    BRAKE_SERVICE: 'Freins',
    REPAIR: 'Réparation',
    ROUTINE_CHECK: 'Visite Technique',
    LAVAGE: 'Lavage',
    ASSURANCE: 'Assurance',
    VIGNETTE: 'Vignette',
    LEASING: 'Leasing',
    TIRES: 'Pneus',
    BATTERY: 'Batterie',
};

// ───────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────
export interface KPIMetrics {
    totalRevenue: number;
    reservationRevenue: number;
    serviceRevenue: number;
    totalExpenses: number;
    netProfit: number;
    netMargin: number;          // %
    totalBookings: number;
    reservationsCount: number;
    servicesCount: number;
    occupancyRate: number;      // % of car-days actually used
    averageDailyRate: number;   // average revenue per booking
    averageBookingDuration: number; // days, reservations only
    revenueGrowth: number;      // % vs previous period
    expensesGrowth: number;     // % vs previous period
    outstandingBalance: number; // total - advance, on confirmed/active in period
    outstandingCount: number;
    paidPercentage: number;     // % paid of total revenue
    cancelledCount: number;
    cancelledLostRevenue: number;
    cancellationRate: number;   // %
    rentalDays: number;         // raw rental car-days in period
    fleetDays: number;          // total possible car-days = cars × days
}

export interface FleetStatus {
    total: number;
    available: number;
    rented: number;
    maintenance: number;
}

export interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        fill?: boolean;
        borderRadius?: number;
        borderWidth?: number;
        hoverBackgroundColor?: string | string[];
    }[];
}

export interface TopCarRow {
    car_id: number;
    plate_number: string;
    brand: string;
    model: string;
    revenue: number;
    bookings: number;
    daysRented: number;
    occupancy: number;       // %
    maintenanceCost: number;
    netProfit: number;
}

export interface TopClientRow {
    name: string;
    cin: string;
    bookings: number;
    revenue: number;
    lastBooking: string | null;
}

export interface BrandRow {
    brand: string;
    revenue: number;
    bookings: number;
    cars: number;
}

export interface MaintenanceTypeRow {
    type: string;
    label: string;
    cost: number;
    count: number;
}

export type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

// ───────────────────────────────────────────────
// useKPI — now computes a full dashboard worth of metrics
// ───────────────────────────────────────────────
export function useKPI() {
    const loading = ref(false);
    const error = ref<string | null>(null);
    const tenantStore = useTenantStore();

    // Date range + period
    const dateRange = ref<{ start: Date; end: Date }>({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });
    const periodType = ref<PeriodType>('month');

    // Core metrics
    const metrics = ref<KPIMetrics>({
        totalRevenue: 0, reservationRevenue: 0, serviceRevenue: 0,
        totalExpenses: 0, netProfit: 0, netMargin: 0,
        totalBookings: 0, reservationsCount: 0, servicesCount: 0,
        occupancyRate: 0, averageDailyRate: 0, averageBookingDuration: 0,
        revenueGrowth: 0, expensesGrowth: 0,
        outstandingBalance: 0, outstandingCount: 0, paidPercentage: 0,
        cancelledCount: 0, cancelledLostRevenue: 0, cancellationRate: 0,
        rentalDays: 0, fleetDays: 0,
    });

    const fleetStatus = ref<FleetStatus>({ total: 0, available: 0, rented: 0, maintenance: 0 });

    // Charts
    const revenueChartData = ref<ChartData>({ labels: [], datasets: [] });
    const statusChartData = ref<ChartData>({ labels: [], datasets: [] });
    const revenueSplitChartData = ref<ChartData>({ labels: [], datasets: [] });
    const brandRevenueChartData = ref<ChartData>({ labels: [], datasets: [] });
    const maintenanceChartData = ref<ChartData>({ labels: [], datasets: [] });

    // Tables
    const topCars = ref<TopCarRow[]>([]);
    const topClients = ref<TopClientRow[]>([]);
    const brandBreakdown = ref<BrandRow[]>([]);
    const maintenanceBreakdown = ref<MaintenanceTypeRow[]>([]);

    // ───────────────────────────────────────────────
    // Period helpers
    // ───────────────────────────────────────────────
    function setPeriod(type: PeriodType, customRange?: { start: Date; end: Date }) {
        periodType.value = type;
        const now = new Date();
        switch (type) {
            case 'week':
                dateRange.value = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
                break;
            case 'month':
                dateRange.value = { start: startOfMonth(now), end: endOfMonth(now) };
                break;
            case 'quarter':
                dateRange.value = { start: startOfQuarter(now), end: endOfQuarter(now) };
                break;
            case 'year':
                dateRange.value = { start: startOfYear(now), end: endOfYear(now) };
                break;
            case 'custom':
                if (customRange) dateRange.value = customRange;
                break;
        }
        fetchData();
    }

    function setCustomRange(start: Date, end: Date) {
        if (start > end) [start, end] = [end, start];
        periodType.value = 'custom';
        dateRange.value = { start, end };
        fetchData();
    }

    // ───────────────────────────────────────────────
    // Data fetch — single entry point
    // ───────────────────────────────────────────────
    async function fetchData() {
        loading.value = true;
        error.value = null;
        try {
            const tenantId = tenantStore.currentTenant?.id;
            if (!tenantId) {
                resetAll();
                return;
            }

            const start = dateRange.value.start;
            const end = dateRange.value.end;
            const periodMs = differenceInMilliseconds(end, start);
            const prevEnd = subMilliseconds(start, 1);
            const prevStart = subMilliseconds(start, periodMs + 1);

            // Run everything in parallel
            const [
                cars,
                reservations,
                prevReservations,
                cancelledReservations,
                services,
                prevServices,
                maintenance,
                prevMaintenance,
            ] = await Promise.all([
                fetchCars(tenantId),
                fetchReservations(tenantId, start, end, false),
                fetchReservations(tenantId, prevStart, prevEnd, false),
                fetchReservations(tenantId, start, end, true),  // cancelled only
                fetchServices(tenantId, start, end),
                fetchServices(tenantId, prevStart, prevEnd),
                fetchMaintenance(tenantId, start, end),
                fetchMaintenance(tenantId, prevStart, prevEnd),
            ]);

            computeFleetStatus(cars, await fetchActiveAggregates(tenantId));
            computeMetrics({ cars, reservations, prevReservations, cancelledReservations, services, prevServices, maintenance, prevMaintenance, start, end });
            computeRevenueChart({ reservations, services, start, end });
            computeRevenueSplit({ reservations, services });
            computeBrandBreakdown({ cars, reservations });
            computeMaintenanceBreakdown(maintenance);
            computeTopCars({ cars, reservations, maintenance, start, end });
            computeTopClients(reservations);
        } catch (e: any) {
            console.error('Error fetching KPI data:', e);
            error.value = e.message || 'Erreur de chargement des KPI.';
        } finally {
            loading.value = false;
        }
    }

    // ───────────────────────────────────────────────
    // Low-level fetchers
    // ───────────────────────────────────────────────
    async function fetchCars(tenantId: string) {
        const { data, error: err } = await supabase
            .from('cars')
            .select('id, brand, model, license_plate, status')
            .eq('tenant_id', tenantId);
        if (err) throw err;
        return (data || []) as any[];
    }

    async function fetchReservations(tenantId: string, start: Date, end: Date, cancelledOnly: boolean) {
        // Reservations whose date range overlaps the [start,end] window.
        // For non-cancelled we treat them as "active in period";
        // for cancelled we use the same overlap window so we can attribute lost revenue.
        const startIso = start.toISOString();
        const endIso = end.toISOString();

        let q = supabase
            .from('reservations')
            .select('id, car_id, client_name, client_cin, total_price, advance_payment, status, start_date, end_date, created_at')
            .eq('tenant_id', tenantId)
            .lt('start_date', endIso)
            .gt('end_date', startIso);

        if (cancelledOnly) {
            q = q.eq('status', 'cancelled');
        } else {
            q = q.neq('status', 'cancelled');
        }

        const { data, error: err } = await q;
        if (err) throw err;
        return (data || []) as any[];
    }

    async function fetchServices(tenantId: string, start: Date, end: Date) {
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const { data, error: err } = await supabase
            .from('services')
            .select('id, car_id, service_type, chauffeur_name, price, start_date, end_date, created_at')
            .eq('tenant_id', tenantId)
            .lt('start_date', endIso)
            .gt('end_date', startIso);
        if (err) throw err;
        return (data || []) as any[];
    }

    async function fetchMaintenance(tenantId: string, start: Date, end: Date) {
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const { data, error: err } = await supabase
            .from('maintenance_records')
            .select('id, car_id, cost, maintenance_type, maintenance_date')
            .eq('tenant_id', tenantId)
            .gte('maintenance_date', startStr)
            .lte('maintenance_date', endStr);
        if (err) throw err;
        return (data || []) as any[];
    }

    async function fetchActiveAggregates(tenantId: string) {
        const nowIso = new Date().toISOString();
        const todayDate = format(new Date(), 'yyyy-MM-dd');

        const [{ data: activeRes }, { data: activeSvc }, { data: activeMaint }] = await Promise.all([
            supabase.from('reservations').select('car_id')
                .eq('tenant_id', tenantId).neq('status', 'cancelled')
                .lte('start_date', nowIso).gte('end_date', nowIso),
            supabase.from('services').select('car_id')
                .eq('tenant_id', tenantId)
                .lte('start_date', nowIso).gte('end_date', nowIso),
            supabase.from('maintenance_records').select('car_id')
                .eq('tenant_id', tenantId).eq('maintenance_date', todayDate),
        ]);

        return {
            rented: new Set([...(activeRes || []), ...(activeSvc || [])].map((r: any) => r.car_id)),
            inMaintenance: new Set((activeMaint || []).map((m: any) => m.car_id)),
        };
    }

    // ───────────────────────────────────────────────
    // Compute steps
    // ───────────────────────────────────────────────
    function resetAll() {
        fleetStatus.value = { total: 0, available: 0, rented: 0, maintenance: 0 };
        topCars.value = [];
        topClients.value = [];
        brandBreakdown.value = [];
        maintenanceBreakdown.value = [];
        revenueChartData.value = { labels: [], datasets: [] };
        statusChartData.value = { labels: [], datasets: [] };
        revenueSplitChartData.value = { labels: [], datasets: [] };
        brandRevenueChartData.value = { labels: [], datasets: [] };
        maintenanceChartData.value = { labels: [], datasets: [] };
    }

    function computeFleetStatus(cars: any[], aggregates: { rented: Set<number>; inMaintenance: Set<number> }) {
        let available = 0, rented = 0, maintenance = 0;
        for (const c of cars) {
            if (aggregates.rented.has(c.id)) rented++;
            else if (aggregates.inMaintenance.has(c.id)) maintenance++;
            else available++;
        }
        fleetStatus.value = { total: cars.length, available, rented, maintenance };
        statusChartData.value = {
            labels: ['Disponible', 'Loué', 'Maintenance'],
            datasets: [{
                label: 'Flotte',
                data: [available, rented, maintenance],
                backgroundColor: ['#10B981', '#3B82F6', '#EF4444'],
                hoverBackgroundColor: ['#059669', '#2563EB', '#DC2626'],
                borderWidth: 0,
            }],
        };
    }

    function computeMetrics(p: { cars: any[]; reservations: any[]; prevReservations: any[]; cancelledReservations: any[]; services: any[]; prevServices: any[]; maintenance: any[]; prevMaintenance: any[]; start: Date; end: Date; }) {
        const reservationRevenue = sum(p.reservations, 'total_price');
        const serviceRevenue = sum(p.services, 'price');
        const totalRevenue = reservationRevenue + serviceRevenue;
        const totalExpenses = sum(p.maintenance, 'cost');
        const netProfit = totalRevenue - totalExpenses;
        const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        const prevReservationRevenue = sum(p.prevReservations, 'total_price');
        const prevServiceRevenue = sum(p.prevServices, 'price');
        const prevRevenue = prevReservationRevenue + prevServiceRevenue;
        const prevExpenses = sum(p.prevMaintenance, 'cost');

        const revenueGrowth = pctChange(totalRevenue, prevRevenue);
        const expensesGrowth = pctChange(totalExpenses, prevExpenses);

        const reservationsCount = p.reservations.length;
        const servicesCount = p.services.length;
        const totalBookings = reservationsCount + servicesCount;
        const averageDailyRate = totalBookings > 0 ? totalRevenue / totalBookings : 0;

        // Real occupancy: sum of overlapping rental days over (cars × days_in_period)
        const daysInPeriod = Math.max(1, differenceInCalendarDays(p.end, p.start) + 1);
        const fleetDays = p.cars.length * daysInPeriod;
        let rentalDays = 0;
        let totalDuration = 0;

        for (const r of p.reservations) {
            const rs = parseISO(r.start_date);
            const re = parseISO(r.end_date);
            const clipStart = maxDate([rs, p.start]);
            const clipEnd = minDate([re, p.end]);
            const overlap = differenceInCalendarDays(clipEnd, clipStart) + 1;
            if (overlap > 0) rentalDays += overlap;
            const dur = differenceInCalendarDays(re, rs) + 1;
            if (dur > 0) totalDuration += dur;
        }
        for (const s of p.services) {
            const ss = parseISO(s.start_date);
            const se = parseISO(s.end_date);
            const clipStart = maxDate([ss, p.start]);
            const clipEnd = minDate([se, p.end]);
            const overlap = differenceInCalendarDays(clipEnd, clipStart) + 1;
            if (overlap > 0) rentalDays += overlap;
        }

        const occupancyRate = fleetDays > 0 ? Math.min((rentalDays / fleetDays) * 100, 100) : 0;
        const averageBookingDuration = reservationsCount > 0 ? totalDuration / reservationsCount : 0;

        // Outstanding balance — only on reservations that are confirmed/active (not just any)
        let outstandingBalance = 0;
        let outstandingCount = 0;
        for (const r of p.reservations) {
            const remaining = Number(r.total_price || 0) - Number(r.advance_payment || 0);
            if (remaining > 0) {
                outstandingBalance += remaining;
                outstandingCount += 1;
            }
        }
        const paidAmount = totalRevenue - outstandingBalance;
        const paidPercentage = totalRevenue > 0 ? (paidAmount / totalRevenue) * 100 : 0;

        // Cancellations
        const cancelledCount = p.cancelledReservations.length;
        const cancelledLostRevenue = sum(p.cancelledReservations, 'total_price');
        const cancellationRate = (totalBookings + cancelledCount) > 0
            ? (cancelledCount / (totalBookings + cancelledCount)) * 100
            : 0;

        metrics.value = {
            totalRevenue, reservationRevenue, serviceRevenue,
            totalExpenses, netProfit, netMargin,
            totalBookings, reservationsCount, servicesCount,
            occupancyRate, averageDailyRate, averageBookingDuration,
            revenueGrowth, expensesGrowth,
            outstandingBalance, outstandingCount, paidPercentage,
            cancelledCount, cancelledLostRevenue, cancellationRate,
            rentalDays, fleetDays,
        };
    }

    function computeRevenueChart(p: { reservations: any[]; services: any[]; start: Date; end: Date }) {
        const days = eachDayOfInterval({ start: p.start, end: p.end });
        const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
        const reservationsByDay: Record<string, number> = {};
        const servicesByDay: Record<string, number> = {};

        for (const r of p.reservations) {
            const key = dayKey(parseISO(r.start_date));
            reservationsByDay[key] = (reservationsByDay[key] || 0) + Number(r.total_price || 0);
        }
        for (const s of p.services) {
            const key = dayKey(parseISO(s.start_date));
            servicesByDay[key] = (servicesByDay[key] || 0) + Number(s.price || 0);
        }

        const labels = days.map(d => format(d, 'd MMM'));
        const dayKeys = days.map(dayKey);

        revenueChartData.value = {
            labels,
            datasets: [
                {
                    label: 'Réservations',
                    data: dayKeys.map(k => reservationsByDay[k] || 0),
                    borderColor: '#6366F1',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    fill: true,
                },
                {
                    label: 'Services',
                    data: dayKeys.map(k => servicesByDay[k] || 0),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.10)',
                    fill: true,
                },
            ],
        };
    }

    function computeRevenueSplit(p: { reservations: any[]; services: any[] }) {
        const reservationRevenue = sum(p.reservations, 'total_price');
        // Split services by service_type (transfert / excursion / fallback)
        const transfertRevenue = p.services
            .filter((s: any) => (s.service_type || '').toLowerCase() === 'transfert')
            .reduce((acc, s) => acc + Number(s.price || 0), 0);
        const excursionRevenue = p.services
            .filter((s: any) => (s.service_type || '').toLowerCase() !== 'transfert')
            .reduce((acc, s) => acc + Number(s.price || 0), 0);

        revenueSplitChartData.value = {
            labels: ['Réservations', 'Transferts', 'Excursions'],
            datasets: [{
                label: 'CA',
                data: [reservationRevenue, transfertRevenue, excursionRevenue],
                backgroundColor: ['#6366F1', '#10B981', '#F59E0B'],
                hoverBackgroundColor: ['#4F46E5', '#059669', '#D97706'],
                borderWidth: 0,
            }],
        };
    }

    function computeBrandBreakdown(p: { cars: any[]; reservations: any[] }) {
        const carById = new Map<number, any>(p.cars.map(c => [c.id, c]));
        const totals: Record<string, BrandRow> = {};

        for (const c of p.cars) {
            if (!totals[c.brand]) totals[c.brand] = { brand: c.brand, revenue: 0, bookings: 0, cars: 0 };
            totals[c.brand].cars += 1;
        }
        for (const r of p.reservations) {
            const car = carById.get(r.car_id);
            if (!car) continue;
            const row = totals[car.brand] = totals[car.brand] || { brand: car.brand, revenue: 0, bookings: 0, cars: 0 };
            row.revenue += Number(r.total_price || 0);
            row.bookings += 1;
        }

        const rows = Object.values(totals)
            .filter(b => b.cars > 0 || b.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue);

        brandBreakdown.value = rows;

        const top = rows.slice(0, 8);
        brandRevenueChartData.value = {
            labels: top.map(r => r.brand),
            datasets: [{
                label: 'CA',
                data: top.map(r => r.revenue),
                backgroundColor: '#6366F1',
                hoverBackgroundColor: '#4F46E5',
                borderRadius: 8,
                borderWidth: 0,
            }],
        };
    }

    function computeMaintenanceBreakdown(maintenance: any[]) {
        const map: Record<string, MaintenanceTypeRow> = {};
        for (const m of maintenance) {
            const t = m.maintenance_type || 'OTHER';
            if (!map[t]) map[t] = { type: t, label: MAINTENANCE_LABELS[t] || t, cost: 0, count: 0 };
            map[t].cost += Number(m.cost || 0);
            map[t].count += 1;
        }
        const rows = Object.values(map).sort((a, b) => b.cost - a.cost);
        maintenanceBreakdown.value = rows;

        const palette = ['#EF4444', '#F59E0B', '#6366F1', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9', '#84CC16'];
        maintenanceChartData.value = {
            labels: rows.map(r => r.label),
            datasets: [{
                label: 'Maintenance',
                data: rows.map(r => r.cost),
                backgroundColor: rows.map((_, i) => palette[i % palette.length]),
                borderWidth: 0,
            }],
        };
    }

    function computeTopCars(p: { cars: any[]; reservations: any[]; maintenance: any[]; start: Date; end: Date }) {
        const days = Math.max(1, differenceInCalendarDays(p.end, p.start) + 1);
        const byCar = new Map<number, TopCarRow>();
        for (const c of p.cars) {
            byCar.set(c.id, {
                car_id: c.id,
                plate_number: c.license_plate,
                brand: c.brand,
                model: c.model,
                revenue: 0, bookings: 0, daysRented: 0, occupancy: 0,
                maintenanceCost: 0, netProfit: 0,
            });
        }

        for (const r of p.reservations) {
            const row = byCar.get(r.car_id);
            if (!row) continue;
            row.revenue += Number(r.total_price || 0);
            row.bookings += 1;
            const rs = parseISO(r.start_date);
            const re = parseISO(r.end_date);
            const clipStart = maxDate([rs, p.start]);
            const clipEnd = minDate([re, p.end]);
            const overlap = differenceInCalendarDays(clipEnd, clipStart) + 1;
            if (overlap > 0) row.daysRented += overlap;
        }

        for (const m of p.maintenance) {
            const row = byCar.get(m.car_id);
            if (!row) continue;
            row.maintenanceCost += Number(m.cost || 0);
        }

        for (const row of byCar.values()) {
            row.occupancy = days > 0 ? Math.min((row.daysRented / days) * 100, 100) : 0;
            row.netProfit = row.revenue - row.maintenanceCost;
        }

        topCars.value = Array.from(byCar.values())
            .filter(r => r.revenue > 0 || r.maintenanceCost > 0)
            .sort((a, b) => b.revenue - a.revenue);
    }

    function computeTopClients(reservations: any[]) {
        const map = new Map<string, TopClientRow>();
        for (const r of reservations) {
            const cin = r.client_cin || `__noCIN__${r.client_name}`;
            const row = map.get(cin) || { name: r.client_name || '—', cin: r.client_cin || '—', bookings: 0, revenue: 0, lastBooking: null };
            row.bookings += 1;
            row.revenue += Number(r.total_price || 0);
            const start = r.start_date as string;
            if (!row.lastBooking || start > row.lastBooking) row.lastBooking = start;
            map.set(cin, row);
        }
        topClients.value = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    }

    return {
        loading,
        error,
        // metrics + datasets
        metrics,
        fleetStatus,
        revenueChartData,
        statusChartData,
        revenueSplitChartData,
        brandRevenueChartData,
        maintenanceChartData,
        // tables
        topCars,
        topClients,
        brandBreakdown,
        maintenanceBreakdown,
        // period
        dateRange,
        periodType,
        setPeriod,
        setCustomRange,
        fetchData,
    };
}

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function sum(arr: any[], key: string): number {
    let total = 0;
    for (const r of arr) total += Number(r[key] || 0);
    return total;
}

function pctChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / Math.abs(previous)) * 100;
}
