import {Text, View} from 'react-native';
import {useTheme} from '../theme/provider';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
};

export function EmptyState({title, subtitle}: EmptyStateProps) {
  const {colors, typography} = useTheme();
  return (
    <View style={{paddingVertical: 22, alignItems: 'center', gap: 6}}>
      <Text style={[typography.h3, {color: colors.text}]}>{title}</Text>
      {subtitle ? <Text style={[typography.bodySm, {color: colors.textMuted, textAlign: 'center'}]}>{subtitle}</Text> : null}
    </View>
  );
}
