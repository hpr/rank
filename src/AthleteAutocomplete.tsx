import { Autocomplete, Avatar, Button, Group, SelectItemProps, Text } from '@mantine/core';
import { forwardRef, useEffect, useState } from 'react';
import { AthleteInfo, SearchCompetitor } from './types';
import { useDebouncedValue } from '@mantine/hooks';
import { getAvatarUrl, searchCompetitors } from './util';

interface ItemProps extends SelectItemProps {
  athlete: SearchCompetitor;
}

const AutoCompleteItem = forwardRef<HTMLDivElement, ItemProps>(({ athlete, ...others }: ItemProps, ref) => {
  const { givenName, familyName, disciplines, aaAthleteId } = athlete;
  const shortDisciplines = disciplines.split(', ').slice(0, 2).join(', ');
  return (
    <div ref={ref} {...others}>
      <Group noWrap>
        <Avatar src={getAvatarUrl(aaAthleteId)}>
          {givenName[0]}
          {familyName[0]}
        </Avatar>
        <div>
          <Text>
            {givenName} {familyName}
          </Text>
          <Text size="xs" color="dimmed">
            {shortDisciplines}
          </Text>
        </div>
      </Group>
    </div>
  );
});

export const AthleteAutocomplete = ({
  gender = undefined,
  addAthlete,
  disabled = false,
  athleteInfo = {},
  setAthleteInfo = () => {},
}: {
  gender: 'Men' | 'Women' | undefined;
  addAthlete: (id: string) => void;
  disabled: boolean;
  athleteInfo: AthleteInfo;
  setAthleteInfo: (athleteInfo: AthleteInfo) => void;
}) => {
  const [athlete, setAthlete] = useState<string>('');
  const [debouncedAthlete] = useDebouncedValue(athlete, 500);
  const [cachedResults, setCachedResults] = useState<{ [k: string]: SearchCompetitor[] }>({});
  useEffect(() => {
    (async () => {
      const results = cachedResults[athlete] ?? (await searchCompetitors(debouncedAthlete));
      setCachedResults({ ...cachedResults, [athlete]: results });
      setAthleteInfo({
        ...athleteInfo,
        ...Object.fromEntries(results.map((res) => [res.aaAthleteId, res])),
      });
      setResults(results);
    })();
  }, [debouncedAthlete]);
  const [results, setResults] = useState<SearchCompetitor[]>([]);
  const data = results.map((athlete) => ({ value: `${athlete.givenName} ${athlete.familyName} #${athlete.aaAthleteId}`, athlete }));

  return (
    <Autocomplete
      disabled={disabled}
      sx={{ width: '100%', minWidth: 300 }}
      filter={(_, item) => {
        const athlete = item.athlete as SearchCompetitor;
        if (athlete.gender && gender) {
          return athlete.gender === gender;
        }
        return true;
      }}
      label="Add athlete"
      placeholder="e.g. Fred Kerley"
      data={data}
      value={athlete}
      onChange={setAthlete}
      itemComponent={AutoCompleteItem}
      rightSection={
        <Button
          disabled={disabled}
          onClick={() => {
            const parts = athlete.split('#');
            const id = parts.at(-1);
            if (parts.length === 2 && id) {
              addAthlete(id);
              setAthlete('');
            }
          }}
        >
          Add
        </Button>
      }
    />
  );
};
