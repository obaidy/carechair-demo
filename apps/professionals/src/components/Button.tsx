import {ActivityIndicator, Pressable, Text, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useTheme} from '../theme/provider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({title, variant = 'primary', loading, disabled, style, ...rest}: ButtonProps) {
  const {colors, radius, typography} = useTheme();

  const palette =
    variant === 'secondary'
      ? {bg: colors.surface, border: colors.border, text: colors.primary}
      : variant === 'ghost'
        ? {bg: 'transparent', border: 'transparent', text: colors.textMuted}
        : variant === 'danger'
          ? {bg: colors.danger, border: colors.danger, text: '#fff'}
          : {bg: colors.primary, border: colors.primary, text: '#fff'};

  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      disabled={isDisabled}
      style={({pressed}) => [
        {
          minHeight: 44,
          borderRadius: radius.md,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: palette.border,
          backgroundColor: palette.bg,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
          opacity: isDisabled ? 0.6 : pressed ? 0.9 : 1
        },
        style
      ]}
      {...rest}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#1B4FCB', '#2E6BFF', '#00B7FF']}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          }}
        />
      ) : null}
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={[typography.body, {color: palette.text, fontWeight: '700'}]}>{title}</Text>}
    </Pressable>
  );
}
