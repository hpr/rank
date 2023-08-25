import WBK, { SimplifiedItem } from 'wikibase-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
import { CatsList, MajorResult, TilasSearchResponse } from './types.mjs';
import wikibaseEdit from 'wikibase-edit';
import { getCategoryQids, search } from './util.mjs';
import { FILE_MAJOR_RESULTS, absentQids } from './const.mjs';
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

const allowCats = [
  'Category:Medalists at the 1912 Summer Olympics',
  'Category:Medalists at the 1920 Summer Olympics',
  'Category:Medalists at the 1924 Summer Olympics',
  'Category:Medalists at the 1928 Summer Olympics',
  'Category:Medalists at the 1932 Summer Olympics',
  'Category:Medalists at the 1936 Summer Olympics',
  'Category:Medalists at the 1948 Summer Olympics',
  'Category:Medalists at the 1952 Summer Olympics',
  'Category:Medalists at the 1956 Summer Olympics',
  'Category:Medalists at the 1960 Summer Olympics',
  'Category:Medalists at the 1964 Summer Olympics',
  'Category:Medalists at the 1968 Summer Olympics',
  'Category:Medalists at the 1972 Summer Olympics',
  'Category:Medalists at the 1976 Summer Olympics',
  'Category:Medalists at the 1980 Summer Olympics',
  'Category:Medalists at the 1984 Summer Olympics',
  'Category:Medalists at the 1988 Summer Olympics',
  'Category:Medalists at the 1992 Summer Olympics',
  'Category:Medalists at the 1996 Summer Olympics',
  'Category:Medalists at the 2000 Summer Olympics',
  'Category:Medalists at the 2004 Summer Olympics',
  'Category:Medalists at the 2008 Summer Olympics',
  'Category:Medalists at the 2012 Summer Olympics',
  'Category:Medalists at the 2016 Summer Olympics',
  'Category:Medalists at the 2020 Summer Olympics',
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
const FILE_ALLOW_QIDS = './script/allowQids.json';

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
      const allowQids: CatsList = fs.existsSync(FILE_ALLOW_QIDS)
        ? JSON.parse(fs.readFileSync(FILE_ALLOW_QIDS, 'utf-8'))
        : await (async () => {
            const allowQids: CatsList = {};
            for (const allowCat of allowCats) (allowQids[allowCat] ??= []).push(...(await getCategoryQids(allowCat)));
            fs.writeFileSync(FILE_ALLOW_QIDS, JSON.stringify(allowQids));
            return allowQids;
          })();
      const qids = (await getCategoryQids('Category:World Athletics Championships medalists')).filter((qid) => Object.values(allowQids).flat().includes(qid));
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

    if (absentQids.includes(entity.id)) continue;
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
        error(
          'no matchingResult',
          label,
          `https://www.wikidata.org/wiki/${entity.id}#${P_DATE_OF_BIRTH}`,
          ...(allSearchHits.length === 1
            ? [`${process.env.PROXY_URL}beta/athletes/${allSearchHits[0].athleteId}`, allSearchHits[0].dateOfBirth]
            : [allSearchHits.length])
        );
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
        summary: `adding ${tilasSexedProperty} ID for WC medalist with matching name (${matchingAlias ?? matchingResult.name}) and date of birth (${
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
