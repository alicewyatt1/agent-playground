/**
 * Generate personalised Touch 1/2/3 messaging for each prospect in Cohort 1.
 * Uses the messaging playbook templates + prospect data.
 * Output: data/personalised-outreach.md
 */
import { config } from "dotenv";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Prospect {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  location: string;
  persona: string;
  eventHook: string;
  isSoutheast: boolean;
  activeLinkedIn: boolean;
  icebreaker: string;
  summaryOfRole: string;
  linkedinProfile: string;
  email: string;
  companyTenure: string;
  notableExperience: string;
  firstDegree: string;
  calanthiaFirstDegree: string;
  deliveryModel: string;
  clientIndustries: string;
}

function loadDeliveryData(): Map<string, { deliveryModel: string; clientIndustries: string }> {
  const masterPath = path.join(__dirname, "..", "data", "Global Contact Center Market Map - Master List (enriched).csv");
  if (!fs.existsSync(masterPath)) return new Map();
  const raw = fs.readFileSync(masterPath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true });
  const map = new Map<string, { deliveryModel: string; clientIndustries: string }>();
  for (const r of records) {
    const name = (r.company_name || "").trim().toLowerCase();
    if (name) {
      map.set(name, {
        deliveryModel: r.delivery_model || "",
        clientIndustries: r.client_industries || "",
      });
    }
  }
  return map;
}

function classifyDeliveryFootprint(model: string): string {
  const m = model.toLowerCase();
  const hasOnshore = m.includes("onshore");
  const hasNearshore = m.includes("nearshore");
  const hasOffshore = m.includes("offshore");
  if (hasOnshore && !hasNearshore && !hasOffshore) return "Onshore-heavy";
  if (!hasOnshore && hasOffshore) return "Offshore-heavy";
  if (hasOnshore && (hasNearshore || hasOffshore)) return "Mixed delivery";
  if (hasNearshore && hasOffshore) return "Offshore-heavy (nearshore + offshore)";
  if (hasNearshore && !hasOffshore) return "Nearshore";
  return "Unknown";
}

function assignPersona(title: string): string {
  const t = title.toLowerCase();

  // Executive Sponsor — top-level titles. Check CEO/Founder first.
  const isExec = t.includes("ceo") || t.includes("chief executive") ||
    t.includes("founder") || t.includes("owner") || t.includes("chairman") ||
    t.includes("managing partner");
  // "President" counts as exec ONLY if not "Vice President"
  const isPresident = t.includes("president") && !t.includes("vice president");
  if (isExec || isPresident) return "Executive Sponsor";

  // Technology Leader
  if (
    t.includes("cto") || t.includes("chief technology") || t.includes("chief information") ||
    t.includes("cio") || t.includes("ciso") ||
    /\bvp\b.*technolog/i.test(title) || t.includes("vp engineering") ||
    t.includes("vp software") || t.includes("vp it") || t.includes("vp digital innovation") ||
    t.includes("vice president of technology") || t.includes("vice president, technology") ||
    t.includes("call center technologies") || t.includes("senior vice president of technology") ||
    t.includes("cybersecurity") || t.includes("innovation")
  ) return "Technology Leader";

  // Everything else: Operations & Finance Leader
  return "Operations & Finance Leader";
}

function assignEventHook(location: string): string {
  const loc = location.toLowerCase();
  const seStates = [
    "georgia", "atlanta", "florida", "north carolina", "south carolina",
    "tennessee", "alabama", "mississippi", "virginia", "louisiana"
  ];
  if (seStates.some(s => loc.includes(s))) return "CBAND Atlanta (Feb 26)";
  return "Enterprise Connect (Mar 10-12, Las Vegas)";
}

function isSoutheastLocation(location: string): boolean {
  const loc = location.toLowerCase();
  const seStates = [
    "georgia", "atlanta", "florida", "north carolina", "south carolina",
    "tennessee", "alabama", "mississippi", "virginia", "louisiana"
  ];
  return seStates.some(s => loc.includes(s));
}

