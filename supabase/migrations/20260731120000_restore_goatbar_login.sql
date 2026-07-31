-- Restore the internal Goatbar account used to access the management panel.
--
-- The account is expected to already exist: creating application users directly
-- in auth.users would bypass GoTrue's identity setup and can leave an account
-- that cannot authenticate. Failing the migration when it is absent makes that
-- operational problem explicit instead of reporting a successful password fix.
do $$
declare
  target_user_id uuid;
begin
  select id
    into target_user_id
    from auth.users
   where lower(email) = lower('drinksgoatbar@gmail.com')
   limit 1;

  if target_user_id is null then
    raise exception
      'Goatbar login account is missing; create drinksgoatbar@gmail.com through Supabase Auth before applying this migration';
  end if;

  update auth.users
     set encrypted_password = crypt('Goatbar@1234', gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         recovery_token = '',
         recovery_sent_at = null,
         updated_at = now()
   where id = target_user_id;
end
$$;
