import { Platform, type ViewStyle } from 'react-native';

type Direction = 'ltr' | 'rtl';

/**
 * Fixes a subtree's layout direction (e.g. a slider stays left-to-right in Arabic). Native
 * takes the `direction` style; React Native Web rejects that style and takes the `dir`
 * attribute instead, so a view gets both: `<View {...dirProps('ltr')} style={[…, dirStyle('ltr')]}>`.
 */
export const dirStyle = (direction: Direction): ViewStyle | null =>
  Platform.OS === 'web' ? null : { direction };

export const dirProps = (direction: Direction): object => (Platform.OS === 'web' ? { dir: direction } : {});
