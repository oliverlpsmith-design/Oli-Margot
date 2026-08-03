# Positive-Cash-Flow Classifier Rate Source

Checked on 2026-08-01 (Australia/Sydney).

ASIC Moneysmart reports an average interest rate of **6.15%** for new Australian home loans in June 2026, using Reserve Bank of Australia data. Moneysmart also recommends testing affordability with a two-percentage-point rate increase.

Finder’s Australian investment-loan comparison reports that, as of August 2026, the average variable **investor principal-and-interest** rate in its database is **7.20%**, while the lowest advertised investor rate is 5.85%. Because Investor Scout is screening investment property rather than owner-occupied finance, the classifier uses the 7.20% investor average rather than a best-case promotional rate.

Sources:

- [ASIC Moneysmart — Choosing a home loan](https://moneysmart.gov.au/home-loans/choosing-a-home-loan)
- [Finder — Investment property home loans](https://www.finder.com.au/home-loans/investment-property-home-loans)
- [Canstar — Compare investment home loan rates](https://www.canstar.com.au/home-loans/compare/property-investments/)

Implementation basis: model annual principal-and-interest debt service on an 80% LVR, 30-year loan at 7.20%. This is a conservative screening assumption, not a personalised finance quote. Listings without a credible advertised or estimated weekly rent fail closed rather than being tagged from price and bedroom count alone.
