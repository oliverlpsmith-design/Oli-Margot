# Positive Cash-Flow Classifier Rate Source

Checked on 2026-08-01 (Australia/Sydney).

The Reserve Bank of Australia’s current lenders’ interest-rate page reports investment housing lending rates around 6.39%–6.43%, with principal-and-interest investment lending around 6.31%–6.38% and interest-only investment lending around 6.85%–6.91% in the search result extract. The classifier should use a conservative, explicit, date-stamped investor financing assumption rather than the cash rate itself.

Source: [Reserve Bank of Australia — Lenders’ Interest Rates](https://www.rba.gov.au/statistics/interest-rates/)

Supporting historical spreadsheet: [RBA Statistical Table F5 — Indicator Lending Rates](https://www.rba.gov.au/statistics/tables/xls/f05hist.xlsx)

Implementation decision: use a conservative **6.50% p.a. interest-only investor rate at 80% LVR**, dated 2026-08-01, until the assumption is deliberately updated. This is slightly above the latest average outstanding investment rates and avoids classifying borderline properties as positive cash flow.
