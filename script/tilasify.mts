import WBK, { SimplifiedItem } from 'wikibase-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
import { TilasSearchResponse } from './types.mjs';
import wikibaseEdit from 'wikibase-edit';
dotenv.config();

const wbEdit = wikibaseEdit({
  instance: 'https://www.wikidata.org',
  credentials: {
    oauth: {
      consumer_key: process.env.CONSUMER_TOKEN,
      consumer_secret: process.env.CONSUMER_SECRET,
      token: process.env.ACCESS_TOKEN,
      token_secret: process.env.ACCESS_SECRET,
    },
  },
  userAgent: 'wikiTrackBot/v2.0.0 (https://github.com/hpr/wikiTrackBotJS)',
  bot: true,
  maxlag: 10,
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const P_TILAS_FEMALE = 'P3882';
const P_TILAS_MALE = 'P3884';
const P_DATE_OF_BIRTH = 'P569';
const FILE_ENTITIES = './script/entities.json';

const wbk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
});

const search = async (name: string): Promise<TilasSearchResponse[]> => {
  const resp = await (
    await fetch(`${process.env.PROXY_URL}api/athletes/search?` + new URLSearchParams({ query: name }), {
      headers: { authorization: process.env.AUTHORIZATION! },
    })
  ).json();
  return resp.divs?.[0].tables.flatMap((table: { body: TilasSearchResponse }) => table.body) ?? [];
};

const entities: Record<string, SimplifiedItem> = fs.existsSync(FILE_ENTITIES)
  ? JSON.parse(fs.readFileSync(FILE_ENTITIES, 'utf-8'))
  : await (async () => {
      const entities = {};
      const qids: `Q${number}`[] = [];
      let cont: { gcmcontinue?: string } | undefined = {};
      while (cont) {
        const params: { [k: string]: string } = {
          action: 'query',
          gcmtitle: 'Category:World_Athletics_Championships_winners',
          generator: 'categorymembers',
          prop: 'pageprops',
          format: 'json',
          gcmlimit: 'max',
        };
        if (cont?.gcmcontinue) params.gcmcontinue = cont.gcmcontinue;
        const { query, ...rest } = await (await fetch(`https://en.wikipedia.org/w/api.php?` + new URLSearchParams(params))).json();
        qids.push(...Object.values(query.pages as { pageprops: { wikibase_item: `Q${number}` } }[]).map((val) => val.pageprops.wikibase_item));
        cont = rest.continue;
      }
      for (const url of wbk.getManyEntities({ ids: qids })) {
        console.log(url);
        Object.assign(entities, wbk.simplify.entities(await (await fetch(url)).json()));
      }
      fs.writeFileSync(FILE_ENTITIES, JSON.stringify(entities));
      return entities;
    })();

const errors: any[] = [];
const error = (...args: any) => {
  errors.push(args);
  console.error(...args);
}
for (const entity of Object.values(entities)) {
  const label = entity.labels?.en;
  if (!label) {
    error('no label', entity.id);
    continue;
  }
  console.log(label);
  if (!entity.claims?.[P_TILAS_MALE] && !entity.claims?.[P_TILAS_FEMALE]) {
    const dob = String(entity.claims?.[P_DATE_OF_BIRTH][0]).split('T')[0];
    if (!dob) {
      error('no dob', label, entity.id);
      continue;
    }
    const matchingResult = (await search(label)).find((hit) => hit.dateOfBirth === dob);
    await new Promise(res => setTimeout(res, 500));
    if (!matchingResult) {
      error('no matchingResult', label, entity.id);
      continue;
    }
    const [sex, id] = matchingResult.athleteId.split('/');
    const tilasSexedProperty = sex === 'women' ? P_TILAS_FEMALE : P_TILAS_MALE;
    console.log(matchingResult.name, matchingResult.minYear, matchingResult.maxYear, matchingResult.athleteId);
    await wbEdit.entity.edit({
      type: 'item',
      id: entity.id,
      claims: { [tilasSexedProperty]: { value: id } },
      reconciliation: { mode: 'merge' },
    });
  }
}
fs.writeFileSync('./script/errors.json', JSON.stringify(errors));
