# Reconciliation: New-list (medium-14) US presence vs Master list

## Why the discrepancy?

- **Medium-14 list** (`medium-14-us-focused-bpo-accounts.csv`) was built as a **US-focused BPO** list: accounts were included because they have (or were researched as having) **US presence** (US HQ and/or US delivery footprint).
- **Master list** (Global Contact Center Market Map – NEW Master List) is a different dataset with different sourcing. For the same companies it often has **different or incomplete** HQ/footprint data (e.g. no US states, or HQ listed as non-US only).

**Conclusion:** For “do they have US presence?”, **trust the medium-14 list** (and any re-verification below) over the master list when they conflict. The master list should be **enriched** from medium-14 (or research) for these accounts so qualification logic can treat them correctly.

---

## Account-by-account reconciliation

### 1. Contact Point 360
| Source | HQ | Onshore delivery | US presence? |
|-------|----|-------------------|-------------|
| **Medium-14** | Canada (Toronto) | **US (McAllen, TX)**; Canada (Toronto, Montreal) | **Yes** – US onshore |
| **Master list** | Canada | Canada | No (missing US) |

**Verdict:** **Believe medium-14.** Master list is missing US onshore (McAllen, TX). Enrich master: set `onshore_delivery_footprint` to include US (e.g. add "Texas" or "McAllen, TX").

---

### 2. Eastwest BPO Inc. (master: Eastwest Enterprises)
| Source | HQ | Onshore delivery | US presence? |
|-------|----|-------------------|-------------|
| **Medium-14** | **USA (Virginia; New Jersey)** | **US (Virginia, Atlantic City NJ)** | **Yes** |
| **Master list** | Philippines | Philippines | No |

**Verdict:** **Believe medium-14.** Master list is wrong: HQ and delivery are US, not Philippines. Enrich master: `company_hq` = United States (or Virginia; New Jersey), `onshore_delivery_footprint` = Virginia, New Jersey.

---

### 3. OAMPI / Open Access BPO (master: Expanding Teams)
| Source | HQ | Onshore delivery | US presence? |
|-------|----|-------------------|-------------|
| **Medium-14** | **USA (Las Vegas, NV)** | **US (Las Vegas, NV)** | **Yes** |
| **Master list** | United States | Nevada | Yes |

**Verdict:** No discrepancy on US presence. Master already has US. They fail qualification only because **service_lines** in the master lack the four outbound tags (Sales Outsourcing, Outbound Services, B2C Telemarketing, Collections). Enrich master: add outbound service line tags if accurate.

---

### 4. Global Strategic (master: Global Strategic Business Process Solutions)
| Source | HQ | Onshore delivery | US presence? |
|-------|----|-------------------|-------------|
| **Medium-14** | **USA (Burlington, NC)** | (nearshore/offshore only) | **Yes** – US HQ |
| **Master list** | Philippines | Philippines | No |

**Verdict:** **Believe medium-14.** Master list is wrong: HQ is US (North Carolina), not Philippines. Enrich master: `company_hq` = United States (or North Carolina), and ensure onshore or HQ reflects US.

---

### 5. Nearsol Philippines Inc. (master: Nearsol)
| Source | HQ | US presence? |
|-------|----|---------------|
| **Medium-14** | **USA (Coral Gables, FL)** | **Yes** |
| **Master list** | United States | Yes |

**Verdict:** No discrepancy. Already qualified in master/qualified list.

---

### 6. Infinit Outsourcing Inc. (master: Infinit-O)
| Source | HQ | Delivery | US presence? |
|-------|----|----------|-------------|
| **Medium-14** | Philippines (Makati) | Philippines only | No |
| **Master list** | Philippines | (blank/Philippines) | No |
| **Re-verification** | — | One old source mentioned “offices in the United States”; current sources (Craft, official) list only Philippines (Makati, Legazpi, Pasay). No US office confirmed. | **No** |

**Verdict:** **No US presence.** Medium-14 and master agree: Philippines-only. They were likely on the “US-focused” list for serving US clients from offshore, not for US footprint. No master list change needed for US presence.

---

### 7. Sourcefit Philippines Inc. (master: Sourcefit)
| Source | HQ | Delivery | US presence? |
|-------|----|----------|-------------|
| **Medium-14** | Philippines | Dominican Republic nearshore; Philippines, etc. | Not stated |
| **Master list** | Philippines | Philippines; Dominican Republic; etc. | No |
| **Re-verification** | — | Sourcefit contact page lists **1888 Kalakaua Ave. Suite C312, Honolulu, HI 96815** (US). | **Yes** – US office (Hawaii) |

**Verdict:** **Believe re-verification.** Master list is incomplete: Sourcefit has a US presence (Honolulu). Enrich master: add US to `company_hq` or `onshore_delivery_footprint` (e.g. Hawaii or United States).

---

### 8. ISSI Corp
| Source | HQ | Delivery | US presence? |
|-------|----|----------|-------------|
| **Medium-14** | Philippines (BGC, Taguig) | Philippines only | No |
| **Master list** | Philippines | Philippines | No |
| **Re-verification** | — | HQ and operations in Philippines; serve North America from there; US phone number and “Chief Sales Officer, North America” – no physical US office found. | **No** |

**Verdict:** **No US presence.** Philippines-only delivery; US clients only. No master list change needed for US presence.

---

## Summary: which to believe

| Account | Master says US? | Medium-14 / research says US? | Action |
|---------|------------------|-------------------------------|--------|
| Contact Point 360 | No | **Yes** (McAllen, TX) | Enrich master with US onshore |
| Eastwest BPO | No | **Yes** (HQ + delivery US) | Enrich master with US HQ + onshore |
| Expanding Teams (OAMPI) | Yes | Yes | Add outbound tags in master if accurate |
| Global Strategic | No | **Yes** (US HQ, NC) | Enrich master with US HQ |
| Nearsol | Yes | Yes | None (already qualified) |
| Infinit-O | No | No | None |
| Sourcefit | No | **Yes** (Honolulu) | Enrich master with US presence |
| ISSI Corp | No | No | None |

**Bottom line:** For **Contact Point 360, Eastwest, Global Strategic, and Sourcefit**, the master list is **wrong or incomplete** on US presence. Your medium-14 list (and, for Sourcefit, current website) is the better source. Enriching the master list from this reconciliation will allow those accounts to pass the US-presence part of qualification when they also meet size and outbound-tag rules.