async function generateMessaging(prospect: Prospect): Promise<string> {
  const hasIcebreaker = prospect.icebreaker.trim().length > 10;
  const hasEvent = prospect.eventHook.length > 0;
  const eventName = prospect.eventHook.includes("CBAND") ? "CCNG event in Atlanta on Feb 26" : "Enterprise Connect in Las Vegas next month";

  const connectionContext = prospect.firstDegree || prospect.calanthiaFirstDegree
    ? `\nConnection: ${prospect.firstDegree ? "Alice is a 1st degree connection" : ""}${prospect.calanthiaFirstDegree ? "Calanthia is a 1st degree connection" : ""}`
    : "";

  const prompt = `You are writing LinkedIn and email outreach for Calanthia Mei. She is an AI entrepreneur, founder-level executive, and Strategic Advisor at Dyna.ai. She spends her days working with BPO leaders — including Teleperformance — on AI strategy for voice operations. She is an EXPERT, not a salesperson. She has valuable insights from working with the biggest names in the industry and is offering to share them.

PROSPECT:
- Name: ${prospect.fullName} (first name: ${prospect.firstName})
- Title: ${prospect.jobTitle}
- Company: ${prospect.company}
- Location: ${prospect.location}
- Persona: ${prospect.persona}
- Event hook: ${prospect.eventHook}${connectionContext}
${prospect.companyTenure ? `- Tenure: ${prospect.companyTenure}` : ""}
${prospect.notableExperience ? `- Notable experience: ${prospect.notableExperience}` : ""}
${hasIcebreaker ? `- Icebreaker insight: ${prospect.icebreaker}` : "- No icebreaker insight available."}
- Delivery footprint: ${classifyDeliveryFootprint(prospect.deliveryModel)} (${prospect.deliveryModel || "unknown"})
- Client industries served: ${prospect.clientIndustries || "Not specified"}
${prospect.summaryOfRole ? `- Role summary: ${prospect.summaryOfRole}` : ""}

CALANTHIA'S VOICE AND TONE:
- She positions herself as an expert who's been in rooms with Teleperformance, major telecoms, Toyota, digital banks
- She's offering to SHARE what she's learning from other leaders, not pitching a product
- Warm, confident, generous with insights. Think: "I'd be happy to share what I'm seeing from other BPO leaders"
- She asks genuine questions — she's curious about what THEY'RE doing too
- Never salesy, never corporate buzzwords. Writes like a real person having a conversation
- Sign-off is "Warm regards, Calanthia" or just "Calanthia"

CASE STUDIES she can reference (use 1-2 relevant ones in Touch 3 based on what industries this BPO likely serves):
- Telecom: Major Mexican telco — 10K+ daily outbound calls, 99% tagging accuracy, 4.7% conversion on telesales upsell across 20K records. Fully automated dual-agent model.
- Collections/Financial services: Digital bank in Singapore — 76% promise-to-pay rate, 40% reach rate, 2-3K daily volume, fully compliant in regulated environment. Expanded from pilot to multi-product in 12 months.
- Travel/Hospitality: Sands Macau hotel booking confirmation via Teleperformance — multi-language voice bot (English, Mandarin, Cantonese). Major Middle East airline — 85%+ booking success, 4K+ daily, 40% labour cost reduction.
- Insurance: Leading Japanese insurer — real-time intent detection, automated categorisation for renewals.
- Restaurant/QSR: Pizza Hut pilot in Thailand for food ordering. Restaurant tech platform for inbound ordering.
- Collections/Fintech: Mexican fintech lender — tone-adapted collections by delinquency stage (friendly→firm), 25% responder rate, 57 payments recovered.

KEY MESSAGING for Touch 3:
- Your clients are demanding higher service quality at lower cost. The biggest BPOs are beginning to use AI to deliver both.
- Don't have Teleperformance's budget and internal AI team? We bring the same Teleperformance-proven team and expertise to you.
- Dyna delivers true end-to-end voice automation — not copilots or agent-assist tools.
- We design bespoke solutions: script design, workflow implementation, continuous monitoring. No internal AI team required.
- One AI partner covering multiple industries (telecom, travel, insurance, collections, etc.) — built for BPOs.
- Every call tracked, every conversion measured, every result tied to revenue. You pay for results.

RULES:
- Touch 1: NEVER mention Dyna, AI products, or anything that sounds like a pitch. This is just a human connecting with another human. Under 300 characters.
- Touch 2: NEVER pitch. Position Calanthia as an expert spending time with BPO leaders. She's sharing what she's learning, comparing notes. She's curious about their world. 3-5 sentences, warm and conversational.
- Touch 3: This is where the value prop comes in, but framed as sharing insights — "I've been working closely with BPO leaders on this exact challenge" not "we sell AI software." Weave in 1-2 relevant case studies naturally. Match the persona:
  - Executive Sponsor: The Teleperformance hook — biggest BPOs using AI, you don't need their budget, we bring the same team to you. Scale without headcount.
  - Operations & Finance Leader: Margin pressure, the capital gap, bespoke solutions, specific proof points from case studies. You pay for results.
  - Technology Leader: The 60-80% problem, purpose-built platform, deployment flexibility, compliance, scales from pilot to production.
- ALSO tailor by delivery footprint:
  - Onshore-heavy: Margins are thin (5-8% EBITDA). AI transforms the unit economics. "You're paying $40-50K per seat onshore. AI runs at a fraction."
  - Offshore-heavy: Healthy margins from labour arbitrage, but threat is obsolescence. Clients demanding AI. "AI protects your position and scales beyond what labour arbitrage can deliver."
  - Mixed delivery: AI is a third delivery tier alongside onshore and offshore. "Zero labour cost, infinite scale, per-outcome pricing."

Write exactly three pieces:

TOUCH 1 — LINKEDIN CONNECTION REQUEST (under 300 chars):
${hasIcebreaker ? "Use a personal hook from the icebreaker insight." : hasEvent ? `Use the event: ${eventName}.` : "Position as an expert: 'I spend my days working with BPO leaders on AI strategy.'"}

TOUCH 2 — LINKEDIN FOLLOW-UP MESSAGE (3-5 sentences, warm):
Start with "Great to connect, [First Name]." then ${hasIcebreaker ? "a genuine, specific icebreaker" : "a specific compliment about their company's work"}.
Then position Calanthia as spending time with BPO leaders exploring AI.
${hasEvent ? `End with: are you going to ${eventName}?` : "End with: would love to share what I'm learning if that's useful."}

TOUCH 3 — EMAIL (persona: ${prospect.persona}):
Subject line + email body. Open with a warm reference to the LinkedIn connection. Share perspective like an expert. Weave in the Teleperformance hook and 1-2 relevant case studies naturally. Close with: "I'd be happy to share more of what I'm seeing — would you be interested in a conversation?" Keep to 120-160 words.

Format EXACTLY like this (no other text):

**Touch 1 — Connection Request**
[the message]

**Touch 2 — LinkedIn Message**
[the message]

**Touch 3 — Email**
Subject: [subject line]

[email body ending with "Warm regards, Calanthia"]`;

  const result = await generateText({
    model: openai("gpt-4o"),
    prompt,
    maxTokens: 800,
    temperature: 0.7,
  });

  return result.text;
}

