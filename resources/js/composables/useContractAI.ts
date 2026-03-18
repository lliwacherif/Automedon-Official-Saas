import { ref } from 'vue';
import type { Car } from './useCars';
import type { Reservation } from './useReservations';
import { compressImage } from '@/utils/image';

const SCALEWAY_PROXY_URL = '/api/scaleway';
const MODEL = 'gemma-3-27b-it';

const SYSTEM_PROMPT = `You are a specialized OCR and document analysis assistant for car rental contracts. Your task is to analyze an image of a paper car rental contract and extract all relevant information into a structured JSON object.

CRITICAL RULES:
1. You MUST return ONLY a valid JSON object. No explanations, no markdown fences, no text before or after the JSON.
2. You MUST handle text in Arabic (العربية), French, and English. Arabic text may be handwritten and right-to-left.
3. You MUST handle both handwritten and printed text.
4. For any field you cannot find or read in the contract, set it to null.
5. Do NOT guess or fabricate data. Only extract what is clearly visible.

EXPECTED JSON SCHEMA:
{
  "client_name": "string | null — Full name of the primary client/renter (الاسم الكامل / Nom complet)",
  "client_cin": "string | null — National ID card number (رقم بطاقة التعريف / CIN)",
  "client_phone": "string | null — Phone number (رقم الهاتف / Téléphone)",
  "client_email": "string | null — Email address",
  "client_permit_number": "string | null — Driving license number (رقم رخصة السياقة / Numéro de permis)",
  "second_driver_name": "string | null — Second driver full name if present",
  "second_driver_cin": "string | null — Second driver CIN",
  "second_driver_phone": "string | null — Second driver phone",
  "second_driver_email": "string | null — Second driver email",
  "second_driver_permit_number": "string | null — Second driver permit number",
  "car_plate_number": "string | null — Vehicle license plate / registration number (رقم اللوحة / Matricule). Extract the FULL plate number as written.",
  "car_brand": "string | null — Vehicle brand/make (الماركة / Marque) e.g. Renault, Dacia, Hyundai",
  "car_model": "string | null — Vehicle model (النوع / Modèle) e.g. Clio, Logan, i10",
  "contract_number": "string | null — Contract or reservation number (رقم العقد / Numéro de contrat)",
  "start_date": "string | null — Rental start date in YYYY-MM-DDTHH:mm format (تاريخ البداية / Date de début). If only date without time, use T08:00",
  "end_date": "string | null — Rental end date in YYYY-MM-DDTHH:mm format (تاريخ النهاية / Date de fin). If only date without time, use T08:00",
  "price_per_day": "number | null — Daily rental rate (السعر اليومي / Prix par jour)",
  "total_price": "number | null — Total rental amount (المبلغ الإجمالي / Prix total)",
  "advance_payment": "number | null — Advance/deposit paid (التسبيق / Acompte / Avance)",
  "caution": "number | null — Security deposit amount (الضمان / Caution)",
  "caution_currency": "string | null — Currency of the security deposit: 'DT' for Tunisian Dinar (دينار تونسي), 'EUR' for Euro, 'USD' for Dollar. Default to 'DT' if currency is ambiguous or Tunisian context.",
  "pickup_location": "string | null — Vehicle pickup location (مكان الاستلام / Lieu de prise en charge)",
  "return_location": "string | null — Vehicle return location (مكان الإرجاع / Lieu de retour)",
  "notes": "string | null — Any additional notes, conditions, or observations visible on the contract"
}

ADDITIONAL GUIDELINES:
- For Arabic names, transliterate them as they appear. If the contract has both Arabic and Latin versions, prefer the Latin version.
- Phone numbers: include country code if visible, otherwise just the number as written.
- Dates: convert from any format (DD/MM/YYYY, MM-DD-YYYY, Arabic date formats) to YYYY-MM-DDTHH:mm. For Tunisian contracts, assume DD/MM/YYYY format.
- Monetary values: extract as plain numbers without currency symbols.
- If the contract mentions "caution en espèces" or "caution en euros", set caution_currency accordingly.
- For plate numbers, preserve the exact format including any dashes, spaces, or regional identifiers (e.g. "123 تونس 4567").`;

interface ContractAIResult {
    client_name: string | null;
    client_cin: string | null;
    client_phone: string | null;
    client_email: string | null;
    client_permit_number: string | null;
    second_driver_name: string | null;
    second_driver_cin: string | null;
    second_driver_phone: string | null;
    second_driver_email: string | null;
    second_driver_permit_number: string | null;
    car_plate_number: string | null;
    car_brand: string | null;
    car_model: string | null;
    contract_number: string | null;
    start_date: string | null;
    end_date: string | null;
    price_per_day: number | null;
    total_price: number | null;
    advance_payment: number | null;
    caution: number | null;
    caution_currency: string | null;
    pickup_location: string | null;
    return_location: string | null;
    notes: string | null;
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function matchCar(result: ContractAIResult, cars: Car[]): number | null {
    if (!cars.length) return null;

    const normalizePlate = (plate: string) =>
        plate.toLowerCase().replace(/[\s\-_.]/g, '');

    if (result.car_plate_number) {
        const needle = normalizePlate(result.car_plate_number);
        const match = cars.find(c =>
            normalizePlate(c.plate_number) === needle ||
            normalizePlate(c.plate_number).includes(needle) ||
            needle.includes(normalizePlate(c.plate_number))
        );
        if (match) return match.id;
    }

    if (result.car_brand || result.car_model) {
        const brand = (result.car_brand || '').toLowerCase().trim();
        const model = (result.car_model || '').toLowerCase().trim();

        const match = cars.find(c => {
            const cBrand = c.brand.toLowerCase();
            const cModel = c.model.toLowerCase();
            if (brand && model) return cBrand === brand && cModel.includes(model);
            if (brand) return cBrand === brand;
            if (model) return cModel.includes(model);
            return false;
        });
        if (match) return match.id;
    }

    return null;
}

function parseAIResponse(raw: string): ContractAIResult {
    let cleaned = raw.trim();

    // Strip markdown code fences if the model wrapped the response
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }

