import {Text, View} from 'react-native';
import {Card} from './Card';
import {useTheme} from '../theme/provider';

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({label, value, hint}: StatCardProps) {
  const {colors, typography} = useTheme();
  return (
    <Card style={{gap: 6, flex: 1, minWidth: 120}}>
      <Text style={[typography.caption, {color: colors.textMuted}]}>{label}</Text>
      <Text style={[typography.h3, {color: colors.text}]}>{value}</Text>
      {hint ? <Text style={[typography.bodySm, {color: colors.textMuted}]}>{hint}</Text> : null}
    </Card>
  );
}
