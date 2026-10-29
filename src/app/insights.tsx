import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { rewardLabel, type ChallengeStatus } from '@/lib/challenges';
import { computeInsights } from '@/lib/insights';
import { startChallenge } from '@/lib/user-data';

export default function InsightsScreen() {
  const { library, data, challenges } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const insights = computeInsights(library.items, data.openDays);
  const maxDay = Math.max(1, ...insights.week.map((d) => d.count));
  const maxHeat = Math.max(1, ...insights.heatmap.map((d) => d.count));
  const completed = challenges.filter((c) => c.state === 'completed');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar title="Insights & challenges" leading="back" />
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              THIS WEEK
            </ThemedText>
            <ThemedText style={styles.headline}>{insights.headline}</ThemedText>
            <View style={styles.bars}>
              {insights.week.map((day) => (
                <View key={day.key} style={styles.barColumn}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {day.count || ''}
                  </ThemedText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${(day.count / maxDay) * 100}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {day.label}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              CONSISTENCY & MEMORIES
            </ThemedText>
            <View style={styles.streaks}>
              <Stat value={insights.captureStreak} label="day capture streak" style={styles.streak} />
              <Stat value={insights.openStreak} label="day app streak" style={styles.streak} />
              <Stat value={insights.activeDays} label="active days (12 wks)" style={styles.streak} />
            </View>
            <View style={styles.heatmap}>
              {Array.from({ length: 12 }, (_, week) => (
                <View key={week} style={styles.heatColumn}>
                  {insights.heatmap.slice(week * 7, week * 7 + 7).map((day) => (
                    <View
                      key={day.key}
                      style={[
                        styles.heatCell,
                        {
                          backgroundColor: day.count ? accent : theme.backgroundSelected,
                          opacity: day.count ? 0.35 + 0.65 * (day.count / maxHeat) : 1,
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold" themeColor="textSecondary">
              LIBRARY
            </ThemedText>
            <View style={styles.statGrid}>
              <Stat value={insights.counts.photos} label="photos" />
              <Stat value={insights.counts.videos} label="videos" />
              <Stat value={insights.counts.live} label="live photos" />
              <Stat value={insights.counts.bursts} label="bursts" />
              <Stat value={insights.counts.screenshots} label="screenshots" />
              <Stat value={`${insights.cleanliness}%`} label="tidy score" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {insights.clutter > 0
                ? `${insights.clutter} screenshots and extra burst frames could be cleaned up.`
                : 'Your library is spotless. No screenshots or extra burst frames.'}
            </ThemedText>
          </Card>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            CHALLENGES
          </ThemedText>
          {challenges.map((status) => (
            <ChallengeCard key={status.challenge.id} status={status} accent={accent} />
          ))}

          {completed.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                BADGES
              </ThemedText>
              <View style={styles.badges}>
                {completed.map(({ challenge }) => (
                  <View key={challenge.id} style={styles.badge}>
                    <View style={[styles.badgeIcon, { backgroundColor: accent }]}>
                      <Icon {...challenge.icon} color="#fff" />
                    </View>
                    <ThemedText type="small" numberOfLines={2} style={styles.badgeLabel}>
                      {challenge.title}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {children}
    </ThemedView>
  );
}

function Stat({ value, label, style }: { value: number | string; label: string; style?: ViewStyle }) {
  return (
    <View style={[styles.stat, style]}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function ChallengeCard({ status, accent }: { status: ChallengeStatus; accent: string }) {
  const theme = useTheme();
  const { challenge, state, progress, daysLeft } = status;
  const canStart = state === 'available' || state === 'expired';

  return (
    <Card>
      <View style={styles.challengeRow}>
        <View style={[styles.badgeIcon, { backgroundColor: state === 'completed' ? accent : theme.backgroundSelected }]}>
          <Icon {...challenge.icon} color={state === 'completed' ? '#fff' : theme.text} />
        </View>
        <View style={styles.challengeText}>
          <ThemedText type="smallBold">{challenge.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {challenge.description}
          </ThemedText>
          <ThemedText type="small" style={{ color: accent }}>
            Reward: {rewardLabel(challenge.reward)}
          </ThemedText>
        </View>
      </View>

      {state === 'active' && (
        <>
          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${(progress / challenge.goal) * 100}%`, backgroundColor: accent },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {progress} / {challenge.goal} · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
          </ThemedText>
        </>
      )}
      {state === 'completed' && (
        <ThemedText type="smallBold" style={{ color: accent }}>
          Completed ✓
        </ThemedText>
      )}
      {canStart && (
        <Pressable
          onPress={() => {
            startChallenge(challenge.id);
          }}
          style={({ pressed }) => [styles.startButton, { borderColor: accent }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: accent }}>
            {state === 'expired' ? 'Time’s up. Try again' : `Start · ${challenge.durationDays} days`}
          </ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  headline: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
  },
  bars: {
    flexDirection: 'row',
    gap: Spacing.two,
    height: 140,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 3,
    borderRadius: Spacing.one,
  },
  streaks: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  // Equal thirds, so long labels wrap instead of running into the next one.
  streak: {
    flex: 1,
    minWidth: 0,
  },
  heatmap: {
    flexDirection: 'row',
    gap: 3,
  },
  heatColumn: {
    flex: 1,
    gap: 3,
  },
  heatCell: {
    aspectRatio: 1,
    borderRadius: 3,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  stat: {
    minWidth: '33%',
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  sectionTitle: {
    marginTop: Spacing.two,
  },
  challengeRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  challengeText: {
    flex: 1,
    gap: Spacing.half,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  startButton: {
    borderWidth: 1.5,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  badge: {
    width: 80,
    alignItems: 'center',
    gap: Spacing.one,
  },
  badgeLabel: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
