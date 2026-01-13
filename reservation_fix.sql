-- Logic:
-- We need to generate a unique reservation_number if it's not provided.
-- Format: RES-YYYYMMDD-XXXX (where XXXX is a random 4 digit string)

CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reservation_number IS NULL THEN
        NEW.reservation_number := 'RES-' || to_char(now(), 'YYYYMMDD') || '-' || 
                                  lpad(floor(random() * 10000)::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS set_reservation_number ON public.reservations;

CREATE TRIGGER set_reservation_number
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION generate_reservation_number();
