import { GRAPHQL_ENDPOINT, GetCompetitorBasicInfo, SearchCompetitors, headers } from './const';
import { CompetitorBasicInfo, SearchCompetitor } from './types';

export const searchCompetitors = async (query: string): Promise<SearchCompetitor[]> => {
  const { data } = await (
    await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operationName: 'SearchCompetitors',
        variables: { query },
        query: SearchCompetitors,
      }),
    })
  ).json();
  return data.searchCompetitors;
};

export const competitorBasicInfo = async (id: string): Promise<CompetitorBasicInfo> => {
  const { data } = await (
    await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operationName: 'GetCompetitorBasicInfo',
        query: GetCompetitorBasicInfo,
        variables: { id },
      }),
    })
  ).json();
  return data.competitor;
};

export const getAvatarUrl = (aaAthleteId: string) => `https://media.aws.iaaf.org/athletes/${aaAthleteId}.jpg`;

export const evtSort = (a: string, b: string) => {
  const DIGITS = '0123456789';
  const normalize = (s: string) => s.replace('Mile', '1609').replace('MILE', '1609');
  const firstNumericWord = (s: string) => s.split(' ').find((w) => DIGITS.includes(w[0])) ?? s.slice(1);
  const gender = (s: string) => s.match(/(Men|Women)/)?.[0] ?? s[0];
  a = normalize(a);
  b = normalize(b);
  if (gender(a) !== gender(b)) return a.localeCompare(b);
  return Number.parseInt(firstNumericWord(a)) - Number.parseInt(firstNumericWord(b));
};

export const normalize = (str: string) =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '');
