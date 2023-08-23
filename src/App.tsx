import { Avatar, Button, Group, Paper, Stack, Table, Text, ActionIcon, Select, CopyButton, Alert } from '@mantine/core';
import React, { useEffect, useState } from 'react';
import { AthleteAutocomplete } from './AthleteAutocomplete';
import { AthleteInfo, CompetitorBasicInfo } from './types';
import { competitorBasicInfo, getAvatarUrl, normalize } from './util';
import { InfoCircle, Trash } from 'tabler-icons-react';
import { MAX_ATHLETES, SERVER_URL, commonDisciplines } from './const';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { modals } from '@mantine/modals';

export default function App() {
  const [athleteIds, setAthleteIds] = useState<string[]>([]);
  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo>({});
  const [urlAthleteInfo, setUrlAthleteInfo] = useState<AthleteInfo>({});
  const [athleteBasicInfo, setAthleteBasicInfo] = useState<{ [id: string]: CompetitorBasicInfo }>({});
  const [athleteYears, setAthleteYears] = useState<{ [id: string]: string }>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [isSnapshot, setIsSnapshot] = useState<boolean>(false);
  const [snapshotParams, setSnapshotParams] = useState<{
    athleteYears: { [id: string]: string };
    athleteIds: string[];
    discipline: string;
    athleteInfo: AthleteInfo;
    athleteBasicInfo: { [id: string]: CompetitorBasicInfo };
  } | null>(null);

  const isReady = !!(athleteIds.length && discipline && athleteIds.every((aid) => athleteYears[aid]));

  const gender: 'Men' | 'Women' | undefined = athleteInfo[athleteIds.find((aid) => athleteInfo[aid]?.gender)!]?.gender;

  const combinedAthleteInfo = { ...urlAthleteInfo, ...athleteInfo };

  useEffect(() => {
    if (window.location.hash) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const athleteYears = JSON.parse(params.get('athleteYears') ?? '{}');
      const athleteIds = JSON.parse(params.get('athleteIds') ?? '[]');
      const discipline = params.get('discipline');
      const athleteInfo = JSON.parse(params.get('athleteInfo') ?? '{}');
      const athleteBasicInfo = JSON.parse(params.get('athleteBasicInfo') ?? '{}');
      const response = window.atob(params.get('response') ?? '');
      setAthleteYears(athleteYears);
      setAthleteIds(athleteIds);
      setDiscipline(discipline);
      setAthleteBasicInfo(athleteBasicInfo);
      setResponse(response);
      setUrlAthleteInfo(athleteInfo);
      setIsSnapshot(true);
      setSnapshotParams({ athleteYears, athleteIds, discipline: discipline!, athleteInfo, athleteBasicInfo });
    }
  }, []);

  return (
    <Stack justify="center" align="center">
      {isSnapshot && (
        <Alert mt="xl" mb={-10} icon={<InfoCircle size="1rem" />} title="Snapshot Mode" color="blue" withCloseButton onClose={() => setIsSnapshot(false)}>
          You're viewing a snapshot from a previously shared prediction. Edit the parameters below to have TrackBot predict your own match races.
        </Alert>
      )}
      <Paper withBorder m="xl" p="md" mb="xs">
        <Stack justify="center" align="center">
          <Group position="center">
            <AthleteAutocomplete
              gender={gender}
              addAthlete={async (id) => {
                if (!athleteIds.includes(id)) {
                  setAthleteIds([...athleteIds, id]);
                  const basicInfo = await competitorBasicInfo(id);
                  const activeYears = basicInfo.resultsByYear.activeYears;
                  setAthleteYears({ ...athleteYears, [id]: activeYears[0] });
                  setAthleteBasicInfo({ ...athleteBasicInfo, [id]: basicInfo });
                }
              }}
              disabled={athleteIds.length >= MAX_ATHLETES}
              athleteInfo={athleteInfo}
              setAthleteInfo={setAthleteInfo}
            />
          </Group>
          <Paper withBorder m="sm" mb={0} p="md" sx={{ width: '100%' }}>
            {athleteIds.length ? (
              <Table verticalSpacing="md">
                <tbody>
                  {athleteIds.map((aid) => {
                    const { givenName, familyName, aaAthleteId, disciplines } = combinedAthleteInfo[aid];
                    const shortDisciplines = disciplines?.split(', ').slice(0, 2).join(', ');
                    const activeYears = athleteBasicInfo[aid]?.resultsByYear?.activeYears;
                    return (
                      <tr key={aaAthleteId}>
                        <td>
                          <Group spacing="sm">
                            <Avatar size={40} src={getAvatarUrl(aaAthleteId)} radius={40}>
                              {givenName?.[0]}
                              {familyName?.[0]}
                            </Avatar>
                            <div>
                              <Text fz="sm" fw={500}>
                                {givenName} {familyName}
                              </Text>
                              <Text c="dimmed" fz="xs">
                                {shortDisciplines}
                              </Text>
                            </div>
                          </Group>
                        </td>
                        <td style={{ width: 110 }}>
                          {activeYears ? (
                            <Select data={activeYears} value={athleteYears[aid]} onChange={(y) => y && setAthleteYears({ ...athleteYears, [aid]: y })} />
                          ) : (
                            'Loading...'
                          )}
                        </td>
                        <td>
                          <Group spacing={0} position="right">
                            <ActionIcon onClick={() => setAthleteIds(athleteIds.filter((id) => id !== aid))}>
                              <Trash />
                            </ActionIcon>
                          </Group>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <Text italic style={{ textAlign: 'center' }}>
                Add athletes of the same gender / event category above...
              </Text>
            )}
          </Paper>
          <Select label="Race Distance?" searchable data={commonDisciplines} value={discipline} onChange={setDiscipline} />
          <Button
            color="green"
            size="lg"
            loading={isGenerating}
            disabled={!isReady || isGenerating}
            onClick={async () => {
              setIsSnapshot(false);
              setIsGenerating(true);
              setResponse(null);
              setSnapshotParams({
                athleteIds,
                athleteYears,
                discipline: discipline!,
                athleteInfo: Object.fromEntries(athleteIds.map((aid) => [aid, combinedAthleteInfo[aid]])),
                athleteBasicInfo: Object.fromEntries(athleteIds.map((aid) => [aid, athleteBasicInfo[aid]])),
              });
              try {
                const { response } = await (
                  await fetch(SERVER_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                      athletes: athleteIds.map((id) => ({ id, year: athleteYears[id] })),
                      discipline,
                      gender,
                    }),
                  })
                ).json();
                setResponse(normalize(response));
                setIsGenerating(false);
              } catch (err) {
                setIsGenerating(false);
                modals.openConfirmModal({
                  title: 'Error',
                  children: (
                    <Text>
                      There was an error with your request. The prediction model can be inconsistent, so try again or try using less athletes? Error Details:{' '}
                      {JSON.stringify(err)}
                    </Text>
                  ),
                  labels: { confirm: 'Confirm', cancel: 'Cancel' },
                  cancelProps: { style: { display: 'none' } },
                });
              }
            }}
          >
            {isGenerating ? 'Generating... (takes 1-2 minutes)' : 'Generate Prediction'}
          </Button>
        </Stack>
      </Paper>
      {response && (
        <Paper withBorder m="xl" p="md" mt="xs">
          <Stack align="center">
            <CopyButton
              value={normalize(
                window.location.origin +
                  window.location.pathname +
                  '#' +
                  new URLSearchParams({
                    athleteIds: JSON.stringify(snapshotParams?.athleteIds),
                    athleteYears: JSON.stringify(snapshotParams?.athleteYears),
                    athleteInfo: JSON.stringify(snapshotParams?.athleteInfo),
                    athleteBasicInfo: JSON.stringify(snapshotParams?.athleteBasicInfo),
                    discipline: snapshotParams?.discipline!,
                    response: window.btoa(response),
                  })
              )}
            >
              {({ copied, copy }) => (
                <Button mb={-10} size="sm" color={copied ? 'teal' : 'blue'} onClick={copy}>
                  {copied ? 'Preview link copied to clipboard' : 'Share link to preview'}
                </Button>
              )}
            </CopyButton>
            <div>
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          </Stack>
        </Paper>
      )}
      <Text italic>
        Contact: <a href="mailto:habs@sdf.org">habs@sdf.org</a> <span style={{ fontStyle: 'normal' }}>|</span>{' '}
        <a href="https://github.com/hpr/match">Source Code</a>
      </Text>
    </Stack>
  );
}
