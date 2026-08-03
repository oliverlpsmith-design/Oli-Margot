# Dual-Income Classifier Planning Source

Checked on 2026-08-01 (Australia/Sydney).

The NSW Government states that secondary dwellings are permitted in standard residential zones **R1, R2, R3, R4, and R5**, and may also be permitted in other zones through a council LEP. A complying-development pathway requires a lot of at least **450 m²**; sub-450 m² proposals generally require a DA, except for a secondary dwelling wholly within an existing dwelling.

Source: [NSW Planning — Secondary dwellings](https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-sepp/secondary-dwellings)

Implementation decision: the automated `dual_income` category will require a genuine dual-income listing signal, at least 450 m², and an R1–R5 zone. Other zones and sub-450 m² listings will not be auto-qualified because local LEP/DA exceptions cannot be verified from the nightly inputs. This is a conservative catalogue gate, not a determination of legal permissibility.
