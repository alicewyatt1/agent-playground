# Qualified list – step-by-step audit (today’s session)

## Starting point
- **Qualified list:** 234 accounts (stored as the list of accounts that met the three criteria; also used for captive BPO check).
- **Qualification logic (unchanged):**
  - US presence: US state or United States in HQ or any delivery footprint (onshore, nearshore, offshore).
  - Mid Market or Enterprise in `size_employee_count`.
  - One of four outbound service line tags: Sales Outsourcing, Outbound Services, B2C Telemarketing & Telesales, Collections Recovery.

---

## Step 1: Delivery enrichment for 8 accounts
**What was done:**  
Eight qualified accounts had no (or incomplete) delivery method/footprint. We used existing research in `delivery-8-results.json` and:
- Filled `delivery_model` and onshore/nearshore/offshore footprint for those 8.
- Applied the “US state when onshore is US” rule (e.g. United States → state names where known).

**Changes made:**  
- **Master List:** Only those 8 rows were updated; no rows added or removed.  
- **Qualified list:** Not modified; still 234 (or 233 if one was already deduped).

**Impact on qualified list:** **None** (enrichment only).

---

## Step 2: Merge same-website accounts (Master List + qualified list)
**What was done:**  
- **Master List:** All rows were grouped by normalized website. Groups with more than one row were merged into a single row (coalesce: first non-empty per column; company name via “best name” rules).  
  - **Result:** Row count went from 8,214 → 7,945 (269 duplicate-by-website rows merged).
- **Qualified list:** The script read the current `qualified-for-captive-check.json`, deduplicated by normalized website (one entry per website), and wrote the result back. So the qualified list was reduced only by duplicate websites.

**Changes made:**  
- **Master List:** 269 rows removed by merging into other rows.  
- **Qualified list:** 233 → 216 entries (or 234 → 217 depending on exact starting count). Reduction is from removing duplicate websites only.

**Impact on qualified list:** **Expected:** small drop (e.g. 233 → 216) from merging duplicate websites only.

**Possible data issue:** Merge used “first non-empty” for every column. So in a group where the first row had e.g. SME size and the second had Mid Market, the merged row got SME. That could have turned some previously qualified rows into not-qualified in the Master List, but the qualified list file itself was only deduped by website and not recomputed at this step.

---

## Step 3: Flag suspected duplicates
**What was done:**  
A script compared company name and website on the qualified list and wrote `qualified-suspected-duplicates.md` (same-website groups and similar-name pairs).

**Changes made:**  
- **Master List:** None.  
- **Qualified list:** None.

**Impact on qualified list:** **None.**

---

## Step 4: User asked to merge accounts sharing the same website
**What was done:**  
Same merge as in Step 2 was run again. Master List was already merged, so row count did not change again. The script again read the qualified list, deduped by website, and wrote it back (so 216 stayed 216).

**Impact on qualified list:** **None** (already merged and deduped).

---

## Step 5: Update qualification column (error)
**What was done:**  
A new script `update-qualified-column.ts` was run that:
1. **Recomputed** qualification from the three rules (US presence, MM/Enterprise, outbound tags) on the **current** Master List.
2. Set the Master List column `qualified` to Y/N based on that recomputation.
3. **Overwrote** `qualified-for-captive-check.json` with only the accounts that passed that recomputation (one per website).

**Changes made:**  
- **Master List:** A `qualified` column was added/updated; values were set from recomputation (131 Y, 7,814 N).  
- **Qualified list:** **Overwritten.** It was replaced by the recomputed set instead of keeping the existing 216. Recomputation yielded 131 qualified rows (130 unique websites), so the file went from **216 → 131**.

**Impact on qualified list:** **Incorrect drop from 216 to 131.**  
The qualified list should have remained the 216 (or 215) accounts that were already qualified and only deduped by website. It should **not** have been replaced by a freshly computed set. The drop was caused by this overwrite, not by the merge or the qualification logic.

---

## Root cause of the drop
- **Merge and enrichment:** Only reduced the list by duplicate websites (234 → ~216) and did not remove accounts otherwise.
- **update-qualified-column.ts:** Treated “update the qualified column” as “recompute who is qualified and replace the qualified list.” That recomputation (on the current Master List) gave 131, and the script overwrote the qualified list with those 131, **discarding the previous 216**.

Correct behavior would have been:
- **Master List:** Set `qualified` = Y for every row whose (normalized) website is in the **existing** qualified list; N for all others.
- **Qualified list:** Leave unchanged (keep the 216).

---

## Recovery
- **captive-bpo-results.json** was built from the qualified list **before** it was overwritten. It has **233 entries** and **215 unique websites**, which matches the pre–update-qualified-column list (after website dedup).
- Recovery steps:
  1. Restore the qualified list from `captive-bpo-results.json` (one entry per unique website → 215 accounts).
  2. Set the Master List `qualified` column from this list: Y if the row’s normalized website is in the restored set, N otherwise. Do not recompute from the three rules for the purpose of defining the qualified list.

After recovery, the qualified list should be **215** (or 216 if one duplicate is kept), and the Master List will have that many rows (and websites) marked qualified=Y.
