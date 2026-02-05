# Category Movement Analysis
## Size Enrichment - Before vs After

---

## Qualified Accounts (131 total)

### Original vs Final Distribution

| Category | BEFORE | AFTER | Net Change |
|----------|--------|-------|------------|
| SME | 54 | 64 | +10 |
| Mid Market | 56 | 32 | -24 |
| Enterprise | 17 | 20 | +3 |
| Super Enterprise | 1 | 12 | +11 |
| Acquired/Merged | 3 | 3 | 0 |

### Movement Flow Diagram

```
BEFORE                          AFTER
────────────────────────────────────────────────────

SME (54)  ───────────────────►  SME (64)
   │                               ▲
   │ -1 to Mid Market              │ +13 from Mid Market
   │ -2 to Enterprise              │
   ▼                               │
Mid Market (56) ─────────────────────────►  Mid Market (32)
   │                                           ▲
   │ -13 to SME                                │ +1 from SME
   │ -10 to Enterprise                         │
   │ -2 to Super Enterprise                    │
   ▼                                           │
Enterprise (17) ──────────────────────────►  Enterprise (20)
   │                                              ▲
   │ -9 to Super Enterprise                       │ +10 from Mid Market
   ▼                                              │ +2 from SME

Super Enterprise (1) ─────────────────────►  Super Enterprise (12)
                                                  ▲
                                                  │ +2 from Mid Market
                                                  │ +9 from Enterprise
```

### Movement Percentages by Original Category

#### From SME (54 accounts originally)
| Moved To | Count | % of Original SME |
|----------|-------|-------------------|
| Stayed SME | 51 | 94.4% |
| → Mid Market | 1 | 1.9% |
| → Enterprise | 2 | 3.7% |
| **Total Moved Out** | **3** | **5.6%** |

#### From Mid Market (56 accounts originally)
| Moved To | Count | % of Original Mid Market |
|----------|-------|--------------------------|
| Stayed Mid Market | 31 | 55.4% |
| → SME | 13 | 23.2% |
| → Enterprise | 10 | 17.9% |
| → Super Enterprise | 2 | 3.6% |
| **Total Moved Out** | **25** | **44.6%** |

#### From Enterprise (17 accounts originally)
| Moved To | Count | % of Original Enterprise |
|----------|-------|--------------------------|
| Stayed Enterprise | 8 | 47.1% |
| → Super Enterprise | 9 | 52.9% |
| **Total Moved Out** | **9** | **52.9%** |

#### From Super Enterprise (1 account originally)
| Moved To | Count | % of Original Super Enterprise |
|----------|-------|--------------------------------|
| Stayed Super Enterprise | 1 | 100% |
| **Total Moved Out** | **0** | **0%** |

### Summary: Where Did Each Category Go?

```
ORIGINAL SME (54 accounts):
├── 94.4% stayed SME
├──  1.9% moved UP to Mid Market
└──  3.7% moved UP to Enterprise

ORIGINAL MID MARKET (56 accounts):  ⚠️ HIGHEST VOLATILITY
├── 55.4% stayed Mid Market
├── 23.2% moved DOWN to SME
├── 17.9% moved UP to Enterprise
└──  3.6% moved UP to Super Enterprise

ORIGINAL ENTERPRISE (17 accounts):
├── 47.1% stayed Enterprise
└── 52.9% moved UP to Super Enterprise

ORIGINAL SUPER ENTERPRISE (1 account):
└── 100% stayed Super Enterprise
```

---

## Non-Qualified Accounts (1,289 total)

### Original vs Final Distribution

| Category | BEFORE | AFTER | Net Change |
|----------|--------|-------|------------|
| SME | 1,279 | 1,285 | +6 |
| Mid Market | 2 | 4 | +2 |
| Unknown | 8 | 0 | -8 |

### Movement Percentages

#### From SME (1,279 accounts originally)
| Moved To | Count | % of Original SME |
|----------|-------|-------------------|
| Stayed SME | 1,277 | 99.84% |
| → Mid Market | 2 | 0.16% |
| **Total Moved Out** | **2** | **0.16%** |

#### From Mid Market (2 accounts originally)
| Moved To | Count | % of Original Mid Market |
|----------|-------|--------------------------|
| Stayed Mid Market | 2 | 100% |
| **Total Moved Out** | **0** | **0%** |

#### From Unknown (8 accounts originally)
| Moved To | Count | % of Original Unknown |
|----------|-------|----------------------|
| → SME | 8 | 100% |

---

## Combined Summary (1,420 accounts total)

### Overall Movement Statistics

| Metric | Qualified | Non-Qualified | Total |
|--------|-----------|---------------|-------|
| Total Accounts | 131 | 1,289 | 1,420 |
| Accounts That Changed | 36 | 2 | 38 |
| Change Rate | 27.5% | 0.16% | 2.7% |

