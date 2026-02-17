/**
 * Reformats the personalised outreach doc:
 * - Removes "Active on LinkedIn" and "Client industries" fields
 * - Merges Event, Icebreaker into ranked "Outreach hooks" field
 * - Reorders fields for clarity
 */
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { config } from "dotenv";
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "data", "personalised-outreach.md");
const content = fs.readFileSync(filePath, "utf-8");

const sections = content.split(/(?=^## \d+\.)/m);
const header = sections[0];
const prospects = sections.slice(1);

const output: string[] = [header];

for (const section of prospects) {
  const lines = section.split("\n");

  // Extract fields from the table
  const getField = (label: string): string => {
    const line = lines.find(l => l.includes(`**${label}**`));
    if (!line) return "";
    const match = line.match(/\*\*[^*]+\*\*\s*\|\s*(.*?)\s*\|?\s*$/);
    return match ? match[1].trim() : "";
  };

  const heading = lines[0]; // ## N. Name
  const company = getField("Company");
  const title = getField("Title");
  const persona = getField("Persona");
  const linkedinConn = getField("LinkedIn connection");
  const event = getField("Event");
  const deliveryFootprint = getField("Delivery footprint");
  const icebreaker = getField("Icebreaker");
  const location = getField("Location");
  const linkedin = getField("LinkedIn");
  const email = getField("Email");

  // Build ranked outreach hooks
  const hooks: string[] = [];

  // 1. Confirmed speaking/event involvement (from icebreaker text)
  const iceLower = icebreaker.toLowerCase();
  if (iceLower.includes("confirmed speaker") || iceLower.includes("co-led") || iceLower.includes("speaking at") || iceLower.includes("co-presented") || iceLower.includes("workshop")) {
    // Extract the speaking bit
    const speakingMatch = icebreaker.match(/(CONFIRMED SPEAKER[^.]+\.|Co-led[^.]+\.|Speaking at[^.]+\.|Co-presented[^.]+\.)/i);
    if (speakingMatch) {
      hooks.push(`**Speaking/event:** ${speakingMatch[1].trim()}`);
    }
  }

  // 2. Mutual connections
  if (linkedinConn && linkedinConn !== "None") {
    hooks.push(`**Mutual connection:** ${linkedinConn}`);
  }

  // 3. LinkedIn activity / published content / company news from icebreaker
  // Filter out the speaking bit we already extracted and any event-proximity info
  let remainingIcebreaker = icebreaker;
  // Remove the speaking match if we already used it
  if (hooks.length > 0 && hooks[0].startsWith("**Speaking")) {
    const speakingMatch = icebreaker.match(/(CONFIRMED SPEAKER[^.]+\.|Co-led[^.]+\.|Speaking at[^.]+\.|Co-presented[^.]+\.)/i);
    if (speakingMatch) {
      remainingIcebreaker = icebreaker.replace(speakingMatch[0], "").trim();
    }
  }
  // Clean up leading "Also" or similar
  remainingIcebreaker = remainingIcebreaker.replace(/^Also\s+/i, "").trim();

  if (remainingIcebreaker.length > 10) {
    hooks.push(`**Insight:** ${remainingIcebreaker}`);
  }

  // 4. Near upcoming event (weakest hook)
  if (event.includes("CBAND")) {
    hooks.push(`**Near event:** Based in ${location} — could attend CBAND Atlanta (Feb 26).`);
  } else if (event.includes("Enterprise Connect")) {
    hooks.push(`**Near event:** Enterprise Connect (Mar 10-12, Las Vegas) as conversation starter.`);
  }

  const hooksStr = hooks.length > 0
    ? hooks.map((h, i) => `${i + 1}. ${h}`).join(" ")
    : "(No hooks found)";

  // Find the messaging part (Touch 1, 2, 3)
  const touchStart = lines.findIndex(l => l.startsWith("**Touch 1"));
  const messagingLines = touchStart >= 0 ? lines.slice(touchStart) : [];

  // Build new section
  const newSection = [
    heading,
    "",
    "| | |",
    "|---|---|",
    `| **Company** | ${company} |`,
    `| **Title** | ${title} |`,
    `| **Persona** | ${persona} |`,
    `| **Delivery footprint** | ${deliveryFootprint} |`,
    `| **LinkedIn connection** | ${linkedinConn} |`,
    `| **Outreach hooks** | ${hooksStr} |`,
    `| **LinkedIn** | ${linkedin} |`,
    `| **Email** | ${email} |`,
    "",
    ...messagingLines,
  ].join("\n");

  output.push(newSection);
}

const result = output.join("");
fs.writeFileSync(filePath, result, "utf-8");
console.log("Done! Reformatted", prospects.length, "prospects");
