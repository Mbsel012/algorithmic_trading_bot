import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { formatDateLabel, today } from '../../src/lib/dates.ts';
import { goalProgress, sortGoals, summariseGoals } from '../../src/lib/goals.ts';
import {
  Body,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Row,
  Screen,
  Spacer,
  StatTile,
  Txt,
} from '../../src/components/ui.tsx';
import { useApp } from '../../src/state/store.tsx';
import { spacing } from '../../src/theme/index.ts';

export default function GoalsScreen() {
  const router = useRouter();
  const { data, money } = useApp();
  const now = today();

  const goals = useMemo(() => sortGoals(data.goals.filter((g) => !g.archived), now), [data.goals, now]);
  const summary = useMemo(() => summariseGoals(data.goals, now), [data.goals, now]);

  return (
    <Screen edges={['bottom']}>
      <Body>
        {goals.length === 0 ? (
          <Card>
            <EmptyState
              icon="🎯"
              title="No goals yet"
              message="Name something you're saving for — an emergency fund, a trip, a new laptop — and watch it fill up."
              actionLabel="Create a goal"
              onAction={() => router.push('/goals/new')}
            />
          </Card>
        ) : (
          <>
            <Card>
              <Row>
                <StatTile label="Saved" value={money(summary.totalSaved)} tone="positive" />
                <StatTile label="Target" value={money(summary.totalTarget)} />
                <StatTile
                  label="Done"
                  value={`${summary.completedCount}/${summary.completedCount + summary.activeCount}`}
                  caption="goals reached"
                />
              </Row>
              <Spacer size={spacing.md} />
              <ProgressBar progress={summary.progress} />
            </Card>
            <Spacer />

            {goals.map((goal) => {
              const progress = goalProgress(goal, now);
              return (
                <Pressable key={goal.id} onPress={() => router.push(`/goals/${goal.id}`)}>
                  <Card style={{ marginBottom: spacing.md }}>
                    <Row justify="space-between">
                      <Row gap={spacing.sm} style={{ flex: 1 }}>
                        <Txt variant="heading">{goal.icon}</Txt>
                        <View style={{ flex: 1 }}>
                          <Txt variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
                            {goal.name}
                          </Txt>
                          <Txt variant="caption" tone="muted">
                            {money(progress.saved)} of {money(goal.targetAmount)}
                          </Txt>
                        </View>
                      </Row>
                      <Txt variant="label" tone={progress.complete ? 'positive' : 'muted'}>
                        {progress.complete ? 'Reached 🎉' : `${Math.round(progress.progress * 100)}%`}
                      </Txt>
                    </Row>
                    <Spacer size={spacing.md} />
                    <ProgressBar progress={progress.progress} color={goal.color} />
                    {goal.targetDate ? (
                      <Txt
                        variant="caption"
                        tone={progress.overdue ? 'negative' : 'faint'}
                        style={{ marginTop: 6 }}
                      >
                        {progress.complete
                          ? `Target was ${formatDateLabel(goal.targetDate, data.settings.locale)}`
                          : progress.overdue
                            ? `Target date passed — ${money(progress.remaining)} to go`
                            : `${money(progress.requiredPerMonth ?? 0)} a month to hit ${formatDateLabel(
                                goal.targetDate,
                                data.settings.locale
                              )}`}
                      </Txt>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}

        <Spacer />
        <Button label="New goal" onPress={() => router.push('/goals/new')} />
      </Body>
    </Screen>
  );
}
