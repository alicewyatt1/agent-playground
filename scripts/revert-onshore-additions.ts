import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const csvPath = '/Users/alicewyatt/Downloads/Global Contact Center Market Map (Final) - Master List.csv';
const csv = fs.readFileSync(csvPath, 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

let reverted = 0;

records.forEach((row: any) => {
  const onshore = row.onshore_delivery_footprint || '';
  if (onshore === 'United States') {
    row.onshore_delivery_footprint = '';
    reverted++;
  } else if (onshore.endsWith(' | United States')) {
    row.onshore_delivery_footprint = onshore.slice(0, -(' | United States').length).trim();
    reverted++;
  }
});

const headers = Object.keys(records[0]);
const csvOutput = stringify(records, { header: true, columns: headers });
fs.writeFileSync(csvPath, csvOutput);

console.log('Reverted onshore_delivery_footprint for', reverted, 'rows (removed added United States).');
