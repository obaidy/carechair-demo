import {Text, TextInput, View, type TextInputProps} from 'react-native';
import {useTheme} from '../theme/provider';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({label, error, style, value, onChangeText, onFocus, onBlur, ...rest}: InputProps) {
  const {colors, radius, typography} = useTheme();
  const externalValue = typeof value === 'string' ? value : String(value ?? '');

  return (
    <View style={{gap: 6}}>
      {label ? <Text style={[typography.caption, {color: colors.textMuted}]}>{label}</Text> : null}
      <TextInput
        style={[
          {
            minHeight: 44,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            color: colors.text,
            ...typography.body
          },
          style
        ]}
        value={externalValue}
        onChangeText={onChangeText}
        onFocus={(event) => {
          onFocus?.(event);
        }}
        onBlur={(event) => {
          onBlur?.(event);
        }}
        selectionColor={colors.primary}
        underlineColorAndroid="transparent"
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
      {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{error}</Text> : null}
    </View>
  );
}
