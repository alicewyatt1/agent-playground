"""
Build final outreach doc with approved templates and personalised hooks.
"""
import re

content = open('data/personalised-outreach1.md', 'r').read()

# --- APPROVED TEMPLATES ---

T1_CBAND = "Hi [NAME] — I'm ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. I'll be at CCNG Atlanta on Feb 26, meeting with a few contact centre leaders who are curious about voice AI. Will you be there too?"
T1_EC = "Hi [NAME] — I'm ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. I'll be at Enterprise Connect next month, meeting with a few contact centre leaders who are curious about voice AI. Will you be there too?"
T1_FS = "Hi [NAME] — I'm ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. I'll be at the Frost & Sullivan MindXchange in Fort Lauderdale in April, meeting with a few contact centre leaders who are curious about voice AI. Will you be there too?"
T1_CONNECTED = "Already connected — skip to Touch 2."

T2_TEMPLATE_EVENT = "[Personalise using hooks above]. I'm ex-PayPal Ventures, now building enterprise voice AI for BPOs at Dyna — Teleperformance is already using us. I'll be at [EVENT] meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"
T2_TEMPLATE_CONNECTED = "[Personalise using hooks above]. I'm ex-PayPal Ventures, now building enterprise voice AI for BPOs at Dyna — Teleperformance is already using us. I'll be at [EVENT] meeting with BPO leaders who are automating their outbound and inbound operations. Would be good to catch up there."

EMAIL_EXEC = """[Personalise — use one of the hooks]

For context, I've spent the past decade building and scaling tech companies in Silicon Valley. I was a founding member of PayPal Ventures and later co-founded and grew two tech companies through exit.

I'm now building enterprise voice AI solutions at Dyna to fully automate inbound and outbound contact centre operations.

The executives I am working with are under pressure to improve margin while maintaining service quality, but without the capital or internal AI teams of the largest BPOs.

Dyna is already deployed in high-volume enterprise environments, including Teleperformance.

We deploy enterprise-proven, fully automated AI agents that:
- Run inbound and outbound calls end-to-end
- Scale operations 24/7 with high uptime and accuracy without additional headcount
- Bring proven operational and technical expertise across Telecom, Lending, Insurance, Consumer Goods, Travel, Restaurants, and more use cases
- Tie performance directly to measurable revenue and margin outcomes

[CTA]"""

EMAIL_OPS = """[Personalise — use one of the hooks]

For context, I've spent the last decade founding and scaling technology businesses in Silicon Valley through two exits. I'm now bringing best-in-class enterprise AI solutions at Dyna to improve operational performance and efficiency at call centers.

The Operations leaders I'm working with are trying to hit SLAs and conversion targets while managing high churn, rising labor costs, and unpredictable volumes.

Dyna is already deployed in high-volume enterprise environments, including Teleperformance and delivers:
- Meaningful cost reduction without compromising service quality
- Elastic agent capacity that doesn't churn or require ramp time
- Fully automated voice AI agents running 24/7 with high uptime and accuracy
- Deep operational expertise across Telecom, Lending, Insurance, Consumer Goods, Travel, Restaurants, and other high-volume industry use cases

[CTA]"""

EMAIL_TECH = """[Personalise — use one of the hooks]

I've spent the last decade founding and scaling technology businesses in Silicon Valley through two exits. I'm now bringing best-in-class enterprise AI solutions at Dyna to automate call center operations at production scale.

Our voice AI solutions have already been deployed in high-volume enterprise environments — including with Teleperformance — across Telecom, Lending, Insurance, Consumer Goods, Travel and Restaurant industries. We handle millions of interactions while maintaining enterprise-grade security, reliability and uptime.

Tech leaders are working with us when they want:
- Enterprise-grade AI solutions designed and deployed by dedicated industry experts — no internal AI team required
- Multi-agent orchestration across voice and text, inbound and outbound use cases
- Flexible deployment (SaaS, private cloud, or on-prem) aligned to security and data residency requirements

[CTA]"""

CTA_CBAND = "I'll be at the CCNG event in Atlanta on Feb 26 meeting with a number of BPO leaders. Would you be interested in meeting there?"
CTA_EC = "I'll be at Enterprise Connect in Las Vegas next month. Would you be interested in meeting there?"
CTA_FS = "I'll be at the Frost & Sullivan MindXchange in Fort Lauderdale in April. Would you be interested in meeting there?"

EVENT_LINE_CBAND = "I'll be at CCNG Atlanta on Feb 26 meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"
EVENT_LINE_EC = "I'll be at Enterprise Connect next month meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"
EVENT_LINE_FS = "I'll be at the Frost & Sullivan MindXchange in Fort Lauderdale in April meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"

