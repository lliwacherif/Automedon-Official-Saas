<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { supabase } from '@/lib/supabase';
import { type Car } from '@/composables/useCars';
import { 
    format, 
    addMonths, 
    subMonths, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek,
    endOfWeek,
    eachDayOfInterval, 
    isSameMonth, 
    isToday, 
    isWithinInterval,
    parseISO,
    isSameDay,
    compareAsc,
    startOfDay,
    endOfDay,
    differenceInDays,
    differenceInHours
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, Calendar as CalendarIcon, Clock, Wrench, CarFront, CalendarRange } from 'lucide-vue-next';
import { formatDateTime } from '@/utils/date';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
    show: boolean;
    car: Car | null;
}>();

const emit = defineEmits(['close']);

const authStore = useAuthStore();

const currentMonth = ref(new Date());
const reservations = ref<any[]>([]);
const loading = ref(false);
const viewMode = ref<'compact' | 'annual'>('annual');

// Touch swipe support
const touchStartX = ref(0);
const touchEndX = ref(0);
const swiping = ref(false);

function onTouchStart(e: TouchEvent) {
    touchStartX.value = e.changedTouches[0].screenX;
    swiping.value = true;
}
function onTouchEnd(e: TouchEvent) {
    if (!swiping.value) return;
    touchEndX.value = e.changedTouches[0].screenX;
    const diff = touchStartX.value - touchEndX.value;
    if (Math.abs(diff) > 60) {
        if (diff > 0) nextMonth();
        else prevMonth();
    }
    swiping.value = false;
}

watch(() => [props.show, props.car], async ([isShow, newCar]) => {
    if (isShow && newCar) {
        currentMonth.value = new Date();
        await fetchReservations((newCar as Car).id);
    }
}, { immediate: true });

async function fetchReservations(carId: number) {
    loading.value = true;
    try {
        const { data, error } = await supabase
            .from('reservations')
            .select('id, start_date, end_date, status')
            .eq('car_id', carId)
            .in('status', ['confirmed', 'active']);

        if (error) throw error;

        const { data: svcData, error: svcError } = await supabase
            .from('services')
            .select('id, start_date, end_date, service_type')
            .eq('car_id', carId);

        if (svcError) throw svcError;

        const today = startOfDay(new Date());

        const filteredRes = (data || []).filter((res: any) => {
            const endDate = endOfDay(parseISO(res.end_date));
            return compareAsc(endDate, today) >= 0;
        }).map((res: any) => ({ ...res, _type: 'reservation' }));

        const filteredSvc = (svcData || []).filter((svc: any) => {
            const endDate = endOfDay(parseISO(svc.end_date));
            return compareAsc(endDate, today) >= 0;
        }).map((svc: any) => ({
            ...svc,
            status: 'active',
            _type: 'service',
        }));

        reservations.value = [...filteredRes, ...filteredSvc];
    } catch (e) {
        console.error('Error fetching reservations:', e);
    } finally {
        loading.value = false;
    }
}

const calendarDays = computed(() => {
    const monthStart = startOfMonth(currentMonth.value);
    const monthEnd = endOfMonth(currentMonth.value);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
});

function getDateReservations(date: Date) {
    return reservations.value.filter(res => {
        const startDate = startOfDay(parseISO(res.start_date));
        const endDate = endOfDay(parseISO(res.end_date));
        return isWithinInterval(date, { start: startDate, end: endDate });
    });
}

function isDateReserved(date: Date) {
    return getDateReservations(date).length > 0;
}

function getDateType(date: Date): 'reservation' | 'service' | 'both' | null {
    const items = getDateReservations(date);
    if (items.length === 0) return null;
    const hasRes = items.some(i => i._type === 'reservation');
    const hasSvc = items.some(i => i._type === 'service');
    if (hasRes && hasSvc) return 'both';
    if (hasSvc) return 'service';
    return 'reservation';
}

function isRangeStart(date: Date) {
    return reservations.value.some(res => isSameDay(date, startOfDay(parseISO(res.start_date))));
}

