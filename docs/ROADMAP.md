# Catalyst ERP — Roadmap

## Current State (V1)

14 modules, 129 routes, 15,694 lines, 64 templates.
Two deployments: MIT-WPU CRF + Ravikiran Services.
Domain: catalysterp.org. GitHub: nvishvajeet/prism-erp.

## Immediate (V1.1)

### Infrastructure
- [ ] Permanent Cloudflare Tunnel (resolve QUIC issues)
- [ ] Auto-start on boot (launchd for Flask + cloudflared)
- [ ] Daily DB backup automation
- [ ] Health monitoring (uptime ping + crash alert)

### Security
- [ ] Rate limiting on login
- [ ] 2FA via TOTP
- [ ] Password policy enforcement

### Mobile
- [ ] PWA Service Worker (offline + push notifications)
- [ ] Camera integration for receipt photos

## Near-Term (V1.2)

### Finance
- [ ] Vendor management (registry, payment history, rates)
- [ ] Invoice PDF generation
- [ ] Budget alerts (80%/100% utilization)
- [ ] Monthly P&L report (PDF export)

### Personnel
- [ ] Leave calendar (visual)
- [ ] Overtime calculation from attendance
- [ ] Document vault (PAN, Aadhar, offer letter storage)

### Vehicles
- [ ] Trip logging (start/end, distance, purpose)
- [ ] Fuel efficiency trends (km/liter)
- [ ] Service reminders (by km or date)

### Communication
- [ ] SendGrid email delivery
- [ ] Google OAuth login
- [ ] WhatsApp notifications

## Medium-Term (V2.0)

- [ ] Procurement module (POs, vendor quotes, GRN)
- [ ] Inventory module (stock levels, reorder points)
- [ ] REST API for mobile apps
- [ ] Multi-tenant (single deploy, multiple orgs)
- [ ] Plugin system (community modules via CLI)

## Long-Term (V3.0)

- [ ] AI Assistant ("How much did we spend on fuel in March?")
- [ ] Predictive maintenance (ML model)
- [ ] Native mobile app (iOS/Android)

## Integration Gaps

| Gap | Effort |
|-----|--------|
| Vehicles fuel → Finance spend reports | Low |
| Personnel birthdays → Notifications | Low |
| Attendance streaks → Personnel alerts | Medium |
| Finance → Letters (payment letters) | Low |
| Calendar → All modules (unified view) | High |
