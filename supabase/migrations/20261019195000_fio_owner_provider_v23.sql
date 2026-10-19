-- V23: OWNER is also a professional by default, regardless of SHOP/SOLO.
-- Explicit opt-out is tenant-scoped and never demotes the owner.
BEGIN;
ALTER TABLE public.barbershops ADD COLUMN IF NOT EXISTS owner_accepts_bookings boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.fio_set_owner_booking_availability(p_shop uuid,p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF p_shop IS NULL OR p_enabled IS NULL OR auth.uid() IS NULL OR public.member_role(p_shop) IS DISTINCT FROM 'OWNER'
 THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.barbershops SET owner_accepts_bookings=p_enabled WHERE id=p_shop;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SHOP'; END IF;
 RETURN p_enabled;
END $fn$;
REVOKE ALL ON FUNCTION public.fio_set_owner_booking_availability(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fio_set_owner_booking_availability(uuid,boolean) TO authenticated;

-- Rebuild preserved function bodies changing only the provider eligibility and 90-day horizon.
DO $do$
DECLARE r record; before_sql text; after_sql text;
BEGIN
 FOR r IN
 SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='fio_private' AND p.proname IN ('is_provider','book_appointment_before_staff_lock'))
    OR (n.nspname='public' AND p.proname IN ('available_slots','calendar_day_availability'))
 LOOP
  before_sql:=r.definition;
  after_sql:=regexp_replace(before_sql,
   $pattern$m\.role\s*=\s*'OWNER'\s+and\s+b\.operation_mode\s*=\s*'SOLO'$pattern$,
   $replace$m.role='OWNER' and b.owner_accepts_bookings is true$replace$,'gi');
  IF after_sql=before_sql AND position('owner_accepts_bookings' IN before_sql)=0 THEN
   RAISE EXCEPTION 'V23_PROVIDER_SQL_MISSING: %',r.signature;
  END IF;
  IF r.signature LIKE 'available_slots(%' THEN
   after_sql:=replace(after_sql,'date+60','date+90');
  END IF;
  IF r.signature LIKE 'calendar_day_availability(%' THEN
   after_sql:=replace(after_sql,'today_local+60','today_local+90');
   after_sql:=replace(after_sql,'''60 days''','''90 days''');
  END IF;
  IF r.signature LIKE '%book_appointment_before_staff_lock(%' THEN
   after_sql:=replace(after_sql,'''60 days''','''90 days''');
  END IF;
  EXECUTE after_sql;
 END LOOP;
END $do$;
COMMIT;
