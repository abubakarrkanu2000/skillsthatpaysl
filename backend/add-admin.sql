-- Create the user in Supabase Authentication > Users first.
-- Replace this email with the actual admin email, then run in the SQL Editor.
insert into stp_private.admins(user_id)
select id from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL')
on conflict(user_id) do nothing;

-- Check that the intended account was added. A missing account yields no row.
select u.email from stp_private.admins a join auth.users u on u.id=a.user_id;
