import {View, type ViewProps} from 'react-native';
import {useTheme} from '../theme/provider';

export function Card({style, ...rest}: ViewProps) {
  const {colors, radius} = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: {width: 0, height: 2},
          elevation: 2
        },
        style
      ]}
      {...rest}
    />
  );
}
