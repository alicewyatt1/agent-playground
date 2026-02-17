/**
 * Final polish: regenerate all Touch 1/2/3 messaging with tightened tone.
 * Keeps context cards as-is, only rewrites the messaging.
 */
import { config } from "dotenv";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "data", "personalised-outreach.md");

const CTAs = [
  "I'd love to compare notes over coffee if you're open to it.",
  "Happy to share what I'm learning — let me know if that's useful.",
  "Would love to share more over a quick chat if the timing works.",
  "Let me know if any of this resonates — always happy to compare notes.",
  "I'm around if you ever want to chat about this.",
  "Would be great to swap perspectives sometime.",
  "Happy to share more — no pressure, just thought it might be interesting.",
  "Let me know if you'd like to hear more — happy to make time.",
  "Would love to continue this conversation if you're interested.",
  "I think we'd have a good conversation about this — let me know.",
  "Curious to hear your perspective. Happy to make time whenever suits.",
  "Would welcome the chance to compare notes if you're up for it.",
  "If any of this is relevant to what you're working on, I'd love to chat.",
  "Drop me a line if you'd like to hear more — no pressure either way.",
  "Always happy to share what I'm seeing. Let me know if you'd like to connect.",
  "Would love to grab 20 minutes to swap notes if you're open to it.",
  "If this is on your radar, I'd enjoy hearing how you're thinking about it.",
  "Let me know if you'd find it useful — I'm happy to share.",
  "Would love to hear your take. Happy to jump on a call whenever works.",
  "Curious what you think — let me know if you'd like to dig into this.",
  "I think you'd find some of this interesting. Happy to share over a call.",
  "Would enjoy comparing perspectives — let me know if you have 20 minutes.",
  "Let me know if you're curious — always happy to share what I'm seeing.",
  "Would love to hear how you're thinking about this. I'm around whenever.",
  "If the timing works, I'd enjoy swapping notes on this.",
  "Let me know if any of this lands — happy to go deeper.",
  "I'd welcome the chance to hear your perspective on this.",
  "Would be great to connect on this — let me know what works.",
];

async function gen(prompt: string): Promise<string> {
  const r = await generateText({ model: openai("gpt-4o"), prompt, maxTokens: 600, temperature: 0.75 });
  return r.text;
}