    // Find the first { and last } to extract JSON
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.substring(start, end + 1);
    }

    return JSON.parse(cleaned) as ContractAIResult;
}

export function useContractAI() {
    const isAnalyzing = ref(false);
    const analysisError = ref<string | null>(null);
    const analysisResult = ref<Partial<Reservation> | null>(null);
    const filledFieldsCount = ref(0);

    async function analyzeContract(file: File, cars: Car[]): Promise<Partial<Reservation>> {
        isAnalyzing.value = true;
        analysisError.value = null;
        analysisResult.value = null;
        filledFieldsCount.value = 0;

        try {
            const apiKey = import.meta.env.VITE_SCALEWAY_API_KEY;
            if (!apiKey) {
                throw new Error('Scaleway API key is not configured (VITE_SCALEWAY_API_KEY)');
            }

            const compressed = await compressImage(file, 1920, 1920, 0.85);
            const base64DataUrl = await fileToBase64(compressed);

            const response = await fetch(`${SCALEWAY_PROXY_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image_url',
                                    image_url: { url: base64DataUrl },
                                },
                                {
                                    type: 'text',
                                    text: 'Analyze this car rental contract image. Extract all visible information and return the JSON object as specified. Process any Arabic, French, or English text you find.',
                                },
                            ],
                        },
                    ],
                    max_tokens: 2048,
                    temperature: 0.1,
                    top_p: 0.95,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed (${response.status}): ${errorBody}`);
            }

            const data = await response.json();
            const rawContent = data.choices?.[0]?.message?.content;

            if (!rawContent) {
                throw new Error('No content in API response');
            }

            const extracted = parseAIResponse(rawContent);
            const carId = matchCar(extracted, cars);

            const reservation: Partial<Reservation> = {};
            let count = 0;

            if (extracted.client_name) { reservation.client_name = extracted.client_name; count++; }
            if (extracted.client_cin) { reservation.client_cin = extracted.client_cin; count++; }
            if (extracted.client_phone) { reservation.client_phone = extracted.client_phone; count++; }
            if (extracted.client_email) { reservation.client_email = extracted.client_email; count++; }
            if (extracted.client_permit_number) { reservation.client_permit_number = extracted.client_permit_number; count++; }

            if (extracted.second_driver_name) { reservation.second_driver_name = extracted.second_driver_name; count++; }
            if (extracted.second_driver_cin) { reservation.second_driver_cin = extracted.second_driver_cin; count++; }
            if (extracted.second_driver_phone) { reservation.second_driver_phone = extracted.second_driver_phone; count++; }
            if (extracted.second_driver_email) { reservation.second_driver_email = extracted.second_driver_email; count++; }
            if (extracted.second_driver_permit_number) { reservation.second_driver_permit_number = extracted.second_driver_permit_number; count++; }

            if (carId) { reservation.car_id = carId; count++; }
            if (extracted.contract_number) { reservation.contract_number = extracted.contract_number; count++; }
            if (extracted.start_date) { reservation.start_date = extracted.start_date; count++; }
            if (extracted.end_date) { reservation.end_date = extracted.end_date; count++; }

            if (extracted.price_per_day != null) { reservation.price_per_day = extracted.price_per_day; count++; }
            if (extracted.total_price != null) { reservation.total_price = extracted.total_price; count++; }
            if (extracted.advance_payment != null) { reservation.advance_payment = extracted.advance_payment; count++; }
            if (extracted.caution != null) { reservation.caution = extracted.caution; count++; }
            if (extracted.caution_currency) { reservation.caution_currency = extracted.caution_currency; count++; }

            if (extracted.pickup_location) { reservation.pickup_location = extracted.pickup_location; count++; }
            if (extracted.return_location) { reservation.return_location = extracted.return_location; count++; }
            if (extracted.notes) { reservation.notes = extracted.notes; count++; }

            filledFieldsCount.value = count;
            analysisResult.value = reservation;
            return reservation;
        } catch (e: any) {
            analysisError.value = e.message || 'Failed to analyze contract';
            throw e;
        } finally {
            isAnalyzing.value = false;
        }
    }

    function hasSecondDriver(result: Partial<Reservation>): boolean {
        return !!(
            result.second_driver_name ||
            result.second_driver_cin ||
            result.second_driver_phone
        );
    }

    return {
        isAnalyzing,
        analysisError,
        analysisResult,
        filledFieldsCount,
        analyzeContract,
        hasSecondDriver,
    };
}
