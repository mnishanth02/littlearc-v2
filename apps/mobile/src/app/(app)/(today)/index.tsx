import React from 'react';
import { ScrollView, View } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { Typography } from '../../../components/ui/Typography';
import { RecordSummaryCard } from '../../../components/domain/RecordSummaryCard';
import { EmergencyCard } from '../../../components/domain/EmergencyCard';

export default function TodayScreen() {
  const { styles } = useStyles(stylesheet);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Typography role="screenTitle">Today</Typography>
        <Typography role="supportingText" color="secondary">
          Thursday, 18 July 2026
        </Typography>
      </View>

      {/* Emergency Shortcut (Always visible/pinned or conditional based on setting, here shown for demo) */}
      <View style={styles.section}>
        <EmergencyCard 
          childName="Aarav"
          bloodGroup="O+"
          allergies={['Amoxicillin']}
          contacts={[
            { relation: 'Mother', name: 'Priya Sharma', phone: '+91 98765 43210' },
            { relation: 'Pediatrician', name: 'Dr. Mehta', phone: '+91 11223 34455' }
          ]}
        />
      </View>

      {/* Actionable items */}
      <View style={styles.section}>
        <Typography role="sectionTitle" style={styles.sectionTitle}>Needs Attention</Typography>
        <RecordSummaryCard 
          title="Review Vaccination Record"
          subtitle="Extracted from Dr. Mehta's clinic document"
          date="2 hours ago"
          provenanceType="suggested"
          provenanceLabel="AI Suggested"
          syncStatus="pending"
        />
        <RecordSummaryCard 
          title="Overdue: 6 Month Checkup"
          subtitle="Scheduled window closed 3 days ago"
          date="Due: 15 July 2026"
          syncStatus="synced"
          // In a real app we'd pass a prop to style it overdue, or the component handles it
        />
      </View>

      {/* Upcoming / Handovers */}
      <View style={styles.section}>
        <Typography role="sectionTitle" style={styles.sectionTitle}>Upcoming</Typography>
        <RecordSummaryCard 
          title="Nanny Handover Notes"
          subtitle="Added feeding schedule instructions"
          date="Tomorrow, 8:00 AM"
          provenanceType="confirmed"
          provenanceLabel="Added by Co-parent"
        />
      </View>
    </ScrollView>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    padding: theme.layout.screenPadding,
    paddingTop: theme.spacing[16], // Accommodate safe area in real implementation
  },
  header: {
    marginBottom: theme.spacing[6],
  },
  section: {
    marginBottom: theme.spacing[8],
  },
  sectionTitle: {
    marginBottom: theme.spacing[4],
  }
}));
