begin;

alter table public.syncpay_enrollment_intents
 drop constraint if exists syncpay_enrollment_intents_plan_code_check;

alter table public.syncpay_enrollment_intents
 add constraint syncpay_enrollment_intents_plan_code_check
 check(
  plan_code in (
   'SOLO',
   'SOLO_PREMIUM',
   'PRO',
   'PLUS',
   'PREMIUM'
  )
 );

commit;