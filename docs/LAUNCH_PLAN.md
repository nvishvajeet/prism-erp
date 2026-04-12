# PRISM X v1.0 — Launch Plan

## Go-live configuration

### Users to create (production, DEMO_MODE=0):
- **Dean** — super_admin (site-wide authority)
- **Kondhalkar** — site_admin (secretary, site-wide admin access)
- **2 operators per instrument** — operator role, assigned per instrument
- **Finance officers** — finance_admin role
- **Faculty** — professor_approver / faculty_in_charge roles

### Instrument data:
- All instruments from the CRF brochure
- Photos from the brochure
- Pricing, capabilities, location filled in via Form Control

### Grants & Finance:
- Created from scratch in production (not demo data)
- Approval sequences configured per instrument

### Environment:
```bash
PRISM_ORG_NAME=Central Research Facility
PRISM_ORG_TAGLINE=MIT-WPU Shared Instrument Facility
LAB_SCHEDULER_DEMO_MODE=0
PRISM_MODULES=instruments,finance,inbox,notifications,attendance,queue,calendar,stats,admin
```

## Future features (v1.1+):
- Vehicle management module (use new_module.sh)
- Procurement module
- Asset tracking
- Real-time instrument status dashboard
- Mobile PWA with camera integration
- Client-side image compression for attachments
- Default avatar system (rotating daily like WhatsApp)
- Advanced reporting / analytics engine
- External API for integrations
- Multi-tenant support (multiple organizations)
