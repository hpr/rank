import fs from 'fs';
import { MeetBests, MajorResult } from './types.mjs';
import dotenv from 'dotenv';
import { markToSecs } from './util.mjs';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ls ../golds/majors/WC | cut -c 6- | rev | cut -c 6- | rev
const wcCids = [
  '13015297',
  '8255184',
  '12996362',
  '12996365',
  '12828580',
  '12828581',
  '12996366',
  '8256922',
  '8257083',
  '7993620',
  '8906660',
  '10626603',
  '12789100',
  '12814135',
  '12844203',
  '12863607',
  '12898707',
  '12935526',
  '13002354',
];
const FILE_WC_RESULTS = './script/data/wcResults.json';
type WcResults = { [cid: string]: { results: MajorResult; bests: MeetBests } };

const wcResults: WcResults = fs.existsSync(FILE_WC_RESULTS)
  ? JSON.parse(fs.readFileSync(FILE_WC_RESULTS, 'utf-8'))
  : await (async () => {
      const wcResults: WcResults = {};
      for (const cid of wcCids) {
        console.log(wcCids.indexOf(cid) + 1, '/', wcCids.length);
        const results = await (
          await fetch(`${process.env.PROXY_URL}api/results/${cid}`, {
            headers: { Authorization: process.env.AUTHORIZATION! },
          })
        ).json();
        // bests: 2003 to present
        const bests = await (
          await fetch(`${process.env.PROXY_URL}api/results/${cid}/best`, {
            headers: { Authorization: process.env.AUTHORIZATION! },
          })
        ).json();
        wcResults[cid] = { results, bests };
      }
      fs.writeFileSync(FILE_WC_RESULTS, JSON.stringify(wcResults));
      return wcResults;
    })();

const athImprovements: { athleteId: string; name: string; diff: number; percentDiff: number; year: number; event: string; oldPb: string; newPb: string }[] = [];
for (const cid in wcResults) {
  console.log(cid);
  if (Array.isArray(wcResults[cid].bests)) continue;
  const year = +wcResults[cid].results.startDate.split('-')[0];
  const perfsList = wcResults[cid].results.genders
    .flatMap((gen) => gen.agegroups ?? [])
    .flatMap((age) => age.events.filter((ev) => ev.title.split(' ').some((word) => word.endsWith('m'))) ?? [])
    .flatMap((ev) => ev.rounds.map((rnd) => ({ ...rnd, evt: ev.title })) ?? [])
    .flatMap((rnd) => rnd.heats.map((ht) => ({ ...ht, evt: rnd.evt })) ?? [])
    .flatMap((ht) => ht.results.map((res) => ({ ...res, evt: ht.evt })) ?? []);

  const athleteToResults = Object.fromEntries(
    [...new Set(perfsList.map((perf) => perf.athleteId))].map((athleteId) => {
      const perfs = perfsList.filter((perf) => perf.athleteId === athleteId);
      const events = [...new Set(perfsList.map((perf) => perf.evt))];
      return [athleteId, Object.fromEntries(events.map((evt) => [evt, perfs.filter((perf) => perf.evt === evt)]))];
    })
  );

  for (const athleteId in athleteToResults) {
    const [sex] = athleteId.split('/');
    for (const evt in athleteToResults[athleteId]) {
      const athleteBests = athleteToResults[athleteId][evt].map((res) => wcResults[cid].bests[sex][res.resultIndex]);
      const [worstBest] = athleteBests.filter((b) => b?.PB).sort((a, b) => +markToSecs(b.PB) - +markToSecs(a.PB));
      if (!worstBest?.PB) continue;
      const { PB } = worstBest;
      const pbScore = +markToSecs(PB);
      const [bestPerf] = athleteToResults[athleteId][evt].filter((res) => res.result).sort((a, b) => +markToSecs(a.result) - +markToSecs(b.result));
      if (!bestPerf) continue;
      const diff = pbScore - +markToSecs(bestPerf.result);
      const percentDiff = (diff / pbScore) * 100;
      athImprovements.push({ year, athleteId, name: bestPerf.name, diff, percentDiff, event: bestPerf.evt, oldPb: PB, newPb: bestPerf.result });
    }
  }
}
console.log(athImprovements.sort((a, b) => b.percentDiff - a.percentDiff).slice(0, 10));
