-- Logging a call outcome (esp. "Call Back") needs a next-follow-up date so
-- it surfaces as a reminder instead of getting lost in the list.

alter table public.call_list_entries
  add column next_follow_up_date date,
  add column next_follow_up_time time without time zone;

create index call_list_entries_follow_up_idx on public.call_list_entries (next_follow_up_date);
