-- PROPOSAL ONLY. Not executed. Do not run before reviewing actual preflight DDL,
-- backing up definitions and testing staging concurrency and shared consumers.
-- Applies to the supplied 01_migration.sql contract, not unknown legacy schemas.
-- Does not modify historical amounts, roles, timestamps or user/hash nulls.
begin;

-- All direct record/upload writes must use the same period serialization as the
-- three revised RPCs. Lock both periods in sorted order when moving a record.
create or replace function public.c2_lock_mutation_periods()
returns trigger language plpgsql set search_path='' as $$
declare before_period text; after_period text; p text;
begin
 if tg_op <> 'INSERT' then
   before_period := case when tg_table_name='c2_monthly_cost_records'
     then to_jsonb(old)->>'periode' else to_jsonb(old)->>'period_month' end;
 end if;
 if tg_op <> 'DELETE' then
   after_period := case when tg_table_name='c2_monthly_cost_records'
     then to_jsonb(new)->>'periode' else to_jsonb(new)->>'period_month' end;
 end if;
 for p in select distinct v from unnest(array[before_period,after_period]) as x(v)
          where v is not null order by v loop
   perform pg_advisory_xact_lock(hashtextextended('c2:period:'||p,0));
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

-- PostgreSQL executes same-event triggers alphabetically: locking precedes guards.
drop trigger if exists c2_00_lock_records on public.c2_monthly_cost_records;
create trigger c2_00_lock_records before insert or update or delete
 on public.c2_monthly_cost_records for each row
 execute function public.c2_lock_mutation_periods();
drop trigger if exists c2_00_lock_uploads on public.c2_upload_history_logs;
create trigger c2_00_lock_uploads before insert or update or delete
 on public.c2_upload_history_logs for each row
 execute function public.c2_lock_mutation_periods();

-- Upload roles/path/filename are source provenance, not mutable display fields.
create or replace function public.c2_guard_upload_provenance()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.upload_id is distinct from old.upload_id
 or new.uploaded_at is distinct from old.uploaded_at
 or new.uploaded_by is distinct from old.uploaded_by
 or new.uploaded_by_name is distinct from old.uploaded_by_name
 or new.uploaded_by_role is distinct from old.uploaded_by_role
 or new.file_sha256 is distinct from old.file_sha256
 or new.file_url is distinct from old.file_url
 or new.file_name is distinct from old.file_name
 or new.file_size_bytes is distinct from old.file_size_bytes
 or new.period_month is distinct from old.period_month then
   raise exception 'Identitas sumber dan timestamp unggahan tidak dapat diubah';
 end if;
 return new;
end $$;
drop trigger if exists c2_guard_upload_provenance on public.c2_upload_history_logs;
create trigger c2_guard_upload_provenance before update on public.c2_upload_history_logs
 for each row execute function public.c2_guard_upload_provenance();

create or replace function public.c2_reject_audit_mutation()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Audit C2 bersifat append-only'; end $$;
drop trigger if exists c2_audit_append_only on public.c2_validation_audit_logs;
create trigger c2_audit_append_only before update or delete on public.c2_validation_audit_logs
 for each row execute function public.c2_reject_audit_mutation();
drop trigger if exists c2_deletion_audit_append_only on public.c2_evidence_deletion_audit;
create trigger c2_deletion_audit_append_only before update or delete on public.c2_evidence_deletion_audit
 for each row execute function public.c2_reject_audit_mutation();

-- Browser writes already have no policy in the supplied migration. Revoking the
-- underlying grants also prevents old SECURITY INVOKER paths gaining access later.
revoke insert,update,delete,truncate on public.c2_monthly_cost_records,
 public.c2_upload_history_logs,public.c2_period_validations,
 public.c2_validation_audit_logs,public.c2_report_history
 from public,anon,authenticated;

-- Do not auto-create/modify bucket or historical files here. Verify storage.buckets
-- and storage.objects policies in preflight; restore the private bucket separately
-- only if an administrator confirms it is absent.
rollback; -- Deliberate review default: change to COMMIT only after staging approval.
