<script setup lang="ts">
import { ref, computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTenantStore } from '@/stores/tenant';
import { useTenantLink } from '@/composables/useTenantLink';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import GlobalCalendarModal from '@/components/GlobalCalendarModal.vue';
import {
    Car,
    Home,
    Info,
    BarChart3,
    ClipboardList,
    Bus,
    Wrench,
    Settings,
    History,
    AlertTriangle,
    CalendarClock,
    Calendar,
    Table,
    ShoppingBag,
    LogOut,
    LogIn,
    UserPlus,
    Menu,
    X,
    BookOpen,
    User,
    ChevronRight,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const tenantStore = useTenantStore();
const { tenantPath } = useTenantLink();
const router = useRouter();
const route = useRoute();

// Mobile menu state
const isMobileMenuOpen = ref(false);
const showCalendarModal = ref(false);

const toggleMobileMenu = () => {
    isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const closeMobileMenu = () => {
    isMobileMenuOpen.value = false;
};

async function handleLogout() {
    await authStore.signOut();
    closeMobileMenu();
}

// Helper to check if current route matches
const isActive = (path: string) => {
    return route.path.includes(path);
};
</script>

<template>
    <nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div class="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
            <div class="flex items-center justify-between h-16">
                <!-- Left: Logo + Nav Links -->
                <div class="flex items-center gap-1">
                    <!-- Logo -->
                    <RouterLink :to="tenantPath('/')" class="flex items-center gap-2 mr-4 shrink-0 group">
                        <div class="relative">
                            <img 
                                :src="tenantStore.currentTenant?.logo_url || '/images/icon-automedon.png'" 
                                alt="Logo" 
                                class="h-8 w-8 object-contain rounded-lg ring-1 ring-gray-200 group-hover:ring-indigo-300 transition-all" 
                            />
                        </div>
                        <span class="text-base font-bold text-gray-900 hidden sm:block tracking-tight">
                            {{ tenantStore.currentTenant?.name || 'Automedon' }}
                        </span>
                    </RouterLink>

                    <!-- Desktop Navigation -->
                    <div class="hidden lg:flex items-center gap-0.5">
                        <!-- Public Links -->
                        <RouterLink 
                            v-if="tenantStore.currentTenant" 
                            :to="tenantPath('/fleet')" 
                            class="nav-item"
                            :class="{ 'nav-item-active': isActive('/fleet') }"
                        >
                            <Home class="w-4 h-4" />
                            <span>{{ $t('nav.fleet') }}</span>
                        </RouterLink>

                        <RouterLink 
                            :to="tenantPath('/about')" 
                            class="nav-item"
                            :class="{ 'nav-item-active': isActive('/about') }"
                        >
                            <Info class="w-4 h-4" />
                            <span>{{ $t('nav.about') }}</span>
                        </RouterLink>

                        <!-- Divider -->
                        <div v-if="authStore.isAdmin && tenantStore.currentTenant" class="w-px h-5 bg-gray-200 mx-1.5"></div>

                        <!-- Admin Links -->
                        <template v-if="authStore.isAdmin && tenantStore.currentTenant">
                            <RouterLink 
                                v-if="authStore.role === 'admin'"
                                :to="tenantPath('/admin/kpi')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/kpi') }"
                            >
                                <BarChart3 class="w-4 h-4" />
                                <span>KPI</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/cars')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/cars') }"
                            >
                                <Car class="w-4 h-4" />
                                <span>{{ $t('nav.admin') }}</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/reservations')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/reservations') && !isActive('/admin/reservations-table') }"
                            >
                                <ClipboardList class="w-4 h-4" />
                                <span>{{ $t('nav.reservations') }}</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/services')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/services') }"
                            >
                                <Bus class="w-4 h-4" />
                                <span>Services</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/maintenance')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/maintenance') }"
                            >
                                <Wrench class="w-4 h-4" />
                                <span>Maintenance</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/settings')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/settings') }"
                            >
                                <Settings class="w-4 h-4" />
                                <span>{{ $t('admin.settings.title') }}</span>
                            </RouterLink>

                            <RouterLink 
                                v-if="authStore.role === 'admin'"
                                :to="tenantPath('/admin/history')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/history') }"
                            >
                                <History class="w-4 h-4" />
                                <span>History</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/reports')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/reports') }"
                            >
                                <AlertTriangle class="w-4 h-4" />
                                <span>{{ $t('reports.title') }}</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/daily-journal')" 
                                class="nav-item"
                                :class="{ 'nav-item-active': isActive('/admin/daily-journal') }"
                            >
                                <CalendarClock class="w-4 h-4" />
                                <span>{{ $t('daily_journal.title') }}</span>
                            </RouterLink>
                        </template>
                    </div>
                </div>

                <!-- Right: Actions -->
                <div class="hidden lg:flex items-center gap-1">
                    <!-- Quick Action Buttons -->
                    <button 
                        v-if="authStore.isAdmin && tenantStore.currentTenant" 
                        @click="router.push(tenantPath('/admin/reservations-table'))"
                        class="action-btn"
                        :class="{ 'action-btn-active': isActive('/admin/reservations-table') }"
                        title="Tableau Admin"
                    >
                        <Table class="w-4 h-4" />
                    </button>

                    <button 
                        v-if="tenantStore.currentTenant" 
                        @click="showCalendarModal = true"
                        class="action-btn"
                        title="Calendrier Global"
                    >
                        <Calendar class="w-4 h-4" />
                    </button>

                    <RouterLink 
                        v-if="tenantStore.currentTenant && authStore.isAdmin"
                        :to="tenantPath('/admin/store')"
                        class="action-btn"
                        :class="{ 'action-btn-active': isActive('/admin/store') }"
                        title="Store"
                    >
                        <ShoppingBag class="w-4 h-4" />
                    </RouterLink>

                    <div class="w-px h-5 bg-gray-200 mx-1"></div>

                    <LanguageSwitcher class="mr-1" />

                    <!-- User Section -->
                    <template v-if="authStore.user || authStore.isAdmin">
                        <div class="flex items-center gap-2 ml-1">
                            <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                <User class="w-3.5 h-3.5 text-indigo-500" />
                                <span v-if="authStore.isAdmin" class="text-xs font-semibold text-gray-700">{{ $t('common.admin') }}</span>
                                <span v-else class="text-xs text-gray-600 max-w-[120px] truncate">{{ authStore.user?.email }}</span>
                            </div>

                            <RouterLink 
                                v-if="!authStore.isAdmin" 
                                to="/client/reservations" 
                                class="action-btn"
                                title="Mes réservations"
                            >
                                <BookOpen class="w-4 h-4" />
                            </RouterLink>

                            <button 
                                @click="handleLogout" 
                                class="action-btn text-red-400 hover:text-red-600 hover:bg-red-50"
                                :title="$t('nav.logout')"
                            >
                                <LogOut class="w-4 h-4" />
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <div class="flex items-center gap-2 ml-1">
                            <RouterLink 
                                to="/login" 
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <LogIn class="w-4 h-4" />
                                {{ $t('nav.login') }}
                            </RouterLink>
                            <RouterLink 
                                to="/register" 
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <UserPlus class="w-4 h-4" />
                                {{ $t('nav.register') }}
                            </RouterLink>
                        </div>
                    </template>
                </div>

                <!-- Mobile: Right Side -->
                <div class="lg:hidden flex items-center gap-2">
                    <LanguageSwitcher />
                    <button 
                        @click="toggleMobileMenu"
                        class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <Menu v-if="!isMobileMenuOpen" class="w-5 h-5" />
                        <X v-else class="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Mobile Sidebar Overlay -->
        <Teleport to="body">
            <Transition name="fade">
                <div 
                    v-if="isMobileMenuOpen" 
                    class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                    @click="closeMobileMenu"
                ></div>
            </Transition>
        </Teleport>

        <!-- Mobile Sidebar -->
        <Teleport to="body">
            <Transition name="slide">
                <div 
                    v-if="isMobileMenuOpen"
                    class="fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 lg:hidden flex flex-col"
                >
                    <!-- Sidebar Header -->
                    <div class="flex items-center justify-between p-4 border-b border-gray-100">
                        <div class="flex items-center gap-2">
                            <img 
                                :src="tenantStore.currentTenant?.logo_url || '/images/icon-automedon.png'" 
                                alt="Logo" 
                                class="h-8 w-8 object-contain rounded-lg" 
                            />
                            <span class="text-base font-bold text-gray-900">
                                {{ tenantStore.currentTenant?.name || 'Automedon' }}
                            </span>
                        </div>
                        <button 
                            @click="closeMobileMenu"
                            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- User Info -->
                    <div v-if="authStore.user || authStore.isAdmin" class="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <User class="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <p v-if="authStore.isAdmin" class="text-sm font-semibold text-indigo-700">{{ $t('common.admin') }}</p>
                                <p v-else class="text-sm text-gray-700 font-medium truncate max-w-[180px]">{{ authStore.user?.email }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation Links -->
                    <div class="py-2 flex-1 overflow-y-auto">
                        <!-- Public Section -->
                        <div class="px-4 pt-3 pb-1.5">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Navigation</span>
                        </div>

                        <RouterLink 
                            v-if="tenantStore.currentTenant"
                            :to="tenantPath('/fleet')" 
                            @click="closeMobileMenu"
                            class="mobile-nav-item"
                            :class="{ 'mobile-nav-active': isActive('/fleet') }"
                        >
                            <Home class="w-5 h-5" />
                            <span>{{ $t('nav.fleet') }}</span>
                            <ChevronRight class="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </RouterLink>

                        <button 
                            v-if="authStore.isAdmin && tenantStore.currentTenant"
                            @click="() => { router.push(tenantPath('/admin/reservations-table')); closeMobileMenu(); }"
                            class="mobile-nav-item w-full text-left"
                            :class="{ 'mobile-nav-active': isActive('/admin/reservations-table') }"
                        >
                            <Table class="w-5 h-5" />
                            <span>Tableau Admin</span>
                        </button>

                        <button 
                            v-if="tenantStore.currentTenant"
                            @click="() => { showCalendarModal = true; closeMobileMenu(); }"
                            class="mobile-nav-item w-full text-left"
                        >
                            <Calendar class="w-5 h-5" />
                            <span>Calendrier Global</span>
                        </button>

                        <RouterLink 
                            v-if="tenantStore.currentTenant && authStore.isAdmin"
                            :to="tenantPath('/admin/store')"
                            @click="closeMobileMenu"
                            class="mobile-nav-item"
                            :class="{ 'mobile-nav-active': isActive('/admin/store') }"
                        >
                            <ShoppingBag class="w-5 h-5" />
                            <span>Store</span>
                        </RouterLink>

                        <RouterLink 
                            :to="tenantPath('/about')"
                            @click="closeMobileMenu"
                            class="mobile-nav-item"
                            :class="{ 'mobile-nav-active': isActive('/about') }"
                        >
                            <Info class="w-5 h-5" />
                            <span>{{ $t('nav.about') }}</span>
                        </RouterLink>

                        <!-- Admin Section -->
                        <template v-if="authStore.isAdmin && tenantStore.currentTenant">
                            <div class="px-4 pt-5 pb-1.5">
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Administration</span>
                            </div>

                            <RouterLink 
                                v-if="authStore.role === 'admin'"
                                :to="tenantPath('/admin/kpi')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/kpi') }"
                            >
                                <BarChart3 class="w-5 h-5" />
                                <span>KPI Dashboard</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/cars')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/cars') }"
                            >
                                <Car class="w-5 h-5" />
                                <span>{{ $t('nav.admin') }}</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/reservations')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/reservations') }"
                            >
                                <ClipboardList class="w-5 h-5" />
                                <span>{{ $t('nav.reservations') }}</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/services')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/services') }"
                            >
                                <Bus class="w-5 h-5" />
                                <span>Services</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/maintenance')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/maintenance') }"
                            >
                                <Wrench class="w-5 h-5" />
                                <span>Maintenance</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/settings')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/settings') }"
                            >
                                <Settings class="w-5 h-5" />
                                <span>{{ $t('admin.settings.title') }}</span>
                            </RouterLink>

                            <RouterLink 
                                v-if="authStore.role === 'admin'"
                                :to="tenantPath('/admin/history')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/history') }"
                            >
                                <History class="w-5 h-5" />
                                <span>History</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/reports')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/reports') }"
                            >
                                <AlertTriangle class="w-5 h-5" />
                                <span>{{ $t('reports.title') }}</span>
                            </RouterLink>

                            <RouterLink 
                                :to="tenantPath('/admin/daily-journal')"
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                                :class="{ 'mobile-nav-active': isActive('/admin/daily-journal') }"
                            >
                                <CalendarClock class="w-5 h-5" />
                                <span>{{ $t('daily_journal.title') }}</span>
                            </RouterLink>
                        </template>

                        <!-- Client Section -->
                        <template v-if="authStore.user && !authStore.isAdmin">
                            <div class="px-4 pt-5 pb-1.5">
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mon Compte</span>
                            </div>

                            <RouterLink 
                                to="/client/reservations" 
                                @click="closeMobileMenu"
                                class="mobile-nav-item"
                            >
                                <BookOpen class="w-5 h-5" />
                                <span>{{ $t('nav.my_bookings') }}</span>
                            </RouterLink>
                        </template>
                    </div>

                    <!-- Bottom Actions -->
                    <div class="shrink-0 p-4 border-t border-gray-100 bg-gray-50/50">
                        <template v-if="authStore.user || authStore.isAdmin">
                            <button 
                                @click="handleLogout"
                                class="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium"
                            >
                                <LogOut class="w-4 h-4" />
                                {{ $t('nav.logout') }}
                            </button>
                        </template>
                        <template v-else>
                            <div class="space-y-2">
                                <RouterLink 
                                    to="/login" 
                                    @click="closeMobileMenu"
                                    class="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                                >
                                    <LogIn class="w-4 h-4" />
                                    {{ $t('nav.login') }}
                                </RouterLink>
                                <RouterLink 
                                    to="/register" 
                                    @click="closeMobileMenu"
                                    class="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
                                >
                                    <UserPlus class="w-4 h-4" />
                                    {{ $t('nav.register') }}
                                </RouterLink>
                            </div>
                        </template>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <GlobalCalendarModal :show="showCalendarModal" @close="showCalendarModal = false" />
    </nav>