# --- PROSPECT DATA ---
# name, first_name, persona, event, is_1st_degree, custom_t1, custom_t2

prospects = {
    "Jim Iyoob": {
        "first": "Jim", "persona": "exec", "event": "EC", "connected": True,
        "t1": None,  # already connected
        "t2": "Jim — I noticed you're keynoting on 'Leadership Readiness in the Age of AI' at the Call Center Campus Symposium. That's the central question I'm working on with BPO leaders right now — what leadership actually looks like when AI handles the execution layer. I'm building voice AI for BPOs at Dyna (Teleperformance is already using us). I'll be at Enterprise Connect next month meeting with several BPO leaders on this. Will you be there?",
    },
    "Benjamin Alpert": {
        "first": "Benjamin", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": "Hi Benjamin — I saw your Customer Connect Expo session on balancing AI and human agents. I'm working on exactly this problem with BPOs at Dyna. Would love to connect.",
        "t2": "Benjamin — your Customer Connect Expo session on AI and human agents covered exactly what I'm working on at Dyna. We're deploying fully automated voice AI for BPOs — Teleperformance is already using us — and the question of how AI and humans work together in production is central. I'll be at CCNG Atlanta on Feb 26 meeting with several BPO leaders on this. Will you be there?",
    },
    "Matt Rocco": {
        "first": "Matt", "persona": "exec", "event": "EC", "connected": False,
        "t1": None, "t2": None,
    },
    "David Kreiss": {
        "first": "David", "persona": "exec", "event": "CBAND", "connected": True,
        "t1": None, "t2": None,
    },
    "Greg Alcorn": {
        "first": "Greg", "persona": "exec", "event": "CBAND", "connected": True,
        "t1": None, "t2": None,
    },
    "Bill Randag": {
        "first": "Bill", "persona": "exec", "event": "EC", "connected": True,
        "t1": None, "t2": None,
    },
    "Ali Karim": {
        "first": "Ali", "persona": "ops", "event": "FS", "connected": False,
        "t1": "Hi Ali — I saw you're presenting 'AI That Works' at the Frost & Sullivan MindXchange in April. I'm working on the same problem with BPOs at Dyna. Would love to connect.",
        "t2": "Ali — your Frost & Sullivan session on 'AI That Works: Inside the Customer and Employee Experience' is directly relevant to what I'm building at Dyna. We deploy fully automated voice AI for BPOs — Teleperformance is already using us. I'll be at the same event in Fort Lauderdale. Would be good to compare notes there.",
    },
    "Liliana Lopez": {
        "first": "Liliana", "persona": "tech", "event": "EC", "connected": False,
        "t1": "Hi Liliana — your work on operationalizing AI at Liveops (moving from 'promising' to 'proven') is exactly the problem I'm solving at Dyna. Would love to connect.",
        "t2": "Liliana — your CCW Orlando workshop on operationalizing AI covered the exact gap I see every day: most BPOs have piloted AI but can't get it into production reliably. That's what we've built at Dyna — fully automated voice AI, already running for Teleperformance. I'll be at Enterprise Connect next month meeting with several BPO leaders on this. Will you be there?",
    },
    "Nanette Harrell": {
        "first": "Nanette", "persona": "exec", "event": "CBAND", "connected": True,
        "t1": None, "t2": None,
    },
    "Dominic Leide": {
        "first": "Dominic", "persona": "exec", "event": "CBAND", "connected": True,
        "t1": None, "t2": None,
    },
    "Kenneth Loggins": {
        "first": "Kenneth", "persona": "ops", "event": "CBAND", "connected": True,
        "t1": None, "t2": None,
    },
    "Brian Flaherty": {
        "first": "Brian", "persona": "exec", "event": "CBAND", "connected": False,
        "t1": "Hi Brian — your Mortgage AI conference session on managing the AI/human balance is the central question in BPO right now. I'm working on this at Dyna. Would love to connect.",
        "t2": "Brian — your upcoming session on 'Staff vs AI vs Virtual Assistants' at the Mortgage AI conference is exactly what I'm working through with BPO leaders at Dyna. We deploy fully automated voice AI — Teleperformance is already using us — and that balance between AI and human agents is the key design decision. I'll be at CCNG Atlanta on Feb 26. Will you be there?",
    },
    "Bill Trocano": {
        "first": "Bill", "persona": "ops", "event": "EC", "connected": False,
        "t1": None, "t2": None,
    },
    "Pablo Paz Hernandez": {
        "first": "Pablo", "persona": "exec", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Amanda Jones": {
        "first": "Amanda", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Donny Jackson": {
        "first": "Donny", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "John Yanez": {
        "first": "John", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Ken Braatz": {
        "first": "Ken", "persona": "tech", "event": "CBAND", "connected": False,
        "t1": "Hi Ken — NinjaAI reviewing 100% of interactions (vs the traditional 2-5%) is the kind of practical AI deployment that actually moves the needle. I'm building something similar for voice at Dyna. Would love to connect.",
        "t2": "Ken — the NinjaAI QA suite is a serious step forward. I'm working on the same principle at Dyna but for fully automated voice — deploying AI that handles entire calls end-to-end, not just assists agents. Teleperformance is already using us. I'll be at CCNG Atlanta on Feb 26 meeting with several BPO technology leaders. Will you be there?",
    },
    "Youssef Hannat": {
        "first": "Youssef", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "James Nelson": {
        "first": "James", "persona": "ops", "event": "EC", "connected": False,
        "t1": None, "t2": None,
    },
    "Bryan Overcash": {
        "first": "Bryan", "persona": "exec", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Erika Garcia": {
        "first": "Erika", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Keith Hansen": {
        "first": "Keith", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Mark D'Angola": {
        "first": "Mark", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Nitesh Kumar": {
        "first": "Nitesh", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Rob Porges": {
        "first": "Rob", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Cathy Sexton": {
        "first": "Cathy", "persona": "ops", "event": "CBAND", "connected": False,
        "t1": None, "t2": None,
    },
    "Aaron Brooks": {
        "first": "Aaron", "persona": "tech", "event": "EC", "connected": False,
        "t1": None, "t2": None,
    },
}

# --- BUILD ---
parts = re.split(r'(## \d+\. .+)', content)
header = parts[0]
output = [header]

for i in range(1, len(parts), 2):
    heading = parts[i]
    body = parts[i+1] if i+1 < len(parts) else ""
    
    name_match = re.match(r'## \d+\. (.+)', heading)
    if not name_match:
        output.append(heading + body)
        continue
    
    name = name_match.group(1).strip()
    p = prospects.get(name)
    if not p:
        output.append(heading + body)
        continue
    
    first = p["first"]
    event = p["event"]
    persona = p["persona"]
    connected = p["connected"]
    
    # Determine event-specific content
    if event == "CBAND":
        default_t1 = T1_CBAND.replace("[NAME]", first)
        cta = CTA_CBAND
        event_line = EVENT_LINE_CBAND
    elif event == "EC":
        default_t1 = T1_EC.replace("[NAME]", first)
        cta = CTA_EC
        event_line = EVENT_LINE_EC
    else:
        default_t1 = T1_FS.replace("[NAME]", first)
        cta = CTA_FS
        event_line = EVENT_LINE_FS
    
    # Touch 1
    if connected:
        t1 = T1_CONNECTED
    elif p["t1"]:
        t1 = p["t1"]
    else:
        t1 = default_t1
    
    # Touch 2
    if p["t2"]:
        t2 = p["t2"]
    elif connected:
        t2 = T2_TEMPLATE_CONNECTED.replace("[EVENT]", 
            "CCNG Atlanta on Feb 26" if event == "CBAND" else 
            "Enterprise Connect next month" if event == "EC" else
            "the Frost & Sullivan MindXchange in Fort Lauderdale in April")
    else:
        t2 = T2_TEMPLATE_EVENT.replace("[EVENT]",
            "CCNG Atlanta on Feb 26" if event == "CBAND" else
            "Enterprise Connect next month" if event == "EC" else
            "the Frost & Sullivan MindXchange in Fort Lauderdale in April")
    
    # Touch 3
    if persona == "exec":
        email = EMAIL_EXEC
    elif persona == "tech":
        email = EMAIL_TECH
    else:
        email = EMAIL_OPS
    email = email.replace("[CTA]", cta)
    
    # Extract context card (everything before the messaging table)
    table_start = body.find("| Touch |")
    if table_start >= 0:
        card = body[:table_start]
    else:
        card = body
    
    # Build new section
    new_body = card
    new_body += "| Touch | Channel | Message |\n"
    new_body += "|---|---|---|\n"
    new_body += f"| **1** | LinkedIn connect | {t1} |\n"
    new_body += f"| **2** | LinkedIn message | {t2} |\n"
    new_body += f"| **3** | Email | {email} |\n"
    new_body += "\n---\n"
    
    output.append(heading + new_body)

result = ''.join(output)
open('data/personalised-outreach1.md', 'w').write(result)
print(f"Done — {len(prospects)} prospects populated")
