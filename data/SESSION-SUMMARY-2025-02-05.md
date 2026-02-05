# Session Summary - February 5, 2025

## Overview

This session focused on verifying and applying enrichment data from previous research sessions to the master Contact Center Market Map CSV file.

---

## What Was Done Today

### 1. Reconciled Enrichment Data

The previous session researched accounts for size (employee count) and service lines, but the updates weren't fully applied to the CSV. Today we:

- Identified missing updates in the CSV
- Created a reconciliation script to apply all enrichment data
- Produced a final, accurate CSV with all updates applied

### 2. Applied Size Enrichment

**Scope:** 1,420 accounts reviewed (131 qualified + 1,289 non-qualified)

| Change Type | Count |
|-------------|-------|
| Mid Market → SME | 12 |
| Mid Market → Enterprise | 8 |
| Mid Market → Super Enterprise | 2 |
| Enterprise → Super Enterprise | 9 |
| SME → Mid Market | 1 |
| SME → Enterprise | 2 |
| Other changes | 2 |
| **Total category changes** | **36** |

### 3. Applied Service Lines Enrichment

**Scope:** 448 accounts researched for outbound/sales services

- 122 unique accounts had service line tags added (based on evidence)
- 326 accounts confirmed NOT to offer target services
- Tags added: Sales Outsourcing, Outbound Services, B2C Telemarketing & Telesales, Collections Recovery Services

### 4. Updated Qualified Column

Recalculated qualification status for all 7,945 accounts based on the complete criteria.

---

## Issues Encountered

### Enrichment Sync Problem

The previous session researched account data but some updates weren't fully applied to the CSV. A reconciliation script was created to ensure all researched data was properly reflected in the final output.

### Lesson Learned

Always verify that enrichment changes are applied directly to the CSV during research sessions.

---

## Definition of "Qualified"

An account is qualified if it meets **ALL THREE** criteria:

1. **Size**: Mid Market (1,000-5,000 employees), Enterprise (5,000-50,000), OR Super Enterprise (50,000+)
2. **US Presence**: US HQ, OR US state in onshore delivery footprint, OR "United States" in nearshore/offshore footprint
3. **Target Service Lines**: Contains at least one of:
   - Sales Outsourcing
   - Outbound Services
   - B2C Telemarketing (& Telesales)
   - Collections (Recovery Services)

---

## Final Output

**File:** `Final - Global Contact Center Market Map - Full List with 164 Qualified (2025-02-05).csv`

### Overall Statistics

| Metric | Count |
|--------|-------|
| Total accounts | 7,945 |
| Qualified (Y) | 164 |
| Not Qualified (N) | 7,781 |

### Size Distribution (All Accounts)

| Size | Count |
|------|-------|
| SME (1–1,000 employees) | 6,977 |
| Mid Market (1,000–5,000 employees) | 431 |
| Enterprise (5,000+ employees) | 214 |
| Super Enterprise (50,000+ employees) | 9 |
| Empty | 312 |
| N/A | 2 |

### Qualified Accounts by Size

| Size | Count | % of Qualified |
|------|-------|----------------|
| Mid Market | 93 | 56.7% |
| Enterprise | 62 | 37.8% |
| Super Enterprise | 9 | 5.5% |
| **Total** | **164** | 100% |

### Super Enterprise Accounts (9)

| Company | Employees |
|---------|-----------|
| Teleperformance | 410,000+ |
| The Bosch Group | 412,400+ |
| Atento | 80,000+ |
| TELUS International | 78,879 |
| transcosmos | 70,000+ |
| EXL Service | 59,500-63,000 |
| Conduent | 54,000-56,000 |
| TaskUs | 47,000-59,000 |
| Inspiro | 32,000-58,000 |

All 9 Super Enterprise accounts are qualified (meet all 3 criteria).

---

## Final Deliverable

**File:** `Final - Global Contact Center Market Map - Full List with 164 Qualified (2025-02-05).csv`

This CSV contains all enrichment updates applied and is the source of truth for the Contact Center Market Map data.

---

## Next Steps / Recommendations

1. **Clean up intermediate files** - Remove old CSVs and consolidate to the final output
2. **Future enrichment** - Always apply changes directly to the master CSV during research
3. **The 312 accounts with empty size** - May need research if they're important to the analysis

---

*Summary generated: February 5, 2025*
