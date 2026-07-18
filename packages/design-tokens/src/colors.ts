export const palette = {
  warmGray: {
    50: '#F9F8F7',
    100: '#F2EFEA',
    200: '#E5E0D8',
    300: '#D5CFC4',
    400: '#B8B2A7',
    500: '#9C968A',
    600: '#7F796E',
    700: '#635E54',
    800: '#48443D',
    900: '#302C27',
    950: '#1D1A17',
  },
  sage: {
    50: '#F4F7F4',
    100: '#E4EDE5',
    200: '#C9DEC9',
    300: '#A3C7A5',
    400: '#7BAA7E',
    500: '#5A8E5E',
    600: '#437146',
    700: '#355938',
    800: '#2A462D',
    900: '#233A25',
  },
  terracotta: {
    50: '#FEF6F5',
    100: '#FDEDED',
    200: '#FAD4D2',
    300: '#F5B0AC',
    400: '#EE837C',
    500: '#E2554C',
    600: '#CB3A31',
    700: '#A92D26',
    800: '#8D2923',
    900: '#752722',
  },
  amber: {
    50: '#FFF9EB',
    100: '#FFF0C6',
    200: '#FFE08A',
    300: '#FFC84B',
    400: '#FFB018',
    500: '#F59600',
    600: '#D97700',
    700: '#B45700',
    800: '#924300',
    900: '#7A3800',
  },
  blue: {
    50: '#F0F5FF',
    100: '#E0EBFF',
    200: '#C7DAFF',
    300: '#A1C3FF',
    400: '#75A3FF',
    500: '#4D80FF',
    600: '#2957E6',
    700: '#1A3FBC',
    800: '#173499',
    900: '#182E7A',
  },
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const lightColors = {
  // Base
  background: {
    primary: palette.warmGray[50],
    secondary: palette.white,
    tertiary: palette.warmGray[100],
  },
  surface: {
    raised: palette.white,
    sunken: palette.warmGray[100],
  },
  text: {
    primary: palette.warmGray[950],
    secondary: palette.warmGray[600],
    inverse: palette.white,
    disabled: palette.warmGray[400],
  },
  action: {
    primary: palette.warmGray[900],
    primaryPressed: palette.warmGray[950],
    secondary: palette.warmGray[200],
    secondaryPressed: palette.warmGray[300],
    disabled: palette.warmGray[200],
  },
  border: {
    subtle: palette.warmGray[200],
    strong: palette.warmGray[400],
    focus: palette.blue[500],
  },

  // Semantic / Domain
  status: {
    attention: palette.amber[500], // e.g., something needs a look but not urgent
    overdue: palette.terracotta[600], // Urgency, missing requirement
    completed: palette.sage[600],
    pending: palette.amber[600],
    offline: palette.warmGray[500],
  },
  record: {
    confirmed: palette.sage[100], // subtle background for confirmed
    suggested: palette.amber[50], // subtle background for AI/OCR suggestion
    verified: palette.blue[50],   // subtle background for provider-verified
  },
  privacy: {
    sensitive: palette.terracotta[50],
  }
};

export const darkColors = {
  // Base
  background: {
    primary: palette.warmGray[950],
    secondary: palette.warmGray[900],
    tertiary: palette.warmGray[800],
  },
  surface: {
    raised: palette.warmGray[800],
    sunken: palette.black,
  },
  text: {
    primary: palette.warmGray[50],
    secondary: palette.warmGray[300],
    inverse: palette.warmGray[950],
    disabled: palette.warmGray[600],
  },
  action: {
    primary: palette.white,
    primaryPressed: palette.warmGray[100],
    secondary: palette.warmGray[700],
    secondaryPressed: palette.warmGray[600],
    disabled: palette.warmGray[800],
  },
  border: {
    subtle: palette.warmGray[800],
    strong: palette.warmGray[600],
    focus: palette.blue[400],
  },

  // Semantic / Domain
  status: {
    attention: palette.amber[400],
    overdue: palette.terracotta[400],
    completed: palette.sage[400],
    pending: palette.amber[400],
    offline: palette.warmGray[400],
  },
  record: {
    confirmed: palette.sage[900], 
    suggested: palette.amber[900], 
    verified: palette.blue[900],   
  },
  privacy: {
    sensitive: palette.terracotta[900],
  }
};

export const highContrastColors = {
  // Example for HC: Use pure blacks/whites, thicker borders, highly distinct semantic colors
  ...lightColors,
  background: {
    primary: palette.white,
    secondary: palette.white,
    tertiary: palette.white,
  },
  text: {
    primary: palette.black,
    secondary: palette.black,
    inverse: palette.white,
    disabled: palette.warmGray[700],
  },
  border: {
    subtle: palette.black,
    strong: palette.black,
    focus: palette.blue[700],
  },
};
