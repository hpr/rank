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
