import { EntityId } from 'wikibase-sdk';

export type CatsList = { [cat: string]: `Q${number}`[] };

export type TilasSearchResponse = {
  athleteId: string;
  name: string;
  dateOfBirth: `${number}-${number}-${number}`;
  yearOfBirth: number;
  country: string; // IOC
  countryIso2: string;
  countryFull: string;
  minYear: number;
  maxYear: number;
  events: string[];
  classes: [];
};

export type AthleteId = `${'men' | 'women'}/${number}`;

export type TilasResult = {
  resultIndex: string;
  name: string;
  athleteId: AthleteId;
  records?: string[];
  country: string;
  countryFull: string;
  countryIso2: string;
  remarks?: string; // DQ IAAF Rule 32.2.a
  pos: string;
  result: string;
  personalBest?: 'PB';
  reaction?: string;
  qualified?: 'Q' | 'q';
  relays?: {
    athleteId: AthleteId;
    name: string;
    leg: string;
  }[];
};

export type MajorResult = {
  authorized: boolean;
  startDate: string;
  endDate: string;
  competitionId: string;
  competition: 'OG' | 'WC' | string;
  competitionLong: string; // '29th Olympic Games'
  venue: string;
  venueCountry: string;
  venueCountryFull: string;
  stadion: string;
  genders: {
    id: string;
    title: string;
    dates: { [d: string]: true };
    agegroups: {
      id: string;
      title: string;
      dates: { [d: string]: true };
      events: {
        id: string;
        title: string;
        dates: { [d: string]: true };
        rounds: {
          id: string;
          title: string | null;
          date: string;
          heats: {
            id: null;
            title: string | null;
            wind?: string;
            results: TilasResult[];
          }[];
        }[];
      }[];
    }[];
  }[];
};

export type GenderedBest = {
  [resultIndex: string]: {
    SB: string;
    SBDate: string;
    PB: string;
    PBDate: string;
  };
};

export type MeetBests =
  | {
      men: GenderedBest;
      women: GenderedBest;
    }
  | [];

export type CirrusResponse = {
  query: {
    search: { title: EntityId; snippet: string }[];
  };
};

export type WikitextResponse = {
  query: {
    pages: {
      [k: number]: {
        pageid: number;
        ns: number;
        title: string;
        revisions: {
          slots: {
            main: {
              contentmodel: 'wikitext';
              contentformat: 'text/x-wiki';
              '*': string;
            };
          };
        }[];
      };
    };
  };
};

export type WcResults = { [cid: string]: { results: MajorResult; bests: MeetBests } };
