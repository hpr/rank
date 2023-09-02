import fs from 'fs';
import dotenv from 'dotenv';
import { FILE_ERRORS, WD, wbk } from './common/const.mjs';
import { CirrusResponse, WikitextResponse } from './common/types.mjs';
import { SimplifiedItem } from 'wikibase-sdk';
import { mkError } from './common/util.mjs';
import WikiApi from 'wikiapi';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const wiki = new WikiApi('enwiki');

// | olympics =
// | worlds = [[2023 World Athletics Championships – Women's 10,000 metres|2023: 10,000 m]]
// | pb             = {{ubl
//   |'''[[100 metres|100&nbsp;m]]''': 10.90 ([[Birmingham]] 2022)
//   |'''[[200 metres|200&nbsp;m]]''': 22.16 ([[Budapest]] 2023)
//   |''Indoors''
//   |'''[[60 metres|60&nbsp;m]]''': 7.05{{AthAbbr|i}} ([[Berlin]] 2023)
//   }}

const cirrusTilasItems: CirrusResponse = await (
  await fetch(wbk.cirrusSearchPages({ haswbstatement: `${WD.P_TILAS_FEMALE}|${WD.P_TILAS_MALE}`, prop: 'snippet', sort: 'create_timestamp_asc', limit: 1 }))
).json();

const errors: any[] = [];
const error = mkError(errors);

const tilasWikis = {};
for (const url of wbk.getManyEntities({ ids: cirrusTilasItems.query.search.map(({ title }) => title) })) {
  const entities = Object.values(wbk.simplify.entities(await (await fetch(url)).json())) as SimplifiedItem[];
  const wikiEntities = entities.filter((ent) => ent.sitelinks?.enwiki);
  const { query } = (await (
    await fetch(
      'https://en.wikipedia.org/w/api.php?' +
        new URLSearchParams({
          action: 'query',
          prop: 'revisions',
          rvprop: 'content',
          format: 'json',
          titles: wikiEntities.map((ent) => ent.sitelinks?.enwiki).join('|'),
          rvslots: 'main',
        })
    )
  ).json()) as WikitextResponse;
  for (const page of Object.values(query.pages)) {
    const entity = wikiEntities.find((ent) => ent.sitelinks?.enwiki === page.title)!;
    const wikitext = page.revisions[0].slots.main['*'];
    const athleteId = entity.claims?.[WD.P_TILAS_FEMALE] ? `women/${entity.claims?.[WD.P_TILAS_FEMALE]}` : `men/${entity.claims?.[WD.P_TILAS_MALE]}`;
    console.log(athleteId, new WikiTextParser().pageToSectionObject(wikitext));
  }
}
fs.writeFileSync(FILE_ERRORS, JSON.stringify(errors));
