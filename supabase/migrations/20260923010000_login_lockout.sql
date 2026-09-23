-- Brute-force protection: track failed login attempts per employee and lock
-- the account out for a cooldown period after too many in a row. Previously
-- there was no limit at all on login attempts.

alter table public.employees
  add column failed_login_attempts integer not null default 0,
  add column locked_until timestamptz;
