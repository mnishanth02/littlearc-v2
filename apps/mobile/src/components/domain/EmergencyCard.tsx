import React from 'react';
import { View } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';

interface EmergencyContact {
  relation: string;
  name: string;
  phone: string;
}

interface EmergencyCardProps {
  childName: string;
  bloodGroup: string;
  allergies: string[];
  contacts: EmergencyContact[];
  onActionPress?: () => void;
}

export function EmergencyCard({
  childName,
  bloodGroup,
  allergies,
  contacts,
  onActionPress
}: EmergencyCardProps) {
  const { styles } = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography role="screenTitle" color="primary">
          {childName}
        </Typography>
        <View style={styles.bloodBadge}>
          <Typography role="emergencyValue" color="inverse">
            {bloodGroup}
          </Typography>
        </View>
      </View>

      <View style={styles.section}>
        <Typography role="label" color="secondary" style={styles.sectionTitle}>
          Known Allergies
        </Typography>
        {allergies.length > 0 ? (
          allergies.map((allergy, idx) => (
            <Typography key={idx} role="body" color="statusOverdue">
              • {allergy}
            </Typography>
          ))
        ) : (
          <Typography role="body" color="primary">
            No known allergies confirmed.
          </Typography>
        )}
      </View>

      <View style={styles.section}>
        <Typography role="label" color="secondary" style={styles.sectionTitle}>
          Emergency Contacts
        </Typography>
        {contacts.map((contact, idx) => (
          <View key={idx} style={styles.contactRow}>
            <View>
              <Typography role="metadata" color="secondary">{contact.relation}</Typography>
              <Typography role="body" color="primary">{contact.name}</Typography>
            </View>
            <Typography role="numericOrDate" color="primary">{contact.phone}</Typography>
          </View>
        ))}
      </View>

      <View style={styles.actionContainer}>
         <Button 
           label="Share Emergency Info" 
           variant="primary" 
           onPress={onActionPress} 
         />
      </View>
    </View>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    backgroundColor: theme.colors.surface.raised,
    borderRadius: theme.radii.xl,
    padding: theme.spacing[5],
    borderWidth: 2,
    borderColor: theme.colors.status.attention,
    // Emphasize elevation for emergency card
    shadowColor: theme.colors.status.attention,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[6],
  },
  bloodBadge: {
    backgroundColor: theme.colors.status.overdue, // Reddish for medical urgency
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radii.md,
  },
  section: {
    marginBottom: theme.spacing[5],
  },
  sectionTitle: {
    marginBottom: theme.spacing[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  actionContainer: {
    marginTop: theme.spacing[2],
  }
}));
