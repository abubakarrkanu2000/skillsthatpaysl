# Launch using the EXISTING Skills That Pay database

Your existing Supabase connection settings are already in config.js, copied from the original configured STP website source. You do not need a new Supabase project or a second administrator account.

## 1. Run one SQL file

In the SQL editor of the SAME Supabase project used for STP, run:

backend/RUN_THIS.sql

This is the only SQL file required in this package. Do not rerun the original event setup.sql or any previous standalone Academy setup files. This migration can be rerun safely; it opens the intake on first installation and preserves later admin closure decisions.

It adds Academy products, orders, payment audit, notification jobs and private receipt storage. It reuses auth.users and the existing stp_is_admin()/stp_private.admins permission system. Existing stp_registrations, stp_settings, attendance numbers, surveys and event capacity values are preserved. Matching phone numbers link a new Academy order to the existing event registration without requiring the event survey or changing that record. No one is automatically registered or marked paid just because they attended the event.

## 2. Copy the website files into your existing GitHub repository

Unzip this package. Copy index.html, admin.html, app.js, admin.js, payment-api.js, config.js, style.css and assets into the folder containing your current website index.html. Replace matching files. Keep your existing STP_Admin_Dashboard.html, js/, css/, register.html and survey files in the repository so your current event administration remains available. This package changes the public homepage and adds the Academy admin page; it does not ship an older copy of your event dashboard over your current one.

The backend folder contains SQL and instructions to run manually, not a server to host. You may keep it in the repository. Public config.js contains a publishable key only; there is no service-role key or administrator password.

Then push your changes as usual:

    git add .
    git commit -m "Launch Academy manual Orange Money payments"
    git push

Your current GitHub-connected hosting should deploy the changes. No hosting configuration is changed by this package. If your existing host uses a website/ subdirectory as its published root, copy the website files there rather than to the repository root. Keep the existing host configuration.

## 3. Check the public site and admin

Open the website after deployment. A successful database connection shows online places remaining. Programme pricing and the online intake capacity are read from academy_products, separately from the event's seat settings.

Choose a programme, enter your details and continue. The order is saved before transfer instructions are shown. Send Orange Money to 075615607, then either:

- send the prefilled WhatsApp message to +23275615607 and attach the receipt; or
- choose a receipt file/paste a screenshot on the website and upload it.

Only one receipt channel is needed. For WhatsApp, the learner returns and taps “I have sent my receipt”. Uploading directly marks it awaiting verification automatically. Neither action confirms payment.

Open /admin.html with your EXISTING authorised STP admin email/password. Review the learner, open any uploaded receipt, check the actual Orange Money transfer, enter its transaction reference and confirm. The learner's private status page then shows confirmed. It refreshes every 30 seconds while open and checks on return. The same transaction reference cannot confirm another order.

Use “Event dashboard” to open your existing /STP_Admin_Dashboard.html. Do not delete that file or its supporting scripts/styles when copying this package.

## Important launch checks

Use a small real transfer or your own controlled test registration to check the complete flow before promoting it. Mark confirmed only after checking settled funds. The SQL was tested locally against the original STP schema, including unauthorised access and rerunning the migration; it has not been executed against your live project here. The project Auth endpoint was reachable and the Academy status function was not yet installed at the time of packaging.

If the SQL has not been run, the website detects the missing Academy settings RPC and offers WhatsApp-only payment instructions instead. These fallback references are local to that browser and you confirm them manually on WhatsApp. They are NOT saved as database orders or magically migrated later. Run the SQL first to use website tracking and receipt uploads from the start.

Email/SMS provider setup remains pending. The website does not claim that automatic confirmation messages have been sent. For launch, your administrator confirmation updates the website; send any additional confirmation manually on WhatsApp.

The database does not automatically charge customers or renew monthly memberships. The NLe 355 transfer is one manual online monthly payment. Automatic subscriptions and ongoing course access are future work.

## Event-to-Academy conversions

The admin dashboard compares Academy contacts with your existing stp_registrations. Exact phone or exact email matches count as returning STP registrants. Conflicting contact matches and matching names alone are flagged for review. Case and repeated whitespace are ignored for names; similar spelling is not treated as identity. Use the event search inside a payment review to cross-check names/contacts, link the correct event registration or mark the learner as new. Classification changes are audited and do not change payment status.

Only confirmed payments count as conversions/revenue. Multiple products bought by one matched event registrant count once in the returning-buyer total. Returning conversion rate = unique event registrants with at least one confirmed payment / total STP event registrations. The separate physical-attendee rate uses only event records marked Attended; Confirmed/Offered is not proof they attended. New buyers are deduplicated by phone. Unresolved matches and their revenue are displayed separately and excluded from returning/new totals until reviewed. These are matched customer conversions, not proof the event caused a sale. WhatsApp-only fallback records cannot be counted until entered in the connected admin.

If the Academy database is already installed, run backend/ACADEMY_CONVERSION_TRACKING.sql only, or run the complete backend/RUN_THIS.sql safely. Then deploy the updated admin.html/admin.js/style.css along with the rest of this package.
