-- READ ONLY. Run with catalog visibility in Supabase SQL Editor.
-- Does not invoke any C2 mutation RPC. Output may include function bodies;
-- keep the results private when they contain business logic.
begin transaction read only;

select current_database(), current_user, now() as inspected_at;

-- Existence, RLS, ownership, and view security_invoker options.
select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       c.reloptions, pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and (c.relname like 'c2_%' or c.relname like 'vw_c2_%')
order by c.relname;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name in (
 'c2_customers','c2_monthly_cost_records','c2_upload_history_logs',
 'c2_upload_drafts','c2_period_validations','c2_validation_audit_logs',
 'c2_evidence_deletion_audit','c2_report_history',
 'vw_c2_company_monthly_summary_v2','vw_c2_company_tax_tracing_v2','vw_c2_evidence_history_v2')
order by table_name, ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname='public' and tablename like 'c2_%')
   or (schemaname='storage' and tablename='objects')
order by schemaname, tablename, policyname;

select c.relname, has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v')
  and (c.relname like 'c2_%' or c.relname like 'vw_c2_%') order by c.relname;

-- Exact overload signatures and effective grants, including inherited PUBLIC.
select p.oid::regprocedure as signature, p.prosecdef as security_definer,
       p.provolatile, p.proconfig, p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'c2_%' order by p.proname, p.oid;

select c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'c2_%' and not t.tgisinternal
order by c.relname, t.tgname;

select c.relname, pg_get_viewdef(c.oid, true) as definition
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
 and (c.relname='c2_cost_transactions' or c.relname like 'vw_c2_%');

select conrelid::regclass as relation, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace='public'::regnamespace
and conrelid in (select oid from pg_class where relname like 'c2_%');
select tablename, indexname, indexdef from pg_indexes
where schemaname='public' and tablename like 'c2_%';

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id='c2-company-sales-reports';

-- Database object dependencies: coordinate consumers in other projects too.
select dependent_ns.nspname as schema_name, dependent.relname as dependent_view
from pg_depend d join pg_rewrite rw on rw.oid=d.objid
join pg_class dependent on dependent.oid=rw.ev_class
join pg_namespace dependent_ns on dependent_ns.oid=dependent.relnamespace
where d.refobjid=to_regclass('public.c2_cost_transactions');

-- Reconcile without repairing legacy values. The three zero-detail logs are
-- intentionally visible here but excluded from the revised Evidence view.
select h.upload_id,h.file_name,h.period_month,h.total_rows as log_rows,
 count(r.record_id) as detail_rows,h.total_cost_amount as log_cost,
 sum(r.total_cost) as detail_cost,
 h.total_cost_amount-coalesce(sum(r.total_cost),0) as difference
from public.c2_upload_history_logs h
left join public.c2_monthly_cost_records r on r.upload_id=h.upload_id
group by h.upload_id,h.file_name,h.period_month,h.total_rows,h.total_cost_amount
order by h.period_month,h.file_name;

select periode, sum(company_share_pct) as share_total, sum(sum_total_cost) as total_cost
from public.vw_c2_company_monthly_summary_v2 group by periode;
select 'drafts' as relation,count(*) from public.c2_upload_drafts
union all select 'deletion_audit',count(*) from public.c2_evidence_deletion_audit;
rollback;
