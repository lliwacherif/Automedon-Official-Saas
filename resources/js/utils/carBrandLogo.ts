/**
 * Resolves the logo path for a given car brand.
 *
 * Default convention is `/images/<Brand>.png`. Some brands use a different
 * filename (lower-case, .jpg, custom naming...) — those go in the override
 * map below so callers don't need to know about it.
 *
 * Keep this file as the single source of truth: every page that renders a
 * brand logo should import `getBrandLogo` from here.
 */

const BRAND_LOGO_OVERRIDES: Record<string, string> = {
    Toyota: '/images/toyota.png',
    Haval: '/images/haval.png',
    Citroen: '/images/citroine.jpg',
    Mercedes: '/images/Mercedes-Logo.png',
    Audi: '/images/Logo_audi.jpg',
    Opel: '/images/Opel-Logo.png',
    Nissan: '/images/Nissan_logo.jpg',
};

export function getBrandLogo(brand: string | null | undefined): string {
    if (!brand) return '/images/car-default.jpg';
    return BRAND_LOGO_OVERRIDES[brand] ?? `/images/${brand}.png`;
}