### Movement Direction Summary

| Direction | Qualified | Non-Qualified | Total |
|-----------|-----------|---------------|-------|
| Moved DOWN (to smaller category) | 13 | 0 | 13 |
| Stayed Same | 92 | 1,279 | 1,371 |
| Moved UP (to larger category) | 23 | 2 | 25 |
| Unknown → Assigned | 0 | 8 | 8 |
| Acquired/Merged (N/A) | 3 | 0 | 3 |

### Key Insight: Mid Market Was Most Misclassified

**44.6% of original Mid Market accounts moved to a different category!**

This is because:
- 23.2% were actually smaller (SME) - overestimated
- 21.5% were actually larger (Enterprise/Super Enterprise) - underestimated

The Mid Market category had the highest error rate, suggesting the original data collection had difficulty accurately sizing companies in this range.

---

## Visual Summary

```
QUALIFIED ACCOUNTS - CATEGORY VOLATILITY

SME:              ████░░░░░░ 5.6% moved out (low volatility)
Mid Market:       ████████░░ 44.6% moved out (HIGH volatility) ⚠️
Enterprise:       █████░░░░░ 52.9% moved out (high volatility)
Super Enterprise: ░░░░░░░░░░ 0% moved out (stable)

NON-QUALIFIED ACCOUNTS - CATEGORY VOLATILITY

SME:              ░░░░░░░░░░ 0.16% moved out (very stable)
Mid Market:       ░░░░░░░░░░ 0% moved out (stable)
```

---

## Detailed Movement Table (All 38 Changes)

### Qualified - Moving DOWN (13 accounts)

| Company | FROM | TO | Employees |
|---------|------|-----|-----------|
| A.R.C.E. Contact Center | Mid Market | SME | 400-700 |
| Account Management Systems | Mid Market | SME | <25 |
| Affinity Global | Mid Market | SME | 361 |
| AllianceOne | Mid Market | SME | 751-1,000 |
| Callbox | Mid Market | SME | 101-500 |
| Callzilla | Mid Market | SME | 240-1,050 |
| CIENCE Technologies | Mid Market | SME | 69-200 |
| Five Star Call Centers | Mid Market | SME | 500-1,000 |
| Global Response | Mid Market | SME | 500-600 |
| OutPLEX | Mid Market | SME | 305-328 |
| Peak Support | Mid Market | SME | 250-500 |
| Redial BPO | Mid Market | SME | 500-800 |
| Vsynergize | Mid Market | SME | 377-421 |

### Qualified - Moving UP (23 accounts)

| Company | FROM | TO | Employees |
|---------|------|-----|-----------|
| CBE Companies | SME | Mid Market | 1,200+ |
| Everise | SME | Enterprise | 9,000-10,000 |
| SourceHOV | SME | Enterprise | 15,000-22,000 |
| Abacus | Mid Market | Enterprise | 5,200+ |
| Fusion CX | Mid Market | Enterprise | 12,500-20,000 |
| GeBBS Healthcare Solutions | Mid Market | Enterprise | 14,000+ |
| Itel International | Mid Market | Enterprise | 7,000+ |
| Outsource2india | Mid Market | Enterprise | 5,000+ |
| ResultsCX | Mid Market | Enterprise | 21,000-22,000 |
| Six Eleven Global | Mid Market | Enterprise | 5,000+ |
| TransPerfect | Mid Market | Enterprise | 10,000+ |
| Telvista | Mid Market | Enterprise | 5,000-7,000 |
| TSI | Mid Market | Enterprise | 5,000+ |
| Teleperformance | Mid Market | Super Enterprise | 410,000+ |
| The Bosch Group | Mid Market | Super Enterprise | 412,400+ |
| Atento | Enterprise | Super Enterprise | 80,000+ |
| Conduent | Enterprise | Super Enterprise | 54,000-56,000 |
| EXL Service | Enterprise | Super Enterprise | 59,500-63,000 |
| Inspiro | Enterprise | Super Enterprise | 32,000-58,000 |
| JPMorgan Chase | Enterprise | Super Enterprise | 317,233 |
| TaskUs | Enterprise | Super Enterprise | 47,000-59,000 |
| TELUS International | Enterprise | Super Enterprise | 78,879 |
| transcosmos | Enterprise | Super Enterprise | 70,000+ |

### Non-Qualified - Moving UP (2 accounts)

| Company | FROM | TO | Employees |
|---------|------|-----|-----------|
| Liveops | SME | Mid Market | 2,467-2,700 |
| NexRep | SME | Mid Market | 612-1,072 |

---

*Analysis generated: 2026-02-05*
