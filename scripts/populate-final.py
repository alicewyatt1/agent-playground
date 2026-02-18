"""
Populate all 28 prospects with finalised messaging templates.
Touch 1: Event-specific connection request
Touch 2: Personalised hook + credibility + event line
Touch 3: Persona-specific email template with hook and CTA
"""
import re

content = open('data/personalised-outreach1.md', 'r').read()

# --- TEMPLATES ---

# Touch 1 variants
T1_CBAND = 'Hi [Name] — I\'m ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. I\'ll be at CCNG Atlanta on Feb 26 speaking with contact centre leaders who are exploring fully automated voice operations. Will you be there?'
T1_EC = 'Hi [Name] — I\'m ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. I\'ll be at Enterprise Connect next month speaking with contact centre leaders who are exploring fully automated voice operations. Will you be there?'
T1_FS = 'Hi [Name] — I\'m ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. I\'ll be at the Frost & Sullivan MindXchange in Fort Lauderdale in April speaking with contact centre leaders who are exploring fully automated voice operations. Will you be there?'
T1_UNIVERSAL = 'Hi [Name] — I\'m ex-PayPal Ventures and now building voice AI solutions for BPOs at Dyna. Teleperformance is already using us. Would love to connect.'
T1_ALREADY = 'Already connected — skip to Touch 2.'

# Touch 3 email templates
EMAIL_EXEC = """[HOOK]

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

EMAIL_OPS = """[HOOK]

For context, I've spent the last decade founding and scaling technology businesses in Silicon Valley through two exits. I'm now bringing best-in-class enterprise AI solutions at Dyna to improve operational performance and efficiency at call centers.

The Operations leaders I'm working with are trying to hit SLAs and conversion targets while managing high churn, rising labor costs, and unpredictable volumes.

Dyna is already deployed in high-volume enterprise environments, including Teleperformance and delivers:
- Meaningful cost reduction without compromising service quality
- Elastic agent capacity that doesn't churn or require ramp time
- Fully automated voice AI agents running 24/7 with high uptime and accuracy
- Deep operational expertise across Telecom, Lending, Insurance, Consumer Goods, Travel, Restaurants, and other high-volume industry use cases

[CTA]"""

EMAIL_TECH = """[HOOK]

I've spent the last decade founding and scaling technology businesses in Silicon Valley through two exits. I'm now bringing best-in-class enterprise AI solutions at Dyna to automate call center operations at production scale.

Our voice AI solutions have already been deployed in high-volume enterprise environments — including with Teleperformance — across Telecom, Lending, Insurance, Consumer Goods, Travel and Restaurant industries. We handle millions of interactions while maintaining enterprise-grade security, reliability and uptime.

Tech leaders are working with us when they want:
- Enterprise-grade AI solutions designed and deployed by dedicated industry experts — no internal AI team required
- Multi-agent orchestration across voice and text, inbound and outbound use cases
- Flexible deployment (SaaS, private cloud, or on-prem) aligned to security and data residency requirements

