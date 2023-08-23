export type SearchCompetitor = {
  aaAthleteId: string;
  familyName: string;
  givenName: string;
  birthDate: string;
  disciplines: string;
  iaafId: number;
  gender: 'Men' | 'Women';
  country: string; // IOC code
  urlSlug: string;
  __typename: 'AthleteSearchResult';
};

export type CompetitorBasicInfo = {
  resultsByYear: {
    activeYears: string[];
  };
};

export type AthleteInfo = {
  [id: string]:  SearchCompetitor;
};

export type ResultsByYearResult = {
  date: string;
  venue: string;
  place: string;
  mark: string;
  wind: string;
  notLegal: boolean;
};

export type Competitor = {
  basicData: {
    firstName: string;
    lastName: string;
    birthDate: string;
    iaafId: string;
    aaId: string;
  };
  personalBests: {
    results: {
      indoor: boolean;
      discipline: string;
      mark: string;
      notLegal: boolean;
      venue: string;
      date: string;
      resultScore: number;
    }[];
  };
  resultsByYear: {
    activeYears: string[];
    resultsByEvent: {
      indoor: boolean;
      discipline: string;
      results: ResultsByYearResult[];
    }[];
  };
};