</template>

<style scoped>
/* Desktop nav items — icon only, text reveals on hover */
.nav-item {
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 0.55rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgb(107 114 128);
    border-radius: 0.5rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    position: relative;
}

.nav-item :deep(svg) {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
}

.nav-item > span {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s ease,
                margin 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 0;
}

.nav-item:hover {
    color: rgb(79 70 229);
    background-color: rgb(238 242 255);
    padding: 0.55rem 0.75rem;
    gap: 0;
}

.nav-item:hover > span {
    max-width: 10rem;
    opacity: 1;
    margin-left: 0.4rem;
}

.nav-item-active {
    color: rgb(79 70 229);
    background-color: rgb(238 242 255);
    box-shadow: inset 0 0 0 1px rgb(199 210 254);
}

/* Right-side action buttons */
.action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    color: rgb(156 163 175);
    border-radius: 0.5rem;
    transition: all 0.15s ease;
}

.action-btn :deep(svg) {
    width: 1.15rem;
    height: 1.15rem;
}

.action-btn:hover {
    color: rgb(79 70 229);
    background-color: rgb(243 244 246);
}

.action-btn-active {
    color: rgb(79 70 229);
    background-color: rgb(238 242 255);
}

/* Mobile nav items */
.mobile-nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    margin: 0.125rem 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgb(55 65 81);
    border-radius: 0.5rem;
    transition: all 0.15s ease;
}

.mobile-nav-item:hover {
    color: rgb(79 70 229);
    background-color: rgb(238 242 255);
}

.mobile-nav-active {
    color: rgb(79 70 229);
    background-color: rgb(238 242 255);
}

/* Slide animation for sidebar */
.slide-enter-active,
.slide-leave-active {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
    transform: translateX(100%);
}

/* Fade animation for overlay */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
