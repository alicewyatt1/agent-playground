/**
 * Builds the ICP & Persona Reference as RTF for Pages.
 * Output: data/ICP-Reference.rtf
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Escape RTF: \ -> \\, { -> \{, } -> \}
// Optional: replace Unicode with \uN? for max compatibility (Pages handles UTF-8 RTF with \ansicpg1252 and \uc1)
function rtfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function par(): string {
  return " \\par\n";
}

function bold(s: string): string {
  return "\\b " + rtfEscape(s) + "\\b0 ";
}

function heading(s: string): string {
  return "\\pard\\sb120\\sa60\\b\\fs28 " + rtfEscape(s) + "\\b0\\fs22\\par\n";
}

function row(label: string, value: string): string {
  return "\\pard\\tx2160 " + bold(label) + rtfEscape(value) + "\\par\n";
}

function bullet(s: string): string {
  return "\\pard\\li720\\tx720 \\bullet  " + rtfEscape(s) + "\\par\n";
}

function blockquote(s: string): string {
  return "\\pard\\li720\\ri720\\sb60\\sa60 " + rtfEscape(s) + "\\par\n";
}

const content = [
  "{\\rtf1\\ansi\\deff0\n",
  "\\pard\\qc\\b\\fs28 ICP & Persona Reference\\b0\\fs22\\par\n",
  "\\par\n",

  row("ICP", "US mid-market BPOs, 1,000-5,000 employees, with contact centre operations"),
  row("Three Personas", "Executive Sponsor \\u183 Operations Leader (+ Finance) \\u183 Technology Leader"),
  row(
    "Mid-market BPO pressures",
    "Mid-market BPOs are the most vulnerable to AI disruption: they lack the capital to build their own AI (unlike Teleperformance, who committed $185M to internal AI), but their clients are pushing for lower costs and better service - and competitors who adopt AI will deliver both. They need external AI partners."
  ),
  row(
    "Key differentiator",
    "One of the few companies that can deliver true autopilot at production scale - not copilots, not tools, full execution."
  ),
  "\\par\n\\par\n",

  heading("Persona 1: Executive Sponsor"),
  "\\par\n",
  row("Titles", "CEO, Founder, Owner, Chairman, President, Co-Founder & CEO, Managing Partner"),
  row(
    "Role in deal",
    "Economic buyer. Owns capital allocation decisions. Final budget authority. Accountable to board/investors for margin expansion, competitive positioning, and long-term valuation."
  ),
  "\\par\n",
  bold("What they care about:") + "\\par\n",
  bullet("Staying competitive: Clients are pushing for cost reductions and better service quality - BPOs that can't deliver both will lose contracts to those that can"),
  bullet("Market positioning: Being seen as AI-forward, not left behind. The industry is moving and standing still is a risk."),
  bullet("Client retention: Some clients are starting to evaluate going direct to AI vendors or building their own capabilities, cutting the BPO out entirely"),
  bullet("Improving EBITDA: Finding ways to structurally improve margins, not just incremental cost savings"),
  "\\par\n",
  row("Their success metrics", "Revenue growth, EBITDA margin, new client acquisition, client retention rate, AI strategy credibility with boards"),
  "\\par\n",
  bold("Core message to them:") + "\\par\n",
  blockquote(
    "Your clients want higher quality and lower cost - and your competitors are starting to use AI to deliver on that. The BPOs that move to AI autopilot now will win on cost and quality and keep those contracts. We deploy AI autopilot for outbound and inbound operations, allowing you to scale on demand without headcount."
  ),
  "\\par\n",
  bold("Most relevant case studies:") + "\\par\n",
  row(
    "Teleperformance / Sands Macau - Hotel booking confirmation",
    "Multi-language AI voice bot deployed through the world's largest BPO for Sands hotel booking confirmations. English, Mandarin, and Cantonese. Name recognition - if Teleperformance trusts Dyna to run voice AI for a marquee client like Sands, a mid-market CEO takes notice."
  ),
  row(
    "IZZI (Mexican telco) - Telesales upsell",
    "20K records processed. 136 closed sales. 4.7% conversion rate. Fully automated dual-agent model. AI can actually close sales - drives revenue."
  ),
  row(
    "Digital Bank Singapore - Collections",
    "Started with 2 voice agents. 76% promise-to-pay rate. Expanded from pilot to multi-product deployment within 12 months. Pilot-to-scale story."
  ),
  "\\par\n\\par\n",

  heading("Persona 2: Operations Leader (+ Finance)"),
  "\\par\n",
  row(
    "Titles",
    "COO, CFO, VP Operations, SVP Operations, VP Client Services, SVP Client Services, VP of Business Operations, EVP Operations, VP Client Solutions, VP Finance, Regional VP"
  ),
  row(
    "Role in deal",
    "COO = Champion who drives evaluation and owns operational outcome. CFO = Margin holder who validates the business case and approves spend."
  ),
  "\\par\n",
  bold("What they care about:") + "\\par\n",
  bullet("Service quality: Hitting client SLAs and conversion targets"),
  bullet("Protecting EBITDA: High margin pressure from labour costs, and scaling revenue is dependent on scaling headcount"),
  bullet("Staffing correctly: Overstaffing kills margin, understaffing kills SLAs; high annual attrition (20-30%+ typical)"),
  bullet("Forecast accuracy: Aligning workforce planning with unpredictable call / outbound volumes"),
  bullet("Avoiding operational disruption: Any new innovation must not jeopardize existing SLAs or client relationships"),
  "\\par\n",
  row(
    "Their success metrics",
    "EBITDA margin (by site, by client, by program), conversion rate (outbound), resolution rate, revenue per seat per year, daily volume capacity and utilisation rate, SLA adherence and client contract renewal rate"
  ),
  "\\par\n",
  bold("Core message to them:") + "\\par\n",
  blockquote(
    "AI autopilot gives you capacity that doesn't churn, doesn't need ramping and meets SLAs. We deploy fully autonomous agents for outbound and inbound that run 24/7 in multiple languages alongside your existing team. You keep staffing lean, protect your margin and scale on demand without the hiring gamble. Your costs flex with your client's demand."
  ),
  "\\par\n",
  bold("Most relevant case studies:") + "\\par\n",
  row("Megacable (Mexican telco) - Package promotion", "10K+ daily outbound volume. 99% tagging accuracy. Dual-agent model. Volume and accuracy at scale."),
  row(
    "Viraal (Mexican fintech) - Collections",
    "Collections segmented by DPD bucket with tone by stage. 57 payments recovered. 25% responder rate. Sophisticated operational design."
  ),
  row(
    "Digital Bank Singapore - Collections",
    "76% promise-to-pay rate. 40% reach rate. 2-3K daily volume. PDPA & MAS compliant. Regulated environment, strong results."
  ),
  row(
    "Airline Saudi Arabia - Flight booking & reschedule",
    "85%+ booking success rate. 4K+ daily volume. 40% labour cost reduction. 1-week MVP delivery. Inbound proof point with clear cost impact."
  ),
  "\\par\n\\par\n",

  heading("Persona 3: Technology Leader"),
  "\\par\n",
  row(
    "Titles",
    "CTO, CIO, VP Technology, VP Engineering, VP Software Engineering, CISO, VP IT, VP Digital Innovation"
  ),
  row("Role in deal", "Technical gatekeeper. Blocks or approves based on feasibility, security, and integration."),
  "\\par\n",
  bold("What they care about:") + "\\par\n",
  bullet("Security, data privacy, and compliance: One breach and the company is done. PCI-DSS, HIPAA, state-level regulations."),
  bullet("System reliability and uptime: If the phones go down, nothing else matters. Baseline expectation."),
  bullet("Integration with existing stack: Genesys, Amazon Connect, Zendesk, or similar. Anything new must work with what they have."),
  bullet("Total cost of ownership: Limited budget, small team, expected to deliver innovation. They can't build like Teleperformance."),
  "\\par\n",
  row("Their success metrics", "Integration time and deployment speed, uptime and system reliability, security incidents (zero tolerance)"),
  "\\par\n",
  bold("Core message to them:") + "\\par\n",
  blockquote(
    "Our platform is enterprise-ready - used by the largest contact centres including Teleperformance. Deploy on cloud, on-prem, or hybrid. We run at 95%+ uptime with built-in compliance controls, content guardrails, and full audit trails. Deployments are API-first - integrates via SIP for telephony and API for CRM (Genesys, Cisco, Zendesk, and custom platforms). Secure by design, minimal internal engineering lift."
  ),
  "\\par\n",
  bold("Most relevant case studies:") + "\\par\n",
  row(
    "HSBC Copilot POC - Knowledge base & agent assist",
    "Head-to-head benchmark vs global top vendor: 98.6% factualness, 88.1% helpfulness, 94.1% comprehensiveness. FAQ latency ~0.5s vs 10-20s. Concrete benchmark data."
  ),
  row(
    "Saudi Arabia telco (S-Telco) - AI agent marketplace",
    "Cisco systems integration. Local cloud deployment. Arabic + English. Suite of AI agents on telco marketplace. Enterprise integration proof."
  ),
  row(
    "Digital Bank Singapore - Pilot to expansion",
    "Started with 2 voice agents. Expanded across personal loans and credit cards over 12 months. PDPA & MAS compliant. Production stability over time."
  ),
  "\\par\n",
  "}",
].join("");

async function main() {
  const outPath = path.join(__dirname, "..", "data", "ICP-Reference.rtf");
  fs.writeFileSync(outPath, content, "utf8");
  console.log("Wrote:", outPath);
}

main().catch(console.error);
