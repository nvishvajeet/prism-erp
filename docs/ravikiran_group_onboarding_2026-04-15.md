# Ravikiran Group onboarding import

Source workbook: `/Users/vishvajeetn/Downloads/attendance sheet.xlsx`

This import keeps each company separate inside the Ravikiran group.
Each employee row now carries an explicit company flair for review and downstream imports.
It does not invent reporting lines or family ownership relationships.
Every row is staged for Nikita / Prashant review before account creation.

## Company totals

| Company | People |
|---|---:|
| Gopal Doodh Dairy | 4 |
| RK Services | 29 |
| Ravikiran Services | 64 |
| Suryajyoti Services | 9 |

## Suggested role totals

| Suggested role | People |
|---|---:|
| finance_admin | 9 |
| operator | 2 |
| requester | 95 |

## Unit breakdown

### Gopal Doodh Dairy

| Unit | People |
|---|---:|
| Dairy | 4 |

### RK Services

| Unit | People |
|---|---:|
| Laundry | 29 |

### Ravikiran Services

| Unit | People |
|---|---:|
| Kitchen | 21 |
| Operations / Wages | 35 |
| PF / Accounts | 8 |

### Suryajyoti Services

| Unit | People |
|---|---:|
| Tuck Shop | 9 |

## Review rules

- Keep the companies separate even though they belong to the Ravikiran group.
- Do not infer line managers from attendance sheets alone.
- Review `finance_admin` suggestions carefully before enabling elevated permissions.
- Default passwords should only be assigned at actual account-creation time.

## Next step

Use the CSV export at `ravikiran_group_onboarding_2026-04-15.csv` as the account-creation review sheet for Nikita and Prashant.
