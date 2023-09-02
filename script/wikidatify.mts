import { SimplifiedItem } from 'wikibase-sdk';
import fs from 'fs';
import dotenv from 'dotenv';
import { AthleteId, CatsList, MajorResult, TilasSearchResponse, WcResults } from './common/types.mjs';
import wikibaseEdit from 'wikibase-edit';
import { getCategoryQids, search, mkError } from './common/util.mjs';
import { FILE_ERRORS, FILE_MAJOR_RESULTS, FILE_WC_RESULTS, WD, absentQids, wbk } from './common/const.mjs';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const FILE_TOPNS = './script/data/topNs.json';

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

const topNs: {
  [k: `men/${number}`]: [number, number, string][];
  [k: `women/${number}`]: [number, number, string][];
} = fs.existsSync(FILE_TOPNS)
  ? JSON.parse(fs.readFileSync(FILE_TOPNS, 'utf-8'))
  : (() => {
      const majorResults: { [cid: string]: MajorResult } = JSON.parse(fs.readFileSync(FILE_MAJOR_RESULTS, 'utf-8'));
      // add WCs
      for (const [cid, { results }] of Object.entries(JSON.parse(fs.readFileSync(FILE_WC_RESULTS, 'utf-8')) as WcResults)) majorResults[cid] = results;
      const topNs = Object.values(majorResults)
        .flatMap((res) => {
          const year = +res.startDate.split('-')[0];
          return (res.genders ?? [])
            .flatMap((g) => g.agegroups.filter((a) => !a.title))
            .flatMap((a) => a.events)
            .flatMap(
              (e) =>
                e.rounds
                  .find((r) => !r.title)
                  ?.heats[0].results.filter((r) => ['1', '2', '3', '4'].includes(r.pos))
                  .flatMap((r) => {
                    if (r.relays) {
                      return [
                        ...new Set(
                          e.rounds
                            .flatMap((rnd) => rnd.heats)
                            .flatMap((ht) => ht.results)
                            .filter((res) => res.athleteId === r.athleteId)
                            .flatMap((res) => res.relays?.map((rel) => rel.athleteId) ?? [])
                        ),
                      ].map((athleteId) => ({ athleteId, pos: r.pos, event: e.title, year }));
                    }
                    return { ...r, event: e.title, year };
                  }) ?? []
            );
        })
        .reduce((acc, r) => {
          (acc[r.athleteId] ??= []).push([+r.year, +r.pos, r.event]);
          return acc;
        }, {} as { [k: AthleteId]: [number, number, string][] });
      fs.writeFileSync(FILE_TOPNS, JSON.stringify(topNs));
      return topNs;
    })();