function isRangeEnd(date: Date) {
    return reservations.value.some(res => isSameDay(date, startOfDay(parseISO(res.end_date))));
}

function isRangeMiddle(date: Date) {
    return isDateReserved(date) && !isRangeStart(date) && !isRangeEnd(date);
}

const activeReservation = computed(() => {
    const now = new Date();
    return reservations.value.find(res => {
        const startDate = parseISO(res.start_date);
        const endDate = parseISO(res.end_date);
        return isWithinInterval(now, { start: startDate, end: endDate });
    });
});

const futureReservations = computed(() => {
    const today = startOfDay(new Date());
    const future = reservations.value.filter(res => {
        if (activeReservation.value && res.id === activeReservation.value.id) return false;
        const startDate = startOfDay(parseISO(res.start_date));
        return compareAsc(startDate, today) >= 0;
    });
    return future.sort((a, b) => compareAsc(parseISO(a.start_date), parseISO(b.start_date)));
});

function getDuration(startDate: string, endDate: string) {
    const days = differenceInDays(parseISO(endDate), parseISO(startDate));
    if (days < 1) {
        const hours = differenceInHours(parseISO(endDate), parseISO(startDate));
        return `${hours}h`;
    }
    return `${days}j`;
}

function nextMonth() {
    currentMonth.value = addMonths(currentMonth.value, 1);
}
function prevMonth() {
    currentMonth.value = subMonths(currentMonth.value, 1);
}
function goToToday() {
    currentMonth.value = new Date();
}

const isCurrentMonth = computed(() => isSameMonth(currentMonth.value, new Date()));

function close() {
    emit('close');
}

const isAvailableToday = computed(() => !activeReservation.value);

const weekdaysMobile = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const weekdaysDesktop = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Annual view helpers
function getDaysForMonth(date: Date) {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const sd = startOfWeek(monthStart, { weekStartsOn: 1 });
    const ed = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: sd, end: ed });
}

const largeCalendarDays = computed(() => getDaysForMonth(currentMonth.value));

const smallMonths = computed(() => {
    const months = [];
    for (let i = 1; i <= 12; i++) {
        months.push(addMonths(currentMonth.value, i));
    }
    return months;
});

