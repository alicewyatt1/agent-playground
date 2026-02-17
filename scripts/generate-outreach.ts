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

RULES:
- Tone: peer-to-peer, senior executive to senior executive. Calanthia is NOT selling. She's genuinely curious and offering value.
- Never mention Dyna.ai or any product in Touch 1 or Touch 2.
- Never pitch in Touch 1 or Touch 2. Touch 3 (email) is where the value prop goes.
- Be specific — no generic compliments. If you don't have something specific, reference the company's reputation or specialty instead.
- Keep Touch 1 under 300 characters including the name.
- Keep Touch 2 to 3-5 sentences. Conversational.
- Keep Touch 3 (email) under 150 words for the body.
- For Touch 3, match the persona:
  - Executive Sponsor: lead with competitive pressure, AI autopilot, scale without headcount
  - Operations & Finance Leader: lead with elastic capacity, no churn, margin protection, proof points (10K daily calls, 99% accuracy, 76% promise-to-pay, 40% cost reduction)
  - Technology Leader: lead with the 60-80% problem, production-grade platform, deployment flexibility, integration

Write exactly three pieces:

TOUCH 1 — LINKEDIN CONNECTION REQUEST (under 300 chars):
${hasIcebreaker ? "Use a personal hook from the icebreaker insight." : hasEvent ? `Use the event hook: ${eventName}.` : "Use an industry peer approach."}

TOUCH 2 — LINKEDIN FOLLOW-UP MESSAGE (after they accept, 3-5 sentences):
${hasIcebreaker && hasEvent ? "Use icebreaker + event approach." : hasIcebreaker ? "Use icebreaker + value offer approach." : hasEvent ? "Use company compliment + event approach." : "Use company compliment + value offer approach."}
End with either an event ask ("are you going?") or a soft value offer ("happy to share what I'm learning").

TOUCH 3 — EMAIL (persona: ${prospect.persona}):
Include a subject line, then the email body. Reference the LinkedIn connection. Use the persona-appropriate value prop and proof points. End with a call to action asking for a 20-minute call.

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
