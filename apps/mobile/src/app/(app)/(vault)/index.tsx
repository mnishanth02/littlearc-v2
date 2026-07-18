import React from 'react';
import { View, TextInput, FlatList } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { Typography } from '../../../components/ui/Typography';
import { RecordSummaryCard } from '../../../components/domain/RecordSummaryCard';

const mockVaultData = [
  { id: '1', title: 'Birth Certificate', subtitle: 'Municipal Corporation', date: '12 Jan 2026', type: 'verified' as const, sync: 'synced' as const },
  { id: '2', title: 'Discharge Summary', subtitle: 'City Hospital', date: '14 Jan 2026', type: 'confirmed' as const, sync: 'offline' as const },
  { id: '3', title: 'Prescription', subtitle: 'Fever & Cold', date: '10 May 2026', type: 'suggested' as const, sync: 'pending' as const },
];

export default function VaultScreen() {
  const { styles, theme } = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography role="screenTitle">Vault</Typography>
      </View>

      <View style={styles.searchContainer}>
        <TextInput 
          style={styles.searchInput}
          placeholder="Search records, doctors, or dates..."
          placeholderTextColor={theme.colors.text.disabled}
        />
      </View>

      <FlatList 
        data={mockVaultData}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <RecordSummaryCard 
            title={item.title}
            subtitle={item.subtitle}
            date={item.date}
            provenanceType={item.type}
            provenanceLabel={
              item.type === 'verified' ? 'Provider Verified' : 
              item.type === 'suggested' ? 'AI Extracted' : 'Parent Confirmed'
            }
            syncStatus={item.sync}
          />
        )}
      />
    </View>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing[16],
    marginBottom: theme.spacing[4],
  },
  searchContainer: {
    paddingHorizontal: theme.layout.screenPadding,
    marginBottom: theme.spacing[4],
  },
  searchInput: {
    backgroundColor: theme.colors.surface.raised,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
  },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing[8],
  }
}));
