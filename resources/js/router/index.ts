import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'

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
                path: 'admin/maintenance',
                component: () => import('../Pages/Admin/Maintenance/Index.vue'),
                name: 'admin.maintenance.index',
                meta: { requiresAuth: true, requiresAdmin: true }
            },
            {
                path: 'admin/kpi',
                component: () => import('../Pages/Admin/KPI/Index.vue'),
                name: 'admin.dashboard', // Renamed from admin.kpi.index for clarity as dashboard
                meta: { requiresAuth: true, requiresAdmin: true, requiresSuperAdmin: true }
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
                meta: { requiresAuth: true, requiresAdmin: true, requiresSuperAdmin: true }
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
                meta: { requiresAuth: true, requiresAdmin: true, requiresSuperAdmin: true }
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

    // Tenant Resolution
    if (to.params.tenantSlug) {
        const slug = to.params.tenantSlug as string
        if (tenantStore.currentTenant?.slug !== slug) {
            try {
                await tenantStore.fetchTenantBySlug(slug)
            } catch (e) {
                // Tenant not found
                console.error("Tenant not found", e)
                next({ name: 'home' }) // or 404
                return
            }
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

    if (to.meta.requiresAuth && !authStore.user && !authStore.isAdmin) {
        // Standard client auth
        next({ name: 'login' })
    } else {
        next()
    }
})

export default router
