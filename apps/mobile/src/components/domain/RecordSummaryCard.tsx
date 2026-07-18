import React from 'react';
import { View, Pressable } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { Typography } from '../ui/Typography';
import { ProvenanceBadge, ProvenanceType } from './ProvenanceBadge';

export type SyncStatus = 'synced' | 'pending' | 'offline';

interface RecordSummaryCardProps {
  title: string;
  subtitle: string;
  date: string;
  provenanceType?: ProvenanceType;
  provenanceLabel?: string;
  syncStatus?: SyncStatus;
  onPress?: () => void;
}

export function RecordSummaryCard({
  title,
  subtitle,
  date,
  provenanceType,
  provenanceLabel,
  syncStatus = 'synced',
  onPress,
}: RecordSummaryCardProps) {
  const { styles } = useStyles(stylesheet);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <Typography role="recordTitle" color="primary">
          {title}
        </Typography>
        {syncStatus !== 'synced' && (
          <View style={styles.syncIndicator(syncStatus)} />
        )}
      </View>

      <Typography role="body" color="secondary" style={styles.subtitle}>
        {subtitle}
      </Typography>

      <View style={styles.footer}>
        <Typography role="metadata" color="secondary">
          {date}
        </Typography>
        
        {provenanceType && provenanceLabel && (
          <ProvenanceBadge type={provenanceType} label={provenanceLabel} />
        )}
      </View>
    </Pressable>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    backgroundColor: theme.colors.surface.raised,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[4],
    marginBottom: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    // Soft shadow for "archival warmth" and clear layout
    shadowColor: theme.colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: theme.colors.background.tertiary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[1],
  },
  subtitle: {
    marginBottom: theme.spacing[3],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  syncIndicator: (status: SyncStatus) => ({
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: status === 'pending' 
      ? theme.colors.status.pending 
      : theme.colors.status.offline,
  }),
}));
