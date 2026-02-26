import {useEffect, useState} from 'react';
import {Text, TextInput, View, type TextInputProps} from 'react-native';
import {useTheme} from '../theme/provider';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({label, error, style, value, onChangeText, onFocus, onBlur, ...rest}: InputProps) {
  const {colors, radius, typography} = useTheme();
  const externalValue = typeof value === 'string' ? value : String(value ?? '');
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(externalValue);

  useEffect(() => {
    if (!isFocused) setLocalValue(externalValue);
  }, [externalValue, isFocused]);

  function handleChangeText(next: string) {
    setLocalValue(next);
    onChangeText?.(next);
  }

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
        value={isFocused ? localValue : externalValue}
        onChangeText={handleChangeText}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
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
