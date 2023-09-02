import fs from 'fs';
import { MeetBests, MajorResult, WcResults } from './common/types.mjs';
import dotenv from 'dotenv';
import { markToSecs } from './common/util.mjs';
import { WaCalculator } from '@glaivepro/wa-calculator';
import { evtTitleToDiscipline, FILE_WC_RESULTS } from './common/const.mjs';
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
  '13046619',
];

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
  const year = +wcResults[cid].results.startDate.split('-')[0];
  console.log(cid, year);
  if (Array.isArray(wcResults[cid].bests)) continue;

  const perfsList = wcResults[cid].results.genders
    .flatMap((gen) => gen.agegroups ?? [])
    .flatMap((age) => age.events.filter((ev) => evtTitleToDiscipline[ev.title]) ?? [])
    .flatMap((ev) => ev.rounds.map((rnd) => ({ ...rnd, evt: ev.title })) ?? [])
    .flatMap((rnd) => rnd.heats.map((ht) => ({ ...ht, evt: rnd.evt })) ?? [])
    .flatMap(
      (ht) =>
        ht.results
          .filter((res) => res.result)
          .map((res) => ({
            ...res,
            evt: ht.evt,
            score: new WaCalculator({
              edition: '2022',
              gender: res.athleteId.startsWith('women') ? 'f' : 'm',
              venueType: 'outdoor',
              discipline: evtTitleToDiscipline[ht.evt],
            }).evaluate(+markToSecs(res.result)),
          })) ?? []
    );

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
      const [worstBest] = athleteBests
        .filter((b) => b?.PB)
        .map((best) => ({
          ...best,
          pbScore: new WaCalculator({
            edition: '2022',
            gender: athleteId.startsWith('women') ? 'f' : 'm',
            venueType: 'outdoor',
            discipline: evtTitleToDiscipline[evt],
          }).evaluate(+markToSecs(best.PB)),
        }))
        .sort((a, b) => a.pbScore - b.pbScore);
      if (!worstBest?.PB) continue;
      const { PB, pbScore } = worstBest;
      const [bestPerf] = athleteToResults[athleteId][evt].sort((a, b) => b.score - a.score);
      if (!bestPerf) continue;
      const diff = bestPerf.score - pbScore;
      const percentDiff = (diff / pbScore) * 100;
      athImprovements.push({ year, athleteId, name: bestPerf.name, diff, percentDiff, event: bestPerf.evt, oldPb: PB, newPb: bestPerf.result });
    }
  }
}
console.log(athImprovements.sort((a, b) => b.diff - a.diff).slice(0, 50));
