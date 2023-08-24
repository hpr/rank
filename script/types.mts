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

export type MajorResult = {
  genders: {
    agegroups: {
      events: {
        // 4 x 100 = 56000
        // 4 x 400 = 58000
        // 4 x 400 Mixed = 58100
        id: string;
        title: string;
        rounds: {
          id: string;
          title: string | null;
          heats: {
            id: null;
            title: string | null;
            results: {
              resultIndex: string;
              athleteId: AthleteId;
              country: string;
              pos: string;
              result: string;
              relays?: {
                athleteId: AthleteId;
                name: string;
                leg: string;
              }[];
            }[];
          }[];
        }[];
      }[];
    }[];
  }[];
};
