import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useTenantStore } from '@/stores/tenant';
import { format } from 'date-fns';

export type CarBrand = 'Renault' | 'Dacia' | 'Skoda' | 'Hyundai' | 'Seat' | 'MG' | 'Mahindra' | 'Kia' | 'Honda' | 'Peugeot' | 'Cherry' | 'Geely' | 'Volkswagen' | 'Suzuki';
export type CarStatus = 'disponible' | 'loue' | 'maintenance';

export interface Car {
    id: number;
    brand: CarBrand;
    model: string;
    plate_number: string;
    status: CarStatus;
    image_url?: string;
    mileage?: number | null;
    purchase_price?: number | null;
    auto_manage_status?: boolean;
    created_at: string;
    next_reservation?: {
        start_date: string;
        end_date: string;
    };
    active_reservation?: {
        start_date: string;
        end_date: string;
        client_name: string;
        contract_number: string | null;
        status: string;
        total_price: number;
        advance_payment: number;
    };
}

export interface CarsByBrand {
    [key: string]: Car[];
}

export function useCars() {
    const cars = ref<Car[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const tenantStore = useTenantStore();

    const carsByBrand = computed(() => {
        const grouped: CarsByBrand = {
            'Renault': [],
            'Dacia': [],
            'Skoda': [],
            'Hyundai': [],
            'Seat': [],
            'MG': [],
            'Mahindra': [],
            'Kia': [],
            'Honda': [],
            'Peugeot': [],
            'Cherry': [],
            'Geely': [],
            'Volkswagen': [],
            'Suzuki': []
        };

        cars.value.forEach(car => {
            if (grouped[car.brand]) {
                grouped[car.brand].push(car);
            }
        });

        return grouped;
    });

    // Helper to map DB result to Car interface
    const mapCar = (dbCar: any): Car => {
        let imageUrl = dbCar.image_url;

        // Fix for image URL display across environments:
        // If the URL looks like it's from our storage bucket, regenerate it using the current env's Supabase URL.
        // This fixes issues where dev/prod URLs are mixed in the DB.
        if (imageUrl && imageUrl.includes('/storage/v1/object/public/car-images/')) {
            try {
                // Extract the file path (e.g. "folder/file.jpg" or "file.jpg")
                const path = imageUrl.split('/storage/v1/object/public/car-images/')[1];
                if (path) {
                    const { data } = supabase.storage
                        .from('car-images')
                        .getPublicUrl(path);
                    imageUrl = data.publicUrl;
                }
            } catch (e) {
                console.warn('Error rewriting image URL:', e);
            }
        }

        return {
            id: dbCar.id,
            brand: dbCar.brand,
            model: dbCar.model,
            plate_number: dbCar.license_plate, // Map license_plate to plate_number
            status: dbCar.status,
            image_url: imageUrl,
            mileage: dbCar.mileage,
            auto_manage_status: dbCar.auto_manage_status,
            created_at: dbCar.created_at
        };
    };

    // Fetch cars for the current tenant
    async function fetchCars() {
        loading.value = true;
        error.value = null;

        const tenantId = tenantStore.currentTenant?.id;
        // If no tenant context (e.g. global home), return empty or handle differently?
        // For now, assume we only show cars if in a tenant context.
        if (!tenantId) {
            cars.value = [];
            loading.value = false;
            return;
        }

        try {
            // Fetch cars
            const { data: carsData, error: carsError } = await (supabase
                .from('cars')
                .select('id, brand, model, license_plate, status, image_url, mileage, purchase_price, auto_manage_status, created_at')
                .eq('tenant_id', tenantId) // Filter by Tenant
                .order('brand', { ascending: true })
                .order('model', { ascending: true }) as any);

            if (carsError) throw carsError;

            // Fetch future reservations (also scoped by tenant implicitly via RLS, or explicit filter)
            // Ideally add .eq('tenant_id', tenantId) to reservations too, but RLS might cover it.
            const nowIso = new Date().toISOString();
            const todayDate = format(new Date(), 'yyyy-MM-dd'); // For maintenance check

            // Fetch active and future reservations
            const { data: reservationsData, error: resError } = await (supabase
                .from('reservations')
                .select('car_id, start_date, end_date, client_name, contract_number, status, total_price, advance_payment')
                .eq('tenant_id', tenantId)
                .in('status', ['confirmed', 'active'])
                .gte('end_date', nowIso)
                .order('start_date', { ascending: true }) as any);

            if (resError) throw resError;

            // Fetch active maintenance
            const { data: maintenanceData, error: maintError } = await (supabase
                .from('maintenance_records')
                .select('car_id')
                .eq('tenant_id', tenantId)
                .eq('maintenance_date', todayDate) as any);

            if (maintError) throw maintError;

            // Fetch active services (currently happening)
            const { data: servicesData, error: svcError } = await (supabase
                .from('services')
                .select('car_id, start_date, end_date, chauffeur_name, service_type, price')
                .eq('tenant_id', tenantId)
                .lte('start_date', nowIso)
                .gte('end_date', nowIso) as any);

            if (svcError) throw svcError;

            const maintenanceCarIds = new Set((maintenanceData || []).map((m: any) => m.car_id));

            // Map reservations to cars
            const mappedCars = (carsData || []).map((dbCar: any) => {
                const car = mapCar(dbCar);

                // Check for ACTIVE reservation (currently happening)
                const activeRes = (reservationsData || []).find((r: any) =>
                    r.car_id === car.id &&
                    r.start_date <= nowIso &&
                    r.end_date >= nowIso
                );

                // Check for ACTIVE service (currently happening)
                const activeSvc = (servicesData || []).find((s: any) =>
                    s.car_id === car.id
                );

                // Check for ACTIVE maintenance
                const isUnderMaintenance = maintenanceCarIds.has(car.id);

                // Override status if active event exists
                if (activeRes) {
                    car.status = 'loue';
                    car.active_reservation = {
                        start_date: activeRes.start_date,
                        end_date: activeRes.end_date,
                        client_name: activeRes.client_name,
                        contract_number: activeRes.contract_number,
                        status: activeRes.status,
                        total_price: activeRes.total_price || 0,
                        advance_payment: activeRes.advance_payment || 0
                    };
                } else if (activeSvc) {
                    car.status = 'loue';
                    car.active_reservation = {
                        start_date: activeSvc.start_date,
                        end_date: activeSvc.end_date,
                        client_name: `[${activeSvc.service_type === 'transfert' ? 'Transfert' : 'Excursion'}] ${activeSvc.chauffeur_name}`,
                        contract_number: null,
                        status: 'active',
                        total_price: activeSvc.price || 0,
                        advance_payment: activeSvc.price || 0
                    };
                } else if (isUnderMaintenance) {
                    car.status = 'maintenance';
                } else {
                    if (car.status === 'loue' || car.status === 'maintenance') {
                        car.status = 'disponible';
                    }
                }

                // Find nearest future reservation for this car (start > now)
                const futureRes = (reservationsData || []).find((r: any) =>
                    r.car_id === car.id && r.start_date > nowIso
                );

                if (futureRes) {
                    car.next_reservation = {
                        start_date: futureRes.start_date,
                        end_date: futureRes.end_date
                    };
                }

                return car;
            });

            cars.value = mappedCars;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error fetching cars:', e);
        } finally {
            loading.value = false;
        }
    }

    async function fetchCarById(id: number) {
        loading.value = true;
        error.value = null;

        // Ensure we are fetching within the tenant context if set
        const tenantId = tenantStore.currentTenant?.id;

        try {
            let query = supabase
                .from('cars')
                .select('id, brand, model, license_plate, status, image_url, mileage, purchase_price, auto_manage_status, created_at')
                .eq('id', id);

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error: supabaseError } = await (query.single() as any);

            if (supabaseError) throw supabaseError;

            return mapCar(data);
        } catch (e: any) {
            error.value = e.message;
            console.error('Error fetching car:', e);
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function createCar(carData: Omit<Car, 'id' | 'created_at'>) {
        loading.value = true;
        error.value = null;

        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            error.value = "Context Tenant not found. Refresh the page.";
            loading.value = false;
            throw new Error("Context Tenant not found");
        }

        try {
            // Use 'as any' to avoid complex type errors but keep manual mapping logic
            const { data, error: supabaseError } = await (supabase
                .from('cars') as any)
                .insert([
                    {
                        tenant_id: tenantId, // Important!
                        brand: carData.brand,
                        model: carData.model,
                        license_plate: carData.plate_number,
                        status: carData.status,
                        image_url: carData.image_url || null
                    }
                ])
                .select('id, brand, model, license_plate, status, image_url, mileage, purchase_price, auto_manage_status, created_at')
                .single();

            if (supabaseError) throw supabaseError;

            await fetchCars();
            return mapCar(data);
        } catch (e: any) {
            error.value = e.message;
            console.error('Error creating car:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function updateCar(id: number, carData: Partial<Car>) {
        loading.value = true;
        error.value = null;

        // We generally rely on RLS, but having tenantId context is good practice
        const tenantId = tenantStore.currentTenant?.id;
        if (!tenantId) {
            console.warn("Updating car without tenant context.");
        }

        try {
            const updateData: Record<string, any> = {};

            if (carData.brand !== undefined) updateData.brand = carData.brand;
            if (carData.model !== undefined) updateData.model = carData.model;
            if (carData.plate_number !== undefined) updateData.license_plate = carData.plate_number;
            if (carData.status !== undefined) updateData.status = carData.status;
            if (carData.image_url !== undefined) updateData.image_url = carData.image_url || null;

            const { data, error: supabaseError } = await (supabase
                .from('cars') as any)
                .update(updateData)
                .eq('id', id)
                .select('id, brand, model, license_plate, status, image_url, mileage, purchase_price, auto_manage_status, created_at');

            if (supabaseError) throw supabaseError;

            await fetchCars();
            return data?.[0] ? mapCar(data[0]) : null;
        } catch (e: any) {
            error.value = e.message;
            console.error('Error updating car:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function deleteCar(id: number) {
        loading.value = true;
        error.value = null;

        try {
            const { error: supabaseError } = await supabase
                .from('cars')
                .delete()
                .eq('id', id);

            if (supabaseError) throw supabaseError;

            await fetchCars();
        } catch (e: any) {
            error.value = e.message;
            console.error('Error deleting car:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return {
        cars,
        carsByBrand,
        loading,
        error,
        fetchCars,
        fetchCarById,
        createCar,
        updateCar,
        deleteCar,
    };
}
