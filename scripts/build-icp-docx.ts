/**
 * Builds the ICP & Persona Reference as a Word document for Pages.
 * Output: data/ICP-Reference.docx
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function p(text: string, opts?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; spacingAfter?: number }) {
  return new Paragraph({
    text,
    heading: opts?.heading,
    spacing: opts?.spacingAfter !== undefined ? { after: opts.spacingAfter } : undefined,
  });
}

function boldLabel(label: string, rest: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: rest }),
    ],
  });
}

function tableRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
        width: { size: 28, type: "PCT" },
      }),
      new TableCell({
        children: [new Paragraph({ text: value })],
        width: { size: 72, type: "PCT" },
      }),
    ],
  });
}

function caseStudyRow(caseStudy: string, proofPoints: string, whyResonates: string) {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: caseStudy, bold: true })] })],
        width: { size: 22, type: "PCT" },
      }),
      new TableCell({
        children: [new Paragraph({ text: proofPoints })],
        width: { size: 39, type: "PCT" },
      }),
      new TableCell({
        children: [new Paragraph({ text: whyResonates })],
        width: { size: 39, type: "PCT" },
      }),
    ],
  });
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        p("ICP & Persona Reference", { heading: HeadingLevel.TITLE }),
        p(""),

        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            tableRow("ICP", "US mid-market BPOs, 1,000–5,000 employees, with contact centre operations"),
            tableRow(
              "Three Personas",
              "Executive Sponsor · Operations Leader (+ Finance) · Technology Leader"
            ),
            tableRow(
              "Mid-market BPO pressures",
              "Mid-market BPOs are the most vulnerable to AI disruption: they lack the capital to build their own AI (unlike Teleperformance, who committed $185M to internal AI), but their clients are pushing for lower costs and better service — and competitors who adopt AI will deliver both. They need external AI partners."
            ),
            tableRow(
              "Key differentiator",
              "One of the few companies that can deliver true autopilot at production scale — not copilots, not tools, full execution."
            ),
          ],
        }),
        p(""),
        p(""),

        p("Persona 1: Executive Sponsor", { heading: HeadingLevel.HEADING_1 }),
        p(""),
        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            tableRow(
              "Titles",
              "CEO, Founder, Owner, Chairman, President, Co-Founder & CEO, Managing Partner"
            ),
            tableRow(
              "Role in deal",
              "Economic buyer. Owns capital allocation decisions. Final budget authority. Accountable to board/investors for margin expansion, competitive positioning, and long-term valuation."
            ),
          ],
        }),
        p(""),
        boldLabel("What they care about", ""),
        new Paragraph({ text: "Staying competitive: Clients are pushing for cost reductions and better service quality — BPOs that can't deliver both will lose contracts to those that can." }),
        new Paragraph({ text: "Market positioning: Being seen as AI-forward, not left behind. The industry is moving and standing still is a risk." }),
        new Paragraph({ text: "Client retention: Some clients are starting to evaluate going direct to AI vendors or building their own capabilities, cutting the BPO out entirely." }),
        new Paragraph({ text: "Improving EBITDA: Finding ways to structurally improve margins, not just incremental cost savings." }),
        p(""),
        boldLabel("Their success metrics", "Revenue growth, EBITDA margin, new client acquisition, client retention rate, AI strategy credibility with boards"),
        p(""),
        boldLabel("Core message to them", ""),
        new Paragraph({
          text: "Your clients want higher quality and lower cost — and your competitors are starting to use AI to deliver on that. The BPOs that move to AI autopilot now will win on cost and quality and keep those contracts. We deploy AI autopilot for outbound and inbound operations, allowing you to scale on demand without headcount.",
          shading: { fill: "F2F2F2" },
        }),
        p(""),
        boldLabel("Most relevant case studies", ""),
        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Case Study", bold: true })] })], width: { size: 22, type: "PCT" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proof Points", bold: true })] })], width: { size: 39, type: "PCT" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Why It Resonates", bold: true })] })], width: { size: 39, type: "PCT" } }),
              ],
            }),
            caseStudyRow(
              "Teleperformance / Sands Macau — Hotel booking confirmation",
              "Multi-language AI voice bot deployed through the world's largest BPO for Sands hotel booking confirmations. English, Mandarin, and Cantonese.",
              "Name recognition. If Teleperformance trusts Dyna to run voice AI for a marquee client like Sands, a mid-market CEO takes notice. Establishes enterprise credibility immediately."
            ),
            caseStudyRow(
              "IZZI (Mexican telco) — Telesales upsell",
              "20K records processed. 136 closed sales. 4.7% conversion rate. Fully automated dual-agent model (promotion agent + validation agent). No human intervention during the call.",
              "AI can actually close sales. This isn't just handling service calls — it's driving revenue. CEOs care about top-line growth, and this shows AI autopilot delivering real commercial outcomes."
            ),
            caseStudyRow(
              "Digital Bank Singapore — Collections",
              "Started with 2 voice agents for personal loan and credit card collections. 76% promise-to-pay rate. Expanded from pilot to multi-product deployment within 12 months.",
              "The pilot-to-scale story. Shows the journey a CEO would be signing up for — start small, prove it works, expand across the business. Low risk, high upside."
            ),
          ],
        }),
        p(""),
        p(""),

        p("Persona 2: Operations Leader (+ Finance)", { heading: HeadingLevel.HEADING_1 }),
        p(""),
        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            tableRow(
              "Titles",
              "COO, CFO, VP Operations, SVP Operations, VP Client Services, SVP Client Services, VP of Business Operations, EVP Operations, VP Client Solutions, VP Finance, Regional VP"
            ),
            tableRow(
              "Role in deal",
              "COO = Champion who drives evaluation and owns operational outcome. CFO = Margin holder who validates the business case and approves spend."
            ),
          ],
        }),
        p(""),
        boldLabel("What they care about", ""),
        new Paragraph({ text: "Service quality: Hitting client SLAs and conversion targets." }),
        new Paragraph({ text: "Protecting EBITDA: High margin pressure from labour costs, and scaling revenue is dependent on scaling headcount." }),
        new Paragraph({ text: "Staffing correctly: Overstaffing kills margin, understaffing kills SLAs; constant challenge given high annual attrition (20–30%+ is typical in the industry)." }),
        new Paragraph({ text: "Forecast accuracy: Aligning workforce planning with unpredictable call / outbound volumes." }),
        new Paragraph({ text: "Avoiding operational disruption: Ensuring any new innovation must not jeopardize existing SLAs or client relationships." }),
        p(""),
        boldLabel("Their success metrics", "EBITDA margin (by site, by client, by program), conversion rate (outbound), resolution rate, revenue per seat per year, daily volume capacity and utilisation rate, SLA adherence and client contract renewal rate"),
        p(""),
        boldLabel("Core message to them", ""),
        new Paragraph({
          text: "AI autopilot gives you capacity that doesn't churn, doesn't need ramping and meets SLAs. We deploy fully autonomous agents for outbound and inbound that run 24/7 in multiple languages alongside your existing team. You keep staffing lean, protect your margin and scale on demand without the hiring gamble. Your costs flex with your client's demand.",
          shading: { fill: "F2F2F2" },
        }),
        p(""),
        boldLabel("Most relevant case studies", ""),
        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Case Study", bold: true })] })], width: { size: 22, type: "PCT" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proof Points", bold: true })] })], width: { size: 39, type: "PCT" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Why It Resonates", bold: true })] })], width: { size: 39, type: "PCT" } }),
              ],
            }),
            caseStudyRow(
              "Megacable (Mexican telco) — Package promotion",
              "10K+ daily outbound volume. 99% tagging accuracy. Dual-agent model: promotion agent pitches, validation agent closes. 20K records across two groups.",
              "Volume and accuracy at scale. A COO can directly benchmark this against their own outbound campaigns. 99% tagging accuracy means clean data and reliable reporting — no manual cleanup."
            ),
            caseStudyRow(
              "Viraal (Mexican fintech) — Collections",
              "Collections segmented by DPD bucket: predue (friendly tone), 1-30 days (empathetic), 31-60 (moderately firm), 61-90 (firm), 91+ (very firm). 57 payments recovered. 25% responder rate.",
              "Sophisticated operational design. This isn't a blunt robo-dialer — it's tone-adapted by delinquency stage, exactly how an experienced collections ops leader would design it. Shows deep workflow expertise."
            ),
            caseStudyRow(
              "Digital Bank Singapore — Collections",
              "76% promise-to-pay rate. 40% reach rate. 2-3K daily volume. Compliant with PDPA & MAS guidelines. Singlish tone-safe templates.",
              "Regulated environment, strong results. A COO/CFO running collections needs to know this works in compliance-heavy contexts. The promise-to-pay rate is genuinely strong."
            ),
            caseStudyRow(
              "Airline Saudi Arabia — Flight booking & reschedule",
              "85%+ booking success rate. 4K+ daily volume. 40% labour cost reduction. 1-week MVP delivery.",
              "Inbound proof point with clear cost impact. Shows AI autopilot handles both outbound and inbound, and the 40% labour cost reduction is the kind of number a CFO wants to see."
            ),
          ],
        }),
        p(""),
        p(""),

        p("Persona 3: Technology Leader", { heading: HeadingLevel.HEADING_1 }),
        p(""),
        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            tableRow(
              "Titles",
              "CTO, CIO, VP Technology, VP Engineering, VP Software Engineering, CISO, VP IT, VP Digital Innovation"
            ),
            tableRow(
              "Role in deal",
              "Technical gatekeeper. Blocks or approves based on feasibility, security, and integration."
            ),
          ],
        }),
        p(""),
        boldLabel("What they care about", ""),
        new Paragraph({ text: "Security, data privacy, and compliance: One breach and the company is done. PCI-DSS, HIPAA (depending on clients), state-level regulations." }),
        new Paragraph({ text: "System reliability and uptime: If the phones go down, nothing else matters. This is the baseline expectation." }),
        new Paragraph({ text: "Integration with existing stack: They're running Genesys, Amazon Connect, Zendesk, or similar. Anything new must work with what they have." }),
        new Paragraph({ text: "Total cost of ownership: Limited budget, small team, but expected to deliver innovation. They can't build like Teleperformance." }),
        p(""),
        boldLabel("Their success metrics", "Integration time and deployment speed, uptime and system reliability, security incidents (zero tolerance)"),
        p(""),
        boldLabel("Core message to them", ""),
        new Paragraph({
          text: "Our platform is enterprise-ready — used by the largest contact centres including Teleperformance. Deploy on cloud, on-prem, or hybrid. We run at 95%+ uptime with built-in compliance controls, content guardrails, and full audit trails. Deployments are API-first — integrates via SIP for telephony and API for CRM (Genesys, Cisco, Zendesk, and custom platforms). Secure by design, minimal internal engineering lift.",
          shading: { fill: "F2F2F2" },
        }),
        p(""),
        boldLabel("Most relevant case studies", ""),
        new Table({
          width: { size: 100, type: "PCT" },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Case Study", bold: true })] })], width: { size: 22, type: "PCT" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Proof Points", bold: true })] })], width: { size: 39, type: "PCT" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Why It Resonates", bold: true })] })], width: { size: 39, type: "PCT" } }),
              ],
            }),
            caseStudyRow(
              "HSBC Copilot POC — Knowledge base & agent assist",
              "Head-to-head benchmark vs. a \"global top vendor\": 98.6% factualness (vs. 67.5%), 88.1% helpfulness (vs. 47.6%), 94.1% comprehensiveness (vs. 59.3%). FAQ latency ~0.5 seconds vs. 10-20 seconds.",
              "Concrete benchmark data. CTOs love head-to-head comparisons. This proves Dyna's platform outperforms established competitors on the metrics that matter — accuracy, speed, and reliability."
            ),
            caseStudyRow(
              "Saudi Arabia telco (S-Telco) — AI agent marketplace",
              "Cisco systems integration. Local cloud deployment. Arabic + English language support. Suite of standardised AI agents deployed on telco marketplace. Copilot with script recommendations and 5-category issue tagging.",
              "Enterprise integration proof. Shows the platform works inside complex enterprise infrastructure (Cisco), handles local deployment requirements, and supports multi-language at production scale."
            ),
            caseStudyRow(
              "Digital Bank Singapore — Pilot to expansion",
              "Started with 2 voice agents. Expanded across personal loans and credit cards over 12 months. PDPA & MAS compliant throughout. Continuous script refinement and quality review built in.",
              "Production stability over time. A CTO's nightmare is a system that works in pilot and breaks in production. 12 months of continuous operation and expansion proves this runs reliably at scale."
            ),
          ],
        }),
      ],
    },
  ],
});

async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, "..", "data", "ICP-Reference.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote:", outPath);
}

main().catch(console.error);
