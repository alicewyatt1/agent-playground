import { config } from "dotenv";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
config();

async function gen(prompt: string) {
  const result = await generateText({
    model: openai("gpt-4o"),
    prompt,
    maxTokens: 800,
    temperature: 0.7,
  });
  return result.text;
}

async function main() {
  const james = await gen(`You are writing LinkedIn and email outreach for Calanthia Mei, an AI entrepreneur and Strategic Advisor at Dyna.ai. She is an EXPERT who spends her days with BPO leaders like Teleperformance. Warm, confident, generous.

PROSPECT: James Nelson, Executive Director of Operations at Percepta (TTEC/Ford JV, ~4,000 employees, automotive CX). Houston, TX. Percepta just named Thomas Monaghan as new President (Feb 2026) — new leadership, potential new priorities. Previously COO at District Photo Inc.
Persona: Operations & Finance Leader. Delivery: Onshore-heavy. Event: Enterprise Connect (Mar 10-12).

RULES:
- Touch 1: Under 300 chars. No Dyna mention. Peer connecting with peer.
- Touch 2: 3-5 sentences. No pitch. Calanthia as expert sharing insights. End with question.
- Touch 3: 120-160 words. Lead with reducing labor costs, expanding capacity. Teleperformance hook. Include proof points (10K daily calls 99% accuracy, 76% promise-to-pay, 40% cost reduction). End with "Warm regards, Calanthia"

Format EXACTLY:
**Touch 1 — Connection Request**
[message]

**Touch 2 — LinkedIn Message**
[message]

**Touch 3 — Email**
Subject: [subject]

[body ending with "Warm regards, Calanthia"]`);

  console.log("===JAMES===");
  console.log(james);

  const cathy = await gen(`You are writing LinkedIn and email outreach for Calanthia Mei, an AI entrepreneur and Strategic Advisor at Dyna.ai. She is an EXPERT who spends her days with BPO leaders like Teleperformance. Warm, confident, generous.

PROSPECT: Cathy Sexton, SVP Financial Services at Harte Hanks. Salisbury, NC. 45+ years in direct marketing and financial services. At Harte Hanks since 2007. Catawba College alumna. Harte Hanks is publicly traded, with contact center operations in Texas and UK. Financial services, healthcare, technology clients.
Persona: Operations & Finance Leader. Delivery: Mixed (onshore + offshore). Event: CBAND Atlanta (Feb 26).

RULES:
- Touch 1: Under 300 chars. No Dyna mention. Peer connecting with peer.
- Touch 2: 3-5 sentences. No pitch. Calanthia as expert sharing insights. End with question about CBAND Atlanta event.
- Touch 3: 120-160 words. Lead with reducing labor costs, expanding capacity. Teleperformance hook. Financial services case study (digital bank Singapore 76% promise-to-pay). AI as third delivery tier. End with "Warm regards, Calanthia"

Format EXACTLY:
**Touch 1 — Connection Request**
[message]

**Touch 2 — LinkedIn Message**
[message]

**Touch 3 — Email**
Subject: [subject]

[body ending with "Warm regards, Calanthia"]`);

  console.log("===CATHY===");
  console.log(cathy);
}

main().catch(console.error);
