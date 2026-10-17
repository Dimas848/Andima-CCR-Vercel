-- PROPOSAL ONLY. No objects/data are dropped. Coordinate other C2 deployments.
-- Local UI/API no longer uses these signatures or this old analytics view.
-- Obtain actual definitions/grants and test staging before changing production.
begin;
do $$
begin
 if to_regprocedure('public.c2_delete_upload(uuid)') is not null then
  revoke execute on function public.c2_delete_upload(uuid) from public,anon,authenticated;
 end if;
 if to_regprocedure('public.c2_validate_period(text,text)') is not null then
  revoke execute on function public.c2_validate_period(text,text) from public,anon,authenticated;
 end if;
 if to_regclass('public.c2_cost_transactions') is not null then
  revoke all on public.c2_cost_transactions from public,anon,authenticated;
 end if;
end $$;
-- Keep revised service-only overloads intact. Do not DROP legacy functions/tables.
rollback; -- Review default; production COMMIT requires actual DDL + staging checks.
