-- Lunch break: time inside it is not counted as working time.
-- Office hours become 10:00–18:00 with lunch 13:30–14:00, so a full day is
-- 7.5 working hours.

alter table public.hr_settings
  add column lunch_start time not null default '13:30',
  add column lunch_end time not null default '14:00',
  add constraint hr_settings_lunch_check check (lunch_end > lunch_start);

update public.hr_settings
set office_start = '10:00',
    office_end = '18:00',
    lunch_start = '13:30',
    lunch_end = '14:00',
    full_day_hours = 7.5,
    half_day_hours = 4,
    updated_at = now();
