import React from 'react';
import { View } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { Typography } from '../ui/Typography';

export type ProvenanceType = 'confirmed' | 'suggested' | 'verified';

interface ProvenanceBadgeProps {
  type: ProvenanceType;
  label: string;
}

export function ProvenanceBadge({ type, label }: ProvenanceBadgeProps) {
  const { styles } = useStyles(stylesheet);

  return (
    <View style={styles.container(type)}>
      <Typography role="metadata" color={getTextColor(type)}>
        {label}
      </Typography>
    </View>
  );
}

function getTextColor(type: ProvenanceType) {
  switch (type) {
    case 'confirmed': return 'statusCompleted';
    case 'suggested': return 'statusAttention';
    case 'verified': return 'primary'; // Or maybe a specific blue text color if added
    default: return 'secondary';
  }
}

const stylesheet = createStyleSheet(theme => ({
  container: (type: ProvenanceType) => ({
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.record[type],
    borderWidth: 1,
    borderColor: type === 'suggested' ? theme.colors.status.attention : 'transparent',
  }),
}));
