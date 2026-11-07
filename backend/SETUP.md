# Existing-project Academy extension

Run RUN_THIS.sql in your current STP Supabase SQL editor. Read ../START_HERE.md for launch steps.

The migration requires the existing public.stp_is_admin() function. It reuses the original administrator allowlist rather than creating another one. Existing account credentials still apply. A new administrator, if needed later, should be added through your original stp_private.admins process by the database owner, not through public signup.

New objects: academy_products (authoritative prices/capacity/open status), academy_orders (contact information and payment state), academy_payment_audit (review history), academy_notifications (pending provider setup), academy_deployments (one-time activation), private academy-receipts bucket. RPCs implement registration, status lookup, receipt submission and authorised review. Matching existing event registrations are referenced by optional foreign key; event records and settings remain unchanged.

Private status tokens have 256 random bits; only their SHA-256 hashes are stored in the order table. Public status responses exclude contact phone/email and transaction details. Public users cannot list orders or read receipts. Uploads require the matching order token and an eligible payment state. The private bucket restricts types to JPEG/PNG/WebP/PDF and file size to 5 MB; upload policies limit the normal flow to three files per token. Authorised admins can create two-minute signed viewing links. Review existing storage policies for unrelated broad access rules that could also cover this bucket.

Confirmed transfer references are unique. Repeated confirmation is idempotent and creates only one pending email job and one pending SMS job. Capacity is checked under a per-product transaction lock. Pending orders do not reserve seats. Monitor outstanding transfers near capacity and close registration early; arrange an alternate group or refund manually if a transfer arrives after the last seat is allocated. No automatic refunds, expiring seat holds, receipt OCR or bank verification is implemented.

The website reads prices and online availability through academy_public_config(). Edit academy_products in Supabase for authoritative settings. The admin screen can open/close all Academy programmes. Initial preserved product settings: NLe 355 online monthly with 200 capacity; NLe 1,450 live with five places in each group (2–4 p.m., 5–7 p.m.). Course launch remains 7 January 2027.

Public functions validate input and enforce tokens/permissions; rate limiting and CAPTCHA are not provided by direct database RPC. Add a protected gateway for abuse protection before a large rollout. Browser data is not proof of payment. Always check the actual Orange Money transfer.

Email and SMS jobs remain pending_setup. Add a server-only sending worker/Edge Function and providers before enabling automatic notifications. Mark sent only after provider acceptance, use idempotency/atomic claims and record errors/retries. Never put sender secrets or a Supabase service-role key into website files.

Testing completed: local PostgreSQL-compatible execution of the original STP schema plus the new migration twice; preservation of existing admin list/settings; duplicate-safe creation; wrong-token rejection; public order-read denial; private receipt access; existing admin vs ordinary-user permissions; pending receipt and confirmed payment transitions; repeat confirmation; notification job idempotency; closure preserved on migration rerun. Storage bucket enforcement and live Auth/network flows still require deployment checks in your Supabase project. The migration has not been applied remotely by this task.

Official API references:
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/storage/security/access-control

Conversion matching, definitions and manual review are described in ../START_HERE.md. The incremental migration is ACADEMY_CONVERSION_TRACKING.sql. No live database changes were made in generating this update.
