# Tester Checklist — MIT-WPU Lab ERP + Ravikiran ERP

Definitive manual-test plan for any tester logged in with `role=tester` on either tenant. This doc is the single source of truth — the `/tester/plan` in-app page renders from it.

**Who uses this:**
- **Tejveer** (Ravikiran tester, `tejveer` / `12345`) — tests Ravikiran ERP with Nikita-level visibility
- **Test User** (Lab ERP tester, `tester` / `12345`) — tests Lab ERP with Kondhalkar-level visibility

**Debugger + feedback access (both tenants):**
- `/debug` — eruda console embed, JS error inspector
- Feedback widget — bottom-right on every page, click to capture a screenshot + text report
- `/admin/dev_panel` — live telemetry tile + feedback log tail

**Reporting flow:**
1. Click the feedback widget on any page where something looks off.
2. Write a 1-sentence description. Attach severity: `polish`, `major`, or `blocker`.
3. Submit. Entry lands in `logs/debug_feedback.md` on the tenant's machine.
4. `feedback-watchdog` daemon on Station Bordeaux (MBP) picks it up within 1 second.
5. Claude2+Codex pair (iMac) triages + files a ticket within 15 min.

---

## 🔬 Lab ERP (mitwpu-rnd.catalysterp.org) — 30 pages to test

Login as `tester` / `12345`. Portal: Lab R&D.

