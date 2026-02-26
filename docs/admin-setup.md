# Super Admin Setup

## 1) Add a Super Admin User
Use SQL in Supabase SQL editor:

```sql
insert into public.admin_users (user_id)
values ('<AUTH_USER_UUID>')
on conflict (user_id) do nothing;
```

## 2) Verify Access
- User logs in via OTP on web.
- Open: `/{locale}/admin/activation-queue`
- If `admin_users` membership exists, queue page opens.

## 3) Remove Super Admin

```sql
delete from public.admin_users
where user_id = '<AUTH_USER_UUID>';
```

## 4) Operational Notes
- Approval/rejection actions are audited in `audit_log`.
- Queue data lives in `activation_requests`.
- Public activation state is controlled by `salons.status` + visibility fields.
