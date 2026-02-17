/**
 * Reformat the outreach doc into clean grid tables.
 * Each prospect gets one table with context + messaging.
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

const output: string[] = [
  "# Personalised Outreach — Cohort 1\n\n",
  "> 28 prospects, ranked by outreach warmth (warmest first)\n\n",
  "---\n\n",
];

for (const section of sections) {
  const lines = section.split("\n");

  // Extract heading
  const nameMatch = lines[0].match(/^## (\d+)\.\s+(.+)/);
  if (!nameMatch) continue;
  const num = nameMatch[1];
  const name = nameMatch[2].trim();

  // Extract fields from table
  const getField = (label: string): string => {
    const line = lines.find(l => l.includes(`**${label}**`));
    if (!line) return "";
    const match = line.match(/\*\*[^*]+\*\*\s*\|\s*(.*?)\s*\|?\s*$/);
    return match ? match[1].trim() : "";
  };

  const company = getField("Company");
  const title = getField("Title");
  const persona = getField("Persona");
  const delivery = getField("Delivery footprint");
  const hooks = getField("Outreach hooks");
  const linkedin = getField("LinkedIn");
  const email = getField("Email");

  // Extract messaging
  const getText = (marker: string, endMarkers: string[]): string => {
    const startIdx = lines.findIndex(l => l.includes(marker));
    if (startIdx < 0) return "";
    const textLines: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (endMarkers.some(m => lines[i].includes(m))) break;
      if (lines[i] === "---") break;
      textLines.push(lines[i]);
    }
    return textLines.join("\n").trim();
  };

  const touch1 = getText("Touch 1", ["Touch 2", "Touch 3"]);
  const touch2 = getText("Touch 2", ["Touch 3"]);
  const touch3 = getText("Touch 3", ["---"]);

  // Clean up hooks — split numbered items onto separate lines
  const hooksCleaned = hooks
    .replace(/\s*(\d+)\.\s*\*\*/g, "\n$1. **")
    .trim();

  // Build the section
  output.push(`## ${num}. ${name}\n\n`);

  // Context card as a simple key-value table
  output.push(`| | |\n`);
  output.push(`|---|---|\n`);
  output.push(`| **Company** | ${company} |\n`);
  output.push(`| **Title** | ${title} |\n`);
  output.push(`| **Persona** | ${persona} |\n`);
  output.push(`| **Delivery** | ${delivery} |\n`);
  output.push(`| **LinkedIn** | ${linkedin} |\n`);
  output.push(`| **Email** | ${email} |\n`);
  output.push(`\n`);

  // Outreach hooks as a separate block
  output.push(`**Outreach hooks:**\n\n`);
  output.push(`${hooksCleaned}\n\n`);

  // Messaging as a 3-column table
  output.push(`| Touch | Channel | Message |\n`);
  output.push(`|---|---|---|\n`);

  // Touch 1
  const t1Clean = touch1.replace(/\n/g, " ").trim();
  output.push(`| **1** | LinkedIn connect | ${t1Clean} |\n`);

  // Touch 2
  const t2Clean = touch2
    .replace(/^Hi /, "")
    .replace(/\nWarm regards,?\s*\n?Calanthia\s*$/i, "")
    .replace(/\nBest,?\s*\n?Calanthia\s*$/i, "")
    .replace(/\nLooking forward.*\n?Calanthia\s*$/i, "")
    .replace(/\n/g, " ")
    .trim();
  output.push(`| **2** | LinkedIn message | ${t2Clean} |\n`);

  // Touch 3
  const t3Lines = touch3.split("\n");
  const subjectLine = t3Lines.find(l => l.startsWith("Subject:"))?.replace("Subject: ", "").trim() || "";
  const t3Body = t3Lines
    .filter(l => !l.startsWith("Subject:") && !l.startsWith("Hi ") || t3Lines.indexOf(l) > 2)
    .join(" ")
    .replace(/\s*Warm regards,?\s*Calanthia\s*$/i, "")
    .replace(/\s*Best,?\s*Calanthia\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  output.push(`| **3** | Email: "${subjectLine}" | ${t3Body} |\n`);

  output.push(`\n---\n\n`);
}

fs.writeFileSync(filePath, output.join(""), "utf-8");
console.log(`Reformatted ${sections.length} prospects into table format`);