async function main() {
  const csvPath = path.join(__dirname, "..", "Downloads", "Top Contacts 2026 - Top Contacts.csv");
  const altPath = "/Users/alicewyatt/Downloads/Top Contacts 2026 - Top Contacts.csv";
  const filePath = fs.existsSync(csvPath) ? csvPath : altPath;

  const raw = fs.readFileSync(filePath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true });

  const deliveryData = loadDeliveryData();

  // Manual overrides for companies not in master list by exact name
  const manualDelivery: Record<string, { deliveryModel: string; clientIndustries: string }> = {
    "focus services": { deliveryModel: "onshore, nearshore", clientIndustries: "Consumer, Telecom, Healthcare" },
    "global strategic": { deliveryModel: "onshore, offshore", clientIndustries: "Financial Services, Healthcare, Technology" },
    "intelogix": { deliveryModel: "onshore, nearshore", clientIndustries: "Consumer, Financial Services, Healthcare, Technology" },
    "flatworld solutions": { deliveryModel: "onshore, nearshore, offshore", clientIndustries: "Financial Services, Healthcare, Technology" },
    "first contact bpo": { deliveryModel: "nearshore, offshore", clientIndustries: "Consumer, Healthcare, Technology" },
  };

  function getDelivery(company: string) {
    const key = company.trim().toLowerCase();
    return deliveryData.get(key) || manualDelivery[key] || { deliveryModel: "Unknown", clientIndustries: "" };
  }

  const prospects: Prospect[] = records
    .filter((r: Record<string, string>) => {
      const name = (r["Full Name"] || "").trim();
      if (!name) return false;
      const active = r["Active on LinkedIn (last 90 days)"] === "1" || r["Active on LinkedIn (last 90 days)"] === "True";
      const se = isSoutheastLocation(r["Location"] || "");
      return active || se;
    })
    .map((r: Record<string, string>) => {
      const fullName = r["Full Name"].trim();
      const firstName = r["First Name"]?.trim() || fullName.split(" ")[0];
      const lastName = r["Last Name"]?.trim() || "";
      const company = r["Company Name"] || "";
      const delivery = getDelivery(company);
      return {
        fullName,
        firstName,
        lastName,
        jobTitle: r["Job Title"] || "",
        company,
        location: r["Location"] || "",
        persona: assignPersona(r["Job Title"] || ""),
        eventHook: assignEventHook(r["Location"] || ""),
        isSoutheast: isSoutheastLocation(r["Location"] || ""),
        activeLinkedIn: r["Active on LinkedIn (last 90 days)"] === "1" || r["Active on LinkedIn (last 90 days)"] === "True",
        icebreaker: r["Icebreaker Insight"] || "",
        summaryOfRole: r["Summary of Role"] || "",
        linkedinProfile: r["LinkedIn Profile"] || "",
        email: r["Contact Email"] || "",
        companyTenure: r["Company Tenure"] || "",
        notableExperience: r["Notable Previous Experience"] || "",
        firstDegree: r["First Degree Connection [Alice or Calanthia]"] || "",
        calanthiaFirstDegree: r["Calanthia First Degree"] || "",
        deliveryModel: delivery.deliveryModel,
        clientIndustries: delivery.clientIndustries,
      };
    });

  console.log(`Found ${prospects.length} prospects (active LinkedIn or Southeast)`);

  const lines: string[] = [
    "# Personalised Outreach — Cohort 1",
    "",
    `> Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    `> Total prospects: ${prospects.length}`,
    "",
    "---",
    "",
  ];

  for (let i = 0; i < prospects.length; i++) {
    const p = prospects[i];
    console.log(`[${i + 1}/${prospects.length}] ${p.fullName} — ${p.jobTitle} at ${p.company}`);

    try {
      const messaging = await generateMessaging(p);

      const footprint = classifyDeliveryFootprint(p.deliveryModel);
      const hasIB = p.icebreaker.trim().length > 10;

      lines.push(`## ${i + 1}. ${p.fullName}`);
      lines.push("");
      lines.push(`| | |`);
      lines.push(`|---|---|`);
      lines.push(`| **Company** | ${p.company} |`);
      lines.push(`| **Title** | ${p.jobTitle} |`);
      lines.push(`| **Persona** | ${p.persona} |`);
      lines.push(`| **Active on LinkedIn** | ${p.activeLinkedIn ? "Yes" : "No"} |`);
      lines.push(`| **Event** | ${p.eventHook} |`);
      lines.push(`| **Delivery footprint** | ${footprint} (${p.deliveryModel || "unknown"}) |`);
      lines.push(`| **Client industries** | ${p.clientIndustries || "Not specified"} |`);
      lines.push(`| **Icebreaker available** | ${hasIB ? "Yes" : "No"} |`);
      if (hasIB) lines.push(`| **Icebreaker** | ${p.icebreaker.substring(0, 200)}${p.icebreaker.length > 200 ? "..." : ""} |`);
      lines.push(`| **Location** | ${p.location} |`);
      lines.push(`| **LinkedIn** | ${p.linkedinProfile} |`);
      lines.push(`| **Email** | ${p.email} |`);
      lines.push("");
      lines.push(messaging);
      lines.push("");
      lines.push("---");
      lines.push("");
    } catch (err) {
      console.error(`  ERROR for ${p.fullName}:`, err);
      lines.push(`## ${i + 1}. ${p.fullName}`);
      lines.push("");
      lines.push(`**Error generating messaging — do manually.**`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  const outPath = path.join(__dirname, "..", "data", "personalised-outreach.md");
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`\nDone! Wrote ${outPath}`);
}

main().catch(console.error);
