import React from 'react';
import { Text, TextProps } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { typography } from '@littlearc/design-tokens';

type TypographyRole = keyof typeof typography;

interface TypographyProps extends TextProps {
  role?: TypographyRole;
  color?: 'primary' | 'secondary' | 'inverse' | 'disabled' | 'statusAttention' | 'statusOverdue' | 'statusCompleted';
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

export function Typography({ 
  role = 'body', 
  color = 'primary', 
  align = 'left',
  style, 
  children, 
  ...props 
}: TypographyProps) {
  const { styles } = useStyles(stylesheet);
  
  return (
    <Text 
      style={[
        styles.role(role),
        styles.color(color),
        styles.align(align),
        style
      ]} 
      {...props}
    >
      {children}
    </Text>
  );
}

const stylesheet = createStyleSheet(theme => ({
  role: (role: TypographyRole) => theme.typography[role],
  align: (align: 'left' | 'center' | 'right') => ({
    textAlign: align,
  }),
  color: (color: string) => {
    switch (color) {
      case 'primary': return { color: theme.colors.text.primary };
      case 'secondary': return { color: theme.colors.text.secondary };
      case 'inverse': return { color: theme.colors.text.inverse };
      case 'disabled': return { color: theme.colors.text.disabled };
      case 'statusAttention': return { color: theme.colors.status.attention };
      case 'statusOverdue': return { color: theme.colors.status.overdue };
      case 'statusCompleted': return { color: theme.colors.status.completed };
      default: return { color: theme.colors.text.primary };
    }
  },
}));
