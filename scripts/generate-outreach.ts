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

  const prompt = `You are writing LinkedIn and email outreach for Calanthia Mei, an AI entrepreneur and Strategic Advisor at Dyna.ai, reaching out to US mid-market BPO leaders.

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
${prospect.summaryOfRole ? `- Role summary: ${prospect.summaryOfRole}` : ""}

KEY MESSAGING (use these themes in Touch 3):
- Dyna deploys fully automated voice AI — true end-to-end voice automation, not copilots or agent-assist tools. One of the few AI providers globally capable of this at enterprise scale.
- The core Teleperformance hook for mid-market: "Your clients are demanding higher service quality at lower cost, and the biggest BPOs are beginning to use AI to deliver both. Don't have Teleperformance's budget and internal AI team? We bring the same Teleperformance-proven team and expertise to you."
- Dyna designs bespoke solutions — script design, workflow implementation, continuous monitoring and optimisation are standard practices. No internal AI team required.
- Multi-industry coverage built for BPOs — telecom, travel, insurance, and more. One AI partner covering your clients' industries.
- Enterprise clients include Teleperformance, Toyota, Pizza Hut, major telecoms, global insurers, digital banks.
- You pay for results — every call tracked, every conversion measured, every result tied to revenue.
- Proof points: 10K+ daily outbound calls with 99% tagging accuracy (telco); 76% promise-to-pay on collections (digital bank); 4.7% conversion on telesales upsell with 20K records; 40% labour cost reduction on inbound bookings (airline).

RULES:
- Tone: peer-to-peer, senior executive to senior executive. Calanthia is NOT selling. She's genuinely curious and offering value.
- Never mention Dyna.ai or any product in Touch 1 or Touch 2. These should feel like a peer connecting, not a vendor approaching.
- Never pitch in Touch 1 or Touch 2. Touch 3 (email) is where the value prop goes.
- Be specific — no generic compliments like "your company has a great reputation." If you have an icebreaker insight, use something concrete from it. If you don't have one, reference something specific about the company's work or specialty.
- Do NOT use phrases like "leveraging AI", "navigating competitive pressures", "exploring synergies", or other corporate buzzwords. Write like a real person.
- Keep Touch 1 under 300 characters including the name.
- Keep Touch 2 to 3-5 sentences. Conversational. End with a question.
- Keep Touch 3 (email) to 100-150 words for the body. Tight, direct, no fluff.
- For Touch 3, match the persona:
  - Executive Sponsor: Lead with the Teleperformance hook — clients demanding higher quality at lower cost, biggest BPOs using AI, "don't have Teleperformance's budget? We bring the same team to you." Fully automated AI agents, 24/7, scale without headcount.
  - Operations & Finance Leader: Lead with margin pressure and the capital gap — "Teleperformance can throw $185M at building AI. You don't have to." Fully automated agents, bespoke script design, proof points (10K daily, 99% accuracy, 76% promise-to-pay, 40% cost reduction). You pay for results.
  - Technology Leader: Lead with the 60-80% problem — teams building internally get stuck at 60-80% quality. Dyna's platform is purpose-built for end-to-end voice automation: cloud/on-prem/SaaS, enterprise-grade uptime, 10+ languages, compliance controls, scales from pilot to production without re-architecting.

Write exactly three pieces:

TOUCH 1 — LINKEDIN CONNECTION REQUEST (under 300 chars):
${hasIcebreaker ? "Use a personal hook drawn from the icebreaker insight. Be specific — reference a particular post, milestone, or opinion." : hasEvent ? `Use the event hook: ${eventName}. Keep it natural.` : "Use an industry peer approach — something specific to what they do."}

TOUCH 2 — LINKEDIN FOLLOW-UP MESSAGE (after they accept, 3-5 sentences):
${hasIcebreaker && hasEvent ? "Open with a specific icebreaker, then mention the event." : hasIcebreaker ? "Open with a specific icebreaker, then offer to share what you're learning." : hasEvent ? "Compliment something specific about their company, then mention the event." : "Compliment something specific about their company, then offer to share what you're learning."}
End with a question — either about the event ("are you going?") or about their world ("how is [Company] thinking about AI for voice operations?").

TOUCH 3 — EMAIL (persona: ${prospect.persona}):
Include a subject line, then the email body. Reference the LinkedIn connection briefly ("Great connecting on LinkedIn"). Use the persona-appropriate value prop from the key messaging above. Include 2-3 specific proof points. End with a call to action asking for a 20-minute call.

Format your response EXACTLY like this (no other text):

**Touch 1 — Connection Request**
[the message]

**Touch 2 — LinkedIn Message**
[the message]

**Touch 3 — Email**
Subject: [subject line]

[email body including "Best, Calanthia" sign-off]`;

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
      return {
        fullName,
        firstName,
        lastName,
        jobTitle: r["Job Title"] || "",
        company: r["Company Name"] || "",
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

      lines.push(`## ${i + 1}. ${p.fullName}`);
      lines.push("");
      lines.push(`| | |`);
      lines.push(`|---|---|`);
      lines.push(`| **Title** | ${p.jobTitle} |`);
      lines.push(`| **Company** | ${p.company} |`);
      lines.push(`| **Persona** | ${p.persona} |`);
      lines.push(`| **Location** | ${p.location} |`);
      lines.push(`| **Event hook** | ${p.eventHook} |`);
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
