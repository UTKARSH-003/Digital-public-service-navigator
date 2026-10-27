# Demonstration workflow

Works in demo mode (no Supabase) up to step 5; steps 6–10 need Supabase and an account promoted to `content_admin`.

1. **Home** – note the independence banner. Search “scholarship”.
2. **Directory** – use the category and state filters, change the sort, page through results.
3. **Service detail** – open *Post-matric scholarship (demonstration record)*. Point out the status badge, the “not verified” warning, “Never verified”, the unverified fees/dates labels, and the official source link (root portal only).
4. **Eligibility** – *Check my eligibility*: status = student, income 100000 → **Likely eligible** with reasons, disclaimer and the official source. Repeat with income 900000 → **Likely not eligible**. Skip the income question → **Insufficient information** and the missing fact is listed.
5. **Assistant** – ask “What documents do I need for an income certificate?”. Answer comes from the record, cites the source, and says “Information not verified” for anything not recorded. Try typing an OTP to see the refusal. Switch the language to Hindi.
6. **Sign up / sign in**, then **Profile**: tick consent, set status = student; **Dashboard** now shows recommendations with the reasons.
7. **Save** the service; **Create my checklist**, tick items, add your own item, store a reference number, print.
8. **Eligibility with “save summary”** – the dashboard lists the outcome only.
9. **Admin** (promoted account): *Services → Edit* a record, add an official source, then **Verification queue → verified**; the badge and “last verified” date update; **Audit log** shows both actions. Import a small CSV (use *dry run* via the API first: `POST /api/admin/services/import?dry_run=true`).
10. **Access control** – as a normal user open `/admin` (denied) and call `/api/admin/services` with your token (403). As a reviewer confirm every edit action is rejected.
11. **Privacy** – Profile → *Download my data*, then *Delete my account*.
