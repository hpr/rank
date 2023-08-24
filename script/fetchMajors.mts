import fs from 'fs';
import dotenv from 'dotenv';
import { MajorResult } from './types.mjs';
import { FILE_MAJOR_RESULTS } from './const.mjs';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ls ../golds/majors/OG | cut -c 6- | rev | cut -c 6- | rev
const olyCids = [
  '12995202',
  '12974432',
  '12974431',
  '12974430',
  '12974429',
  '13023424',
  '12974416',
  '12974415',
  '12974414',
  '12974412',
  '12974404',
  '12974402',
  '12828560',
  '12828565',
  '12828564',
  '12828557',
  '12828533',
  '12828528',
  '12828534',
  '8257021',
  '8232064',
  '12042259',
  '12825110',
  '12877460',
  '12992925',
];

const majorResults: { [cid: string]: MajorResult } = JSON.parse(fs.readFileSync(FILE_MAJOR_RESULTS, 'utf-8'));

for (const cid of olyCids) {
  console.log(cid);
  const results = await (
    await fetch(`${process.env.PROXY_URL}api/results/${cid}`, {
      headers: { Authorization: process.env.AUTHORIZATION! },
    })
  ).json();
  majorResults[cid] = results;
}

fs.writeFileSync(FILE_MAJOR_RESULTS, JSON.stringify(majorResults));
