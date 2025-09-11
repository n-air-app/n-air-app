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
] as const;

export type CommentPosition = (typeof COMMENT_POSITIONS)[number];
export type CommentSize = (typeof COMMENT_SIZES)[number];
export type CommentFont = (typeof COMMENT_FONTS)[number];
export type CommentColor = (typeof COMMENT_COLORS)[number];
