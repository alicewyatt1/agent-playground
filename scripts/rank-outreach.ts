/**
 * Ranks prospects by outreach hook warmth and reorders the document.
 * Also flags where messaging needs to lead with a different hook.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "data", "personalised-outreach.md");
const content = fs.readFileSync(filePath, "utf-8");

const parts = content.split(/(?=^## \d+\.)/m);
const header = parts[0];
const sections = parts.slice(1);

interface Prospect {
  name: string;
  section: string;
  score: number;
  tier: string;
  reason: string;
}

function scoreSection(section: string): Prospect {
  const nameMatch = section.match(/^## \d+\.\s+(.+)/);
  const name = nameMatch ? nameMatch[1].trim() : "Unknown";
  const hooks = section.match(/\*\*Outreach hooks\*\*\s*\|(.*?)\|/)?.[1] || "";
  const hooksLower = hooks.toLowerCase();
  const connField = section.match(/\*\*LinkedIn connection\*\*\s*\|(.*?)\|/)?.[1] || "";

  let score = 0;
  let tier = "D";
  const reasons: string[] = [];

  // Confirmed speaker/event involvement
  if (hooksLower.includes("confirmed speaker") || hooksLower.includes("co-led") || hooksLower.includes("co-presented")) {
    score += 40;
    reasons.push("Confirmed speaker/event");
  }
  if (hooksLower.includes("speaking/event") && !hooksLower.includes("confirmed speaker") && !hooksLower.includes("co-led") && !hooksLower.includes("co-presented")) {
    score += 30;
    reasons.push("Speaking at event");
  }

  // 1st degree connection
  if (connField.toLowerCase().includes("1st degree") || connField.toLowerCase().includes("calanthia 1st")) {
    score += 25;
    reasons.push("1st degree connection");
  }

  // 2nd degree connection
  if (connField.toLowerCase().includes("2nd degree")) {
    score += 10;
    reasons.push("2nd degree connection");
  }

  // Strong personal insight (award, published content, specific achievement)
  if (hooksLower.includes("award") || hooksLower.includes("published") || hooksLower.includes("authored") ||
      hooksLower.includes("launched") || hooksLower.includes("2,500%") || hooksLower.includes("apseed") ||
      hooksLower.includes("logixassist") || hooksLower.includes("ninjaai") || hooksLower.includes("promoted") ||
      hooksLower.includes("expansion") || hooksLower.includes("clutch") || hooksLower.includes("new president")) {
    score += 15;
    reasons.push("Strong personal/company insight");
  }

  // Company is event-active (sponsor)
  if (hooksLower.includes("sponsor") || hooksLower.includes("confirmed at ccw") || hooksLower.includes("booth")) {
    score += 10;
    reasons.push("Company event-active");
  }

  // Near event only (weakest)
  if (reasons.length === 0 && hooksLower.includes("near event")) {
    score += 3;
    reasons.push("Near event only");
  }

  // Assign tier
  if (score >= 40) tier = "A";
  else if (score >= 25) tier = "B";
  else if (score >= 15) tier = "C";
  else tier = "D";

  return { name, section, score, tier, reason: reasons.join(" + ") || "Location only" };
}

const prospects = sections.map(scoreSection);
prospects.sort((a, b) => b.score - a.score);

// Renumber and rebuild
const output: string[] = [
  header.replace(/Total prospects: \d+.*/, `Total prospects: ${prospects.length} — ranked by outreach warmth (warmest first)`)
];

for (let i = 0; i < prospects.length; i++) {
  const p = prospects[i];
  // Replace old number with new
  const renumbered = p.section.replace(/^## \d+\./, `## ${i + 1}.`);
  output.push(renumbered);
}

fs.writeFileSync(filePath, output.join(""), "utf-8");

console.log("Ranked prospects:\n");
for (let i = 0; i < prospects.length; i++) {
  const p = prospects[i];
  console.log(`${i + 1}. [Tier ${p.tier}, score ${p.score}] ${p.name} — ${p.reason}`);
}