[CTA]"""

# CTA variants
CTA_CBAND = "I'll be at the CCNG event in Atlanta on Feb 26 meeting with a number of BPO leaders. Would you be interested in meeting there?"
CTA_EC = "I'll be at Enterprise Connect in Las Vegas next month meeting with a number of BPO leaders. Would a short conversation be useful?"
CTA_FS = "I'll be at the Frost & Sullivan MindXchange in Fort Lauderdale in April. Would you be interested in meeting there?"
CTA_GENERIC = "A number of mid-market BPO leaders have been exploring this recently. Would a short overview be useful?"

# --- PROSPECT DATA ---
# (name, persona, event, is_first_degree, hook_for_touch2, hook_for_email)

prospects = [
    ("Jim Iyoob", "Executive Sponsor", "EC", True,
     "I saw you're keynoting on 'Leadership Readiness in the Age of AI' at the Call Center Campus Symposium — that's the exact conversation I'm having with BPO leaders right now.",
     "I saw you're keynoting on 'Leadership Readiness in the Age of AI' — that's exactly the question every BPO leader I'm working with is grappling with."),
    ("Benjamin Alpert", "Operations & Finance Leader", "CBAND", False,
     "Your Customer Connect Expo presentation on balancing AI and human agents was spot on — it's the same conversation I'm having with operators every day.",
     "Your Customer Connect Expo presentation on balancing AI and human agents resonated — it's exactly the conversation I'm having with BPO operations leaders right now."),
    ("Matt Rocco", "Executive Sponsor", "EC", False,
     "I see Etech is all over the conference circuit this year — CCW, the Conversational AI Summit. Good to see you investing in that.",
     "I noticed Etech's strong presence across the conference circuit this year — CCW, Conversational AI Summit, Call Center Campus."),
    ("David Kreiss", "Executive Sponsor", "CBAND", True,
     "KM²'s Caribbean expansion is serious scale — 1,250 new jobs across Grenada and Saint Lucia.",
     "KM²'s expansion across the Caribbean — 1,250 new jobs, 6,500+ employees — is serious growth."),
    ("Greg Alcorn", "Executive Sponsor", "CBAND", True,
     "Your work with ApSeed — 25,000 kids getting pre-K tablets, 131% literacy improvement — is a great example of tech done right.",
     "Your work with ApSeed is a great example of using technology for real impact."),
    ("Bill Randag", "Executive Sponsor", "EC", True,
     "I see DATAMARK is sponsoring both Frost & Sullivan MindXchange events this year — good to see that level of commitment to the industry.",
     "I noticed DATAMARK is sponsoring both Frost & Sullivan events this year — clearly investing in where the industry is headed."),
    ("Ali Karim", "Operations & Finance Leader", "FS", False,
     "Your Frost & Sullivan presentation on 'AI That Works' looks like a strong session — it's the exact topic I'm working on with BPO leaders.",
     "Your upcoming Frost & Sullivan session on 'AI That Works: Inside the Customer and Employee Experience' covers exactly what I'm working on with BPO operations leaders."),
    ("Liliana Lopez", "Technology Leader", "EC", False,
     "Your CCW Orlando workshop on operationalizing AI — moving from 'promising' to 'proven' — is exactly right. That gap is where most deployments stall.",
     "Your CCW Orlando workshop on moving AI from 'promising' to 'proven' is exactly the challenge I'm solving with BPO technology leaders."),
    ("Nanette Harrell", "Executive Sponsor", "CBAND", True,
     "Congrats on the Clutch Top 100 recognition — and expanding into Uganda and Guam is a bold move.",
     "Congrats on Helpware's Clutch Top 100 recognition and the expansion into Uganda, Guam, and Poland."),
    ("Dominic Leide", "Executive Sponsor", "CBAND", True,
     "The Office Gurus has built a strong nearshore operation — El Salvador, Belize, Dominican Republic. Good model.",
     "The Office Gurus' nearshore model across El Salvador, Belize, and DR is well-positioned."),
    ("Kenneth Loggins", "Operations & Finance Leader", "CBAND", True,
     "The NC call center opening — 550 jobs, former Concentrix facility — is a strong move. And I hear you're heading into South Africa next.",
     "Focus Services' NC expansion creating 550 jobs is a strong move — and the push into South Africa shows real ambition."),
    ("Brian Flaherty", "Executive Sponsor", "CBAND", False,
     "Your upcoming Mortgage AI conference talk on 'Staff vs AI vs Virtual Assistants' is exactly the right question. Every BPO leader I talk to is wrestling with that balance.",
     "Your upcoming session on 'Staff vs AI vs Virtual Assistants' at the Mortgage AI conference is exactly the question BPO leaders are asking right now."),
    ("Bill Trocano", "Operations & Finance Leader", "EC", False,
     "Your article on AI raising the bar for human agents — not replacing them — is the right framing. That's what I'm seeing in practice.",
     "Your recent article on AI raising the bar for human agents — not replacing them — is exactly what I'm seeing play out in BPO operations."),
    ("Pablo Paz Hernandez", "Executive Sponsor", "CBAND", False,
     "First Contact BPO growing 2,500% in under a year is serious momentum. And the CIOReview Top 10 recognition for ICC validates the model.",
     "First Contact BPO's growth trajectory — 2,500% in under a year — speaks for itself."),
    ("Amanda Jones", "Operations & Finance Leader", "CBAND", False,
     "Congrats on CBE's Torch Award for Ethics and the OIR Catalyst for Change Award. That level of recognition says a lot about how you run operations.",
     "CBE's Torch Award for Ethics and the Catalyst for Change Award say a lot about how you run the operation."),
    ("Donny Jackson", "Operations & Finance Leader", "CBAND", False,
     "Congrats on the promotion to RVP — Helpware's leadership restructuring looks like it's setting up for a strong next phase.",
     "Congrats on the move to RVP Business Operations. Helpware's growth trajectory is clear."),
    ("John Yanez", "Operations & Finance Leader", "CBAND", False,
     "LogixAssist winning AI-based Customer Service Solution of the Year is a strong validation. The first-contact resolution numbers are solid.",
     "LogixAssist winning 'AI-based Customer Service Solution of the Year' — with a 67-89% first-contact resolution increase — is a strong result."),
    ("Ken Braatz", "Technology Leader", "CBAND", False,
     "NinjaAI reviewing 100% of interactions vs the traditional 2-5% is a meaningful shift. That's the kind of practical AI deployment that actually delivers.",
     "The NinjaAI QA suite — reviewing 100% of interactions vs the traditional 2-5% — is exactly the kind of practical AI deployment that delivers."),
    ("Youssef Hannat", "Operations & Finance Leader", "CBAND", False,
     "With Thomas Monaghan stepping in as President, I imagine there's fresh thinking about where Percepta goes next.",
     "With new leadership at Percepta, I imagine there's fresh thinking about operational priorities."),
    ("James Nelson", "Operations & Finance Leader", "EC", False,
     "With Thomas Monaghan stepping in as President at Percepta, it's an interesting time for the business.",
     "With new leadership at Percepta, I imagine there's fresh thinking about operational direction."),
    ("Bryan Overcash", "Executive Sponsor", "CBAND", False,
     "GCS's track record — from the MTA COVID Hotline to processing 700,000+ unemployment claims — shows what a well-run onshore operation can do.",
     "GCS's track record — COVID Hotline for 68,000 MTA employees, 700,000+ unemployment claims — shows serious operational capability."),
    ("Erika Garcia", "Operations & Finance Leader", "CBAND", False,
     "I saw your post about joining Global Strategic during a period of strong momentum. Good timing.",
     "Global Strategic's momentum in the market is clear."),
    ("Keith Hansen", "Operations & Finance Leader", "CBAND", False,
     "KM² Solutions has built a strong Caribbean delivery model. Interested to hear how the Atlanta side of things is going.",
     "KM²'s Caribbean delivery model is well-regarded in the industry."),
    ("Mark D'Angola", "Operations & Finance Leader", "CBAND", False,
     "Managing call centers engaging 5M+ customers annually at Buwelo is no small operation. And 94% client retention speaks for itself.",
     "Buwelo's 94% client retention rate and 5M+ annual customer interactions is a strong track record."),
    ("Nitesh Kumar", "Operations & Finance Leader", "CBAND", False,
     "I saw your contributions to 'The AI Walk' series on empowering frontline agents. Practical take on a topic that gets overhyped.",
     "Your 'AI Walk' series contributions on empowering frontline agents with AI is a practical take on a topic that gets overhyped."),
    ("Rob Porges", "Operations & Finance Leader", "CBAND", False,
     "Flatworld's MSuite showcase at the MBA Servicing Conference and the launch of Flatworld.ai shows you're serious about AI in operations.",
     "Flatworld's MSuite and the launch of Flatworld.ai show a serious commitment to AI in operations."),
    ("Cathy Sexton", "Operations & Finance Leader", "CBAND", False,
     "Nearly two decades at Harte Hanks in financial services — you've seen the industry evolve more than most.",
     "Your deep experience in financial services at Harte Hanks gives you a perspective most don't have."),
    ("Aaron Brooks", "Technology Leader", "EC", False,
     "24 years at InfoCision leading call center technology — that kind of tenure and depth is rare.",
     "24 years leading call center technology at InfoCision is rare depth in this industry."),
]

# --- BUILD OUTPUT ---
# Split by prospect sections
parts = re.split(r'(## \d+\. .+)', content)
header = parts[0]
sections = []
for i in range(1, len(parts), 2):
    if i+1 < len(parts):
        sections.append((parts[i], parts[i+1]))

output = [header]

for idx, (heading, body) in enumerate(sections):
    # Find the matching prospect data
    name_match = re.match(r'## \d+\. (.+)', heading)
    if not name_match:
        output.append(heading + body)
        continue
    
    name = name_match.group(1).strip()
    prospect = None
    for p in prospects:
        if p[0] == name:
            prospect = p
            break
    
    if not prospect:
        output.append(heading + body)
        continue
    
    p_name, persona, event, is_first_degree, hook_t2, hook_email = prospect
    first_name = p_name.split()[0]
    
    # Determine event-specific content
    if event == "CBAND":
        t1 = T1_CBAND.replace("[Name]", first_name)
        cta = CTA_CBAND
        event_line_t2 = "I'll be at CCNG Atlanta on Feb 26 meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"
    elif event == "EC":
        t1 = T1_EC.replace("[Name]", first_name)
        cta = CTA_EC
        event_line_t2 = "I'll be at Enterprise Connect next month meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"
    elif event == "FS":
        t1 = T1_FS.replace("[Name]", first_name)
        cta = CTA_FS
        event_line_t2 = "I'll be at the Frost & Sullivan MindXchange in Fort Lauderdale in April meeting with BPO leaders who are automating their outbound and inbound operations. Will you be there?"
    else:
        t1 = T1_UNIVERSAL.replace("[Name]", first_name)
        cta = CTA_GENERIC
        event_line_t2 = "A number of mid-market BPOs are rolling this out right now. Would a quick overview be useful?"
    
    if is_first_degree:
        t1 = T1_ALREADY
    
    # Touch 2
    t2 = f"Great to connect, {first_name}. {hook_t2} I'm ex-PayPal Ventures, now building enterprise voice AI for BPOs at Dyna — Teleperformance is already using us. {event_line_t2}"
    
    # Touch 3 - pick template
    if persona == "Executive Sponsor":
        email = EMAIL_EXEC
    elif persona == "Technology Leader":
        email = EMAIL_TECH
    else:
        email = EMAIL_OPS
    
    email = email.replace("[HOOK]", hook_email).replace("[CTA]", cta)
    
    # Extract the context card (everything before the messaging table)
    table_match = re.search(r'\| Touch \|', body)
    if table_match:
        card = body[:table_match.start()]
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
print(f"Populated {len(prospects)} prospects with finalised messaging")
