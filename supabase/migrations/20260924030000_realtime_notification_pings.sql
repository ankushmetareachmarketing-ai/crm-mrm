-- Live notifications via Supabase Realtime "broadcast from database".
-- Every new notification sends a ping to its recipient's private channel
-- `notifications:<employee id>`. The ping carries only the notification id;
-- the browser then reloads the list through /api/notifications (which checks
-- the NextAuth session), so no notification text ever goes over Realtime.

create or replace function public.ping_notification_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- realtime.send() already swallows its own errors, so a Realtime hiccup can
  -- never roll back the business action that created this notification.
  perform realtime.send(
    jsonb_build_object('id', new.id),
    'new',
    'notifications:' || new.recipient_employee_id::text,
    true
  );
  return null;
end;
$$;

create trigger notifications_ping_recipient
after insert on public.notifications
for each row execute function public.ping_notification_recipient();

-- Private channels are authorised by RLS on realtime.messages. The browser
-- connects with a short-lived JWT minted by /api/realtime-token whose `sub`
-- is the signed-in employee's id, so each employee can only join their own
-- channel.
create policy "Employees receive their own notification pings"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() = 'notifications:' || (auth.jwt() ->> 'sub')
);
