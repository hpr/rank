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
  userAgent: 'wikiTrackBot/v2.0.0-rank (https://github.com/hpr/rank)',
  bot: true,
  maxlag: 10,
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const P_TILAS_FEMALE = 'P3882';
const P_TILAS_MALE = 'P3884';
const P_DATE_OF_BIRTH = 'P569';
const P_OCCUPATION = 'P106';
const Q_WHEELCHAIR_RACER = 'Q51536424';
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
        Object.assign(entities, wbk.simplify.entities(await (await fetch(url)).json(), { keepNonTruthy: true }));
      }
      fs.writeFileSync(FILE_ENTITIES, JSON.stringify(entities));
      return entities;
    })();

const errors: any[] = [];
const error = (...args: any) => {
  errors.push(args);
  console.error(...args);
};
for (const entity of Object.values(entities)) {
  if (entity.claims?.[P_OCCUPATION].includes(Q_WHEELCHAIR_RACER)) continue;
  const label = entity.labels?.en;
  if (!label) {
    error('no label', entity.id);
    continue;
  }
  if (!entity.claims?.[P_TILAS_MALE] && !entity.claims?.[P_TILAS_FEMALE]) {
    const dobs = entity.claims?.[P_DATE_OF_BIRTH].map((dob) => String(dob).split('T')[0]) ?? [];
    if (!dobs.length) {
      error('no dobs', label, entity.id);
      continue;
    }
    let matchingAlias: string | undefined;
    let matchingResult: TilasSearchResponse | undefined;
    const aliases = [...new Set([label, ...Object.values(entity.aliases ?? {}).flat()])].filter((name) => name.match(/\w/) && name.split(' ').length >= 2);
    for (const alias of aliases) {
      console.log('trying', alias, aliases.indexOf(alias), aliases.length);
      const result = (await search(alias)).find((hit) => dobs.includes(hit.dateOfBirth));
      await new Promise((res) => setTimeout(res, 500));
      if (result) {
        matchingAlias = alias;
        matchingResult = result;
        break;
      }
    }
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
      summary: `adding tilastopaja ID for gold medalist with matching name (${matchingAlias}) and date of birth (${matchingResult.dateOfBirth})`,
    });
  }
}
fs.writeFileSync('./script/errors.json', JSON.stringify(errors));
