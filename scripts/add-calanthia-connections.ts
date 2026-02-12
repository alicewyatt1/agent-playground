import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

config();

// Connection data from LinkedIn profile checks (as Calanthia Mei Fuchs)
const connectionData: Record<string, { firstDegree: string; secondDegree: string }> = {
  'Erica Parks': { firstDegree: 'N', secondDegree: '' },
  'Brian Answeeney': { firstDegree: 'N', secondDegree: '(No LinkedIn URL provided)' },
  'LeGrand Bonnet': { firstDegree: 'N', secondDegree: 'Rich; Ken' },
  'Pankaj Dhanuka': { firstDegree: 'N', secondDegree: '(No LinkedIn URL provided)' },
  'Nate Spears': { firstDegree: 'N', secondDegree: 'Brandon' },
  'Bill Randag': { firstDegree: 'N', secondDegree: 'Aaron' },
  'Satish Kumar': { firstDegree: 'N', secondDegree: '' },
  'Matt Storey': { firstDegree: 'N', secondDegree: 'Jonathan; Emily; +3 others' },
  'Dilip Barot': { firstDegree: 'N', secondDegree: '' },
  'Jim Iyoob': { firstDegree: 'N', secondDegree: 'Omair; Ian; +2 others' },
  'Kaylene Eckels': { firstDegree: 'N', secondDegree: 'Tzvika' },
  'Vishal Choudhary': { firstDegree: 'N', secondDegree: '' },
  'Chris Basile': { firstDegree: 'N', secondDegree: 'Chase' },
  'Benjamin Johnson': { firstDegree: 'N', secondDegree: '' },
  'Jacob William': { firstDegree: 'N', secondDegree: '' },
  'Bill Wiser': { firstDegree: 'N', secondDegree: '' },
  'Bracken Mayes': { firstDegree: 'N', secondDegree: '' },
  'Kenneth Loggins': { firstDegree: 'N', secondDegree: 'Aaron' },
  'Greg Alcorn': { firstDegree: 'N', secondDegree: 'Ian; Aaron' },
  'David Fisher': { firstDegree: 'N', secondDegree: 'Stephanie' },
  'Nanette Harrell': { firstDegree: 'N', secondDegree: '' },
  'Emily Slota': { firstDegree: 'N', secondDegree: 'Efi; Josh' },
  'Craig Taylor': { firstDegree: 'N', secondDegree: '' },
  'Gary Taylor': { firstDegree: 'N', secondDegree: '' },
  'Steve Boyazis': { firstDegree: 'N', secondDegree: '(LinkedIn URL points to wrong profile - Steve Brubaker)' },
  'Michael White': { firstDegree: 'N', secondDegree: '' },
  'Johanna McCaskill': { firstDegree: 'N', secondDegree: '' },
  'David Kreiss': { firstDegree: 'N', secondDegree: 'Karla M.' },
  'Rodd Furlough': { firstDegree: 'N', secondDegree: '' },
  'Michelle Pittsenbarger': { firstDegree: 'N', secondDegree: '' },
  'Jim Watson': { firstDegree: 'N', secondDegree: 'Amir' },
  'Curt Cornum': { firstDegree: 'N', secondDegree: 'Lisa; Dominic' },
  'Michelle Winnett': { firstDegree: 'N', secondDegree: 'Josh; Alex' },
  'Justin Nalder': { firstDegree: 'N', secondDegree: '' },
  'Matthew Fisher': { firstDegree: 'N', secondDegree: 'Jordan' },
  'Kevin Welch': { firstDegree: 'Y', secondDegree: '' },
  'Stephanie Anthony': { firstDegree: 'N', secondDegree: 'Stephanie; Kate; +1 other' },
  'Hemal Mewada': { firstDegree: 'N', secondDegree: '' },
  'Thomas Monaghan': { firstDegree: 'N', secondDegree: 'Maxim' },
  'Omeed Jafari': { firstDegree: 'N', secondDegree: '' },
  'Petro Bondarevskyi': { firstDegree: 'N', secondDegree: 'Manana' },
  'Dominic Leide': { firstDegree: 'N', secondDegree: 'Aaron' },
  'Vidya Ravichandran': { firstDegree: 'N', secondDegree: 'Jonny; Gayla; +1 other' },
  'Joseph DeWoody': { firstDegree: 'N', secondDegree: 'Noah' },
  'Jim Radzicki': { firstDegree: 'N', secondDegree: 'Alex; A.S.' },
  'Butch Valenzuela': { firstDegree: 'N', secondDegree: 'Zack; Jeielle Jea; +4 others' },
  'Maria L. Valenzuela': { firstDegree: 'N', secondDegree: 'Julian Kyle Lizares' },
};

async function main() {
  const inputPath = path.join(process.cwd(), 'data', 'gaps-top-contacts-with-connections.csv');
  const outputPath = path.join(process.cwd(), 'data', 'gaps-top-contacts-with-calanthia-connections.csv');

  const csvContent = fs.readFileSync(inputPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  console.log(`Read ${records.length} records from input CSV`);

  // Add the two new columns to each record
  for (const record of records) {
    const fullName = record['Full Name']?.trim();
    const match = connectionData[fullName];
    
    if (match) {
      record['Calanthia First Degree'] = match.firstDegree;
      record['Calanthia Second Degree'] = match.secondDegree;
    } else {
      // Try partial matching
      const keys = Object.keys(connectionData);
      const partialMatch = keys.find(k => fullName?.includes(k) || k.includes(fullName));
      if (partialMatch) {
        record['Calanthia First Degree'] = connectionData[partialMatch].firstDegree;
        record['Calanthia Second Degree'] = connectionData[partialMatch].secondDegree;
      } else {
        console.log(`No match found for: "${fullName}"`);
        record['Calanthia First Degree'] = 'N';
        record['Calanthia Second Degree'] = '(not checked)';
      }
    }
  }

  // Get column headers from first record
  const columns = Object.keys(records[0]);
  
  const output = stringify(records, {
    header: true,
    columns: columns,
  });

  fs.writeFileSync(outputPath, output);
  console.log(`Output written to: ${outputPath}`);
  
  // Print summary
  const firstDegreeCount = records.filter((r: any) => r['Calanthia First Degree'] === 'Y').length;
  const secondDegreeCount = records.filter((r: any) => r['Calanthia Second Degree'] && r['Calanthia Second Degree'] !== '' && !r['Calanthia Second Degree'].startsWith('(')).length;
  const thirdDegreeCount = records.filter((r: any) => r['Calanthia First Degree'] === 'N' && (r['Calanthia Second Degree'] === '' || !r['Calanthia Second Degree'])).length;
  
  console.log(`\nSummary:`);
  console.log(`  1st degree connections: ${firstDegreeCount}`);
  console.log(`  2nd degree connections: ${secondDegreeCount}`);
  console.log(`  3rd+ degree (no connection): ${thirdDegreeCount}`);
  console.log(`  Total contacts: ${records.length}`);
}

main().catch(console.error);
