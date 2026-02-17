/**
 * Regenerate messaging for 1st degree connections and misaligned hooks.
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

async function gen(prompt: string): Promise<string> {
  const r = await generateText({ model: openai("gpt-4o"), prompt, maxTokens: 600, temperature: 0.7 });
  return r.text;
}

interface Fix {
  name: string;
  isFirstDegree: boolean;
  prompt: string;
}

const fixes: Fix[] = [
  {
    name: "Jim Iyoob",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to Jim Iyoob (President, ETSLabs at Etech Global Services). He is a confirmed speaker at the Conversational AI Summit (Apr 9), CCW Las Vegas (Jun 22-25), and Call Center Campus Symposium. Etech is at CCW LV Booth #1404.

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Direct LinkedIn message as a warm reconnection. Lead with his speaking engagements — "I noticed you're speaking at the Conversational AI Summit next month — I'd love to hear your perspective." 3-5 sentences.
Touch 3: Email. Executive Sponsor persona. Lead with his speaking work, then Teleperformance hook. 120-160 words. End with "Warm regards, Calanthia".`
  },
  {
    name: "David Kreiss",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to David Kreiss (Founder, President, CEO of KM² Solutions). Also Calanthia 2nd degree to Karla M. Cosgalla. David is leading massive Caribbean expansion — 1,250 new jobs, 6,500+ employees, new Grenada and Saint Lucia facilities. Offshore-heavy (nearshore + offshore). Near CBAND Atlanta (Boca Raton, FL).

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Warm reconnection. Lead with the Caribbean expansion — "The growth you're driving in Grenada and Saint Lucia is incredible — 1,250 new jobs is no small feat." Then ask about CBAND Atlanta. 3-5 sentences.
Touch 3: Email. Executive Sponsor persona. Acknowledge the expansion, then Teleperformance hook. AI protects your position and scales beyond labour arbitrage. 120-160 words. End with "Warm regards, Calanthia".`
  },
  {
    name: "Greg Alcorn",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to Greg Alcorn (Founder and CEO, Global Contact Service International, Salisbury NC). Also Alice 2nd degree (Mark Escueta), Calanthia 2nd degree (Ian Harriman, Aaron Anderson). Greg founded ApSeed nonprofit (25,000+ pre-K tablets, 131% literacy improvement). Former NC Board of Education. Onshore-heavy. Near CBAND Atlanta.

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Warm reconnection. Lead with ApSeed — "The impact ApSeed is having on early childhood literacy is remarkable — 25,000 children across multiple states." Then pivot to what she's seeing with BPO leaders. Ask about CBAND Atlanta. 3-5 sentences.
Touch 3: Email. Executive Sponsor persona. Onshore-heavy means thin margins. Teleperformance hook. 120-160 words. End with "Warm regards, Calanthia".`
  },
  {
    name: "Bill Randag",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to Bill Randag (President, DATAMARK Inc.). Also Alice 2nd degree (Brandon Pfluger, Gabriel Pike), Calanthia 2nd degree (Aaron Anderson). DATAMARK is a featured sponsor at both Frost & Sullivan MindXchange East (Fort Lauderdale, Apr 12-15) and West (Tucson, Oct 18-21). 35+ years, 4,600+ employees. Mixed delivery.

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Warm reconnection. Lead with DATAMARK's Frost & Sullivan presence — "I noticed DATAMARK is sponsoring both Frost & Sullivan events this year — impressive commitment." Ask about Enterprise Connect. 3-5 sentences.
Touch 3: Email. Executive Sponsor persona. Teleperformance hook. Multi-industry coverage. 120-160 words. End with "Warm regards, Calanthia".`
  },
  {
    name: "Nanette Harrell",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to Nanette Harrell (President, Helpware). Helpware named Clutch Top 100 Fastest-Growing 2025. Expanded to Poland, Albania, Puerto Rico, Guam, Uganda. Acquired Unicsoft, launched Helpware Tech. 18 locations across 4 continents. Asheville, NC. Mixed delivery. Near CBAND Atlanta.

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Warm reconnection. Lead with Clutch Top 100 — "Congratulations on the Clutch Top 100 recognition — and the expansion into Uganda and Guam is bold." Then mention what she's learning from BPO leaders about AI. Ask about CBAND Atlanta. 3-5 sentences.
Touch 3: Email. Executive Sponsor persona. Teleperformance hook. AI as third delivery tier for mixed delivery. 120-160 words. End with "Warm regards, Calanthia".`
  },
  {
    name: "Dominic Leide",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to Dominic Leide (President, The Office Gurus). Also Alice 2nd degree (Dave Zimmerman, Alan Bowman), Calanthia 2nd degree (Aaron Anderson). Office Gurus has mixed delivery (onshore + nearshore). Tampa, FL. Near CBAND Atlanta. Office Gurus confirmed attending CCW LV (Jun 22-25). Parent company SGC on NASDAQ.

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Warm reconnection. Reference The Office Gurus' work. Ask about CBAND Atlanta. 3-5 sentences.
Touch 3: Email. Executive Sponsor persona. Teleperformance hook. AI as third delivery tier for mixed delivery. 120-160 words. End with "Warm regards, Calanthia".`
  },
  {
    name: "Kenneth Loggins",
    isFirstDegree: true,
    prompt: `Calanthia is ALREADY CONNECTED on LinkedIn to Kenneth Loggins (VP Shared Services, Focus Services). Also Calanthia 2nd degree (Aaron Anderson). Kenneth led the grand opening of a new Focus Services call center in NC (former Concentrix, 350 seats, ~550 jobs). Focus expanding to South Africa. Mixed delivery (onshore + nearshore). Jacksonville, NC. Near CBAND Atlanta.

Touch 1: NOT NEEDED — already connected. Write "Already connected on LinkedIn — skip to Touch 2."
Touch 2: Warm reconnection. Lead with the NC call center opening — "The NC expansion creating 550 jobs is impressive — and I hear you're heading into South Africa next." Ask about CBAND Atlanta. 3-5 sentences.
Touch 3: Email. Operations & Finance persona. Reducing labor costs, expanding capacity. Teleperformance hook. 120-160 words. End with "Warm regards, Calanthia".`
  },
];

async function main() {
  const content = fs.readFileSync(filePath, "utf-8");
  let updated = content;

  for (const fix of fixes) {
    console.log(`Generating: ${fix.name}`);
    const fullPrompt = `You are writing LinkedIn and email outreach for Calanthia Mei, an AI entrepreneur and Strategic Advisor at Dyna.ai. She is an EXPERT who spends her days with BPO leaders. Warm, confident, generous. Sign off "Warm regards, Calanthia".

${fix.prompt}

Format EXACTLY:
**Touch 1 — Connection Request**
[message or "Already connected on LinkedIn — skip to Touch 2."]

**Touch 2 — LinkedIn Message**
[message]

**Touch 3 — Email**
Subject: [subject]

[body]`;

    const messaging = await gen(fullPrompt);

    // Find the person's section and replace their messaging
    const sectionRegex = new RegExp(`(## \\d+\\. ${fix.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)\\*\\*Touch 1[\\s\\S]*?(?=\\n---)`);
    const match = updated.match(sectionRegex);
    if (match) {
      const cardPart = match[1];
      updated = updated.replace(match[0], cardPart + messaging);
      console.log(`  ✓ Updated ${fix.name}`);
    } else {
      console.log(`  ✗ Could not find section for ${fix.name}`);
    }
  }

  fs.writeFileSync(filePath, updated, "utf-8");
  console.log("\nDone!");
}

main().catch(console.error);
