-- Drop the existing foreign key constraint
ALTER TABLE public.reservation_documents
DROP CONSTRAINT IF EXISTS reservation_documents_reservation_id_fkey;

-- Re-create it with ON DELETE CASCADE
ALTER TABLE public.reservation_documents
ADD CONSTRAINT reservation_documents_reservation_id_fkey
FOREIGN KEY (reservation_id)
REFERENCES public.reservations(id)
ON DELETE CASCADE;
