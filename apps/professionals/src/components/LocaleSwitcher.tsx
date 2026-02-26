import {Pressable, Text, View} from 'react-native';
import {SUPPORTED_LOCALES, type LocaleCode} from '../i18n';
import {styles} from '../styles';

export function LocaleSwitcher({
  locale,
  onChange,
  rtl
}: {
  locale: LocaleCode;
  onChange: (locale: LocaleCode) => void;
  rtl: boolean;
}) {
  return (
    <View style={[styles.localeRow, rtl && styles.rowRtl]}>
      {SUPPORTED_LOCALES.map((entry) => (
        <Pressable
          key={entry}
          style={[styles.localeChip, locale === entry && styles.localeChipActive]}
          onPress={() => onChange(entry)}
        >
          <Text style={[styles.localeChipText, locale === entry && styles.localeChipTextActive]}>{entry.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}