async function main() {
  const content = fs.readFileSync(filePath, "utf-8");
  const parts = content.split(/(?=^## \d+\.)/m);
  const header = parts[0];
  const sections = parts.slice(1);

  console.log(`Processing ${sections.length} prospects...`);
  const output: string[] = [header];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Extract name and context card
    const nameMatch = section.match(/^## \d+\.\s+(.+)/);
    const name = nameMatch ? nameMatch[1].trim() : "Unknown";

    // Find the card (everything before Touch 1)
    const touchStart = section.indexOf("**Touch 1");
    if (touchStart < 0) {
      output.push(section);
      continue;
    }
    const card = section.substring(0, touchStart);

    // Extract key fields from card
    const getField = (label: string): string => {
      const match = card.match(new RegExp(`\\*\\*${label}\\*\\*\\s*\\|\\s*(.*?)\\s*\\|`));
      return match ? match[1].trim() : "";
    };

    const company = getField("Company");
    const title = getField("Title");
    const persona = getField("Persona");
    const delivery = getField("Delivery footprint");
    const connection = getField("LinkedIn connection");
    const hooks = getField("Outreach hooks");
    const isFirstDegree = connection.toLowerCase().includes("1st degree") || connection.toLowerCase().includes("calanthia 1st");
    const cta = CTAs[i % CTAs.length];

    console.log(`[${i + 1}/${sections.length}] ${name} (${persona})`);

    const prompt = `You are writing LinkedIn and email outreach for Calanthia Mei. She is an AI entrepreneur and Strategic Advisor at Dyna.ai. She is a SENIOR EXPERT — she's been in rooms with Teleperformance, Toyota, and major BPO leaders. She is NOT a salesperson. She's warm, confident, generous with insights, and genuinely curious.

PROSPECT: ${name}, ${title} at ${company}
Persona: ${persona}
Delivery: ${delivery}
LinkedIn connection: ${connection}
${isFirstDegree ? "NOTE: Calanthia is ALREADY CONNECTED to this person on LinkedIn. Touch 1 = 'Already connected on LinkedIn — skip to Touch 2.' Touch 2 should feel like a warm reconnection, not a cold message." : ""}

OUTREACH HOOKS (ranked by strength, use #1 first):
${hooks}

WHO IS CALANTHIA (use her credentials to build credibility):
- Serial entrepreneur. Raised $20M as a founder. Helped scale a Stripe-backed fintech to $130M and three exits.
- Former PayPal Ventures investor — invested $250M in global fintech. Former HSBC Investment Banking.
- Georgetown University, Magna Cum Laude. Featured in Forbes, CNBC, NYSE, NASDAQ TV.
- Spoken at nearly 100 events across US, Asia, Europe. Currently building AI agents for contact centres.
- She's NOT a salesperson. She's a serious operator who has been in rooms with Teleperformance, Toyota, and major enterprise BPOs.
- You don't need to mention ALL credentials — pick 1-2 that are most relevant to this person and weave them naturally.

CRITICAL TONE RULES:
- Build FOMO. Use phrases like: "Since I'm meeting with a number of your peers at [event]..." / "Several BPO leaders have been reaching out about their outbound AI strategy — I thought you might also be interested" / "I thought you might be interested in hearing what your peers are doing to evolve"
- Calanthia sounds like a peer sharing insights, NOT a vendor pitching
- NEVER say: "I hope this message finds you well", "explore synergies", "leverage AI", "navigate challenges", "I was thrilled", "I'd love to explore how we might work together", "our solutions", "explore opportunities", "I recently came across"
- NEVER use two case studies in one email — pick ONE or just reference Teleperformance
- Every message should feel like it could ONLY have been sent to this one person. No corporate chat.
- Touch 1: Under 300 chars. "Hey [first name], I spend my days working with BPO leaders on their AI strategy. Great to connect" is the baseline energy. Keep it that simple.
- Touch 2: NO pitch. Build rapport. FOMO. "I'm meeting with BPO leaders at [event] — will you also be there?" / "[Company] has a great reputation for [X] — I thought you'd be interested in hearing what your peers are doing to evolve." 3-5 sentences max.
- Touch 3: Frame as sharing what she's learning. Focus on OUTBOUND AUTOPILOT (telesales, campaigns, outbound calls). Only mention collections if the company explicitly does collections (these companies do collections: Unity Communications, Helpware, Etech, DATAMARK, The Office Gurus, Valor Global). Everyone else = outbound telesales focus.
  - Executive Sponsor: competitive positioning, FOMO, "the biggest BPOs are moving." Teleperformance hook.
  - Operations & Finance Leader: ONE outbound proof point (10K daily calls, 99% accuracy, 4.7% conversion). FOMO. "Several operators I work with are seeing..."
  - Technology Leader: Be the AI leader. Enterprise-grade, battle-tested. "I work with Teleperformance's team on this."
- CTA: Use this specific CTA at the end of Touch 3: "${cta}"
- Sign off: "Warm regards, Calanthia" (Touch 2 and 3)

FORMAT EXACTLY:

**Touch 1 — Connection Request**
${isFirstDegree ? "Already connected on LinkedIn — skip to Touch 2." : "[under 300 chars, lead with the #1 outreach hook]"}

**Touch 2 — LinkedIn Message**
[3-5 sentences. Lead with #1 hook. Warm, conversational. End with a question. No pitch.]

**Touch 3 — Email**
Subject: [subject line — specific to this person, not generic]

[120-150 words. Lead with personalisation. Reference outbound operations. ONE case study max or just Teleperformance. End with the CTA above. "Warm regards, Calanthia"]`;

    try {
      const messaging = await gen(prompt);
      output.push(card + messaging + "\n\n---\n");
    } catch (err) {
      console.error(`  ERROR: ${err}`);
      output.push(section); // keep original if error
    }
  }

  fs.writeFileSync(filePath, output.join(""), "utf-8");
  console.log("\nDone! Final polish complete.");
}

main().catch(console.error);
