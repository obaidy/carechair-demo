import {Pressable, Text} from 'react-native';
import {useTheme} from '../theme/provider';

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function Chip({label, active, onPress}: ChipProps) {
  const {colors, radius, typography} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : colors.surface
      }}
    >
      <Text style={[typography.bodySm, {color: active ? colors.primary : colors.textMuted, fontWeight: '700'}]}>{label}</Text>
    </Pressable>
  );
}
