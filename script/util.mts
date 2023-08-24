import { TilasSearchResponse } from './types.mjs';

export const getCategoryQids = async (gcmtitle: string) => {
  const qids: `Q${number}`[] = [];
  let cont: { gcmcontinue?: string } | undefined = {};
  while (cont) {
    console.log(gcmtitle, cont);
    const params: { [k: string]: string } = {
      action: 'query',
      gcmtitle,
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
  return qids;
};

export const search = async (name: string): Promise<TilasSearchResponse[]> => {
  const resp = await (
    await fetch(`${process.env.PROXY_URL}api/athletes/search?` + new URLSearchParams({ query: name }), {
      headers: { authorization: process.env.AUTHORIZATION! },
    })
  ).json();
  if (!resp.authorized) throw new Error('not authorized');
  return resp.divs?.[0].tables.flatMap((table: { body: TilasSearchResponse }) => table.body) ?? [];
};
