import re

content = open('data/personalised-outreach.md', 'r').read()

# First, remove ALL location rows
content = re.sub(r'\| \*\*Location\*\* \|[^\n]*\n', '', content)

# Location per prospect name
locations = {
    "Jim Iyoob": "San Antonio, TX",
    "Benjamin Alpert": "Bradenton, FL",
    "Matt Rocco": "Nacogdoches, TX",
    "David Kreiss": "Boca Raton, FL",
    "Greg Alcorn": "Salisbury, NC",
    "Bill Randag": "El Paso, TX",
    "Ali Karim": "El Paso, TX",
    "Liliana Lopez": "United States",
    "Nanette Harrell": "Asheville, NC",
    "Dominic Leide": "Tampa, FL",
    "Kenneth Loggins": "Jacksonville, NC",
    "Brian Flaherty": "Elon, NC",
    "Bill Trocano": "Rochester, NY",
    "Pablo Paz Hernandez": "Miami, FL",
    "Amanda Jones": "Clarksville, TN",
    "Donny Jackson": "Atlanta, GA",
    "John Yanez": "Tampa, FL",
    "Ken Braatz": "Boynton Beach, FL",
    "Youssef Hannat": "Nashville, TN",
    "James Nelson": "Houston, TX",
    "Bryan Overcash": "Salisbury, NC",
    "Erika Garcia": "Miami, FL",
    "Keith Hansen": "Atlanta, GA",
    "Mark D'Angola": "Atlanta, GA",
    "Nitesh Kumar": "Alpharetta, GA",
    "Rob Porges": "Miami, FL",
    "Cathy Sexton": "Salisbury, NC",
    "Aaron Brooks": "Cleveland, OH",
}

# Split into sections by prospect heading
parts = re.split(r'(## \d+\. .+)', content)

result = []
current_name = None
for part in parts:
    heading_match = re.match(r'## \d+\. (.+)', part)
    if heading_match:
        current_name = heading_match.group(1).strip()
        result.append(part)
    else:
        if current_name and current_name in locations:
            loc = locations[current_name]
            # Insert location row after Persona row
            part = part.replace(
                '| **Persona**',
                f'| **Persona**',
                1
            )
            # Find the Persona line and add Location after it
            lines = part.split('\n')
            new_lines = []
            for line in lines:
                new_lines.append(line)
                if '**Persona**' in line:
                    new_lines.append(f'| **Location** | {loc} |')
            part = '\n'.join(new_lines)
        result.append(part)

content = ''.join(result)
open('data/personalised-outreach.md', 'w').write(content)
print("Fixed — one location per prospect")
