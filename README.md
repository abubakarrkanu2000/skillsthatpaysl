# Skills That Pay — complete registration system

The approved website design is preserved. This package connects registration,
eight survey pages, a completion page, and the admin dashboard to Supabase.
The supplied project URL and publishable key have been configured. The database setup and admin account still need to be created in Supabase.

## 1. Set up the database

Create or open your Supabase project. In its SQL Editor, run backend/setup.sql
once. It creates STP-specific tables, database functions, admin access rules,
public/private seat limits, attendance numbering, and an admin activity log.
It does not overwrite an existing STP installation: running it twice will fail
rather than silently resetting tables. Keep a copy of the project before making
changes if it already contains important data.

## 2. Set up admin access

In Supabase Authentication > Users, add your admin email and a strong password.
Use the dashboard's confirmed-user option for this manually provisioned account.
Open backend/add-admin.sql, replace YOUR_ADMIN_EMAIL, and run it in the SQL Editor.
Confirm that your exact email appears in the result. Repeat for authorised team
members. Having a Supabase login alone does not grant STP admin access.
The website does not offer public admin signup. If a password is lost, the project
owner can reset the account using Supabase's user-management tools.

## 3. Connect the website

website/js/system-config.js already contains the supplied project URL and
publishable public key. No further change to these values is needed.
A legacy anon key also works. Never insert a secret or service-role key.
These public settings do not grant permission to read attendee records.
Database rules restrict those records to the allowlisted admin users.

## 4. Put the pages on your host

Upload the contents of website/ to your existing website root. That folder
contains index.html, register.html, all eight question pages, the completion
page, STP_Admin_Dashboard.html, CSS, JavaScript and the original images.
Keep backend/ and tests/ as setup/developer files outside the public web root.
Use HTTPS for the live website. To check locally from this package directory:

    python3 -m http.server 8000 --directory website

Open http://localhost:8000/register.html and
http://localhost:8000/STP_Admin_Dashboard.html.
Configuration must be completed before real registration or admin login works.
Missing settings display an error; the system never pretends a local draft was
received by the team.

## What the system does

- Saves name, email and a correctly formatted Sierra Leone mobile number before
  opening the survey. Duplicate email/phone entries are rejected.
- Keeps drafts when moving Back; submits all eight answers to the database only
  after server-side validation. Minimum age is 17. Other selections require text.
- Displays survey success only after the database confirms saving.
- Keeps incomplete registrations for the team to review and follow up.
- Uses real admin sign-in, access checks, session refresh and sign-out.
- Shows live registrations, completed surveys, confirmed guests and waitlists.
- Searches names, emails, phones and attendance numbers; filters status and skill.
- Displays every survey answer, including Other text and requested next-event expert.
- Adds clients and other invited guests directly. Their survey is not required.
  Guest type defaults to Reserved; contact details are optional for manual guests.
- Supports offered, confirmed, waitlisted, declined, not selected, offer expired,
  cancelled, ready for review, survey incomplete and attended statuses.
- Enforces 50 public and 20 reserved confirmed/attended places at the database level.
  One confirmation cannot exceed the remaining allocation, even with two admins.
- Assigns a unique attendance number on confirmation. Numbers are never reused;
  cancellations free the seat but retain the historical number.
- Records check-in only for a confirmed attendee; repeated check-in does not create
  a second attendance event. Cancelled/declined guests cannot check in.
- Exports the filtered list as CSV; exports protect against spreadsheet formulas.
- Lets an admin open or close public registration and survey submission.
  Direct admin invitations remain available when public registration is closed.
- Records guest additions, status changes and registration open/close events.
  The audit records are stored in stp_audit_log; they are admin-readable in Supabase.

## Event and communication

The completion page reminds attendees of Saturday, 7 November 2026.
Survey completion is an application, not a confirmed seat. Confirm only after the
person agrees to attend. The investment answer is course research, not a selection
criterion. Do not promise admission based on that answer.

WhatsApp group invitations, attendance-offer messages, attendance-number messages,
email delivery and automatic reminders are handled by the team. This package does
not send messages or add people to groups automatically. No WhatsApp link, delivery
provider or credentials were supplied. The existing date, branding and event-page
content were retained; review the event page's venue/time before opening registration.

## Validation performed

The SQL ran successfully in local PostgreSQL using PGlite. The included tests cover
private record access, admin permissions, phone validation, duplicate registrations,
submission-token ownership, required survey answers, age and option checks, guest
creation, retry handling, seat limits, numbering, cancellation, check-in and closure.
Frontend tests cover phone formats, secret tokens, admin session refresh, pagination,
failed requests, submission confirmation and registration retries. JavaScript syntax,
local asset links and archive integrity were also checked.

To rerun developer tests with Node.js 20+:

    npm install
    npm test

Live Supabase login and end-to-end browser testing have not been performed because
no configured project or browser testing capability was provided. Before taking
public registrations, complete one real submission, sign in as the admin, verify
the saved answers, add a guest, confirm them and check them in. Then cancel or
remove test records through the project owner account.

## File layout

website/          Pages and public assets to upload to your web host
backend/          One-time database setup and admin allowlist SQL
tests/            Reproducible database and frontend checks
package.json      Developer test dependency and command
README.md         Setup and operating instructions
