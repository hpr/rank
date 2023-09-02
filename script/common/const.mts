import WBK from 'wikibase-sdk';

export const FILE_MAJOR_RESULTS = './script/data/majorResults.json';
export const FILE_ERRORS = './script/data/errors.json';
export const FILE_WC_RESULTS = './script/data/wcResults.json';

export const absentQids = ['Q508060', 'Q437026', 'Q272854', 'Q272846', 'Q1339957'];

export const evtTitleToDiscipline = {
  '100m': '100m',
  '200m': '200m',
  '400m': '400m',
  '800m': '800m',
  '1500m': '1500m',
  '5000m': '5000m',
  '10,000m': '10000m',
  Marathon: 'marathon',
  '3000m Steeplechase': '3000mSt',
  '110m Hurdles': '110mh',
  '400m Hurdles': '400mh',
  'High Jump': 'high_jump',
  'Pole Vault': 'pole_vault',
  'Long Jump': 'long_jump',
  'Triple Jump': 'triple_jump',
  'Shot Put': 'shot_put',
  'Discus Throw': 'discus_throw',
  'Hammer Throw': 'hammer_throw',
  'Javelin Throw': 'javelin_throw',
  Decathlon: 'decathlon',
  '20km Race Walk': '20kmW',
  '50km Race Walk': '50kmW',
  '4 x 100m': undefined,
  '4 x 400m': undefined,
  '100m Hurdles': '100mh',
  Heptathlon: 'heptathlon',
  'Javelin Throw (Old Model)': undefined,
  '3000m': '3000m',
  '10km Race Walk': '10kmW',
  '4 x 400m Mixed relay': undefined,
  '10,000m Race Walk': undefined,
  '35km Race Walk': '35kmW',
};

export const wbk = WBK({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql',
});

export const WD = {
  P_TILAS_FEMALE: 'P3882',
  P_TILAS_MALE: 'P3884',
  P_DATE_OF_BIRTH: 'P569',
  P_OCCUPATION: 'P106',
  P_INSTANCE_OF: 'P31',
  P_SUBJECT_NAMED_AS: 'P1810',
  Q_HUMAN: 'Q5',
  Q_WHEELCHAIR_RACER: 'Q51536424',
};
