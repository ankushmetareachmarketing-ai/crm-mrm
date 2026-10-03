-- Who paid and from which account: recorded with every payment so the
-- Owner can match a receipt to the bank statement before approving it.

alter table public.payments
  add column account_holder_name text,
  add column account_name text;