| # | page | route | what to test | expected result |
|---|---|---|---|---|
| 1 | Login | `/login` | Submit with `tester` + `12345` | 302 → `/manual` |
| 2 | Role Manual | `/manual` | Scroll the onboarding text | No 500, content renders |
| 3 | Home / Dashboard | `/` | All quick-action tiles click | Every tile routes to a real page (no 404) |
| 4 | Instruments list | `/instruments` | 22 rows visible (CRF brochure list) | ICP-MS, FESEM, XRD, Raman, PSA, Nanoindenter, Surface Profile, Tribometer, POM, Battery, UV-Vis, UV-NIR, Sputtering, UTMs, Hardness×3, Fatigue, Compression, Microscope RV3 |
| 5 | Instrument detail | `/instruments/1` | Click into each instrument | Name + make + model shown, operators listed |
| 6 | New request | `/new-request` | Start a sample-characterization request | Form renders, all PDF fields present (designation, class, magnetic Y/N, output format, Option A/B payment) |
| 7 | Schedule | `/schedule` | View today's queue | Table loads, filters work |
| 8 | Personnel | `/personnel` | List of 14 users visible | Dean + Vishvajeet + Kondhalkar + 6 operators + 5 faculty |
| 9 | Attendance | `/attendance` | Attendance page loads | No 500 |
| 10 | Attendance QR kiosk | `/attendance/qr` | QR code renders | Scannable SVG |
| 11 | Finance portal | `/finance` | Finance tiles load | Grants, Salary, Vendor Payments visible |
| 12 | Grants list | `/finance/grants` | Click a grant row | Row is clickable → detail page |
| 13 | Salary schedule | `/finance/salary` | Monthly salary table | All 14 users listed with status |
| 14 | Tax schedule | `/finance/tax` | Tax schedule table | Renders cleanly |
| 15 | Purchase orders | `/payments` | PO list | Add new / edit flow works |
| 16 | Purchase order detail | `/payments/<id>` | Click any PO | Edit form renders (Kondhalkar's finance-gate visible) |
| 17 | Vendors | `/vendors` | Vendor list + detail | Edit works |
| 18 | Vehicles | `/vehicles` | Vehicle list + detail | Expense log renders, add-expense works |
| 19 | Admin users | `/admin/users` | 14 users listed | No phantom Ravikiran/demo users |
| 20 | Admin onboard | `/admin/onboard` | New-user invite form | Form renders |
| 21 | Admin notices | `/admin/notices` | Compose + list of active notices | No errors |
| 22 | Admin password reset | `/admin/password_reset` | Reset-request queue | No 500 |
| 23 | Admin pending users | `/admin/pending_users` | Approval queue | Audit trail visible |
| 24 | Admin dev panel | `/admin/dev_panel` | Live dev dashboard | Telemetry tile + feedback tile populate |
| 25 | Debugger console | `/debug` | Eruda opens | JS console accessible |
| 26 | Sitemap | `/sitemap` | Full route list | Every link resolves |
| 27 | My profile | `/me` | Profile page | Edit own info |
| 28 | My security | `/me/security` | Change password | Flow works |
| 29 | Notifications | `/notifications` | Notification inbox | Empty state OK if no notices |
| 30 | Logout | `/logout` | Click sign-out | Returns to /login |

**Bonus test — requisition end-to-end:** create a new request on XRD with Option B payment (UTR + proof upload), log out, log in as `kondhalkar@mitwpu.edu.in` / `12345`, verify the request shows up in Kondhalkar's queue with the payment details, click "Approve & Route to Operator", confirm the request appears in Santosh Patil or Aparna Potdar's operator queue (both are XRD operators).

---

## 🏠 Ravikiran ERP (ravikiran.catalysterp.org) — 25 pages to test

Login as `tejveer` / `12345`. Portal: Ravikiran HQ.

| # | page | route | what to test |
|---|---|---|---|
| 1 | Login | `/login` | Bare username `tejveer` works alongside emails |
| 2 | Home | `/` | Ravikiran-branded landing (not Lab) |
| 3 | Manual | `/manual` | Tester role manual renders |
| 4 | Personnel | `/personnel` | List of household members |
| 5 | Vehicles | `/vehicles` | Vehicle list |
| 6 | Vehicle detail | `/vehicles/1` | Expense log, add-expense flow |
| 7 | Vehicle add log | via detail | Add expense → routes to approval if over threshold |
| 8 | Vendors | `/vendors` | Household vendors |
| 9 | Vendor detail | `/vendors/1` | Edit vendor info |
| 10 | Payments (purchase orders) | `/payments` | PO list + edit |
| 11 | Payment detail | `/payments/<id>` | Inline edit form (title/amount/vendor/category/priority/due date) |
| 12 | Payments books | `/payments/books` | Books overview |
| 13 | Attendance | `/attendance` | Household attendance |
| 14 | Schedule | `/schedule` | Task schedule |
| 15 | Finance | `/finance` | Ravikiran finance lanes (Salary / Vendor Payments / Company Books / Spend) |
| 16 | Admin users | `/admin/users` | Household members + operators |
| 17 | Admin onboard | `/admin/onboard` | Invite new household member |
| 18 | Admin dev panel | `/admin/dev_panel` | Dev dashboard |
| 19 | Debug | `/debug` | Eruda console |
| 20 | Sitemap | `/sitemap` | All routes |
| 21 | My profile | `/me` | Profile edit |
| 22 | My security | `/me/security` | Change password |
| 23 | Notifications | `/notifications` | Notice inbox |
| 24 | Feedback log | check via dev panel | Recent feedback entries |
| 25 | Logout | `/logout` | Sign out |

---

## 🎯 Severity rubric for feedback

| Severity | Meaning | Example |
|---|---|---|
| **blocker** | I cannot use the feature at all | 500 page, button does nothing, data not saving |
| **major** | Feature is degraded but usable with workaround | Wrong data shown, slow load, missing column |
| **polish** | Cosmetic / UX — works but looks wrong | Misaligned button, color mismatch, typo |

All 3 land in the same feedback log; severity just sets priority for triage.

---

## 🚨 What to do if a page 500's

1. Capture screenshot + the URL.
2. Click feedback widget → paste URL + short description → submit as `blocker`.
3. If feedback widget also doesn't work, note the 500 in a message to the operator (or in `/debug` if the widget is broken).

---

## 📊 Test run summary template

At the end of a testing session, drop this template into the feedback widget with `polish` severity as a session-end report:

```
Tester: <name>
Tenant: <lab / ravikiran>
Session start: <HH:MM>
Session end: <HH:MM>
Pages tested: <N / 30 or 25>
Blockers: <list>
Majors: <list>
Polishes: <list>
Overall impression: <1 sentence>
```
