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
  secondDegree: string;
  calanthiaFirstDegree: string;
  calanthiaSecondDegree: string;
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
- Don't have Teleperformance's budget and internal AI team? Don't worry, at Dyna, we bring Teleperformance-proven team and expertise to you.
- Dyna delivers true end-to-end voice automation — AI agents that automate outbound and inbound calls from greeting to resolution independently. Not copilots or agent-assist tools.
- We design bespoke solutions: script design, workflow implementation, continuous monitoring and optimization. No internal AI team required.
- Multi-agent orchestration across multiple channels (voice and text), multiple use cases (inbound and outbound).
- One AI partner covering multiple industries (telecom, travel, insurance, collections, etc.) — built for BPOs.
- Every call tracked, every conversion measured, every result tied to revenue. You pay for results.
- Battle-tested with international enterprises: Teleperformance, Toyota, HSBC (verbal only), Pizza Hut, major telecoms, digital banks.
- For Technology Leaders specifically: lead with "Be the tech leader who leads your contact center into the AI era." Enterprise-grade solutions designed and deployed by dedicated industry experts. SaaS, private cloud, or on-prem.

RULES:
- Touch 1: NEVER mention Dyna, AI products, or anything that sounds like a pitch. This is just a human connecting with another human. Under 300 characters.
- Touch 2: NEVER pitch. Position Calanthia as an expert spending time with BPO leaders. She's sharing what she's learning, comparing notes. She's curious about their world. 3-5 sentences, warm and conversational.
- Touch 3: This is where the value prop comes in, but framed as sharing insights — "I've been working closely with BPO leaders on this exact challenge" not "we sell AI software." Weave in 1-2 relevant case studies naturally. Match the persona:
  - Executive Sponsor: The Teleperformance hook — biggest BPOs using AI, "don't have Teleperformance's budget and internal AI team? Don't worry, we bring Teleperformance-proven team and expertise to you." AI agents that automate outbound and inbound calls from end to end, 24/7, scale without headcount.
  - Operations & Finance Leader: Lead with REDUCING LABOR COSTS and expanding capacity — "fully automated AI agents allow you to scale on demand while reducing labor costs significantly." Industry competitive pressure to improve EBITDA margin. Bespoke solutions, specific proof points. You pay for results.
  - Technology Leader: LEAD WITH ASPIRATION — "Be the tech leader who leads your contact center into the AI era." Then: enterprise-grade AI solutions designed and deployed for you by dedicated industry experts, no internal AI team needed. Multi-agent orchestration across voice AND text, inbound and outbound. Deployed via SaaS, private cloud, or on-prem. Battle-tested by enterprise (Teleperformance, Toyota, major telecoms). Can handle volume at scale. Do NOT lead with the 60-80% build problem — lead with the vision of being the AI leader.
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
    "datamark, inc.": { deliveryModel: "onshore, nearshore, offshore", clientIndustries: "Financial Services, Healthcare, Public Sector, Technology" },
    "etech global services": { deliveryModel: "onshore, offshore", clientIndustries: "Financial Services, Consumer, Healthcare, Technology, Telecom" },
    "liveops": { deliveryModel: "onshore, offshore", clientIndustries: "Insurance, Telecom, Consumer, Healthcare" },
  };

  function getDelivery(company: string) {
    const key = company.trim().toLowerCase();
    return deliveryData.get(key) || manualDelivery[key] || { deliveryModel: "Unknown", clientIndustries: "" };
  }

  // Exclusions: removed after web verification
  const excludeNames = new Set([
    "Pankaj Dhanuka",    // Wrong company — at Fusion CX, not ClearSource
    "Demond Moore",      // Can't verify at Percepta
    "Daniel Aristimuno", // Title unverifiable — listed as Site Director elsewhere
    "Rodd Furlough",     // Can't verify at KM² Solutions
  ]);

  // Track Brian Flaherty to remove the duplicate
  let brianFlahertySeen = false;

  // Force-include contacts who are event-active (even if not LinkedIn-active or SE)
  const forceIncludeNames = new Set([
    "Ali Karim",        // DATAMARK — confirmed speaker at Frost & Sullivan East + West
    "Bill Randag",      // DATAMARK President — company heavily event-active
    "Matt Rocco",       // Etech CEO — company at CCW LV + Conversational AI Summit
    "Jim Iyoob",        // Etech — confirmed speaker at Conversational AI Summit + CCW LV
    "Liliana Lopez",    // Liveops — co-led AI Maturity Workshop at CCW Orlando, active LinkedIn
    "Bill Trocano",     // Liveops — published AI article Feb 2026, active LinkedIn
  ]);

  // Enriched icebreakers from web research (override CSV data)
  const enrichedIcebreakers: Record<string, string> = {
    "Amanda Jones": "CBE Companies won the 2025 BBB Torch Award for Ethics and the OIR Catalyst for Change Award for their CBE Cares community initiative. They also opened a new Philippines office in 2024.",
    "Pablo Paz Hernandez": "First Contact BPO grew 2,500% in under a year after launching in 2023. His other company, Interactive Contact Center, was named one of CIOReview's Top 10 Contact Center Services in Latin America. YEC member.",
    "Greg Alcorn": "Founded ApSeed, a nonprofit providing free pre-K tablets to 25,000+ disadvantaged children across NC, SC, NYC, and Africa — 131% literacy improvement in one school district. Former NC State Board of Education member. GCS was first to invest in Forward Rowan economic development initiative.",
    "Bryan Overcash": "Co-founded GCS in 2001 with Greg Alcorn. CPA credential. Active in Forward Rowan economic development initiative. GCS managed the COVID Hotline for 68,000 MTA NYC Transit employees and helped process 700,000+ unemployment claims for NY State Dept of Labor.",
    "Brian Flaherty": "Speaking at the Mortgage AI conference in October 2026 ('Staff vs AI vs Virtual Assistants: How You Can Manage The AI/Human Balance'). Recently presented a webinar with the Five Star Institute on mortgage operations outsourcing. Global Strategic is ISO 27001 certified.",
    "Donny Jackson": "Promoted to RVP Business Operations - US as part of a major Helpware leadership restructuring. CEO Robert Nash specifically highlighted these appointments as key to the company's growth strategy. Experience across healthcare, retail, tech, and finance.",
    "Nanette Harrell": "Helpware named one of Clutch's Top 100 Fastest-Growing Companies for 2025. Company expanded to Poland, Albania, Puerto Rico, Guam, and Uganda. Acquired Unicsoft and launched Helpware Tech division. Now operates from 18 locations across 4 continents.",
    "John Yanez": "Promoted to COO at InteLogix. Their LogixAssist product won 'AI-based Customer Service Solution of the Year' at the 2025 AI Breakthrough Awards — 67-89% first-contact resolution increase, 40% training time reduction. InteLogix acquired Pioneer CX in Feb 2026 to expand into public sector/GovCX.",
    "David Kreiss": "Massive Caribbean expansion — 1,250 new jobs across Grenada and Saint Lucia. New 8,000 sq ft Grenada facility (800 workforce), second Grenada site adding 650 jobs. KM² now has 6,500+ employees across six Caribbean countries. Celebrating 15th year in Grenada.",
    "Ken Braatz": "Led the launch of SupportNinja's 'Outsourcing 2.0' AI suite (NinjaAI) in March 2025 — includes NinjaAI QA that reviews 100% of interactions vs the traditional 2-5%. Authored content on AI-powered QA. SupportNinja ranked #2653 on Inc. 5000 and named Outsource Partner of the Year 2025.",
    "Benjamin Alpert": "Co-presented at Customer Connect Expo (April 2025, Las Vegas) on 'Balancing AI and Human Agents — The Future of Contact Centers' to 3,000+ CX leaders. The Office Gurus launched GuruAssist AI platform. Company named #1 Best Place to Work in call center industry in El Salvador two consecutive years.",
    "Mark D'Angola": "Title is SVP & Country Head, Operations (APAC) at Buwelo — oversees call centers engaging 5M+ customers annually. 15+ years in BPO, prior Fortune 500 experience. Buwelo reports 94% client retention rate and attrition as low as 7%.",
    "Rob Porges": "Shared Flatworld's 'Tech in Mortgage — Powered by MSuite' podcast highlighting AI-driven mortgage automation. Flatworld showcased MSuite at the MBA Servicing Conference in Dallas (Feb 2025). Company launched Flatworld.ai as a standalone AI transformation partner in June 2025.",
    "Kenneth Loggins": "Gave reporters a tour during the grand opening of a new Focus Services call center in North Carolina (former Concentrix facility, 350 seats). Focus Services is expanding to South Africa. The NC expansion created ~550 jobs.",
    "Erika Garcia": "Shared a post about joining Global Strategic during strong momentum and focusing on turning insights into strategies. Note: may have moved to White Glove Business Solutions — verify current role on LinkedIn before outreach.",
    "Youssef Hannat": "Percepta just named Thomas Monaghan as new President (Feb 2026), replacing Karen Gurganious. New leadership = potential new priorities. Percepta is a TTEC/Ford JV with ~4,000 employees across 13 countries, focused on automotive CX.",
    "Ali Karim": "CONFIRMED SPEAKER at Frost & Sullivan Customer Contact MindXchange East (Fort Lauderdale, Apr 12-15): presenting 'AI That Works: Inside the Customer and Employee Experience' case history + facilitating roundtable 'Cut Through the CX Hype: Pick the Right Tech, Every Time'. Also speaking at Frost & Sullivan West (Tucson, Oct 18-21) on Emotional AI and Sentiment Analytics. DATAMARK is a featured sponsor at both events. 35+ year BPO, 4,600+ employees across US, Mexico, and India.",
    "Bill Randag": "President of DATAMARK. Company is a featured sponsor at both Frost & Sullivan MindXchange East (Fort Lauderdale, Apr 12-15) and West (Tucson, Oct 18-21) with multiple speakers. DATAMARK is one of the most event-active BPOs on the circuit. 35+ years, 4,600+ employees, US + Mexico + India delivery.",
    "Matt Rocco": "CEO of Etech Global Services. Etech is confirmed at CCW Las Vegas 2026 (Jun 22-25, Booth #1404) with a workshop. Jim Iyoob (Etech) is a confirmed speaker at the Conversational AI Summit (Apr 9) and Call Center Campus Symposium (May 17-20). Etech is one of the most conference-active BPOs.",
    "Jim Iyoob": "CONFIRMED SPEAKER at Conversational AI & Contact Center Innovation Summit (Virtual, Apr 9, 2026). Also speaking at CCW Las Vegas 2026 (Jun 22-25, workshop) and Call Center Campus Symposium (May 17-20, keynote). President of ETS Labs at Etech. Authored blog on 'Analytics and the Power of the Human Touch'. Very active on the conference circuit.",
    "Liliana Lopez": "Co-led an AI Maturity Workshop at CCW Orlando (Jan 2026) on operationalizing AI — moving from 'promising' to 'proven'. Also shared thought leadership on sandboxing AI, real-time agent assist, and using AI to accelerate onboarding and QA. Promoted LiveNexus for testing and scaling AI innovations. VP of Technology, Cybersecurity & Innovation at Liveops.",
    "Bill Trocano": "Published a LinkedIn article in Feb 2026 about how AI didn't replace humans during the holiday season but raised the bar for human agents. Global VP of CX at Liveops. Active interest in AI-enabled CX and workforce enablement.",
  };

  const prospects: Prospect[] = records
    .filter((r: Record<string, string>) => {
      const name = (r["Full Name"] || "").trim();
      if (!name) return false;
      if (excludeNames.has(name)) return false;
      // Remove duplicate Brian Flaherty
      if (name === "Brian Flaherty") {
        if (brianFlahertySeen) return false;
        brianFlahertySeen = true;
      }
      const active = r["Active on LinkedIn (last 90 days)"] === "1" || r["Active on LinkedIn (last 90 days)"] === "True";
      const se = isSoutheastLocation(r["Location"] || "");
      const forced = forceIncludeNames.has(name);
      return active || se || forced;
    })
    .map((r: Record<string, string>) => {
      const fullName = r["Full Name"].trim();
      const firstName = r["First Name"]?.trim() || fullName.split(" ")[0];
      const lastName = r["Last Name"]?.trim() || "";
      const company = r["Company Name"] || "";
      const delivery = getDelivery(company);
      const icebreaker = enrichedIcebreakers[fullName] || r["Icebreaker Insight"] || "";
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
        icebreaker,
        summaryOfRole: r["Summary of Role"] || "",
        linkedinProfile: r["LinkedIn Profile"] || "",
        email: r["Contact Email"] || "",
        companyTenure: r["Company Tenure"] || "",
        notableExperience: r["Notable Previous Experience"] || "",
        firstDegree: r["First Degree Connection [Alice or Calanthia]"] || "",
        secondDegree: r["Second Degree Connections [Alice only]"] || "",
        calanthiaFirstDegree: r["Calanthia First Degree"] || "",
        calanthiaSecondDegree: r["Calanthia Second Degree"] || "",
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

      // Build LinkedIn connection string
      const connections: string[] = [];
      if (p.firstDegree && p.firstDegree.toLowerCase() === "true") connections.push("Alice 1st degree");
      if (p.calanthiaFirstDegree && p.calanthiaFirstDegree.toLowerCase() !== "false" && p.calanthiaFirstDegree.trim()) connections.push("Calanthia 1st degree");
      if (p.secondDegree && p.secondDegree.trim()) connections.push(`Alice 2nd degree (${p.secondDegree.trim()})`);
      if (p.calanthiaSecondDegree && p.calanthiaSecondDegree.trim() && !p.calanthiaSecondDegree.includes("No LinkedIn")) connections.push(`Calanthia 2nd degree (${p.calanthiaSecondDegree.trim()})`);
      const connectionStr = connections.length > 0 ? connections.join("; ") : "None";

      lines.push(`## ${i + 1}. ${p.fullName}`);
      lines.push("");
      lines.push(`| | |`);
      lines.push(`|---|---|`);
      lines.push(`| **Company** | ${p.company} |`);
      lines.push(`| **Title** | ${p.jobTitle} |`);
      lines.push(`| **Persona** | ${p.persona} |`);
      lines.push(`| **Active on LinkedIn** | ${p.activeLinkedIn ? "Yes" : "No"} |`);
      lines.push(`| **LinkedIn connection** | ${connectionStr} |`);
      lines.push(`| **Event** | ${p.eventHook} |`);
      lines.push(`| **Delivery footprint** | ${footprint} (${p.deliveryModel || "unknown"}) |`);
      lines.push(`| **Client industries** | ${p.clientIndustries || "Not specified"} |`);
      lines.push(`| **Icebreaker** | ${p.icebreaker.trim().length > 10 ? p.icebreaker.substring(0, 200) + (p.icebreaker.length > 200 ? "..." : "") : ""} |`);
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
