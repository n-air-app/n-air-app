export const COMMENT_POSITIONS = ['naka', 'ue', 'shita'] as const;
export const COMMENT_SIZES = ['big', 'medium', 'small'] as const;
export const COMMENT_FONTS = ['defont', 'gothic', 'mincho'] as const;
export const COMMENT_COLORS = [
  'white',
  'red',
  'pink',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'black',
  'white2',
  'red2',
  'pink2',
  'orange2',
  'yellow2',
  'green2',
  'cyan2',
  'blue2',
  'purple2',
  'black2',
] as const;

export type CommentPosition = (typeof COMMENT_POSITIONS)[number];
export type CommentSize = (typeof COMMENT_SIZES)[number];
export type CommentFont = (typeof COMMENT_FONTS)[number];
export type CommentColor = (typeof COMMENT_COLORS)[number];
