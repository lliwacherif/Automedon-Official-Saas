import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { pageKeyForPath, userCanAccessPage } from '@/utils/pagePermissions'

// Import Pages
const Home = () => import('../Pages/Home.vue')
const About = () => import('../Pages/About.vue')

// Auth
const Login = () => import('../Pages/Auth/Login.vue')
const Register = () => import('../Pages/Auth/Register.vue')

// Root
const RootLogin = () => import('../Pages/Root/Login.vue')
const RootDashboard = () => import('../Pages/Root/Dashboard.vue')
const RootSettings = () => import('../Pages/Root/Settings.vue')

// Admin
const AdminLogin = () => import('../Pages/Admin/Login.vue')
const AdminCars = () => import('../Pages/Admin/Cars/Index.vue')
const AdminCarsEdit = () => import('../Pages/Admin/Cars/Edit.vue')

const routes = [
    { path: '/', component: About, name: 'home' },
    { path: '/fleet', component: Home, name: 'fleet' }, // Moved previous home to fleet
    { path: '/about', component: About, name: 'about' },

    // Auth Routes
    { path: '/login', component: Login, name: 'login' },
    { path: '/register', component: Register, name: 'register' },

    // Root Interface
    {
        path: '/root',
        component: RootLogin,
        name: 'root.login',
        meta: { requiresAuth: false }
    },
    {
        path: '/root/dashboard',
        component: RootDashboard,
        name: 'root.dashboard',
        meta: { requiresRoot: true }
    },
    {
        path: '/root/store',
        component: () => import('../Pages/Root/Store/Index.vue'),
        name: 'root.store',
        meta: { requiresRoot: true }
    },
    {
        path: '/root/settings',
        component: RootSettings,
        name: 'root.settings',
        meta: { requiresRoot: true }
    },

    // Tenant Routes
    {
        path: '/:tenantSlug',
        component: () => import('@/components/TenantLayout.vue'), // Optional: if we want a layout wrapper, otherwise pass router-view or just children without component? 
        // If we don't specify component for parent, it renders children in parent's router-view? valid if parent is root.
        // But here we might want a layout. For now, let's just make them separate routes matching params OR keep structure.
        children: [
            // Public Client Pages
            {
                path: '',
                component: Home,
                name: 'tenant.home'
            },
            {
                path: 'fleet',
                component: Home,
                name: 'tenant.fleet'
            },
            {
                path: 'about',
                component: About,
                name: 'tenant.about'
            },

            // Tenant Admin Login
            {
                path: 'admin',
                component: AdminLogin,
                name: 'admin.login',
                meta: { requiresAuth: false }
            },

            // Protected Admin Routes
            {
                path: 'admin/cars',
                component: AdminCars,
                name: 'admin.cars.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/cars/create',
                component: AdminCarsEdit,
                name: 'admin.cars.create',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/cars/:id/edit',
                component: AdminCarsEdit,
                name: 'admin.cars.edit',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/cars/:id/papers',
                component: () => import('../Pages/Admin/Cars/Papers.vue'),
                name: 'admin.cars.papers',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/reservations',
                component: () => import('../Pages/Admin/Reservations/Index.vue'),
                name: 'admin.reservations.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/reservations/:id',
                component: () => import('../Pages/Admin/Reservations/Edit.vue'),
                name: 'admin.reservations.show',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/daily-journal',
                component: () => import('../Pages/Admin/DailyJournal.vue'),
                name: 'admin.daily_journal.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/reservations-table',
                component: () => import('../Pages/Admin/ReservationsTable.vue'),
                name: 'admin.reservations.table',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/faithful-clients',
                component: () => import('../Pages/Admin/FaithfulClients.vue'),
                name: 'admin.faithful_clients.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/invoices/:id/build',
                component: () => import('../Pages/Admin/Invoices/InvoiceBuilderPage.vue'),
                name: 'admin.invoices.build',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/contracts/blank',
                component: () => import('../Pages/Admin/Contracts/ContractBuilderPage.vue'),
                name: 'admin.contracts.blank',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/contracts/:id/build',
                component: () => import('../Pages/Admin/Contracts/ContractBuilderPage.vue'),
                name: 'admin.contracts.build',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/services',
                component: () => import('../Pages/Admin/Services/Index.vue'),
                name: 'admin.services.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/services/invoice',
                component: () => import('../Pages/Admin/Services/InvoiceBuilder.vue'),
                name: 'admin.services.invoice',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/services/b2b-clients',
                component: () => import('../Pages/Admin/Services/B2BClients.vue'),
                name: 'admin.services.b2b',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/maintenance',
                component: () => import('../Pages/Admin/Maintenance/Index.vue'),
                name: 'admin.maintenance.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/kpi',
                component: () => import('../Pages/Admin/KPI/Index.vue'),
                name: 'admin.dashboard', // Renamed from admin.kpi.index for clarity as dashboard
                // Access is gated by the per-user allowed_pages allow-list in
                // the beforeEach guard (or admin role bypass) — no more hard
                // admin-only flag so users granted "kpi" can actually reach it.
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/settings',
                component: () => import('../Pages/Admin/Settings.vue'),
                name: 'admin.settings',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/history',
                component: () => import('../Pages/Admin/History/Index.vue'),
                name: 'admin.history.index',
                // Same as KPI: access controlled by allowed_pages allow-list
                // + admin role bypass — no hard admin-only flag.
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/reports',
                component: () => import('../Pages/Admin/Reports.vue'),
                name: 'admin.reports',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/history/:id',
                component: () => import('../Pages/Admin/History/Show.vue'),
                name: 'admin.history.show',
                // Inherits the same access rule as admin/history (via the
                // allowed_pages allow-list — its routePrefixes include
                // '/admin/history' so /admin/history/:id matches too).
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/store',
                component: () => import('../Pages/Admin/Store/Index.vue'),
                name: 'admin.store.index',
                meta: { requiresAuth: true, requiresAdmin: true } // Visible to all admins (including assistants? or restrict?)
            },
        ]
    },

    // Client Routes (Legacy/Global for now, or move to tenant later?)
    {
        path: '/client/reservations',
        component: () => import('../Pages/Client/Reservations/Index.vue'),
        name: 'client.reservations.index',
        meta: { requiresAuth: true }
    },
    {
        path: '/client/reservations/:id',
        component: () => import('../Pages/Client/Reservations/Show.vue'),
        name: 'client.reservations.show',
        meta: { requiresAuth: true }
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    const tenantStore = useTenantStore()

    // Ensure auth is initialized
    if (authStore.loading) {
        await authStore.initializeAuth()
    }

    // Root Protection
    if (to.meta.requiresRoot) {
        if (!authStore.isRoot) {
            next({ name: 'root.login' })
            return
        }
    }

    // Redirect bare top-level routes back to tenant-scoped versions if a tenant session exists
    const bareRoutes: Record<string, string> = { 'fleet': 'tenant.fleet', 'about': 'tenant.about' }
    if (!to.params.tenantSlug && bareRoutes[to.name as string]) {
        const savedSlug = tenantStore.currentTenant?.slug
            || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('automedon_tenant_slug') : null)
        if (savedSlug) {
            next({ name: bareRoutes[to.name as string], params: { tenantSlug: savedSlug } })
            return
        }
    }

    // Tenant Resolution
    if (to.params.tenantSlug) {
        const slug = to.params.tenantSlug as string
        try {
            await tenantStore.fetchTenantBySlug(slug, true)
        } catch (e) {
            console.error("Tenant not found", e)
            next({ name: 'home' })
            return
        }
    }

    if (to.meta.requiresAdmin && !authStore.isAdmin) {
        // Redirect to tenant login if slug exists, otherwise root or home
        if (to.params.tenantSlug) {
            next({ name: 'admin.login', params: { tenantSlug: to.params.tenantSlug } })
        } else {
            next({ name: 'home' })
        }
        return
    }

    if (to.meta.requiresSuperAdmin && authStore.role !== 'admin') {
        // Assistant trying to access Admin-only pages
        if (to.params.tenantSlug) {
            next({ name: 'admin.reservations.index', params: { tenantSlug: to.params.tenantSlug } })
        } else {
            next({ name: 'home' })
        }
        return
    }

    // Per-user page allow-list (only enforced for non-admin tenant users)
    if (to.meta.requiresAdmin && authStore.isAdmin && authStore.role !== 'admin' && authStore.role !== 'root') {
        const pageKey = pageKeyForPath(to.path)
        if (pageKey && !userCanAccessPage(authStore.role, authStore.allowedPages, pageKey)) {
            // Fall back to a page the user can see
            const tenantSlug = to.params.tenantSlug as string | undefined
            const fallback = pickFallbackRouteName(authStore.allowedPages)
            if (tenantSlug) {
                next({ name: fallback, params: { tenantSlug } })
            } else {
                next({ name: 'home' })
            }
            return
        }
    }

    if (to.meta.requiresAuth && !authStore.user && !authStore.isAdmin) {
        // Standard client auth
        next({ name: 'login' })
    } else {
        next()
    }
})

function pickFallbackRouteName(allowedPages: string[] | null | undefined): string {
    const pageRouteMap: Record<string, string> = {
        fleet: 'admin.cars.index',
        kpi: 'admin.dashboard',
        reservations: 'admin.reservations.index',
        reservations_table: 'admin.reservations.table',
        services: 'admin.services.index',
        maintenance: 'admin.maintenance.index',
        history: 'admin.history.index',
        reports: 'admin.reports',
        daily_journal: 'admin.daily_journal.index',
        faithful_clients: 'admin.faithful_clients.index',
        store: 'admin.store.index',
    }
    if (allowedPages && allowedPages.length > 0) {
        for (const key of allowedPages) {
            if (pageRouteMap[key]) return pageRouteMap[key]
        }
    }
    return 'admin.settings'
}

export default router
