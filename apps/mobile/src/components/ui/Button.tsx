import React from 'react';
import { Pressable, PressableProps, ActivityIndicator, View } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { Typography } from './Typography';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export function Button({ 
  label, 
  variant = 'primary', 
  isLoading = false, 
  disabled,
  leftIcon,
  ...props 
}: ButtonProps) {
  const { styles, theme } = useStyles(stylesheet);
  
  const isDisabled = disabled || isLoading;

  // Determine text color for the button
  const getTextColor = () => {
    if (isDisabled) return 'disabled';
    if (variant === 'primary' || variant === 'destructive') return 'inverse';
    if (variant === 'secondary' || variant === 'outline' || variant === 'ghost') return 'primary';
    return 'primary';
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container(variant, isDisabled),
        pressed && !isDisabled && styles.pressed(variant),
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      {...props}
    >
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator 
            color={variant === 'primary' || variant === 'destructive' ? theme.colors.text.inverse : theme.colors.text.primary} 
            size="small" 
          />
        ) : (
          <>
            {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
            <Typography role="buttonLabel" color={getTextColor()} align="center">
              {label}
            </Typography>
          </>
        )}
      </View>
    </Pressable>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: (variant: string, disabled: boolean) => ({
    minHeight: theme.touchTargets.min,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    opacity: disabled ? 0.6 : 1,
    ...getVariantStyles(variant, theme),
  }),
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: theme.spacing[2],
  },
  pressed: (variant: string) => ({
    ...getPressedStyles(variant, theme),
  })
}));

function getVariantStyles(variant: string, theme: any) {
  switch (variant) {
    case 'primary':
      return { backgroundColor: theme.colors.action.primary };
    case 'secondary':
      return { backgroundColor: theme.colors.action.secondary };
    case 'outline':
      return { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border.strong };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'destructive':
      return { backgroundColor: theme.colors.status.overdue };
    default:
      return { backgroundColor: theme.colors.action.primary };
  }
}

function getPressedStyles(variant: string, theme: any) {
  switch (variant) {
    case 'primary':
      return { backgroundColor: theme.colors.action.primaryPressed };
    case 'secondary':
      return { backgroundColor: theme.colors.action.secondaryPressed };
    case 'outline':
    case 'ghost':
      return { backgroundColor: theme.colors.action.secondary };
    case 'destructive':
      return { opacity: 0.8 };
    default:
      return { backgroundColor: theme.colors.action.primaryPressed };
  }
}
