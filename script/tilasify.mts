import WBK, { SimplifiedItem } from 'wikibase-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
import { MajorResult, TilasSearchResponse } from './types.mjs';
import wikibaseEdit from 'wikibase-edit';
import { getCategoryQids, search } from './util.mjs';
import { FILE_MAJOR_RESULTS } from './const.mjs';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

const denyList = [
  'Category:Medalists_at_the_1908_Summer_Olympics',
  'Category:Medalists_at_the_1904_Summer_Olympics',
  'Category:Medalists_at_the_1900_Summer_Olympics',
  'Category:Medalists_at_the_1896_Summer_Olympics',
  'Category:Medalists at the 1906 Intercalated Games',
];

const P_TILAS_FEMALE = 'P3882';
const P_TILAS_MALE = 'P3884';
const P_DATE_OF_BIRTH = 'P569';
const P_OCCUPATION = 'P106';
const P_INSTANCE_OF = 'P31';
const P_SUBJECT_NAMED_AS = 'P1810';
const Q_HUMAN = 'Q5';
const Q_WHEELCHAIR_RACER = 'Q51536424';

const FILE_ENTITIES = './script/entities.json';
const FILE_COMPLETED = './script/completedQids.json';

const wbk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
});

const completedQids: string[] = fs.existsSync(FILE_COMPLETED) ? JSON.parse(fs.readFileSync(FILE_COMPLETED, 'utf-8')) : [];
const majorResults: { [cid: string]: MajorResult } = JSON.parse(fs.readFileSync(FILE_MAJOR_RESULTS, 'utf-8'));
const relayLegs = Object.values(majorResults)
  .flatMap((majorRes) => majorRes.genders ?? [])
  .flatMap((gen) => gen.agegroups ?? [])
  .flatMap((age) => age.events ?? [])
  .flatMap((ev) => ev.rounds ?? [])
  .flatMap((rnd) => rnd.heats ?? [])
  .flatMap((ht) => ht.results ?? [])
  .flatMap((res) => res.relays ?? []);

const entities: Record<string, SimplifiedItem> = fs.existsSync(FILE_ENTITIES)
  ? JSON.parse(fs.readFileSync(FILE_ENTITIES, 'utf-8'))
  : await (async () => {
      const entities = {};
      const denyQids: `Q${number}`[] = [];
      for (const denyUrl of denyList) denyQids.push(...(await getCategoryQids(denyUrl)));
      const qids = (await getCategoryQids('Category:Olympic gold medalists for the United States in track and field')).filter((qid) => !denyQids.includes(qid));
      console.log(qids.length);
      for (const url of wbk.getManyEntities({ ids: qids })) {
        console.log(url);
        Object.assign(entities, wbk.simplify.entities(await (await fetch(url)).json(), { keepNonTruthy: true }));
      }
      fs.writeFileSync(FILE_ENTITIES, JSON.stringify(entities));
      return entities;
    })();

// fs.writeFileSync(
//   FILE_COMPLETED,
//   JSON.stringify([...completedQids, ...Object.keys(entities).filter((key) => entities[key].claims?.[P_TILAS_MALE] || entities[key].claims?.[P_TILAS_FEMALE])])
// );
// if (!0) process.exit();

const errors: any[] = [];
const error = (...args: any) => {
  errors.push(args);
  console.error(...args);
};
const entityVals = Object.values(entities);
try {
  for (const entity of entityVals) {
    console.log(`${entityVals.indexOf(entity) + 1} / ${entityVals.length}`);

    if (!entity.claims?.[P_INSTANCE_OF]?.includes(Q_HUMAN)) continue;
    if (entity.claims?.[P_OCCUPATION]?.includes(Q_WHEELCHAIR_RACER)) continue;
    const label = entity.labels?.en;
    if (!label) {
      error('no label', entity.id);
      continue;
    }
    if (!entity.claims?.[P_TILAS_MALE] && !entity.claims?.[P_TILAS_FEMALE]) {
      const dobs = entity.claims?.[P_DATE_OF_BIRTH]?.map((dob) => String(dob).split('T')[0]) ?? [];
      if (!dobs.length) {
        error('no dobs', label, entity.id);
        continue;
      }
      let matchingAlias: string | undefined;
      let matchingResult: Partial<TilasSearchResponse> | undefined;
      const aliases = [...new Set([label, ...Object.values(entity.labels ?? {}).flat(), ...Object.values(entity.aliases ?? {}).flat()])].filter(
        (name) => name.match(/\w/) && name.split(' ').length >= 2
      );
      const allSearchHits: TilasSearchResponse[] = [];
      for (const alias of aliases) {
        console.log('trying', alias, `(${aliases.indexOf(alias) + 1}/${aliases.length})`);
        const searchHits = await search(alias);
        for (const hit of searchHits) if (!allSearchHits.find((h) => h.athleteId === hit.athleteId)) allSearchHits.push(hit);
        const result = searchHits.find((hit) => {
          if (!hit.dateOfBirth) return dobs.map((dob) => +dob.split('-')[0]).includes(hit.yearOfBirth);
          return dobs.includes(hit.dateOfBirth);
        });
        await new Promise((res) => setTimeout(res, 500));
        if (result) {
          matchingAlias = alias;
          matchingResult = result;
          break;
        }
      }
      matchingResult ??= allSearchHits.find((hit) => !hit.yearOfBirth);
      if (!matchingResult) {
        const matchingLeg = relayLegs.find((leg) => aliases.includes(leg.name));
        if (matchingLeg) {
          console.log('found relay');
          matchingResult = {
            name: matchingLeg.name,
            athleteId: matchingLeg.athleteId,
          };
        }
      }
      if (!matchingResult?.athleteId) {
        error('no matchingResult', label, entity.id, allSearchHits.length);
        continue;
      }
      const [sex, id] = matchingResult.athleteId.split('/');
      const tilasSexedProperty = sex === 'women' ? P_TILAS_FEMALE : P_TILAS_MALE;
      console.log(matchingResult.name, matchingResult.minYear, matchingResult.maxYear, matchingResult.athleteId);
      await wbEdit.entity.edit({
        type: 'item',
        id: entity.id,
        claims: { [tilasSexedProperty]: { value: id, qualifiers: { [P_SUBJECT_NAMED_AS]: matchingResult.name } } },
        reconciliation: { mode: 'merge' },
        summary: `adding tilastopaja ID for WC medalist with matching name (${matchingAlias ?? matchingResult.name}) and date of birth (${
          matchingResult.dateOfBirth ?? matchingResult.yearOfBirth ?? dobs[0]
        })`,
      });
      entities[entity.id].claims![tilasSexedProperty] = [id];
    }
  }
} catch (e) {
  console.error(e);
}
fs.writeFileSync(
  FILE_COMPLETED,
  JSON.stringify([
    ...new Set([...completedQids, ...Object.keys(entities).filter((key) => entities[key].claims?.[P_TILAS_MALE] || entities[key].claims?.[P_TILAS_FEMALE])]),
  ])
);
fs.writeFileSync(FILE_ENTITIES, JSON.stringify(entities));
fs.writeFileSync('./script/errors.json', JSON.stringify(errors));