// Tooltip
const hoveredDate = ref<Date | null>(null);
const tooltipInfo = computed(() => {
    if (!hoveredDate.value) return null;
    const items = getDateReservations(hoveredDate.value);
    if (items.length === 0) return null;
    return items;
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-all duration-250 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div v-if="show" class="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
                <!-- Backdrop -->
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" @click="close"></div>

                <!-- Modal Content -->
                <div class="fixed inset-0 bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
                    :class="viewMode === 'annual' 
                        ? 'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-[1200px] sm:h-[90vh] sm:rounded-2xl' 
                        : 'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[95vw] sm:max-w-[920px] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl'"
                >
                    
                    <!-- Header -->
                    <div class="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 bg-white">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <div class="p-2 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl shrink-0 ring-1 ring-indigo-100">
                                <CalendarIcon class="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600" />
                            </div>
                            <div class="min-w-0">
                                <h3 class="text-sm sm:text-lg font-bold text-gray-900 truncate">
                                    {{ car?.brand }} {{ car?.model }}
                                    <span v-if="authStore.isAdmin" class="ml-1.5 text-gray-400 font-medium text-xs sm:text-sm">
                                        {{ car?.plate_number }}
                                    </span>
                                </h3>
                                <p class="text-[11px] sm:text-xs text-gray-400 mt-0.5">Calendrier de disponibilité</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <!-- View mode toggle -->
                            <div class="flex items-center bg-gray-100 rounded-lg p-0.5">
                                <button 
                                    @click="viewMode = 'compact'"
                                    class="p-1.5 sm:p-2 rounded-md transition-all duration-150"
                                    :class="viewMode === 'compact' 
                                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' 
                                        : 'text-gray-400 hover:text-gray-600'"
                                    title="Vue mensuelle"
                                >
                                    <CalendarIcon class="w-4 h-4" />
                                </button>
                                <button 
                                    @click="viewMode = 'annual'"
                                    class="p-1.5 sm:p-2 rounded-md transition-all duration-150"
                                    :class="viewMode === 'annual' 
                                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' 
                                        : 'text-gray-400 hover:text-gray-600'"
                                    title="Vue annuelle"
                                >
                                    <CalendarRange class="w-4 h-4" />
                                </button>
                            </div>

                            <button 
                                @click="close" 
                                class="p-2 -mr-1 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
                            >
                                <X class="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                    </div>

                    <!-- ============ COMPACT VIEW ============ -->
                    <div v-if="viewMode === 'compact'" class="flex-1 overflow-y-auto overscroll-contain">
                        <div class="p-4 sm:p-6">
                            <!-- Status Banner -->
                            <div 
                                class="flex items-center gap-3 px-4 py-3 sm:py-3.5 rounded-xl mb-5 sm:mb-6"
                                :class="isAvailableToday 
                                    ? 'bg-emerald-50 ring-1 ring-emerald-200/60' 
                                    : 'bg-red-50 ring-1 ring-red-200/60'"
                            >
                                <div 
                                    class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0"
                                    :class="isAvailableToday ? 'bg-emerald-100' : 'bg-red-100'"
                                >
                                    <Check v-if="isAvailableToday" class="w-4 h-4 text-emerald-600" />
                                    <AlertCircle v-else class="w-4 h-4 text-red-500" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="font-semibold text-[13px] sm:text-sm" :class="isAvailableToday ? 'text-emerald-700' : 'text-red-700'">
                                        {{ isAvailableToday ? 'Disponible aujourd\'hui' : 'Actuellement réservé' }}
                                    </p>
                                    <p v-if="!isAvailableToday && activeReservation" class="text-[11px] sm:text-xs mt-0.5" :class="isAvailableToday ? 'text-emerald-600/70' : 'text-red-500/70'">
                                        Jusqu'au {{ formatDateTime(activeReservation.end_date) }}
                                        <span v-if="activeReservation._type === 'service'" class="ml-1 text-orange-500 font-semibold">(Service)</span>
                                    </p>
                                </div>
                                <div 
                                    class="w-2 h-2 rounded-full shrink-0 animate-pulse"
                                    :class="isAvailableToday ? 'bg-emerald-400' : 'bg-red-400'"
                                ></div>
                            </div>

                            <!-- Main Grid -->
                            <div class="flex flex-col lg:flex-row gap-5 sm:gap-6">
                                
                                <!-- CALENDAR -->
                                <div class="flex-1 min-w-0">
                                    <div class="bg-gray-50/80 rounded-2xl p-3.5 sm:p-5 ring-1 ring-gray-100">
                                        
                                        <!-- Month Navigation -->
                                        <div class="flex items-center justify-between mb-4">
                                            <button 
                                                @click="prevMonth" 
                                                class="p-2 sm:p-2.5 rounded-xl bg-white hover:bg-gray-50 active:scale-95 transition-all touch-manipulation ring-1 ring-gray-200 shadow-sm"
                                            >
                                                <ChevronLeft class="h-4 w-4 text-gray-600" />
                                            </button>
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm sm:text-base font-bold text-gray-800 capitalize">
                                                    {{ format(currentMonth, 'MMMM yyyy', { locale: fr }) }}
                                                </span>
                                                <button 
                                                    v-if="!isCurrentMonth"
                                                    @click="goToToday"
                                                    class="text-[10px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full transition-colors"
                                                >
                                                    Aujourd'hui
                                                </button>
                                            </div>
                                            <button 
                                                @click="nextMonth" 
                                                class="p-2 sm:p-2.5 rounded-xl bg-white hover:bg-gray-50 active:scale-95 transition-all touch-manipulation ring-1 ring-gray-200 shadow-sm"
                                            >
                                                <ChevronRight class="h-4 w-4 text-gray-600" />
                                            </button>
                                        </div>

                                        <!-- Calendar Grid -->
                                        <div 
                                            class="select-none"
                                            @touchstart.passive="onTouchStart"
                                            @touchend.passive="onTouchEnd"
                                        >
                                            <!-- Weekday Headers -->
                                            <div class="grid grid-cols-7 mb-1.5">
                                                <div 
                                                    v-for="(day, index) in weekdaysDesktop" 
                                                    :key="day" 
                                                    class="text-center py-2 text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider"
                                                >
                                                    <span class="sm:hidden">{{ weekdaysMobile[index] }}</span>
                                                    <span class="hidden sm:inline">{{ day }}</span>
                                                </div>
                                            </div>
                                            
                                            <!-- Days Grid -->
                                            <div class="grid grid-cols-7 gap-y-1">
                                                <div 
                                                    v-for="date in calendarDays" 
                                                    :key="date.toISOString()" 
                                                    class="relative"
                                                    :class="{ 'z-10': isToday(date) }"
                                                >
                                                    <!-- Range connector background -->
                                                    <div 
                                                        v-if="isSameMonth(date, currentMonth) && isDateReserved(date)"
                                                        class="absolute inset-y-0.5 sm:inset-y-1"
                                                        :class="[
                                                            getDateType(date) === 'service' ? 'bg-orange-100/70' : 'bg-red-100/70',
                                                            isRangeStart(date) && !isRangeEnd(date) ? 'left-1/2 right-0 rounded-l-lg' : '',
                                                            isRangeEnd(date) && !isRangeStart(date) ? 'left-0 right-1/2 rounded-r-lg' : '',
                                                            isRangeMiddle(date) ? 'left-0 right-0' : '',
                                                            isRangeStart(date) && isRangeEnd(date) ? 'hidden' : '',
                                                        ]"
                                                    ></div>
                                                    
                                                    <div
                                                        class="relative aspect-square flex flex-col items-center justify-center mx-auto w-full max-w-[44px] sm:max-w-[48px]"
                                                        @mouseenter="hoveredDate = date"
                                                        @mouseleave="hoveredDate = null"
                                                    >
                                                        <div
                                                            class="w-9 h-9 sm:w-10 sm:h-10 flex flex-col items-center justify-center rounded-xl transition-all duration-150"
                                                            :class="[
                                                                !isSameMonth(date, currentMonth) 
                                                                    ? 'opacity-20' 
                                                                    : '',
                                                                
                                                                isToday(date) && isSameMonth(date, currentMonth)
                                                                    ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50 text-indigo-700 font-bold shadow-sm' 
                                                                    : '',
                                                                
                                                                isSameMonth(date, currentMonth) && isDateReserved(date) && !isToday(date)
                                                                    ? getDateType(date) === 'service' 
                                                                        ? 'bg-orange-100 text-orange-700' 
                                                                        : 'bg-red-100 text-red-700'
                                                                    : '',
                                                                    
                                                                isSameMonth(date, currentMonth) && !isDateReserved(date) && !isToday(date)
                                                                    ? 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700' 
                                                                    : '',
                                                                    
                                                                !isSameMonth(date, currentMonth) 
                                                                    ? 'text-gray-300' 
                                                                    : '',
                                                            ]"
                                                        >
                                                            <time 
                                                                :datetime="format(date, 'yyyy-MM-dd')"
                                                                class="text-xs sm:text-sm font-semibold leading-none"
                                                            >
                                                                {{ format(date, 'd') }}
                                                            </time>
                                                            
                                                            <!-- Status indicator -->
                                                            <div 
                                                                v-if="isSameMonth(date, currentMonth) && !isToday(date)"
                                                                class="flex gap-0.5 mt-1"
                                                            >
                                                                <div 
                                                                    class="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
                                                                    :class="isDateReserved(date) 
                                                                        ? getDateType(date) === 'service' ? 'bg-orange-500' : 'bg-red-500' 
                                                                        : 'bg-emerald-400'"
                                                                ></div>
                                                                <div 
                                                                    v-if="getDateType(date) === 'both'"
                                                                    class="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-orange-500"
                                                                ></div>
                                                            </div>
                                                            <!-- Today indicator dot -->
                                                            <div 
                                                                v-if="isToday(date) && isSameMonth(date, currentMonth)"
                                                                class="w-1 h-1 rounded-full bg-indigo-500 mt-0.5"
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Legend -->
                                        <div class="mt-4 pt-3.5 border-t border-gray-200/80 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                                            <div class="flex items-center gap-1.5">
                                                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-100"></span>
                                                <span class="text-[11px] sm:text-xs text-gray-500 font-medium">Disponible</span>
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <span class="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-100"></span>
                                                <span class="text-[11px] sm:text-xs text-gray-500 font-medium">Réservé</span>
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <span class="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-100"></span>
                                                <span class="text-[11px] sm:text-xs text-gray-500 font-medium">Service</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- RESERVATIONS SIDEBAR -->
                                <div class="lg:w-[280px] xl:w-[300px] shrink-0">
                                    <div class="bg-gray-50/80 rounded-2xl p-3.5 sm:p-5 ring-1 ring-gray-100 h-full flex flex-col">
                                        <div class="flex items-center justify-between mb-3.5">
                                            <h4 class="text-[13px] sm:text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Clock class="w-4 h-4 text-indigo-500" />
                                                À venir
                                            </h4>
                                            <span 
                                                class="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                                :class="futureReservations.length > 0 ? 'text-indigo-600 bg-indigo-100' : 'text-gray-400 bg-gray-100'"
                                            >
                                                {{ futureReservations.length }}
                                            </span>
                                        </div>
                                        
                                        <!-- Empty State -->
                                        <div 
                                            v-if="futureReservations.length === 0" 
                                            class="flex-1 flex flex-col items-center justify-center py-8 sm:py-10 text-center"
                                        >
                                            <div class="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                                                <CalendarIcon class="w-6 h-6 text-gray-300" />
                                            </div>
                                            <p class="text-sm font-medium text-gray-400">Aucune réservation</p>
                                            <p class="text-[11px] text-gray-300 mt-1">Ce véhicule est libre</p>
                                        </div>

                                        <!-- Reservation Cards -->
                                        <div v-else class="space-y-2.5 flex-1 max-h-[180px] lg:max-h-[320px] overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar">
                                            <div 
                                                v-for="res in futureReservations" 
                                                :key="res.id"
                                                class="bg-white rounded-xl p-3 sm:p-3.5 ring-1 transition-all hover:shadow-sm"
                                                :class="res._type === 'service' ? 'ring-orange-200/60 hover:ring-orange-300' : 'ring-gray-200/80 hover:ring-indigo-200'"
                                            >
                                                <div class="flex items-start gap-2.5">
                                                    <div 
                                                        class="p-1.5 rounded-lg shrink-0 mt-0.5"
                                                        :class="res._type === 'service' ? 'bg-orange-50' : 'bg-indigo-50'"
                                                    >
                                                        <Wrench v-if="res._type === 'service'" class="w-3.5 h-3.5 text-orange-500" />
                                                        <CarFront v-else class="w-3.5 h-3.5 text-indigo-500" />
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <!-- Type badge + duration -->
                                                        <div class="flex items-center gap-1.5 mb-1.5">
                                                            <span 
                                                                class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                                :class="res._type === 'service' ? 'text-orange-600 bg-orange-50' : 'text-indigo-600 bg-indigo-50'"
                                                            >
                                                                {{ res._type === 'service' ? (res.service_type || 'Service') : 'Réservation' }}
                                                            </span>
                                                            <span class="text-[10px] font-semibold text-gray-400">
                                                                {{ getDuration(res.start_date, res.end_date) }}
                                                            </span>
                                                        </div>
                                                        <!-- Dates -->
                                                        <div class="space-y-1">
                                                            <div class="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-600">
                                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                                                <span class="truncate">{{ formatDateTime(res.start_date) }}</span>
                                                            </div>
                                                            <div class="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-600">
                                                                <span class="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></span>
                                                                <span class="truncate">{{ formatDateTime(res.end_date) }}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ============ ANNUAL VIEW ============ -->
                    <template v-else>
                        <!-- MOBILE LAYOUT: Single scrollable column -->
                        <div class="flex-1 overflow-y-auto lg:hidden overscroll-contain">
                            <!-- Current Month - Mobile -->
                            <div class="p-4 bg-white border-b border-gray-200">
                                <!-- Month Navigation -->
                                <div class="flex items-center justify-between mb-4">
                                    <button @click="prevMonth" class="p-2 hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200">
                                        <ChevronLeft class="w-5 h-5 text-gray-600" />
                                    </button>
                                    <div class="flex items-center gap-2">
                                        <h3 class="text-lg font-bold text-gray-900 capitalize">
                                            {{ format(currentMonth, 'MMMM yyyy', { locale: fr }) }}
                                        </h3>
                                        <button 
                                            v-if="!isCurrentMonth"
                                            @click="goToToday"
                                            class="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full transition-colors"
                                        >
                                            Aujourd'hui
                                        </button>
                                    </div>
                                    <button @click="nextMonth" class="p-2 hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200">
                                        <ChevronRight class="w-5 h-5 text-gray-600" />
                                    </button>
                                </div>

                                <!-- Calendar Grid - Mobile -->
                                <div 
                                    class="select-none"
                                    @touchstart.passive="onTouchStart"
                                    @touchend.passive="onTouchEnd"
                                >
                                    <div class="grid grid-cols-7 mb-2">
                                        <div v-for="day in weekdaysMobile" :key="day" 
                                            class="text-center text-xs font-semibold text-gray-500 py-2">
                                            {{ day }}
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-7 gap-1">
                                        <div 
                                            v-for="date in largeCalendarDays" 
                                            :key="date.toISOString()" 
                                            class="aspect-square relative"
                                        >
                                            <div
                                                class="absolute inset-0.5 flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all"
                                                :class="[
                                                    !isSameMonth(date, currentMonth) ? 'text-gray-300' : '',
                                                    isToday(date) && isSameMonth(date, currentMonth) ? 'ring-2 ring-indigo-500' : '',
                                                    isSameMonth(date, currentMonth) ? (
                                                        isDateReserved(date) 
                                                            ? getDateType(date) === 'service' 
                                                                ? 'bg-orange-100 text-orange-700' 
                                                                : 'bg-red-100 text-red-700'
                                                            : 'bg-green-50 text-green-700'
                                                    ) : ''
                                                ]"
                                            >
                                                <span>{{ format(date, 'd') }}</span>
                                                <div 
                                                    v-if="isSameMonth(date, currentMonth)"
                                                    class="flex gap-0.5 mt-0.5"
                                                >
                                                    <div 
                                                        class="w-1 h-1 rounded-full"
                                                        :class="isDateReserved(date) 
                                                            ? getDateType(date) === 'service' ? 'bg-orange-500' : 'bg-red-500' 
                                                            : 'bg-green-500'"
                                                    ></div>
                                                    <div 
                                                        v-if="getDateType(date) === 'both'"
                                                        class="w-1 h-1 rounded-full bg-orange-500"
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Legend - Mobile -->
                                <div class="mt-4 pt-3 border-t border-gray-200 flex justify-center gap-4 flex-wrap">
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                        <span class="text-xs text-gray-600">Disponible</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                        <span class="text-xs text-gray-600">Réservé</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                                        <span class="text-xs text-gray-600">Service</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Future Months - Mobile -->
                            <div class="p-4 bg-gray-50">
                                <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                    Mois Suivants (Prochains 12 mois)
                                </h3>
                                <div class="grid grid-cols-2 gap-3">
                                    <div 
                                        v-for="monthDate in smallMonths" 
                                        :key="monthDate.toISOString()" 
                                        class="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
                                    >
                                        <h4 class="text-sm font-bold text-gray-900 capitalize mb-2 text-center">
                                            {{ format(monthDate, 'MMMM', { locale: fr }) }}
                                        </h4>
                                        <div class="grid grid-cols-7 gap-0.5 mb-1">
                                            <div v-for="day in ['L', 'M', 'M', 'J', 'V', 'S', 'D']" :key="day" 
                                                class="text-center text-[9px] font-medium text-gray-400">
                                                {{ day }}
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-7 gap-0.5">
                                            <div 
                                                v-for="date in getDaysForMonth(monthDate)" 
                                                :key="date.toISOString()" 
                                                class="aspect-square flex items-center justify-center rounded text-[9px] relative"
                                                :class="[
                                                    !isSameMonth(date, monthDate) ? 'text-transparent' : 'text-gray-700'
                                                ]"
                                            >
                                                <span class="z-10 relative">{{ isSameMonth(date, monthDate) ? format(date, 'd') : '' }}</span>
                                                <div v-if="isSameMonth(date, monthDate)" 
                                                    class="absolute inset-0 rounded transition-colors"
                                                    :class="isDateReserved(date) 
                                                        ? getDateType(date) === 'service' ? 'bg-orange-100' : 'bg-red-100' 
                                                        : 'bg-green-50'"
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- DESKTOP LAYOUT: Side by side -->
                        <div class="hidden lg:flex flex-1 overflow-hidden">
                            <!-- LEFT: Large Current Month -->
                            <div class="flex-1 p-6 overflow-y-auto bg-white border-r border-gray-100">
                                <div class="h-full flex flex-col">
                                    <div class="flex items-center justify-between mb-6">
                                        <button @click="prevMonth" class="p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                                            <ChevronLeft class="w-6 h-6 text-gray-400 group-hover:text-gray-900" />
                                        </button>
                                        <div class="flex items-center gap-3">
                                            <h3 class="text-2xl font-bold text-gray-900 capitalize">
                                                {{ format(currentMonth, 'MMMM yyyy', { locale: fr }) }}
                                            </h3>
                                            <button 
                                                v-if="!isCurrentMonth"
                                                @click="goToToday"
                                                class="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors"
                                            >
                                                Aujourd'hui
                                            </button>
                                        </div>
                                        <button @click="nextMonth" class="p-2 hover:bg-gray-100 rounded-lg transition-colors group">
                                            <ChevronRight class="w-6 h-6 text-gray-400 group-hover:text-gray-900" />
                                        </button>
                                    </div>

                                    <div class="flex-1 flex flex-col">
                                        <div class="grid grid-cols-7 mb-4">
                                            <div v-for="day in weekdaysDesktop" :key="day" 
                                                class="text-center text-sm font-semibold text-gray-400 uppercase tracking-wider py-2">
                                                {{ day }}
                                            </div>
                                        </div>
                                        
                                        <div class="grid grid-cols-7 grid-rows-6 gap-2 flex-1">
                                            <div 
                                                v-for="date in largeCalendarDays" 
                                                :key="date.toISOString()" 
                                                class="relative border rounded-xl p-2 transition-all duration-200 flex flex-col justify-between"
                                                :class="[
                                                    !isSameMonth(date, currentMonth) ? 'bg-gray-50/50 text-gray-300 border-transparent' : 'bg-white border-gray-100',
                                                    isToday(date) ? 'ring-2 ring-indigo-500 ring-offset-2' : '',
                                                    isSameMonth(date, currentMonth) ? (
                                                        isDateReserved(date)
                                                            ? getDateType(date) === 'service' 
                                                                ? 'bg-orange-50 border-orange-100' 
                                                                : 'bg-red-50 border-red-100'
                                                            : 'bg-green-50 border-green-100'
                                                    ) : ''
                                                ]"
                                            >
                                                <div class="flex justify-between items-start">
                                                    <span class="text-lg font-medium" 
                                                        :class="[
                                                            isToday(date) ? 'text-indigo-600' : 'text-gray-700',
                                                            isSameMonth(date, currentMonth) && isDateReserved(date) 
                                                                ? getDateType(date) === 'service' ? 'text-orange-700' : 'text-red-700' 
                                                                : '',
                                                            isSameMonth(date, currentMonth) && !isDateReserved(date) ? 'text-green-700' : ''
                                                        ]">
                                                        {{ format(date, 'd') }}
                                                    </span>
                                                    <div v-if="isSameMonth(date, currentMonth)">
                                                        <Wrench v-if="getDateType(date) === 'service'" class="w-4 h-4 text-orange-500" />
                                                        <AlertCircle v-else-if="isDateReserved(date)" class="w-4 h-4 text-red-500" />
                                                        <Check v-else class="w-4 h-4 text-green-500" />
                                                    </div>
                                                </div>
                                                
                                                <div v-if="isSameMonth(date, currentMonth)" class="mt-auto text-xs font-medium truncate"
                                                    :class="isDateReserved(date) 
                                                        ? getDateType(date) === 'service' ? 'text-orange-600' : 'text-red-600' 
                                                        : 'text-green-600'">
                                                    {{ isDateReserved(date) 
                                                        ? getDateType(date) === 'service' ? 'Service' : 'Loué' 
                                                        : 'Libre' }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- RIGHT: Small Upcoming Months -->
                            <div class="w-[60%] p-6 bg-gray-50 overflow-y-auto border-l border-gray-200">
                                <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Mois Suivants (Prochains 12 mois)</h3>
                                
                                <div class="grid grid-cols-4 gap-4">
                                    <div v-for="monthDate in smallMonths" :key="monthDate.toISOString()" class="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex flex-col items-center">
                                        <h4 class="text-sm font-bold text-gray-900 capitalize mb-2 text-center">
                                            {{ format(monthDate, 'MMMM', { locale: fr }) }}
                                        </h4>
                                        
                                        <div class="grid grid-cols-7 gap-0.5 mb-2">
                                            <div v-for="day in ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']" :key="day" 
                                                class="text-center text-[10px] font-medium text-gray-400">
                                                {{ day }}
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-7 gap-0.5 w-full">
                                            <div 
                                                v-for="date in getDaysForMonth(monthDate)" 
                                                :key="date.toISOString()" 
                                                class="aspect-square flex items-center justify-center rounded-full text-[10px] relative"
                                                :class="[
                                                    !isSameMonth(date, monthDate) ? 'text-transparent pointer-events-none' : 'text-gray-700'
                                                ]"
                                            >
                                                <span class="z-10 relative">{{ isSameMonth(date, monthDate) ? format(date, 'd') : '' }}</span>
                                                <div v-if="isSameMonth(date, monthDate)" 
                                                    class="absolute inset-0 rounded-full transition-colors"
                                                    :class="isDateReserved(date) 
                                                        ? getDateType(date) === 'service' 
                                                            ? 'bg-orange-100 text-orange-700 font-bold' 
                                                            : 'bg-red-100 text-red-700 font-bold' 
                                                        : 'bg-green-50 text-green-700'"
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Legend Footer - Annual View -->
                        <div class="flex bg-white border-t border-gray-100 px-4 sm:px-6 py-3 justify-between items-center text-sm">
                            <div class="flex gap-4 sm:gap-6 flex-wrap">
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 rounded-full bg-green-500"></span>
                                    <span class="text-gray-600 font-medium text-xs sm:text-sm">Disponible</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 rounded-full bg-red-500"></span>
                                    <span class="text-gray-600 font-medium text-xs sm:text-sm">Réservé</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="w-3 h-3 rounded-full bg-orange-500"></span>
                                    <span class="text-gray-600 font-medium text-xs sm:text-sm">Service</span>
                                </div>
                            </div>
                        </div>
                    </template>
                    
                    <!-- Footer -->
                    <div v-if="viewMode === 'compact'" class="sticky bottom-0 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex justify-end safe-bottom">
                        <button 
                            @click="close"
                            class="w-full sm:w-auto px-8 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all touch-manipulation"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #e5e7eb;
    border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #d1d5db;
}

.safe-bottom {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
.overscroll-contain {
    -webkit-overflow-scrolling: touch;
}
.touch-manipulation {
    touch-action: manipulation;
}
.select-none {
    -webkit-user-select: none;
    user-select: none;
}
</style>
